import { App, TFile } from 'obsidian';
import { LinguaSyncSettings, AudioFileInfo } from '../types';

export interface AudioCleanResult {
  totalScanned: number;
  referencedCount: number;
  unusedCount: number;
  unusedFiles: AudioFileInfo[];
  deletedCount: number;
  errors: string[];
}

export class AudioCleaner {
  private app: App;
  private settings: LinguaSyncSettings;

  constructor(app: App, settings: LinguaSyncSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Scan audio folders and find all audio files
   */
  async scanAudioFiles(): Promise<AudioFileInfo[]> {
    const audioFiles: AudioFileInfo[] = [];

    // Scan both recording folder and TTS folder
    const foldersToScan = [
      this.settings.audioFolder,
      this.settings.ttsAudioFolder
    ].filter(folder => folder && folder.trim() !== '');

    // Get all files in vault
    const allFiles = this.app.vault.getAllLoadedFiles();

    for (const file of allFiles) {
      if (file instanceof TFile) {
        // Check if file is in any of the audio folders
        const isInAudioFolder = foldersToScan.some(folder => file.path.startsWith(folder));

        if (isInAudioFolder) {
          const ext = file.extension.toLowerCase();
          // Check if it's an audio file
          if (['wav', 'mp3', 'webm', 'ogg', 'm4a', 'aac'].includes(ext)) {
            audioFiles.push({
              path: file.path,
              name: file.name,
              size: file.stat.size,
              mtime: file.stat.mtime,
              referenced: false
            });
          }
        }
      }
    }

    return audioFiles;
  }

  /**
   * Check which audio files are referenced in markdown documents
   */
  async findReferencedAudio(): Promise<Set<string>> {
    const referencedFiles = new Set<string>();
    const allFiles = this.app.vault.getMarkdownFiles();

    for (const mdFile of allFiles) {
      try {
        const content = await this.app.vault.read(mdFile);

        // Check for Obsidian audio link syntax: ![[filename]] or ![[path/to/file]]
        const linkPattern = /!\[\[([^\]|]+\.(?:wav|mp3|webm|ogg|m4a|aac))\]\]/gi;
        let match;

        while ((match = linkPattern.exec(content)) !== null) {
          referencedFiles.add(match[1]);
        }

        // Also check for wiki links without the ! prefix (just references)
        const refPattern = /\[\[([^\]|]+\.(?:wav|mp3|webm|ogg|m4a|aac))\]\]/gi;
        while ((match = refPattern.exec(content)) !== null) {
          referencedFiles.add(match[1]);
        }

      } catch (err) {
        console.error(`[AudioCleaner] Failed to read ${(mdFile as any).path}:`, err);
      }
    }

    return referencedFiles;
  }

  /**
   * Mark audio files as referenced or not
   */
  async markReferencedFiles(audioFiles: AudioFileInfo[]): Promise<void> {
    const referencedAudio = await this.findReferencedAudio();

    for (const audio of audioFiles) {
      // Check if filename or full path is referenced
      if (referencedAudio.has(audio.name) || referencedAudio.has(audio.path)) {
        audio.referenced = true;
      }

      // Also check with different path variations
      const basename = audio.name;
      if (referencedAudio.has(basename)) {
        audio.referenced = true;
      }
    }
  }

  /**
   * Clean unused audio files
   */
  async cleanUnusedAudio(): Promise<AudioCleanResult> {
    const result: AudioCleanResult = {
      totalScanned: 0,
      referencedCount: 0,
      unusedCount: 0,
      unusedFiles: [],
      deletedCount: 0,
      errors: []
    };

    // Check if audio cleaner is enabled
    if (!this.settings.enableAudioCleaner) {
      result.errors.push('Audio cleaner is disabled in settings');
      return result;
    }

    try {
      // 1. Scan audio files
      const audioFiles = await this.scanAudioFiles();
      result.totalScanned = audioFiles.length;

      // 2. Mark referenced files
      await this.markReferencedFiles(audioFiles);

      // 3. Filter unused files
      const unusedFiles = audioFiles.filter(f => !f.referenced);

      // Apply whitelist filter
      const whitelist = this.settings.audioCleanerWhitelist || [];
      const filteredUnused = unusedFiles.filter(f => {
        // Check if file is in whitelist (by name or path)
        return !whitelist.some(w => f.name === w || f.path === w);
      });

      result.unusedCount = filteredUnused.length;
      result.unusedFiles = filteredUnused;
      result.referencedCount = result.totalScanned - result.unusedCount;

      // 4. Delete unused files (if not dry run)
      if (!this.settings.audioCleanerDryRun) {
        for (const file of filteredUnused) {
          try {
            const tFile = this.app.vault.getAbstractFileByPath(file.path);
            if (tFile instanceof TFile) {
              await this.app.vault.delete(tFile);
              result.deletedCount++;
              console.log(`[AudioCleaner] Deleted: ${file.path}`);
            }
          } catch (err: any) {
            const errorMsg = `Failed to delete ${file.path}: ${err.message}`;
            result.errors.push(errorMsg);
            console.error(`[AudioCleaner] ${errorMsg}`);
          }
        }
      }

    } catch (err: any) {
      result.errors.push(`Scan failed: ${err.message}`);
      console.error('[AudioCleaner] Scan failed:', err);
    }

    return result;
  }

  /**
   * Get summary of audio files (for preview)
   */
  async getAudioSummary(): Promise<{
    total: number;
    referenced: number;
    unused: number;
    unusedFiles: AudioFileInfo[];
  }> {
    const audioFiles = await this.scanAudioFiles();
    await this.markReferencedFiles(audioFiles);

    const unusedFiles = audioFiles.filter(f => !f.referenced);

    return {
      total: audioFiles.length,
      referenced: audioFiles.length - unusedFiles.length,
      unused: unusedFiles.length,
      unusedFiles: unusedFiles
    };
  }
}
