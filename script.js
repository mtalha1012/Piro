// DOM Elements
const repoForm = document.getElementById('repoForm');
const repoUrlInput = document.getElementById('repoUrl');
const statusMessage = document.getElementById('statusMessage');
const selectionUI = document.getElementById('selectionUI');
const treeContainer = document.getElementById('treeContainer');
const generateBtn = document.getElementById('generateBtn');
const selectionMode = document.getElementById('selectionMode');
const selectAllBtn = document.getElementById('selectAllBtn');
const progressContainer = document.getElementById('progressContainer');
const progressCount = document.getElementById('progressCount');
const progressBarFill = document.getElementById('progressBarFill');
const progressStateText = document.getElementById('progressStateText');

// Constants ported from Python
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
const BINARY_EXTENSIONS = [
    '.mp4', '.mp3', '.wav', '.ogg', '.flac', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.o', '.obj',
    '.ttf', '.woff', '.woff2', '.eot'
];

let repoData = { owner: '', repo: '', branch: '' };
let allFiles = [];
let lastCheckedNode = null;

// Utility to check file types
const isImage = (path) => IMAGE_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
const isBinary = (path) => BINARY_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));

function parseGitHubUrl(url) {
    try {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.replace(/^\/|\/$/g, '').split('/');
        if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
        throw new Error("Invalid format");
    } catch (e) {
        throw new Error("Please enter a valid GitHub repository URL.");
    }
}

// -----------------------------------------
// PHASE 1: Fetch and Render Tree
// -----------------------------------------
repoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoadingState('fetch', true);
    
    try {
        const { owner, repo } = parseGitHubUrl(repoUrlInput.value);
        repoData.owner = owner;
        repoData.repo = repo;

        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!repoRes.ok) throw new Error("Repository not found or API rate limit exceeded.");
        const repoJson = await repoRes.json();
        repoData.branch = repoJson.default_branch;

        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.branch}?recursive=1`);
        if (!treeRes.ok) throw new Error("Failed to fetch repository tree.");
        const treeJson = await treeRes.json();

        // Filter out strict binaries, but keep images for document rendering
        allFiles = treeJson.tree
            .filter(item => item.type === 'blob' && !isBinary(item.path))
            .map(item => item.path);
        
        buildTreeUI(allFiles);
        selectionUI.classList.remove('hidden');
        
    } catch (error) {
        showError(error.message);
    } finally {
        toggleLoadingState('fetch', false);
    }
});

// -----------------------------------------
// PHASE 2: Client-Side ZIP Assembly
// -----------------------------------------
generateBtn.addEventListener('click', async () => {
    toggleLoadingState('gen', true);
    progressContainer.classList.remove('hidden');
    
    try {
        const selectedPaths = Array.from(treeContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        const mode = selectionMode.value;
        let targetFiles = mode === 'include' 
            ? allFiles.filter(f => selectedPaths.some(p => f.startsWith(p)))
            : allFiles.filter(f => !selectedPaths.some(p => f.startsWith(p)));

        if (targetFiles.length === 0) throw new Error("No files selected to generate.");

        // Fetch Zipball
        progressStateText.textContent = "Downloading Repository Archive...";
        progressBarFill.style.width = `10%`;
        
        const zipUrl = `https://codeload.github.com/${repoData.owner}/${repoData.repo}/zip/refs/heads/${repoData.branch}`;
        const zipRes = await fetch(zipUrl);
        if (!zipRes.ok) throw new Error("Failed to download repository zipball.");
        const zipBlob = await zipRes.blob();
        
        progressStateText.textContent = "Extracting and Stitching...";
        const zipData = await JSZip.loadAsync(zipBlob);
        
        // GitHub zips contain a root folder (e.g. repoName-branchName/)
        const rootFolder = Object.keys(zipData.files)[0].split('/')[0];
        
        // Initialize Docx Document
        const docSections = [];

        // Add Title Page
        docSections.push({
            children: [
                new docx.Paragraph({
                    text: `Project Codebase: ${repoData.repo}`,
                    heading: docx.HeadingLevel.TITLE,
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { before: 2000, after: 400 }
                }),
                new docx.Paragraph({
                    text: `Repository: https://github.com/${repoData.owner}/${repoData.repo}`,
                    alignment: docx.AlignmentType.CENTER,
                    pageBreakBefore: false
                })
            ]
        });

        // Add ASCII Tree
        const asciiTree = generateAsciiTree(targetFiles);
        docSections.push({
            children: [
                new docx.Paragraph({ text: "Repository Structure", heading: docx.HeadingLevel.HEADING_1, pageBreakBefore: true }),
                new docx.Paragraph({
                    children: [new docx.TextRun({ text: asciiTree, font: "Consolas", size: 20 })]
                })
            ]
        });

        // Process Files
        let processed = 0;
        const bodyChildren = [new docx.Paragraph({ pageBreakBefore: true })]; // Start files on new page

        for (const path of targetFiles) {
            processed++;
            progressCount.textContent = `${processed}/${targetFiles.length}`;
            progressBarFill.style.width = `${10 + (processed / targetFiles.length) * 90}%`;

            const zipPath = `${rootFolder}/${path}`;
            const fileEntry = zipData.file(zipPath);
            if (!fileEntry) continue;

            bodyChildren.push(new docx.Paragraph({ text: path, heading: docx.HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));

            if (isImage(path)) {
                // Image Processing
                const uint8 = await fileEntry.async("uint8array");
                const dimensions = await getImageDimensions(uint8, path);
                bodyChildren.push(new docx.Paragraph({
                    children: [
                        new docx.ImageRun({
                            data: uint8,
                            transformation: { width: dimensions.width, height: dimensions.height }
                        })
                    ]
                }));
            } else {
                // Code Processing
                const rawText = await fileEntry.async("string");
                const cellParagraphs = colorizeCodeToDocx(rawText, path);
                
                bodyChildren.push(new docx.Table({
                    width: { size: 100, type: docx.WidthType.PERCENTAGE },
                    borders: docx.TableBorders.NONE,
                    rows: [
                        new docx.TableRow({
                            children: [
                                new docx.TableCell({
                                    shading: { fill: "F6F8FA" }, // GitHub Light gray background
                                    children: cellParagraphs
                                })
                            ]
                        })
                    ]
                }));
            }
            bodyChildren.push(new docx.Paragraph({ text: "" })); // Spacing
        }

        docSections.push({ children: bodyChildren });

        // Compile and Download
        progressStateText.textContent = "Compiling Word Document...";
        const doc = new docx.Document({ sections: docSections });
        const blob = await docx.Packer.toBlob(doc);
        saveAs(blob, `${repoData.repo}_Report.docx`);
        
    } catch (error) {
        showError(error.message);
    } finally {
        toggleLoadingState('gen', false);
        setTimeout(() => progressContainer.classList.add('hidden'), 2000);
    }
});

