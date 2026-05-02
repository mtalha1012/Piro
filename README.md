# Piro | Stitching Code into Context

![Piro Banner](logo.png) 

**Piro** is a 100% client-side web application designed to completely automate the tedious process of converting GitHub repositories into readable, formatted documents. 

Whether you are a Computer Science student compiling 50 source files into a Microsoft Word (`.docx`) report for a final project, or a developer trying to feed an entire codebase into an LLM (like ChatGPT or Claude) via Markdown (`.md`), Piro does the heavy lifting in seconds.

## 🚀 Live Demo
**Try it directly in your browser:** [Insert Live GitHub Pages Link Here]

## ✨ Key Features

* **Instant Document Generation (.docx):** Compiles selected codebase files into a single, clean Microsoft Word document.
* **Flawless Syntax Highlighting:** Replicates the VS Code experience directly inside Word with dynamic Dark and Light themes.
* **AI Context Export (.md):** Instantly stitch your entire repository into a flat Markdown file—the most token-efficient format for feeding large codebases into AI context windows.
* **Interactive File Tree:** Fetch any public repository and use the graphical file tree to precisely include or exclude specific files and folders.
* **100% Serverless Architecture:** Everything runs locally in your browser. There is no backend, no database, no sign-ups, and no code ever leaves your machine.
* **Cross-Platform Resiliency:** Documents are strictly sanitized at the byte level to prevent XML corruption, ensuring the `.docx` files open perfectly on Windows, macOS, and iOS.
* **Personal Access Token Support:** Seamlessly bypass GitHub's 60-request/hour unauthenticated API limit for massive repositories by providing a local-only token.

## 🛠️ Tech Stack

Piro was built as a lightweight, lightning-fast vanilla web app. 
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **APIs:** GitHub REST API (Trees, Contents)
* **Libraries:**
  * [`docx`](https://docx.js.org/) - For client-side Word document generation.
  * [`highlight.js`](https://highlightjs.org/) - For precise, multi-language syntax parsing.
  * [`FileSaver.js`](https://github.com/eligrey/FileSaver.js/) - For triggering local file downloads.

## ⚙️ How It Works (The Architecture)

Piro operates in a two-phase client-side pipeline:

1. **Mapping (Phase 1):** The app makes a `recursive=1` call to the GitHub API to fetch the complete directory tree. It filters out binary files (like `.exe`, `.mp4`) and unsupported images, then dynamically renders an interactive DOM tree for the user.
2. **Stitching (Phase 2):** Based on the user's selection, Piro batches raw file requests. For Word exports, the code is parsed by `highlight.js` to assign color classes, which are then mapped to `docx` TextRuns to preserve indentation and color. For Markdown exports, it simply concatenates the raw text wrapped in appropriate language backticks. 

## 💻 Local Setup

Since Piro has no backend, running it locally is incredibly simple.

1. Clone the repository:
   ```bash
   git clone [https://github.com/mtalha1012/piro.git](https://github.com/mtalha1012/piro.git)
