import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile, requestUrl } from 'obsidian';
import { LinguaSyncSettings } from './types';
import { AudioRecorder } from './voice/audio-recorder';
import { TranscriptionService } from './voice/transcription-service';
import { RecordingModal } from './voice/recording-modal';
import { TTSManager } from './tts/tts-manager';
import { AudioCleaner } from './voice/audio-cleaner';
import * as config from './config.json';

const DEFAULT_SETTINGS: Partial<LinguaSyncSettings> = {
  defaultLanguage: 'en',
  targetLanguage: 'zh',

  enableVoice2Text: true,
  sttApiKey: '',
  sttLanguage: '',
  sttModel: 'whisper-1',
  sttBaseUrl: 'https://llm-k2xjlgq4u73czbcj.cn-beijing.maas.aliyuncs.com',
  saveAudio: true,
  audioFolder: config.paths?.audioFolder || '01-音频/Recordings',
  audioFormat: 'wav',
  audioFilenameTemplate: config.templates?.audioFilename || 'Recording_{{date}}{{seq}}',
  recordOnlyMode: false,

  enableTTS: true,
  ttsApiKey: '',
  ttsWorkspace: config.tts?.workspace || 'llm-k2xjlgq4u73czbcj',
  ttsModel: config.tts?.model || 'qwen-audio-3.0-tts-flash',
  ttsVoice: config.tts?.defaultVoice || 'longanfengyue',
  ttsSpeed: 1.0,
  ttsAudioFolder: config.paths?.ttsAudioFolder || 'AloudFiles',
  ttsFilenameTemplate: config.templates?.ttsFilename || '{{title}}_{{date}}{{time}}_{{seq}}',

  enableAudioCleaner: true,
  audioCleanerDryRun: true,
  audioCleanerWhitelist: [],
  audioCleanerAutoClean: false,
  audioCleanerLastCleanTime: 0,

  enableAITranslation: true,
  aiApiKey: '',
  aiModel: config.ai?.model || 'qwen3.8-max',
  aiBaseUrl: config.ai?.baseUrl || 'https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic',
};

export default class LinguaSyncPlugin extends Plugin {
  settings!: LinguaSyncSettings;
  recorder!: AudioRecorder;
  transcriptionService!: TranscriptionService;
  ttsManager!: TTSManager;
  audioCleaner!: AudioCleaner;
  statusBarItem!: HTMLElement;
  isRecording: boolean = false;
  recordingModal: RecordingModal | null = null;