// -----------------------------------------
// Syntx Highlighting Engine (Highlight.js -> Docx)
// -----------------------------------------
const hljsColorMap = {
    'hljs-keyword': '569cd6', 'hljs-built_in': '4ec9b0', 'hljs-type': '4ec9b0',
    'hljs-literal': '569cd6', 'hljs-number': 'b5cea8', 'hljs-regexp': 'd16969',
    'hljs-string': 'd69d85', 'hljs-subst': 'd4d4d4', 'hljs-symbol': 'd69d85',
    'hljs-class': '4ec9b0', 'hljs-function': 'dcdcaa', 'hljs-title': 'dcdcaa',
    'hljs-params': '9cdcfe', 'hljs-comment': '57a64a', 'hljs-doctag': '608b4e',
    'hljs-meta': '9b9b9b', 'hljs-name': '569cd6', 'hljs-attr': '9cdcfe',
    'hljs-variable': '9cdcfe', 'default': 'd4d4d4' // VS Code Dark Theme Colors
};

function colorizeCodeToDocx(rawText, filename) {
    const ext = filename.split('.').pop();
    const highlighted = hljs.getLanguage(ext) 
        ? hljs.highlight(rawText, { language: ext }).value 
        : hljs.highlightAuto(rawText).value;

    const parser = new DOMParser();
    const dom = parser.parseFromString(`<div>${highlighted}</div>`, 'text/html');
    const paragraphs = [];
    let currentRuns = [];

    function walk(node, currentColor) {
        if (node.nodeType === Node.TEXT_NODE) {
            const lines = node.textContent.split('\n');
            lines.forEach((line, index) => {
                if (line) {
                    currentRuns.push(new docx.TextRun({ text: line, color: currentColor, font: "Consolas", size: 18 }));
                }
                if (index < lines.length - 1) {
                    paragraphs.push(new docx.Paragraph({ children: currentRuns, spacing: { after: 0, line: 240 } }));
                    currentRuns = [];
                }
            });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            let color = currentColor;
            if (node.className && node.className.startsWith('hljs-')) {
                const matchedClass = node.className.split(' ').find(c => hljsColorMap[c]);
                if (matchedClass) color = hljsColorMap[matchedClass];
            }
            node.childNodes.forEach(child => walk(child, color));
        }
    }

    walk(dom.body.firstChild, hljsColorMap['default']);
    if (currentRuns.length > 0) paragraphs.push(new docx.Paragraph({ children: currentRuns, spacing: { after: 0, line: 240 } }));
    
    // Fallback if empty
    if (paragraphs.length === 0) paragraphs.push(new docx.Paragraph({ text: " " }));
    return paragraphs;
}

