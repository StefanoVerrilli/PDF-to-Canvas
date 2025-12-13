import { App, Plugin, TFile, FuzzySuggestModal, Notice, PluginSettingTab, Setting } from 'obsidian';
import * as pdfjsLib from 'pdfjs-dist';

// --- Settings Definition ---
interface PdfToCanvasSettings {
	folderPath: string;
	embedMode: boolean; // True = Base64 (No files), False = Save Images (Files)
	renderScale: number;
}

const DEFAULT_SETTINGS: PdfToCanvasSettings = {
	folderPath: 'Canvas Imports',
	embedMode: false,
	renderScale: 3.0
}

// --- Canvas Interface ---
interface CanvasNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	type: 'file' | 'text' | 'group';
	file?: string;
	text?: string;
	label?: string;
}

interface CanvasData {
	nodes: CanvasNode[];
	edges: any[];
}

export default class PdfToCanvasPlugin extends Plugin {
	settings: PdfToCanvasSettings;

	async onload() {
		await this.loadSettings();

		// 1. Command: Import from Vault (Fuzzy Search)
		this.addCommand({
			id: 'import-pdf-vault',
			name: 'Import PDF from Vault',
			callback: () => {
				if (!this.checkActiveCanvas()) return;
				new PdfSelectionModal(this.app, (file) => this.processVaultFile(file)).open();
			}
		});

		// 2. Command: Import from System (Native File Picker)
		this.addCommand({
			id: 'import-pdf-system',
			name: 'Import PDF from System (External)',
			callback: () => {
				if (!this.checkActiveCanvas()) return;
				this.triggerSystemFilePicker();
			}
		});

		// 3. Settings Tab
		this.addSettingTab(new PdfToCanvasSettingTab(this.app, this));
	}

