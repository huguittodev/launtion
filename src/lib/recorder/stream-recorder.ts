/**
 * stream-recorder.ts
 *
 * MediaStream and MediaRecorder manager for browser screen recording.
 * Wraps navigator.mediaDevices.getDisplayMedia with cursor suppression ('never'),
 * progressive codec negotiation (VP9 -> VP8 -> H264 -> WebM -> MP4),
 * chunk timeslicing, and automatic stop detection via track.onended.
 */

import type { StreamRecorderOptions } from './types';

export const DEFAULT_CODEC_CANDIDATES: string[] = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=h264',
  'video/webm',
  'video/mp4;codecs=avc1',
  'video/mp4',
];

/**
 * Resolves the optimal supported video MIME type for the host browser.
 */
export function resolveOptimalMimeType(
  candidates: string[] = DEFAULT_CODEC_CANDIDATES
): string {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return '';
  }

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // Continue to next candidate
    }
  }

  return '';
}

export interface StreamRecorderStartResult {
  stream: MediaStream;
  t0_ms: number;
  mimeType: string;
  resolution: { width: number; height: number };
}

export interface StreamRecorderStopResult {
  videoBlob: Blob;
  videoUrl?: string;
  mimeType: string;
  duration_ms: number;
  resolution: { width: number; height: number };
}

export class StreamRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private t0_ms = 0;
  private tEnd_ms = 0;
  private selectedMimeType = '';
  private resolution = { width: 1920, height: 1080 };
  private onStreamEndedCallback: (() => void) | null = null;
  private isRecordingActive = false;

  constructor(private options?: StreamRecorderOptions) {}

  private getEffectiveMimeType(): string {
    return (
      this.mediaRecorder?.mimeType ||
      this.selectedMimeType ||
      'video/webm'
    );
  }

  public static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  public async start(onStreamEnded?: () => void): Promise<StreamRecorderStartResult> {
    if (!StreamRecorder.isSupported()) {
      throw new Error(
        'Screen recording is not supported in this browser environment. Ensure HTTPS or localhost is used.'
      );
    }

    this.onStreamEndedCallback = onStreamEnded ?? null;
    this.recordedChunks = [];
    this.isRecordingActive = true;

    const fps = this.options?.fps ?? 30;
    const captureCursor = this.options?.captureCursor ?? this.options?.video?.cursor ?? 'never';

    const constraints: DisplayMediaStreamOptions = {
      video: {
        frameRate: { ideal: fps, max: 60 },
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
        // @ts-expect-error - cursor property is standard in W3C Screen Capture API
        cursor: captureCursor,
      },
      audio: this.options?.audio ?? this.options?.captureAudio ?? true,
    };

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (err) {
      this.isRecordingActive = false;
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.name === 'NotAllowedError') {
        throw new Error('Permiso denegado o selección de pantalla cancelada.');
      }
      throw error;
    }

    // Inspect video track settings
    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings ? videoTrack.getSettings() : undefined;
      this.resolution = {
        width: settings?.width || 1920,
        height: settings?.height || 1080,
      };

      // Listen for native floating banner "Stop sharing" click
      videoTrack.addEventListener('ended', () => {
        if (this.tEnd_ms === 0 && this.t0_ms > 0) {
          this.tEnd_ms = typeof performance !== 'undefined' ? performance.now() : Date.now();
        }
        if (this.onStreamEndedCallback && this.isRecordingActive) {
          this.onStreamEndedCallback();
        }
      });
    }

    // Negotiate MIME type
    const candidateList = this.options?.mimeTypePreference ?? DEFAULT_CODEC_CANDIDATES;
    this.selectedMimeType = resolveOptimalMimeType(candidateList);

    const recorderOptions: MediaRecorderOptions = {};
    if (this.selectedMimeType) {
      recorderOptions.mimeType = this.selectedMimeType;
    }
    if (this.options?.videoBitsPerSecond) {
      recorderOptions.videoBitsPerSecond = this.options.videoBitsPerSecond;
    }

    try {
      try {
        this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
      } catch {
        // Fallback without options if mimeType caused initialization issue
        this.selectedMimeType = '';
        this.mediaRecorder = new MediaRecorder(this.stream);
      }

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = () => {
        this.isRecordingActive = false;
        this.cleanupTracks();
      };

      this.t0_ms = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const timeslice = this.options?.timesliceMs ?? 500;
      this.mediaRecorder.start(timeslice);
    } catch (err) {
      this.isRecordingActive = false;
      this.cleanupTracks();
      throw err;
    }

    return {
      stream: this.stream,
      t0_ms: this.t0_ms,
      mimeType: this.getEffectiveMimeType(),
      resolution: this.resolution,
    };
  }

  public async stop(): Promise<StreamRecorderStopResult> {
    this.isRecordingActive = false;

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const effectiveEnd = this.tEnd_ms > 0 ? this.tEnd_ms : (this.t0_ms > 0 ? now : 0);
      const duration_ms = this.t0_ms > 0 ? Math.max(0, effectiveEnd - this.t0_ms) : 0;
      this.tEnd_ms = effectiveEnd;

      this.cleanupTracks();
      const effectiveMime = this.getEffectiveMimeType();
      const finalBlob = new Blob(this.recordedChunks, {
        type: effectiveMime,
      });
      const videoUrl =
        typeof URL !== 'undefined' && URL.createObjectURL
          ? URL.createObjectURL(finalBlob)
          : undefined;

      return {
        videoBlob: finalBlob,
        videoUrl,
        mimeType: effectiveMime,
        duration_ms,
        resolution: this.resolution,
      };
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) return;

      this.mediaRecorder.onstop = () => {
        this.tEnd_ms = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const duration_ms = Math.max(0, this.tEnd_ms - this.t0_ms);
        const effectiveMime = this.getEffectiveMimeType();
        const finalBlob = new Blob(this.recordedChunks, {
          type: effectiveMime,
        });
        const videoUrl =
          typeof URL !== 'undefined' && URL.createObjectURL
            ? URL.createObjectURL(finalBlob)
            : undefined;

        this.cleanupTracks();

        resolve({
          videoBlob: finalBlob,
          videoUrl,
          mimeType: effectiveMime,
          duration_ms,
          resolution: this.resolution,
        });
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        // If stop fails synchronously, force resolution
        this.cleanupTracks();
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.tEnd_ms = this.tEnd_ms > 0 ? this.tEnd_ms : now;
        const duration_ms = this.t0_ms > 0 ? Math.max(0, this.tEnd_ms - this.t0_ms) : 0;
        const effectiveMime = this.getEffectiveMimeType();
        const finalBlob = new Blob(this.recordedChunks, {
          type: effectiveMime,
        });
        const videoUrl =
          typeof URL !== 'undefined' && URL.createObjectURL
            ? URL.createObjectURL(finalBlob)
            : undefined;
        resolve({
          videoBlob: finalBlob,
          videoUrl,
          mimeType: effectiveMime,
          duration_ms,
          resolution: this.resolution,
        });
      }
    });
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public isRecording(): boolean {
    return this.isRecordingActive && this.mediaRecorder?.state === 'recording';
  }

  private cleanupTracks(): void {
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {
        // Ignore cleanup errors
      }
      this.stream = null;
    }
  }
}
