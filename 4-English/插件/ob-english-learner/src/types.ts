// Types for OB English Learner Plugin

export interface LinguaSyncSettings {
  // General
  defaultLanguage: string;
  targetLanguage: string;

  // Voice to Text
  enableVoice2Text: boolean;
  sttApiKey: string;
  sttLanguage: string;
  sttModel: string;
  sttBaseUrl: string;
  saveAudio: boolean;
  audioFolder: string;
  audioFormat: 'wav' | 'webm' | 'mp3';
  audioFilenameTemplate: string;
  recordOnlyMode: boolean;

  // Text to Speech
  enableTTS: boolean;
  ttsApiKey: string;
  ttsWorkspace: string;
  ttsModel: string;
  ttsVoice: string;
  ttsSpeed: number;
  ttsAudioFolder: string;
  ttsFilenameTemplate: string;

  // Audio Cleaner
  enableAudioCleaner: boolean;
  audioCleanerDryRun: boolean;
  audioCleanerWhitelist: string[];
  audioCleanerAutoClean: boolean;
  audioCleanerLastCleanTime: number;

  // AI Translation
  enableAITranslation: boolean;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
}

export interface AudioFileInfo {
  path: string;
  name: string;
  size: number;
  mtime: number;
  referenced: boolean;
}