  async onload() {
    await this.loadSettings();

    this.recorder = new AudioRecorder();
    this.transcriptionService = new TranscriptionService(this.settings);
    this.ttsManager = new TTSManager(this.app, this.settings);
    this.audioCleaner = new AudioCleaner(this.app, this.settings);

    this.injectStyles();

    // Check for automatic daily cleaning
    this.checkAutoClean();

    this.addRibbonIcon('mic', 'Start Voice Recording', () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        this.startRecording(view.editor, view);
      } else {
        new Notice('Please open a Markdown note first.');
      }
    });

    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText('[REC]');
    this.statusBarItem.addEventListener('click', () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        this.startRecording(view.editor, view);
      }
    });

    this.addCommand({
      id: 'start-voice-recording',
      name: 'Start Voice Recording',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'r' }],
      editorCallback: (editor: Editor) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          this.startRecording(editor, view);
        }
      }
    });

    this.addCommand({
      id: 'tts-play-pause',
      name: 'TTS Play/Pause',
      hotkeys: [{ modifiers: ['Mod'], key: 'Space' }],
      editorCallback: (editor: Editor) => {
        const state = this.ttsManager.getState();
        if (state === 'playing') {
          this.ttsManager.pause();
        } else if (state === 'paused') {
          this.ttsManager.resume();
        } else {
          this.speakSelection(editor);
        }
      }
    });

    this.addCommand({
      id: 'tts-stop',
      name: 'TTS Stop',
      hotkeys: [{ modifiers: [], key: 'Escape' }],
      callback: () => {
        this.ttsManager.stop();
      }
    });

    this.addCommand({
      id: 'clean-unused-audio',
      name: 'Clean Unused Audio Files',
      callback: async () => {
        new Notice('Starting audio cleanup...');
        const result = await this.audioCleaner.cleanUnusedAudio();
        new Notice(`Found ${result.unusedCount} unused files, ${result.referencedCount} referenced.`);
      }
    });

    this.addCommand({
      id: 'translate-selection',
      name: 'Translate Selection',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 't' }],
      editorCallback: (editor: Editor) => {
        this.translateSelection(editor);
      }
    });

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const selection = editor.getSelection();
        if (!selection) return;

        if (this.settings.enableTTS) {
          menu.addItem((item) => {
            item
              .setTitle('Speak Selection')
              .setIcon('volume-2')
              .onClick(() => {
                this.speakSelection(editor);
              });
          });
        }

        if (this.settings.enableAITranslation) {
          menu.addItem((item) => {
            item
              .setTitle('Translate Selection')
              .setIcon('languages')
              .onClick(() => {
                this.translateSelection(editor);
              });
          });
        }
      })
    );

    this.addSettingTab(new LinguaSyncSettingTab(this.app, this));
  }

  async startRecording(editor: Editor, view?: MarkdownView) {
    if (!this.settings.enableVoice2Text) {
      new Notice('Please enable Voice to Text in settings.');
      return;
    }

    try {
      await this.recorder.startRecording(this.settings.audioFormat);
      const stream = this.recorder.getStream();

      if (!stream) {
        new Notice('Failed to access microphone.');
        return;
      }

      this.isRecording = true;
      this.statusBarItem.setText('[STOP]');

      this.recordingModal = new RecordingModal(
        this.app,
        async (cancelled: boolean) => {
          this.isRecording = false;
          this.statusBarItem.setText('[REC]');
          this.recordingModal = null;

          if (cancelled) {
            this.recorder.cleanup();
            return;
          }

          new Notice('Processing audio...');
          try {
            const audioBlob = await this.recorder.stopRecording();

            let audioLink = '';
            if (this.settings.saveAudio) {
              try {
                const fileName = await this.saveAudioFile(audioBlob, view?.file?.basename);
                audioLink = `![[${fileName}]]\n`;
              } catch (err: any) {
                new Notice('Failed to save audio: ' + err.message);
              }
            }

            let transcription = '';
            if (!this.settings.recordOnlyMode) {
              try {
                transcription = await this.transcriptionService.transcribe(audioBlob, this.settings.audioFormat);
              } catch (err: any) {
                new Notice('Transcription failed: ' + err.message);
              }
            }

            const finalContent = `${audioLink}${transcription ? transcription + '\n\n' : ''}`;
            if (finalContent) {
              editor.replaceRange(finalContent, editor.getCursor());
            }
          } catch (error: any) {
            new Notice('Error processing recording: ' + error.message);
          }
        },
        () => this.recorder.pauseRecording(),
        () => this.recorder.resumeRecording(),
        stream
      );

      this.recordingModal.open();
    } catch (error: any) {
      new Notice('Failed to start recording: ' + error.message);
      this.isRecording = false;
    }
  }

  async speakSelection(editor: Editor) {
    if (!this.settings.enableTTS) {
      new Notice('Please enable Text to Speech in settings.');
      return;
    }

    const selection = editor.getSelection();
    if (!selection) {
      new Notice('Please select some text to speak.');
      return;
    }

    if (selection.length > 4096) {
      new Notice('Text too long (max 4096 chars).');
      return;
    }

    const from = editor.getCursor('from');
    const to = editor.getCursor('to');

    // Get note title for filename
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const noteTitle = view?.file?.basename;

    try {
      await this.ttsManager.playSelection(selection, editor, from, to, noteTitle);
    } catch (error: any) {
      new Notice('TTS Failed: ' + error.message);
    }
  }

  async translateSelection(editor: Editor) {
    if (!this.settings.enableAITranslation) {
      new Notice('Please enable AI Translation in settings.');
      return;
    }

    const selection = editor.getSelection();
    if (!selection) {
      new Notice('Please select some text to translate.');
      return;
    }

    if (selection.length > 8192) {
      new Notice('Text too long (max 8192 chars).');
      return;
    }

    const notice = new Notice('Translating...', 0);

    try {
      // Detect language and translate
      const isChinese = /[一-龥]/.test(selection);
      const sourceLang = isChinese ? 'Chinese' : 'English';
      const targetLang = isChinese ? 'English' : 'Chinese';

      const userPrompt = `Translate to ${targetLang} (natural, idiomatic, no explanations):\n\n${selection}`;

      const response = await requestUrl({
        url: this.settings.aiBaseUrl + '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.aiApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.settings.aiModel,
          max_tokens: config.ai?.maxTokens || 1500,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        })
      });

      if (response.status !== 200) {
        const errorData = response.json;
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        throw new Error(`API error: ${errorMsg}`);
      }

      const data = response.json;
      // Anthropic API format: content is an array, find the text type
      let translation = '';
      if (data.content && Array.isArray(data.content)) {
        const textContent = data.content.find((item: any) => item.type === 'text');
        if (textContent) {
          translation = textContent.text.trim();
        }
      }

      if (!translation) {
        throw new Error('No translation in response');
      }

      notice.hide();

      // Insert translation below the selected text
      const to = editor.getCursor('to');
      const insertText = `\n\n**Translation:**\n${translation}\n`;
      editor.replaceRange(insertText, to);

      new Notice('Translation inserted');

    } catch (error: any) {
      notice.hide();
      new Notice('Translation failed: ' + error.message);
      console.error('[Translation] Error:', error);
    }
  }

  async saveAudioFile(audioBlob: Blob, noteTitle?: string): Promise<string> {
    const folderPath = this.settings.audioFolder || 'recordings';
    const extension = 'wav';

    const now = window.moment();

    const firstWord = (noteTitle || 'Recording').split(/\s+/)[0]
      .replace(/[\\/:"*?<>|]/g, '')
      .substring(0, 20);
    const dateStr = now.format('YYYYMMDDHHmm');
    const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    let fileName = `${firstWord}_${dateStr}_${randomNum}`;

    let filePath = `${folderPath}/${fileName}.${extension}`;

    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      try {
        await this.app.vault.createFolder(folderPath);
      } catch (err: any) {
        if (!err.message?.includes('Folder already exists')) {
          throw err;
        }
      }
    }

    let attempts = 0;
    while (attempts < 10) {
      try {
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (existingFile) {
          const newRandom = Math.floor(Math.random() * 100).toString().padStart(2, '0');
          fileName = `${firstWord}_${dateStr}_${newRandom}`;
          filePath = `${folderPath}/${fileName}.${extension}`;
          attempts++;
          continue;
        }

        const arrayBuffer = await audioBlob.arrayBuffer();
        await this.app.vault.createBinary(filePath, arrayBuffer);
        return filePath;
      } catch (err: any) {
        if (err.message?.includes('File already exists') || attempts > 0) {
          const newRandom = Math.floor(Math.random() * 100).toString().padStart(2, '0');
          fileName = `${firstWord}_${dateStr}_${newRandom}`;
          filePath = `${folderPath}/${fileName}.${extension}`;
          attempts++;
          continue;
        }
        throw err;
      }
    }

    throw new Error('Failed to generate unique filename after 10 attempts');
  }

  onunload() {
    if (this.recordingModal) {
      this.recordingModal.close();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as LinguaSyncSettings;
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.transcriptionService.updateSettings(this.settings);
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .tts-highlight {
        background-color: var(--text-highlight-bg, rgba(255, 200, 0, 0.3));
        border-radius: 2px;
      }
      .tts-playing {
        background-color: var(--text-highlight-bg, rgba(255, 200, 0, 0.5));
      }
      .translation-modal {
        max-width: 600px;
      }
      .translation-section {
        margin-bottom: 20px;
      }
      .translation-section h3 {
        margin-bottom: 8px;
        font-size: 14px;
        color: var(--text-muted);
      }
      .translation-box {
        padding: 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background-color: var(--background-secondary);
        max-height: 200px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .translation-result {
        background-color: var(--background-primary);
        border-color: var(--interactive-accent);
      }
      .translation-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 20px;
      }
    `;
    document.head.appendChild(style);
  }

  private async checkAutoClean() {
    if (!this.settings.enableAudioCleaner || !this.settings.audioCleanerAutoClean) {
      return;
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const lastClean = this.settings.audioCleanerLastCleanTime || 0;

    // Check if 24 hours have passed since last clean
    if (now - lastClean >= oneDay) {
      console.log('[AudioCleaner] Running automatic daily clean...');
      const result = await this.audioCleaner.cleanUnusedAudio();

      // Update last clean time
      this.settings.audioCleanerLastCleanTime = now;
      await this.saveSettings();

      if (result.deletedCount > 0) {
        new Notice(`Auto-clean: Deleted ${result.deletedCount} unused audio files`);
      }
    }
  }
}

class LinguaSyncSettingTab extends PluginSettingTab {
  plugin: LinguaSyncPlugin;

  constructor(app: App, plugin: LinguaSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'OB English Learner' });

    // API Settings
    containerEl.createEl('h3', { text: 'API Settings' });

    new Setting(containerEl)
      .setName('TTS API Key')
      .setDesc('API Key for TTS service (Qwen Audio)')
      .addText(text => text
        .setPlaceholder('sk-...')
        .setValue(this.plugin.settings.ttsApiKey)
        .onChange(async value => {
          this.plugin.settings.ttsApiKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('AI Translation API Key')
      .setDesc('API Key for AI Translation (Token Plan)')
      .addText(text => text
        .setPlaceholder('sk-sp-...')
        .setValue(this.plugin.settings.aiApiKey)
        .onChange(async value => {
          this.plugin.settings.aiApiKey = value;
          await this.plugin.saveSettings();
        }));

    // STT Settings
    containerEl.createEl('h3', { text: 'Voice to Text (STT)' });

    new Setting(containerEl)
      .setName('Enable STT')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableVoice2Text)
        .onChange(async value => {
          this.plugin.settings.enableVoice2Text = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Audio Folder')
      .addText(text => text
        .setValue(this.plugin.settings.audioFolder)
        .onChange(async value => {
          this.plugin.settings.audioFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Record Only Mode')
      .setDesc('Save audio without transcription')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.recordOnlyMode)
        .onChange(async value => {
          this.plugin.settings.recordOnlyMode = value;
          await this.plugin.saveSettings();
        }));

    // TTS Settings
    containerEl.createEl('h3', { text: 'Text to Speech (TTS)' });

    new Setting(containerEl)
      .setName('Enable TTS')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableTTS)
        .onChange(async value => {
          this.plugin.settings.enableTTS = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Voice')
      .setDesc('Qwen TTS voice name')
      .addDropdown(dropdown => {
        const voices = config.tts?.voices || [
          {id: 'longanfengyue', name: 'longanfengyue (Female, 30)'}
        ];
        voices.forEach((voice: any) => {
          dropdown.addOption(voice.id, voice.name);
        });
        dropdown.setValue(this.plugin.settings.ttsVoice || config.tts?.defaultVoice || 'longanfengyue')
          .onChange(async value => {
            this.plugin.settings.ttsVoice = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Speed')
      .setDesc('Playback speed (0.5 - 2.0)')
      .addText(text => text
        .setValue(String(this.plugin.settings.ttsSpeed))
        .onChange(async value => {
          const speed = parseFloat(value);
          if (!isNaN(speed) && speed >= 0.5 && speed <= 2.0) {
            this.plugin.settings.ttsSpeed = speed;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('TTS Audio Folder')
      .setDesc('Folder to save TTS audio files')
      .addText(text => text
        .setValue(this.plugin.settings.ttsAudioFolder)
        .onChange(async value => {
          this.plugin.settings.ttsAudioFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('TTS Filename Template')
      .setDesc('Template: {{title}}=first word, {{date}}=YYYYMMDD, {{time}}=HHMM, {{seq}}=2-digit random')
      .addText(text => text
        .setValue(this.plugin.settings.ttsFilenameTemplate)
        .onChange(async value => {
          this.plugin.settings.ttsFilenameTemplate = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Test TTS')
      .addButton(button => button
        .setButtonText('Test')
        .onClick(async () => {
          button.setDisabled(true);
          button.setButtonText('Testing...');
          try {
            await this.plugin.ttsManager.testSpeak('Hello, this is a test.');
            new Notice('TTS test successful!');
          } catch (error: any) {
            new Notice('TTS test failed: ' + error.message);
          } finally {
            button.setDisabled(false);
            button.setButtonText('Test');
          }
        }));

    // AI Translation Settings
    containerEl.createEl('h3', { text: 'AI Translation' });

    new Setting(containerEl)
      .setName('Enable AI Translation')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAITranslation)
        .onChange(async value => {
          this.plugin.settings.enableAITranslation = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Test AI Translation')
      .addButton(button => button
        .setButtonText('Test')
        .onClick(async () => {
          button.setDisabled(true);
          button.setButtonText('Testing...');
          try {
            const url = this.plugin.settings.aiBaseUrl + '/v1/messages';
            const apiKey = this.plugin.settings.aiApiKey;

            console.log('[AI Test] URL:', url);
            console.log('[AI Test] API Key length:', apiKey?.length);
            console.log('[AI Test] API Key prefix:', apiKey?.substring(0, 10));
            console.log('[AI Test] Model:', this.plugin.settings.aiModel);

            const response = await requestUrl({
              url: url,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: this.plugin.settings.aiModel,
                max_tokens: 10,
                messages: [
                  { role: 'user', content: 'Hello' }
                ]
              })
            });

            console.log('[AI Test] Response status:', response.status);

            if (response.status === 200) {
              new Notice('AI Translation test successful!');
            } else {
              const errorData = response.json;
              const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
              new Notice(`AI Translation test failed: ${errorMsg}`);
            }
          } catch (error: any) {
            new Notice('AI Translation test failed: ' + error.message);
          } finally {
            button.setDisabled(false);
            button.setButtonText('Test');
          }
        }));

    // Audio Cleaner
    containerEl.createEl('h3', { text: 'Audio Cleaner' });

    new Setting(containerEl)
      .setName('Enable Audio Cleaner')
      .setDesc('Enable audio file cleanup features')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAudioCleaner)
        .onChange(async value => {
          this.plugin.settings.enableAudioCleaner = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.enableAudioCleaner) {
      new Setting(containerEl)
        .setName('Auto Clean (Daily)')
        .setDesc('Automatically clean unused audio files once per day')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.audioCleanerAutoClean)
          .onChange(async value => {
            this.plugin.settings.audioCleanerAutoClean = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Dry Run Mode')
        .setDesc('Preview only, do not delete files (disable to actually delete)')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.audioCleanerDryRun)
          .onChange(async value => {
            this.plugin.settings.audioCleanerDryRun = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Manual Clean')
        .setDesc('Scan and clean unused audio files now')
        .addButton(button => button
          .setButtonText('Clean Now')
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('Scanning...');

            try {
              const result = await this.plugin.audioCleaner.cleanUnusedAudio();

              if (this.plugin.settings.audioCleanerDryRun) {
                new Notice(`Found ${result.unusedCount} unused files (dry run, nothing deleted)`);
              } else {
                new Notice(`Cleaned ${result.deletedCount} unused audio files`);
              }

              // Update last clean time
              this.plugin.settings.audioCleanerLastCleanTime = Date.now();
              await this.plugin.saveSettings();
            } catch (error: any) {
              new Notice('Clean failed: ' + error.message);
            } finally {
              button.setDisabled(false);
              button.setButtonText('Clean Now');
            }
          }));

      // Show last clean time
      const lastClean = this.plugin.settings.audioCleanerLastCleanTime;
      if (lastClean > 0) {
        const lastCleanDate = new Date(lastClean);
        const timeStr = lastCleanDate.toLocaleString();
        containerEl.createEl('p', {
          text: `Last cleaned: ${timeStr}`,
          cls: 'setting-item-description'
        });
      }
    }
  }
}