	checkActiveCanvas(): boolean {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== 'canvas') {
			new Notice('Please open a Canvas file first.');
			return false;
		}
		return true;
	}

	// --- Handlers ---

	async processVaultFile(file: TFile) {
		const arrayBuffer = await this.app.vault.readBinary(file);
		await this.processPdfData(arrayBuffer, file.basename);
	}

	triggerSystemFilePicker() {
		// Create a hidden input element to trigger system dialog
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.pdf';
		
		input.onchange = async (e: any) => {
			const file = e.target.files[0];
			if (file) {
				const arrayBuffer = await file.arrayBuffer();
				// Remove extension for the label name
				const name = file.name.replace(/\.[^/.]+$/, ""); 
				await this.processPdfData(arrayBuffer, name);
			}
		};
		input.click();
	}

	// --- Core Logic ---

	async processPdfData(arrayBuffer: ArrayBuffer, pdfName: string) {
		const canvasFile = this.app.workspace.getActiveFile();
		if (!canvasFile) return;

		const notice = new Notice('Initializing PDF engine...', 0);

		try {
			// Worker Config (Online/MJS)
			pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

			// 1. Read Current Canvas
			const canvasContent = await this.app.vault.read(canvasFile);
			let canvasData: CanvasData = { nodes: [], edges: [] };
			
			if (canvasContent.trim().length > 0) {
				try {
					const parsed = JSON.parse(canvasContent);
					canvasData = {
						nodes: parsed.nodes || [],
						edges: parsed.edges || []
					};
				} catch (e) { console.error("Canvas parse error", e); }
			}

			// 2. Calculate Start Position
			let startX = -400; 
			let startY = -400;
			if (canvasData.nodes.length > 0) {
				const maxX = canvasData.nodes.reduce((max, node) => Math.max(max, node.x + node.width), -Infinity);
				const minY = canvasData.nodes.reduce((min, node) => Math.min(min, node.y), Infinity);
				startX = maxX + 200; 
				startY = minY;
			}

			// 3. Prepare Folder (Only if NOT in Embed Mode)
			let pdfFolderName = "";
			if (!this.settings.embedMode) {
				const root = this.settings.folderPath;
				if (!this.app.vault.getAbstractFileByPath(root)) {
					await this.app.vault.createFolder(root);
				}
				pdfFolderName = `${root}/${pdfName}`;
				if (!this.app.vault.getAbstractFileByPath(pdfFolderName)) {
					await this.app.vault.createFolder(pdfFolderName);
				}
			}

			// 4. Load PDF
			const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
			const pdfDocument = await loadingTask.promise;
			const pageCount = pdfDocument.numPages;

			const newNodes: CanvasNode[] = [];
			
			// Layout Config
			const gap = 60;
			const columns = 4;
			const jpegQuality = 0.95;

			let groupMinX = Infinity, groupMinY = Infinity, groupMaxX = -Infinity, groupMaxY = -Infinity;

			for (let i = 1; i <= pageCount; i++) {
				notice.setMessage(`Processing page ${i}/${pageCount}...`);

				const page = await pdfDocument.getPage(i);
				const viewport = page.getViewport({ scale: this.settings.renderScale });

				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d');
				canvas.height = viewport.height;
				canvas.width = viewport.width;

				if (context) {
					// Type cast to 'any' to avoid strict type errors in older/newer lib versions
					const renderContext = {
						canvasContext: context,
						viewport: viewport
					};
					await page.render(renderContext as any).promise;

					const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);

					// --- MODE SWITCH: File vs Base64 ---
					let nodeType: 'file' | 'text' = 'file';
					let fileOrTextPayload: any = {};

					const visualWidth = viewport.width / this.settings.renderScale;
					const visualHeight = viewport.height / this.settings.renderScale;

					if (this.settings.embedMode) {
						// EMBED MODE: Create a Text Node with Markdown Image Syntax
						nodeType = 'text';
						fileOrTextPayload = { text: `![](${dataUrl})` };
					} else {
						// FILE MODE: Save to Vault (Allowing user to chose)
						const base64Data = dataUrl.split(',')[1];
						const imageBuffer = this.base64ToArrayBuffer(base64Data);
						const imageName = `Page ${i}.jpg`;
						const imagePath = `${pdfFolderName}/${imageName}`;
						
						const existingFile = this.app.vault.getAbstractFileByPath(imagePath);
						if (existingFile instanceof TFile) {
							await this.app.vault.modifyBinary(existingFile, imageBuffer);
						} else {
							await this.app.vault.createBinary(imagePath, imageBuffer);
						}

						nodeType = 'file';
						fileOrTextPayload = { file: imagePath };
					}

					// Layout
					const col = (i - 1) % columns;
					const row = Math.floor((i - 1) / columns);
					const x = startX + (col * (visualWidth + gap));
					const y = startY + (row * (visualHeight + gap));

					// Track Bounds
					groupMinX = Math.min(groupMinX, x);
					groupMinY = Math.min(groupMinY, y);
					groupMaxX = Math.max(groupMaxX, x + visualWidth);
					groupMaxY = Math.max(groupMaxY, y + visualHeight);

					newNodes.push({
						id: this.generateNodeId(),
						x: x,
						y: y,
						width: visualWidth,
						height: visualHeight,
						type: nodeType,
						...fileOrTextPayload
					});
				}
			}

			// 5. Create Group
			const groupPadding = 40;
			const groupNode: CanvasNode = {
				id: this.generateNodeId(),
				type: 'group',
				label: pdfName,
				x: groupMinX - groupPadding,
				y: groupMinY - groupPadding,
				width: (groupMaxX - groupMinX) + (groupPadding * 2),
				height: (groupMaxY - groupMinY) + (groupPadding * 2)
			};

			canvasData.nodes.push(...newNodes, groupNode);
			await this.app.vault.modify(canvasFile, JSON.stringify(canvasData, null, 2));
			
			notice.hide();
			new Notice(`Imported ${pageCount} pages from "${pdfName}"!`);

		} catch (error) {
			notice.hide();
			console.error('Failed to process PDF:', error);
			new Notice('Error processing PDF. Check console.');
		}
	}

	// --- Helpers ---

	base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binaryString = window.atob(base64);
		const len = binaryString.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	generateNodeId() {
		return 'node' + Math.random().toString(36).substr(2, 14);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// --- SETTINGS TAB ---
class PdfToCanvasSettingTab extends PluginSettingTab {
	plugin: PdfToCanvasPlugin;

	constructor(app: App, plugin: PdfToCanvasPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'PDF to Canvas Settings' });

		new Setting(containerEl)
			.setName('Images Folder')
			.setDesc('Where to save the extracted images (only used if Embed Mode is OFF).')
			.addText(text => text
				.setPlaceholder('Canvas Imports')
				.setValue(this.plugin.settings.folderPath)
				.onChange(async (value) => {
					this.plugin.settings.folderPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Embed Images Directly (No Files)')
			.setDesc('If ON, images are embedded as data inside the canvas file. Saves vault clutter, but makes canvas files huge and slower.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.embedMode)
				.onChange(async (value) => {
					this.plugin.settings.embedMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Image Quality (Scale)')
			.setDesc('Higher = Sharper text, larger files. (Default: 3.0)')
			.addSlider(slider => slider
				.setLimits(1.0, 5.0, 0.5)
				.setValue(this.plugin.settings.renderScale)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.renderScale = value;
					await this.plugin.saveSettings();
				}));
	}
}

// --- MODAL ---
class PdfSelectionModal extends FuzzySuggestModal<TFile> {
	onChoose: (result: TFile) => void;

	constructor(app: App, onChoose: (result: TFile) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles().filter(f => f.extension === 'pdf');
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent) {
		this.onChoose(item);
	}
}