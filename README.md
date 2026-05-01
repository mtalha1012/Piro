# Piro 🪡
**Stitching Code into Context.**

Piro is a blazing-fast, 100% client-side developer tool that selectively harvests code from any GitHub repository and transforms it into a structured, syntax-highlighted Word Document (`.docx`). 

Built entirely on the frontend, Piro bypasses traditional backend bottlenecks by fetching repository "Zipballs" and compiling documents locally in your browser memory. This guarantees total data privacy, zero server costs, and lightning-fast generation.

---

## ✨ Features

* **Zero Backend, Infinite Scaling:** Everything happens in your browser. No server timeouts, no database, no backend compute limits.
* **Zipball Architecture:** Bypasses strict GitHub API rate limits by downloading the entire repository as a single ZIP file, allowing unauthenticated users to process massive repositories instantly.
* **Interactive File Selection:** A native-feeling GitHub file tree with "Include/Exclude" toggles, folder collapsing, and `Shift+Click` bulk selection.
* **Local Syntax Highlighting:** Powered by `highlight.js`, preserving language-specific syntax colors (VS Code Dark theme) natively inside the Word document.
* **Smart Asset Handling:** Automatically filters out binary noise (audio, video, compiled files) but correctly parses and scales valid image assets (`.png`, `.jpg`, etc.) to fit neatly within Word document margins.
* **ASCII Tree Generation:** Automatically generates and prepends a beautiful, monospaced ASCII visual map of your selected repository structure.

## 🚀 How It Works

1. **Connect:** Paste a public GitHub URL. Piro makes a single API call to map the repository tree structure.
2. **Select:** Use the UI to check/uncheck the specific files or folders you want to include in your document.
3. **Stitch:** Piro downloads the repository archive (`JSZip`), colorizes the code locally (`highlight.js`), constructs the Word document natively (`docx.js`), and triggers a local download.

## 🛠️ Tech Stack

Piro is built using pure, Vanilla web technologies to ensure it can be hosted anywhere for $0.

* **HTML5 / CSS3 / Vanilla JavaScript**
* **[JSZip](https://stuk.github.io/jszip/):** In-browser zip extraction.
* **[highlight.js](https://highlightjs.org/):** Client-side syntax colorization.
* **[docx.js](https://docx.js.org/):** Programmatic Word document assembly.
* **[FileSaver.js](https://github.com/eligrey/FileSaver.js/):** Client-side file saving.

## 💻 Local Development

Because Piro is a fully frontend application, there are no dependencies to install or servers to configure. 

1. Clone the repository:
   ```bash
   git clone [https://github.com/yourusername/piro.git](https://github.com/yourusername/piro.git)
