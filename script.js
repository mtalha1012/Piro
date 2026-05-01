// --- DOM Elements ---
const homeScreen = document.getElementById('homeScreen');
const repoForm = document.getElementById('repoForm');
const repoUrlInput = document.getElementById('repoUrl');
const statusMessage = document.getElementById('statusMessage');
const selectionUI = document.getElementById('selectionUI');
const treeContainer = document.getElementById('treeContainer');
const generateBtn = document.getElementById('generateBtn');
const selectionMode = document.getElementById('selectionMode');
const exportFormat = document.getElementById('exportFormat'); // <-- Added
const selectAllBtn = document.getElementById('selectAllBtn');
const backBtn = document.getElementById('backBtn');
const displayRepoName = document.getElementById('displayRepoName');
const includeImagesToggle = document.getElementById('includeImages');

// Progress Bar
const progressContainer = document.getElementById('progressContainer');
const progressCount = document.getElementById('progressCount');
const progressBarFill = document.getElementById('progressBarFill');

// --- State & Constants ---
let repoData = { owner: '', repo: '', branch: '' };
let allFiles = [];
let lastCheckedNode = null;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
const BINARY_EXTENSIONS = ['.mp4', '.mp3', '.wav', '.zip', '.pdf', '.exe', '.pyc'];

const isImage = (path) => IMAGE_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
const isBinary = (path) => BINARY_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));

// --- Utility Functions ---
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

function toggleLoadingState(prefix, isLoading) {
    const btnId = prefix === 'gen' ? 'generateBtn' : 'fetchBtn';
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    document.getElementById(`${prefix}BtnText`).classList.toggle('hidden', isLoading);
    document.getElementById(`${prefix}Loader`).classList.toggle('hidden', !isLoading);
}

function showError(msg) {
    statusMessage.textContent = msg;
    statusMessage.classList.remove('hidden');
    statusMessage.classList.add('error');
}

function validateGenerateBtn() {
    const checkedCount = treeContainer.querySelectorAll('input[type="checkbox"]:checked').length;
    generateBtn.disabled = (selectionMode.value === 'include' && checkedCount === 0);
}

