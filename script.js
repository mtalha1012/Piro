// --- DOM Elements ---
const homeScreen = document.getElementById('homeScreen');
const repoForm = document.getElementById('repoForm');
const repoUrlInput = document.getElementById('repoUrl');
const githubTokenInput = document.getElementById('githubToken');
const tokenHintBox = document.getElementById('tokenHintBox');
const hintBoxText = document.getElementById('hintBoxText');
const statusMessage = document.getElementById('statusMessage');

const selectionUI = document.getElementById('selectionUI');
const treeContainer = document.getElementById('treeContainer');
const generateBtn = document.getElementById('generateBtn');
const genBtnText = document.getElementById('genBtnText');
const selectAllBtn = document.getElementById('selectAllBtn');
const backBtn = document.getElementById('backBtn');
const displayRepoName = document.getElementById('displayRepoName');
const themeRow = document.getElementById('themeRow');

const progressContainer = document.getElementById('progressContainer');
const progressCount = document.getElementById('progressCount');
const progressBarFill = document.getElementById('progressBarFill');

// --- State & Constants ---
let repoData = { owner: '', repo: '', branch: '' };
let allFiles = [];
let lastCheckedNode = null;

// Load saved preferences from the browser (or fallback to defaults)
let selectionModeVal = localStorage.getItem('piro_selectionMode') || 'include';
let exportFormatVal = localStorage.getItem('piro_exportFormat') || 'docx';
let includeImagesVal = localStorage.getItem('piro_includeImages') !== 'no'; // Defaults to true ('yes')
let codeThemeVal = localStorage.getItem('piro_theme') || 'dark';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp'];
const BINARY_EXTENSIONS = ['.mp4', '.mp3', '.wav', '.zip', '.pdf', '.exe', '.pyc', '.ttf', '.woff', '.woff2', '.svg', '.ico', '.eot', '.dll', '.bin'];

const isImage = (path) => IMAGE_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
const isBinary = (path) => BINARY_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));

// --- Pill Group Setup & Persistence ---
function setupPillGroup(groupId, storageKey, initialValue, onChange) {
    const group = document.getElementById(groupId);
    if (!group) return;

    // 1. Sync UI with the loaded preference on startup
    group.querySelectorAll('.pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === initialValue);
    });

    // 2. Add Event Listeners to save the new choice when clicked
    group.querySelectorAll('.pill').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const val = btn.dataset.value;
            localStorage.setItem(storageKey, val); // Save to browser memory
            onChange(val);
        });
    });
}

// Initialize the pill groups with their loaded values and save keys
setupPillGroup('selectionModeGroup', 'piro_selectionMode', selectionModeVal, val => { 
    selectionModeVal = val; 
    validateGenerateBtn(); 
});

setupPillGroup('exportFormatGroup', 'piro_exportFormat', exportFormatVal, val => {
    exportFormatVal = val;
    themeRow.style.display = val === 'docx' ? 'flex' : 'none';
    validateGenerateBtn();
});

setupPillGroup('imagesGroup', 'piro_includeImages', includeImagesVal ? 'yes' : 'no', val => { 
    includeImagesVal = val === 'yes'; 
    validateGenerateBtn(); 
});

setupPillGroup('themeGroup', 'piro_theme', codeThemeVal, val => { 
    codeThemeVal = val; 
});

// Initial UI toggle: Hide the theme row on startup if Markdown was the saved preference
themeRow.style.display = exportFormatVal === 'docx' ? 'flex' : 'none';

// --- Autocomplete: Tab or Right Arrow fills 'https://github.com/' ---
repoUrlInput.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === 'Tab') {
        const currentVal = this.value.trim().toLowerCase();
        const targetUrl = 'https://github.com/';
        
        if (currentVal !== targetUrl && (currentVal === '' || targetUrl.startsWith(currentVal))) {
            e.preventDefault(); // prevents Tab from jumping to the next field
            this.value = targetUrl;
            setTimeout(() => {
                this.selectionStart = this.selectionEnd = this.value.length;
            }, 0);
        }
    }
});

const tokenSection = document.getElementById('tokenSection');

githubTokenInput.addEventListener('input', () => {
    validateGenerateBtn();
});

