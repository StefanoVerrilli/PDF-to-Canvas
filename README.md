# PDF to Canvas

**PDF to Canvas** is an Obsidian plugin that bridges the gap between linear documents and spatial thinking. It allows you to import PDF files—page by page—directly into [Obsidian Canvas](https://obsidian.md/canvas) as individual nodes.

While Obsidian natively supports embedding entire PDF files, the ability to break them down into single pages was missing. Inspired by the workflow of [Excalidraw](https://excalidraw.com/), this plugin brings this feature to the native Canvas ecosystem.

---

## 🔧 Key Features

- **Page-by-Page Import:** Instantly convert a multi-page PDF into a grid of individual image nodes.
- **Smart Grouping:** Imported pages are automatically organized into a labeled Group within the Canvas, keeping your workspace tidy.
- **Flexible Sources:** Import PDFs already inside your Vault or pick files directly from your System (external drive, downloads, etc.) without cluttering your root folder.
- **Vault Organization:** "Clutter-aware" settings allow you to control exactly where and how generated images are stored.

---

## ⚙️ Settings & Configuration

You can customize how the plugin handles file generation to suit your workflow:

### 1. Storage Mode
Choose between keeping your vault light or keeping your file structure clean.
- **Save as Files (Default):** Extracts pages as `.jpg` or `.md` files into a specific folder. Best for performance and keeping the `.canvas` file size small.
- **Embed Images Directly:** Encodes pages as Base64 strings directly into the `.canvas` file.
    - *Pros:* Zero extra files created in your vault.
    - *Cons:* Can result in very large `.canvas` files which may impact performance on slower devices.

### 2. Image Folder
If you choose to save files, you can specify a dedicated folder (e.g., `Canvas Imports`) to keep your vault organized.

### 3. Image Quality
Adjust the resolution (render scale) of the imported pages.
- **Lower Scale:** Smaller file sizes, faster loading.
- **Higher Scale:** Crisper text, ideal for zooming in on detailed documents.

---

## 🚀 Usage

ensure you have an **active Canvas file open**, then open the Command Palette (`Ctrl/Cmd + P`) and search for:

- **`PDF to Canvas: Import PDF from Vault`**
    - Select a PDF that already exists inside your Obsidian Vault.
- **`PDF to Canvas: Import PDF from System`**
    - Opens your native file picker to select a PDF from anywhere on your computer.

---

## 📦 Installation

*(Since this is a manual install currently)*

1.  Download the `main.js`, `manifest.json`, and `styles.css` from the latest release.
2.  Create a folder named `pdf-to-canvas` inside your vault's plugin folder: `.obsidian/plugins/`.
3.  Move the downloaded files into that folder.
4.  Reload Obsidian and enable the plugin in Community Plugins settings.

---

## 🙋 Contact & Credits

This plugin was designed as a testing ground to integrate features I found essential for my own spatial note-taking workflow. It is currently a solo project maintained by **[StefanoVerrilli](https://github.com/StefanoVerrilli)**.

If you find this tool useful or have suggestions for improvement, feel free to open an issue or reach out!
