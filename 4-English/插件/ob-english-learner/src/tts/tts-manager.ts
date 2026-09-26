// TTS Manager with Qwen TTS support
import { App, Editor, Notice, requestUrl, TFile } from 'obsidian';
import { LinguaSyncSettings } from '../types';
import * as config from '../config.json';

export interface TTSChunk {
    text: string;
    start: number;
    end: number;
}

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

export class TTSManager {
    app: App;
    settings: LinguaSyncSettings;
    currentState: PlaybackState = 'idle';
    chunks: TTSChunk[] = [];
    currentChunkIndex: number = 0;
    editor: Editor | null = null;
    audioElement: HTMLAudioElement | null = null;
    currentAudioUrl: string | null = null;
    isPaused: boolean = false;
    pausedAt: number = 0;

    constructor(app: App, settings: LinguaSyncSettings) {
        this.app = app;
        this.settings = settings;
    }

    getState(): PlaybackState {
        return this.currentState;
    }

    play(): void {
        if (this.audioElement) {
            this.audioElement.play();
            this.currentState = 'playing';
        }
    }

    pause(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.currentState = 'paused';
        }
    }

    resume(): void {
        if (this.audioElement) {
            this.audioElement.play();
            this.currentState = 'playing';
        }
    }

    stop(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.currentState = 'idle';
        }
    }

    setPlaybackSpeed(speed: number): void {
        if (this.audioElement) {
            this.audioElement.playbackRate = speed;
        }
    }

    next(): void {
        console.log('[TTSManager] Next sentence');
    }

    previous(): void {
        console.log('[TTSManager] Previous sentence');
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const audioBuffer = await this.speakQwen('Hello');
            return { success: true, message: `Connection OK, audio size: ${audioBuffer.byteLength}` };
        } catch (error: any) {
            return { success: false, message: error.message || 'Connection failed' };
        }
    }

    private getEndpoint(): string {
        let baseUrl = this.settings.sttBaseUrl?.trim() || '';
        if (!baseUrl) {
            baseUrl = 'https://llm-k2xjlgq4u73czbcj.cn-beijing.maas.aliyuncs.com';
        }
        baseUrl = baseUrl.replace(/\/$/, '');

        // 提取 WorkspaceId (如 llm-xxx)
        const match = baseUrl.match(/https?:\/\/(llm-[a-z0-9]+)/i);
        const workspaceId = match ? match[1] : 'llm-k2xjlgq4u73czbcj';

        return `https://${workspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`;
    }

    async playSelection(
        text: string,
        editor: Editor,
        from: { line: number; ch: number },
        to: { line: number; ch: number },
        noteTitle?: string
    ): Promise<void> {
        console.log('[TTSManager] Playing selection:', text.substring(0, 50));

        try {
            this.currentState = 'loading';

            // Check for cached audio
            const cachedFile = await this.getCachedAudio(noteTitle);
            let audioBuffer: ArrayBuffer;

            if (cachedFile) {
                console.log('[TTSManager] Using cached audio:', cachedFile.path);
                audioBuffer = await this.app.vault.readBinary(cachedFile);
            } else {
                console.log('[TTSManager] No cache found, calling API');
                audioBuffer = await this.speakQwen(text);

                // Save to vault
                await this.saveAudioToVault(noteTitle, audioBuffer, editor, to);
            }

            // Create audio URL
            if (this.currentAudioUrl) {
                URL.revokeObjectURL(this.currentAudioUrl);
            }
            this.currentAudioUrl = URL.createObjectURL(new Blob([audioBuffer], { type: 'audio/wav' }));

            // Play audio
            this.audioElement = new Audio(this.currentAudioUrl);
            this.audioElement.playbackRate = this.settings.ttsSpeed || 1.0;

            this.audioElement.onended = () => {
                this.currentState = 'idle';
            };

            this.audioElement.onerror = (err) => {
                console.error('[TTSManager] Audio error:', err);
                this.currentState = 'idle';
                new Notice('TTS playback error');
            };

            await this.audioElement.play();
            this.currentState = 'playing';

        } catch (error: any) {
            console.error('[TTSManager] Error:', error);
            this.currentState = 'idle';
            new Notice('TTS Error: ' + (error.message || 'Unknown error'));
            throw error;
        }
    }

    private async speakQwen(text: string): Promise<ArrayBuffer> {
        const apiKey = this.settings.ttsApiKey;
        if (!apiKey) {
            throw new Error('TTS API key not configured');
        }

        const workspaceId = this.settings.ttsWorkspace || config.tts?.workspace || 'llm-k2xjlgq4u73czbcj';
        const endpoint = `https://${workspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`;

        const voice = this.settings.ttsVoice || config.tts?.defaultVoice || 'longanfengyue';
        const model = config.tts?.model || 'qwen-audio-3.0-tts-flash';

        console.log('[TTS] Qwen-Audio-TTS Request:', { endpoint, model, voice, textLength: text.length });

        try {
            const response = await requestUrl({
                url: endpoint,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    input: {
                        text: text,
                        voice: voice,
                        format: 'wav',
                        sample_rate: 24000
                    }
                })
            });

            if (response.status !== 200) {
                const errorText = JSON.stringify(response);
                console.error('[TTS] Qwen-Audio-TTS Error:', response.status, errorText);
                throw new Error(`Qwen-Audio-TTS failed: ${response.status}`);
            }

            console.log('[TTS] Qwen-Audio-TTS Response status:', response.status);
            const json = response.json;
            console.log('[TTS] Qwen-Audio-TTS Response:', JSON.stringify(json).substring(0, 500));

            if (json.code && json.code !== '') {
                throw new Error(`Qwen-Audio-TTS failed: ${json.code} - ${json.message}`);
            }

            let audioBuffer: ArrayBuffer;

            // Check for audio URL
            const audioData = json.output?.audio;
            if (audioData?.url) {
                console.log('[TTS] Downloading audio from URL:', audioData.url);
                const audioResponse = await requestUrl({
                    url: audioData.url,
                    method: 'GET'
                });
                audioBuffer = audioResponse.arrayBuffer;
            } else if (audioData?.data) {
                // Decode base64
                console.log('[TTS] Decoding base64 audio data, length:', audioData.data.length);
                const binaryString = atob(audioData.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                audioBuffer = bytes.buffer;
            } else {
                throw new Error('No audio data in response');
            }

            console.log('[TTS] Received audio buffer, size:', audioBuffer.byteLength);
            return audioBuffer;

        } catch (error: any) {
            console.error('[TTS] Qwen-Audio-TTS error:', error);
            throw new Error(`Qwen-Audio-TTS error: ${error.message}`);
        }
    }

    async testSpeak(text: string): Promise<void> {
        const audioBuffer = await this.speakQwen(text);

        // Create audio URL
        if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
        }
        this.currentAudioUrl = URL.createObjectURL(new Blob([audioBuffer], { type: 'audio/wav' }));

        // Play audio
        this.audioElement = new Audio(this.currentAudioUrl);
        this.audioElement.playbackRate = this.settings.ttsSpeed || 1.0;

        return new Promise((resolve, reject) => {
            if (!this.audioElement) {
                reject(new Error('Audio element not created'));
                return;
            }

            this.audioElement.onended = () => {
                this.currentState = 'idle';
                resolve();
            };

            this.audioElement.onerror = (err) => {
                console.error('[TTSManager] Audio error:', err);
                this.currentState = 'idle';
                reject(new Error('Audio playback error'));
            };

            this.audioElement.play()
                .then(() => {
                    this.currentState = 'playing';
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    private generateFilename(noteTitle?: string): string {
        // Use template from settings
        const template = this.settings.ttsFilenameTemplate || '{{title}}_{{date}}{{time}}_{{seq}}';

        const title = (noteTitle || 'Audio').split(/\s+/)[0]
            .replace(/[\\/:"*?<>|]/g, '')
            .substring(0, 20);

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        const dateStr = `${year}${month}${day}`;
        const timeStr = `${hours}${minutes}`;
        const randomNum = String(Math.floor(Math.random() * 100)).padStart(2, '0');

        // Replace template variables
        let filename = template
            .replace(/\{\{title\}\}/g, title)
            .replace(/\{\{date\}\}/g, dateStr)
            .replace(/\{\{time\}\}/g, timeStr)
            .replace(/\{\{seq\}\}/g, randomNum);

        return `${filename}.wav`;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36).substring(0, 6);
    }

    private async getCachedAudio(noteTitle?: string): Promise<TFile | null> {
        const folder = this.settings.ttsAudioFolder || 'AloudFiles';
        const filename = this.generateFilename(noteTitle);
        const filePath = `${folder}/${filename}`;

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            return file;
        }
        return null;
    }

    private async saveAudioToVault(
        noteTitle: string | undefined,
        audioBuffer: ArrayBuffer,
        editor: Editor,
        to: { line: number; ch: number }
    ): Promise<void> {
        const folder = this.settings.ttsAudioFolder || 'AloudFiles';
        const filename = this.generateFilename(noteTitle);
        const filePath = `${folder}/${filename}`;

        // Ensure folder exists
        const folderObj = this.app.vault.getAbstractFileByPath(folder);
        if (!folderObj) {
            try {
                await this.app.vault.createFolder(folder);
            } catch (err: any) {
                if (!err.message?.includes('Folder already exists')) {
                    console.error('[TTSManager] Failed to create folder:', err);
                    return;
                }
            }
        }

        // Save audio file
        try {
            await this.app.vault.createBinary(filePath, audioBuffer);
            console.log('[TTSManager] Saved audio to:', filePath);

            // Insert reference after selected text
            const audioRef = `\n![[${filename}]]\n`;
            editor.replaceRange(audioRef, to);
            console.log('[TTSManager] Inserted audio reference');
        } catch (err: any) {
            if (err.message?.includes('File already exists')) {
                console.log('[TTSManager] Audio file already exists');
            } else {
                console.error('[TTSManager] Failed to save audio:', err);
            }
        }
    }

    async getCacheSize(): Promise<number> {
        const folder = this.settings.ttsAudioFolder || 'AloudFiles';
        const folderObj = this.app.vault.getAbstractFileByPath(folder);

        if (!folderObj) {
            return 0;
        }

        let totalSize = 0;
        const files = this.app.vault.getFiles();
        for (const file of files) {
            if (file.path.startsWith(folder) && file.extension === 'wav') {
                totalSize += file.stat.size;
            }
        }
        return totalSize;
    }

    async clearCache(): Promise<void> {
        const folder = this.settings.ttsAudioFolder || 'AloudFiles';
        const files = this.app.vault.getFiles();

        let count = 0;
        for (const file of files) {
            if (file.path.startsWith(folder) && file.extension === 'wav' && file.basename.startsWith('TTS_')) {
                await this.app.vault.delete(file);
                count++;
            }
        }

        new Notice(`TTS Cache cleared: ${count} files deleted`);
    }
}