// -----------------------------------------
// Helper Functions ported from Python
// -----------------------------------------
function generateAsciiTree(paths) {
    const tree = {};
    paths.forEach(path => {
        const parts = path.split('/');
        let current = tree;
        parts.forEach(part => {
            current = current[part] = current[part] || {};
        });
    });

    const lines = [];
    function buildLines(node, prefix = "") {
        const entries = Object.keys(node);
        entries.forEach((key, i) => {
            const isLast = i === entries.length - 1;
            lines.push(prefix + (isLast ? "└── " : "├── ") + key);
            buildLines(node[key], prefix + (isLast ? "    " : "│   "));
        });
    }
    buildLines(tree);
    return lines.join('\n');
}

async function getImageDimensions(uint8array, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return new Promise((resolve) => {
        const blob = new Blob([uint8array], { type: `image/${mime}` });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            // Scale to max width of 600px for docx to avoid page overflow
            let w = img.naturalWidth; let h = img.naturalHeight;
            if (w > 600) { h = Math.round(h * (600 / w)); w = 600; }
            resolve({ width: w, height: h });
        };
        img.onerror = () => resolve({ width: 300, height: 300 }); // Safe fallback
        img.src = url;
    });
}

// -----------------------------------------
// Tree UI & State Logic (Unchanged)
// -----------------------------------------
function buildTreeUI(paths) {
    treeContainer.innerHTML = '';
    const fileTree = {};
    paths.forEach(path => {
        const parts = path.split('/');
        let current = fileTree;
        parts.forEach((part, index) => {
            if (index === parts.length - 1) current[part] = null;
            else { current[part] = current[part] || {}; current = current[part]; }
        });
    });
    renderTree(fileTree, treeContainer, '');
}

function renderTree(node, parentElement, currentPath) {
    Object.keys(node).sort().forEach(key => {
        const isFile = node[key] === null;
        const fullPath = currentPath ? `${currentPath}/${key}` : key;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'tree-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = isFile ? fullPath : `${fullPath}/`;
        
        checkbox.addEventListener('click', (e) => handleShiftClick(e, checkbox));

        if (!isFile) {
            const chevron = document.createElement('span'); chevron.className = 'chevron collapsed'; chevron.textContent = '▶';
            const label = document.createElement('span'); label.className = 'folder'; label.textContent = key;
            itemDiv.append(chevron, checkbox, label);

            const childrenContainer = document.createElement('div'); childrenContainer.className = 'children-container hidden';
            
            itemDiv.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    childrenContainer.classList.toggle('hidden');
                    chevron.classList.toggle('expanded');
                    chevron.classList.toggle('collapsed');
                }
            });
            checkbox.addEventListener('change', (e) => {
                childrenContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked);
            });

            parentElement.append(itemDiv, childrenContainer);
            renderTree(node[key], childrenContainer, fullPath);
        } else {
            const spacer = document.createElement('span'); spacer.className = 'spacer';
            const label = document.createElement('span'); label.className = 'file'; label.textContent = key;
            itemDiv.append(spacer, checkbox, label);
            
            itemDiv.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    handleShiftClick(e, checkbox);
                }
            });
            parentElement.appendChild(itemDiv);
        }
    });
}

function handleShiftClick(e, currentCheckbox) {
    if (!lastCheckedNode) { lastCheckedNode = currentCheckbox; return; }
    if (e.shiftKey) {
        const visibleCb = Array.from(treeContainer.querySelectorAll('input[type="checkbox"]')).filter(cb => cb.offsetParent !== null);
        const start = visibleCb.indexOf(lastCheckedNode);
        const end = visibleCb.indexOf(currentCheckbox);
        if (start > -1 && end > -1) {
            const min = Math.min(start, end), max = Math.max(start, end);
            for (let i = min; i <= max; i++) visibleCb[i].checked = lastCheckedNode.checked;
        }
    }
    lastCheckedNode = currentCheckbox;
}

selectAllBtn.addEventListener('change', (e) => {
    treeContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked);
});

function toggleLoadingState(prefix, isLoading) {
    const btnId = prefix === 'gen' ? 'generateBtn' : `${prefix}Btn`;
    document.getElementById(btnId).disabled = isLoading;
    document.getElementById(`${prefix}BtnText`).classList.toggle('hidden', isLoading);
    document.getElementById(`${prefix}Loader`).classList.toggle('hidden', !isLoading);
    statusMessage.classList.add('hidden');
}

function showError(msg) {
    statusMessage.textContent = msg;
    statusMessage.classList.remove('hidden');
    statusMessage.classList.add('error');
}