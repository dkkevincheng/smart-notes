// Audio Recorder - WebM based recording
// Uses MediaRecorder API which is supported in all modern browsers

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private leftChannelData: Float32Array[] = [];
  private recordingLength: number = 0;
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private stream: MediaStream | null = null;
  private sampleRate: number = 16000;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private format: 'wav' | 'webm' | 'mp3' = 'webm';
  private startTime: number | null = null;

  async startRecording(format: 'wav' | 'webm' | 'mp3' = 'webm'): Promise<void> {
    this.format = format;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.startTime = Date.now();

      if (format === 'wav') {
        // WAV Recording using AudioContext
        // @ts-ignore - AudioContext is standard
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);

        // Buffer size must be power of 2
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        this.mediaStreamSource.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        this.processor.onaudioprocess = (e) => {
          if (!this.isRecording || this.isPaused) return;

          const left = e.inputBuffer.getChannelData(0);
          const leftCloned = new Float32Array(left);
          this.leftChannelData.push(leftCloned);
          this.recordingLength += leftCloned.length;
        };

        this.leftChannelData = [];
        this.recordingLength = 0;
      } else {
        // WebM Recording using MediaRecorder
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        }

        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
        this.recordedChunks = [];

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };

        this.mediaRecorder.start(100); // Collect 100ms chunks
      }

      this.isRecording = true;
    } catch (error) {
      console.error('[AudioRecorder] Failed to start recording:', error);
      throw new Error('Failed to access microphone: ' + (error as Error).message);
    }
  }

  pauseRecording(): void {
    this.isPaused = true;
    if (this.format === 'wav') {
      if (this.audioContext && this.audioContext.state === 'running') {
        this.audioContext.suspend();
      }
    } else {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }
    }
  }

  resumeRecording(): void {
    this.isPaused = false;
    if (this.format === 'wav') {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    } else {
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }
    }
  }

  async stopRecording(): Promise<Blob> {
    this.isRecording = false;
    this.isPaused = false;

    let blob: Blob;

    if (this.format === 'wav') {
      // Stop WAV processing
      if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
      }
      if (this.mediaStreamSource) {
        this.mediaStreamSource.disconnect();
      }

      // Process WAV data
      const pcmBuffer = this.flattenAudioBuffers(this.leftChannelData, this.recordingLength);
      blob = this.encodeWAV(pcmBuffer, this.sampleRate);
    } else {
      // Stop MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        const stopPromise = new Promise<void>((resolve) => {
          if (!this.mediaRecorder) return resolve();
          this.mediaRecorder.onstop = () => resolve();
          this.mediaRecorder.stop();
        });
        await stopPromise;
      }

      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      blob = new Blob(this.recordedChunks, { type: mimeType });

      // Note: MP3 conversion requires additional library (e.g., FFmpeg)
      // For now, WebM is saved as-is
      if (this.format === 'mp3') {
        console.warn('[AudioRecorder] MP3 format requested but not implemented, saving as WebM');
      }
    }

    // Cleanup
    this.cleanup();

    return blob;
  }

  private flattenAudioBuffers(buffers: Float32Array[], totalLength: number): Float32Array {
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, 36 + samples.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, samples.length * 2, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      // 16-bit PCM
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getRecordingDuration(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(e => console.error(e));
      }
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.leftChannelData = [];
    this.recordingLength = 0;
    this.isRecording = false;
    this.isPaused = false;
    this.recordedChunks = [];
    this.startTime = null;
  }
}
