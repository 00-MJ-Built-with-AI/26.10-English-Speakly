/** One shared microphone stream for the whole app, so the browser asks for permission once. */
let shared: Promise<MediaStream> | undefined;

export function micStream(): Promise<MediaStream> {
  if (!shared) {
    shared = navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
      .catch((err) => {
        shared = undefined;
        throw err;
      });
  }
  return shared.then((s) => {
    if (s.getAudioTracks().every((t) => t.readyState === 'ended')) {
      shared = undefined;
      return micStream();
    }
    return s;
  });
}

export function hasMicApi(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Records the learner's voice alongside recognition. */
export class VoiceRecorder {
  private rec?: MediaRecorder;
  private chunks: Blob[] = [];
  private stopped?: Promise<Blob | undefined>;

  start(stream: MediaStream): void {
    if (typeof MediaRecorder === 'undefined') return;
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
    this.rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.stopped = new Promise((resolve) => {
      this.rec!.onstop = () => resolve(this.chunks.length ? new Blob(this.chunks, { type: this.rec!.mimeType }) : undefined);
    });
    this.rec.start(1000);
  }
  pause(): void {
    if (this.rec?.state === 'recording') this.rec.pause();
  }
  resume(): void {
    if (this.rec?.state === 'paused') this.rec.resume();
  }
  stop(): Promise<Blob | undefined> {
    if (!this.rec || this.rec.state === 'inactive') return this.stopped ?? Promise.resolve(undefined);
    this.rec.stop();
    return this.stopped!;
  }
}