// --- Utility Functions ---
function getHighlightedWordParagraphs(code, filename, theme = 'dark') {
    const ext = filename.split('.').pop().toLowerCase();
    const langMap = {
        'cpp': 'cpp', 'c': 'c', 'h': 'cpp', 'hpp': 'cpp', 'cc': 'cpp',
        'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript', 'jsx': 'javascript',
        'ts': 'typescript', 'tsx': 'typescript',
        'py': 'python', 'java': 'java',
        'html': 'xml', 'htm': 'xml', 'xml': 'xml', 'vue': 'xml',
        'css': 'css', 'scss': 'css', 'less': 'css',
        'json': 'json', 'jsonc': 'json',
        'md': 'markdown',
        'go': 'go', 'rs': 'rust', 'rb': 'ruby',
        'sh': 'bash', 'bash': 'bash', 'zsh': 'bash',
        'yaml': 'yaml', 'yml': 'yaml',
        'php': 'php', 'swift': 'swift', 'kt': 'kotlin', 'cs': 'csharp',
        'sql': 'sql', 'dart': 'dart', 'r': 'r'
    };
    const lang = langMap[ext] || 'plaintext';

    let highlightedHtml = code;
    try {
        highlightedHtml = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch (e) {
        try { highlightedHtml = hljs.highlightAuto(code).value; } catch(ex) {}
    }

    const tempDiv = document.createElement('pre');
    tempDiv.innerHTML = highlightedHtml;

    const darkColorMap = {
        'hljs-keyword': '569CD6',
        'hljs-built_in': '4EC9B0',
        'hljs-type': '4EC9B0',
        'hljs-title': 'DCDCAA',
        'hljs-title.class': '4EC9B0',
        'hljs-title.function': 'DCDCAA',
        'hljs-string': 'CE9178',
        'hljs-number': 'B5CEA8',
        'hljs-comment': '6A9955',
        'hljs-variable': '9CDCFE',
        'hljs-params': '9CDCFE',
        'hljs-property': '9CDCFE',
        'hljs-attr': '9CDCFE',
        'hljs-meta': 'C586C0',
        'hljs-literal': '569CD6'
    };

    const lightColorMap = {
        'hljs-keyword': '0000FF',
        'hljs-built_in': '267F99',
        'hljs-type': '267F99',
        'hljs-title': '795E26',
        'hljs-title.class': '267F99',
        'hljs-title.function': '795E26',
        'hljs-string': 'A31515',
        'hljs-number': '098658',
        'hljs-comment': '008000',
        'hljs-variable': '001080',
        'hljs-params': '001080',
        'hljs-property': '001080',
        'hljs-attr': 'E50000',
        'hljs-meta': 'AF00DB',
        'hljs-literal': '0000FF'
    };

    const colorMap = theme === 'dark' ? darkColorMap : lightColorMap;
    const defaultColor = theme === 'dark' ? 'D4D4D4' : '1E1E1E';

    const lines = [[]];

    function traverse(node, currentColor) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                const parts = text.split('\n');
                parts.forEach((part, idx) => {
                    if (idx > 0) lines.push([]);
                    if (part) {
                        // Preserve leading indentation — Word collapses plain spaces
                        const preserved = part.replace(/^ +/g, m => ' '.repeat(m.length));
                        lines[lines.length - 1].push(new docx.TextRun({
                            text: preserved,
                            color: currentColor,
                            font: 'Consolas',
                            size: 18
                        }));
                    }
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            let newColor = currentColor;
            if (node.className && typeof node.className === 'string') {
                const classes = node.className.split(' ');
                for (const cls of classes) {
                    if (colorMap[cls]) { newColor = colorMap[cls]; break; }
                }
            }
            node.childNodes.forEach(child => traverse(child, newColor));
        }
    }

    tempDiv.childNodes.forEach(child => traverse(child, defaultColor));

    while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();
    return lines.map(lineRuns => new docx.Paragraph({
        children: lineRuns.length > 0 ? lineRuns : [new docx.TextRun({ text: ' ', font: 'Consolas', size: 18 })],
        spacing: { before: 0, after: 0 }
    }));
}

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
    const selected = Array.from(treeContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

    let targetFiles = selectionModeVal === 'include'
        ? allFiles.filter(f => selected.some(p => f.startsWith(p)))
        : allFiles.filter(f => !selected.some(p => f.startsWith(p)));

    if (!includeImagesVal) targetFiles = targetFiles.filter(f => !isImage(f));

    const count = targetFiles.length;
    const tokenVal = githubTokenInput.value.trim();

    if (count > 150) {
        tokenSection.classList.remove('hidden'); // Slide down the token UI
        if (!tokenVal) {
            generateBtn.disabled = true;
            genBtnText.textContent = `Token Required (${count} files)`;
        } else {
            generateBtn.disabled = false;
            genBtnText.textContent = `Generate Document (${count} files)`;
        }
    } else {
        tokenSection.classList.add('hidden'); // Hide the token UI
        generateBtn.disabled = count === 0;
        genBtnText.textContent = count === 0 ? 'Generate Document' : `Generate Document (${count} files)`;
    }

    updateSelectAllState();
}

function updateSelectAllState() {
    const all = Array.from(treeContainer.querySelectorAll('input[type="checkbox"]'));
    const files = all.filter(cb => !cb.value.endsWith('/'));
    if (files.length === 0) return;
    const checkedCount = files.filter(cb => cb.checked).length;
    if (checkedCount === 0) {
        selectAllBtn.indeterminate = false;
        selectAllBtn.checked = false;
    } else if (checkedCount === files.length) {
        selectAllBtn.indeterminate = false;
        selectAllBtn.checked = true;
    } else {
        selectAllBtn.indeterminate = true;
        selectAllBtn.checked = false;
    }
}

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

// Phase 1: Fetch Repo
repoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    toggleLoadingState('fetch', true);
    statusMessage.classList.add('hidden');
    
    try {
        const { owner, repo } = parseGitHubUrl(repoUrlInput.value);
        repoData.owner = owner;
        repoData.repo = repo;

        const headers = {};

        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        if (!repoRes.ok) {
            if (repoRes.status === 403) throw new Error("GitHub API rate limit hit. Please provide a Personal Access Token.");
            throw new Error("Repository not found or is private.");
        }
        
        const repoJson = await repoRes.json();
        repoData.branch = repoJson.default_branch;

        const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${repoData.branch}?recursive=1`, { headers });
        if (!treeRes.ok) throw new Error("Failed to load repository tree. Check your token permissions.");
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

// --- Phase 2: Generate Document ---
generateBtn.addEventListener('click', async () => {
    toggleLoadingState('gen', true);
    progressContainer.classList.remove('hidden');
    progressBarFill.style.width = '0%';
    progressCount.textContent = '0/0';
    statusMessage.classList.add('hidden');
    const bodyChildren = [];
    const format = exportFormatVal;

    try {
        const selected = Array.from(treeContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

        let targetFiles = selectionModeVal === 'include'
            ? allFiles.filter(f => selected.some(p => f.startsWith(p)))
            : allFiles.filter(f => !selected.some(p => f.startsWith(p)));

        if (!includeImagesVal) targetFiles = targetFiles.filter(f => !isImage(f));
        if (targetFiles.length === 0) throw new Error("No files selected to generate.");

        const token = githubTokenInput.value.trim();

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
                    let res;
                    if (token) {
                        const encodedPath = path.split('/').map(encodeURIComponent).join('/');
                        const apiUrl = `https://api.github.com/repos/${repoData.owner}/${repoData.repo}/contents/${encodedPath}?ref=${repoData.branch}`;
                        res = await fetch(apiUrl, {
                            headers: {
                                'Authorization': `token ${token}`,
                                'Accept': 'application/vnd.github.v3.raw'
                            }
                        });
                    } else {
                        res = await fetch(rawUrl);
                    }
                    
                    if (!res.ok) {
                        // 403 (Rate Limit) or 429 (Too Many Requests)
                        if (res.status === 403 || res.status === 429) {
                            throw new Error("GitHub download limit exceeded during generation. Please provide a token to continue.");
                        }
                        console.warn(`Skipping file (HTTP ${res.status}): ${path}`);
                        return null; 
                    }

                    processed++;
                    progressCount.textContent = `${processed}/${targetFiles.length}`;
                    progressBarFill.style.width = `${(processed / targetFiles.length) * 100}%`;

                    if (isImage(path)) {
                        if (format === 'md') return { type: 'image', path, url: rawUrl };
                        const buffer = await res.arrayBuffer();
                        return { type: 'image', path, buffer };
                    } else {
                        const text = await res.text();
                    
                        // If it contains null bytes or invalid UTF-8 replacement characters, it's binary junk.
                        if (text.includes('\x00') || text.includes('\uFFFD')) {
                            console.warn(`Skipped ${path} - Detected as non-UTF-8 binary content.`);
                            return null; // Skips the file entirely
                        }
                        
                        const cleanText = text.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '');
                        return { type: 'text', path, text: cleanText };
                    }
                } catch (e) {
                    console.error(`Failed to fetch ${path}`, e);
                    return null;
                }
            }));

            for (const fileData of batchResults) {
                if (!fileData) continue;

                if (format === 'md') {
                    mdContent += `## ${fileData.path}\n\n`;
                    if (fileData.type === 'image') {
                        mdContent += `![${fileData.path.split('/').pop()}](${encodeURI(fileData.url)})\n\n`;
                    } else {
                        const ext = fileData.path.split('.').pop() || 'txt';
                        mdContent += `\`\`\`${ext}\n${fileData.text}\n\`\`\`\n\n`;
                    }
                } else {
                    bodyChildren.push(new docx.Paragraph({ text: fileData.path, heading: docx.HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 }}));
                    
                    if (fileData.type === 'image') {
                        bodyChildren.push(new docx.Paragraph({ children: [new docx.ImageRun({ data: fileData.buffer, transformation: { width: 400, height: 300 } })] }));
                    } else {
                        let paragraphs;

                        if (fileData.text.length > 30000) {
                            paragraphs = [new docx.Paragraph({
                                children: [new docx.TextRun({ text: '/* File too large for syntax highlighting — raw text */', color: codeThemeVal === 'dark' ? '6A9955' : '008000', font: 'Consolas', size: 18 })],
                                spacing: { before: 0, after: 0 }
                            })];
                            for (const line of fileData.text.split(/\r?\n/)) {
                                const preserved = line.replace(/^ +/g, m => ' '.repeat(m.length));
                                paragraphs.push(new docx.Paragraph({
                                    children: [new docx.TextRun({ text: preserved || ' ', color: codeThemeVal === 'dark' ? 'D4D4D4' : '1E1E1E', font: 'Consolas', size: 18 })],
                                    spacing: { before: 0, after: 0 }
                                }));
                            }
                        } else {
                            paragraphs = getHighlightedWordParagraphs(fileData.text, fileData.path, codeThemeVal);
                        }

                        const noBorder = { style: docx.BorderStyle.NIL, size: 0, color: "auto" };
                        const allNone = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder };
                        const tabName = fileData.path.split('/').pop();

                        bodyChildren.push(new docx.Table({
                            width: { size: 100, type: docx.WidthType.PERCENTAGE },
                            borders: allNone,
                            rows: [
                                new docx.TableRow({
                                    children: [new docx.TableCell({
                                        shading: { fill: codeThemeVal === 'dark' ? '2D2D2D' : 'E8E8E8' },
                                        borders: allNone,
                                        margins: { top: 80, bottom: 80, left: 180, right: 180 },
                                        children: [new docx.Paragraph({
                                            children: [new docx.TextRun({ text: tabName, color: codeThemeVal === 'dark' ? 'CCCCCC' : '555555', font: 'Consolas', size: 17 })],
                                            spacing: { before: 0, after: 0 }
                                        })]
                                    })]
                                }),
                                new docx.TableRow({
                                    children: [new docx.TableCell({
                                        shading: { fill: codeThemeVal === 'dark' ? '1E1E1E' : 'F8F8F8' },
                                        borders: allNone,
                                        margins: { top: 120, bottom: 160, left: 180, right: 180 },
                                        children: paragraphs
                                    })]
                                })
                            ]
                        }));
                    }
                    bodyChildren.push(new docx.Paragraph({ text: "" }));
                }
            }
        }

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