// Generate an ASCII visual tree for Markdown exports
function generateAsciiTree(paths) {
    const tree = {};
    paths.forEach(path => {
        const parts = path.split('/');
        let current = tree;
        parts.forEach(part => { current = current[part] = current[part] || {}; });
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

// --- Navigation ---
backBtn.addEventListener('click', () => {
    selectionUI.classList.add('hidden');
    homeScreen.classList.remove('hidden');
    statusMessage.classList.add('hidden');
});

// --- Phase 1: Fetch Repo ---
repoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoadingState('fetch', true);
    statusMessage.classList.add('hidden');
    
    try {
        const { owner, repo } = parseGitHubUrl(repoUrlInput.value);
        repoData.owner = owner;
        repoData.repo = repo;

        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (!repoRes.ok) throw new Error("Repository not found.");
        const repoJson = await repoRes.json();
        repoData.branch = repoJson.default_branch;

        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.branch}?recursive=1`);
        const treeJson = await treeRes.json();

        allFiles = treeJson.tree
            .filter(item => item.type === 'blob' && !isBinary(item.path))
            .map(item => item.path);
        
        displayRepoName.textContent = `${owner} / ${repo}`;
        homeScreen.classList.add('hidden');
        selectionUI.classList.remove('hidden');
        
        buildTreeUI(allFiles);
        validateGenerateBtn();
        
    } catch (error) {
        showError(error.message);
    } finally {
        toggleLoadingState('fetch', false);
    }
});

// --- Phase 2: Generate Document (HIGH SPEED BATCHING) ---
generateBtn.addEventListener('click', async () => {
    toggleLoadingState('gen', true);
    progressContainer.classList.remove('hidden');
    const bodyChildren = [];
    const format = exportFormat.value;
    
    try {
        const selected = Array.from(treeContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        const shouldIncludeImages = includeImagesToggle.checked;

        let targetFiles = selectionMode.value === 'include' 
            ? allFiles.filter(f => selected.some(p => f.startsWith(p)))
            : allFiles.filter(f => !selected.some(p => f.startsWith(p)));

        if (!shouldIncludeImages) targetFiles = targetFiles.filter(f => !isImage(f));
        if (targetFiles.length === 0) throw new Error("No files selected to generate.");

        // Document Intialization Setup
        let mdContent = `# Project Codebase: ${repoData.repo}\n**Repository:** https://github.com/${repoData.owner}/${repoData.repo}\n\n`;
        
        if (format === 'docx') {
            bodyChildren.push(new docx.Paragraph({ text: `Project Codebase: ${repoData.repo}`, heading: docx.HeadingLevel.TITLE, alignment: docx.AlignmentType.CENTER, spacing: { before: 2000, after: 400 }}));
            bodyChildren.push(new docx.Paragraph({ text: `Repository: https://github.com/${repoData.owner}/${repoData.repo}`, alignment: docx.AlignmentType.CENTER }));
            bodyChildren.push(new docx.Paragraph({ text: "", pageBreakBefore: true }));
        } else {
            mdContent += `## Repository Structure\n\`\`\`text\n${generateAsciiTree(targetFiles)}\n\`\`\`\n\n`;
        }

        let processed = 0;
        const BATCH_SIZE = 15;

        for (let i = 0; i < targetFiles.length; i += BATCH_SIZE) {
            const batch = targetFiles.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(async (path) => {
                const rawUrl = `https://raw.githubusercontent.com/${repoData.owner}/${repoData.repo}/${repoData.branch}/${path}`;
                try {
                    const res = await fetch(rawUrl);
                    if (!res.ok) return null;

                    processed++;
                    progressCount.textContent = `${processed}/${targetFiles.length}`;
                    progressBarFill.style.width = `${(processed / targetFiles.length) * 100}%`;

                    if (isImage(path)) {
                        if (format === 'md') return { type: 'image', path, url: rawUrl }; // MD just needs the link
                        const buffer = await res.arrayBuffer();
                        return { type: 'image', path, buffer };
                    } else {
                        const text = await res.text();
                        return { type: 'text', path, text };
                    }
                } catch (e) {
                    console.error(`Failed to fetch ${path}`, e);
                    return null;
                }
            }));

            // Stitch the batch
            for (const fileData of batchResults) {
                if (!fileData) continue;

                if (format === 'md') {
                    // MARKDOWN COMPILATION
                    mdContent += `## ${fileData.path}\n\n`;
                    if (fileData.type === 'image') {
                        mdContent += `![${fileData.path.split('/').pop()}](${encodeURI(fileData.url)})\n\n`;
                    } else {
                        const ext = fileData.path.split('.').pop();
                        mdContent += `\`\`\`${ext}\n${fileData.text}\n\`\`\`\n\n`;
                    }
                } else {
                    // WORD COMPILATION
                    bodyChildren.push(new docx.Paragraph({ text: fileData.path, heading: docx.HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 }}));
                    if (fileData.type === 'image') {
                        bodyChildren.push(new docx.Paragraph({ children: [new docx.ImageRun({ data: fileData.buffer, transformation: { width: 400, height: 300 } })] }));
                    } else {
                        const paragraphs = [];
                        if (fileData.text.length > 30000) {
                            paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun({ text: "/* File too large for formatting. Rendered as raw text. */\n\n" + fileData.text, font: "Consolas", size: 18 })] }));
                        } else {
                            paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun({ text: fileData.text, font: "Consolas", size: 18 })] }));
                        }
                        bodyChildren.push(new docx.Table({ width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows: [new docx.TableRow({ children: [new docx.TableCell({ shading: { fill: "F6F8FA" }, children: paragraphs })] })] }));
                    }
                    bodyChildren.push(new docx.Paragraph({ text: "" }));
                }
            }
        }

        // Final Download Trigger
        if (format === 'docx') {
            const doc = new docx.Document({ sections: [{ children: bodyChildren }] });
            const blob = await docx.Packer.toBlob(doc);
            saveAs(blob, `${repoData.repo}_Report.docx`);
        } else {
            const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
            saveAs(blob, `${repoData.repo}_Report.md`);
        }
        
    } catch (e) {
        showError(e.message);
    } finally {
        toggleLoadingState('gen', false);
        setTimeout(() => progressContainer.classList.add('hidden'), 2000);
    }
});

// --- Tree UI Engine ---
function buildTreeUI(paths) {
    treeContainer.innerHTML = '';
    const fileTree = {};
    paths.forEach(path => {
        const parts = path.split('/');
        let current = fileTree;
        parts.forEach((part, i) => {
            if (i === parts.length - 1) current[part] = null;
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
        checkbox.addEventListener('change', validateGenerateBtn);
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
                childrenContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = e.target.checked; });
                validateGenerateBtn();
            });
            parentElement.append(itemDiv, childrenContainer);
            renderTree(node[key], childrenContainer, fullPath);
        } else {
            const spacer = document.createElement('span'); spacer.className = 'spacer'; 
            spacer.style.display = 'inline-block'; spacer.style.width = '16px'; 
            const label = document.createElement('span'); label.className = 'file'; label.textContent = key;
            itemDiv.append(spacer, checkbox, label);
            itemDiv.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    handleShiftClick(e, checkbox);
                    validateGenerateBtn();
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
        validateGenerateBtn();
    }
    lastCheckedNode = currentCheckbox;
}

if (selectAllBtn) {
    selectAllBtn.addEventListener('change', (e) => {
        treeContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked);
        validateGenerateBtn();
    });
}
