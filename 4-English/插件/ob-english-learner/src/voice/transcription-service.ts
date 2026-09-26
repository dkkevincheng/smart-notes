// Transcription Service - 阿里云 ASR

import { requestUrl } from 'obsidian';
import { LinguaSyncSettings } from '../types';

export class TranscriptionService {
  private settings: LinguaSyncSettings;

  constructor(settings: LinguaSyncSettings) {
    this.settings = settings;
  }

  updateSettings(settings: LinguaSyncSettings): void {
    this.settings = settings;
  }

  async transcribe(audioBlob: Blob, format: string): Promise<string> {
    const { sttApiKey, sttModel, sttBaseUrl } = this.settings;

    if (!sttApiKey) {
      throw new Error('STT API key not configured');
    }

    return await this.transcribeASR(audioBlob, format);
  }

  private async transcribeASR(audioBlob: Blob, format: string): Promise<string> {
    const apiKey = this.settings.sttApiKey;
    const model = this.settings.sttModel || 'whisper-1';
    const baseUrl = this.settings.sttBaseUrl || 'https://api.openai.com/v1/audio/transcriptions';

    // Convert blob to base64 for transport
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    try {
      // Use requestUrl for JSON-based transcription (if API supports it)
      // For FormData uploads, we need fetch
      const response = await fetch(`${baseUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: audioBlob
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(errorData.error?.message || 'Transcription failed');
      }

      const data = await response.json() as any;
      return data.text || '';
    } catch (error) {
      console.error('[TranscriptionService] Error:', error);
      throw error;
    }
  }
}
