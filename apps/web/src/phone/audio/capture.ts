/**
 * Microphone capture: getUserMedia with the browser's echo cancellation, noise suppression and auto gain,
 * an AudioWorklet that resamples to 16 kHz PCM16 and cuts exact 512-sample frames, and a 300 ms pre-roll ring.
 * The worklet's source is built from the same `Capturer` class the unit tests cover.
 */
import { Capturer, PreRoll, pcm16ToBytes } from './pcm.js';

const WORKLET = `
const Capturer = ${Capturer.toString()};
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.c = new Capturer(sampleRate, 16000); this.on = true;
    this.port.onmessage = (e) => { if (e.data === 'flush') { const f = this.c.flush(); if (f) this.port.postMessage(f, [f.buffer]); } }; }
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) { for (const f of this.c.push(ch)) this.port.postMessage(f, [f.buffer]); } return true; }
}
registerProcessor('vidur-capture', CaptureProcessor);
`;

export type FrameSink = (frame: ArrayBuffer) => void;

export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private readonly pre = new PreRoll(300, 32);
  private sink: FrameSink | null = null;
  /** Everything captured while a press is active; used for the intelligibility dump and tests. */
  recording: Int16Array[] | null = null;

  get isOpen(): boolean {
    return this.ctx !== null;
  }

  /** Opens the mic. Must be called from a user gesture on iOS. Throws if permission is refused. */
  async open(): Promise<void> {
    if (this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(ctx, 'vidur-capture', { numberOfInputs: 1, numberOfOutputs: 0 });
    node.port.onmessage = (e: MessageEvent<Int16Array>) => this.onFrame(e.data);
    src.connect(node);
    this.ctx = ctx;
    this.node = node;
  }

  private feed: ReturnType<typeof setInterval> | null = null;

  /** Test hook: when `window.__vidurTestClip` is set, a press sends that clip at real-time pace instead of the microphone. */
  private static testClip(): Int16Array | null {
    return (globalThis as { __vidurTestClip?: Int16Array }).__vidurTestClip ?? null;
  }

  private onFrame(frame: Int16Array): void {
    if (MicCapture.testClip()) return; // test mode: the microphone is ignored
    if (this.sink) {
      this.recording?.push(frame);
      this.sink(pcm16ToBytes(frame));
    } else this.pre.push(frame);
  }

  /** Start sending. The last 300 ms are sent first, in a burst, so the first syllable is not lost. */
  begin(sink: FrameSink): void {
    void this.ctx?.resume();
    this.recording = [];
    for (const f of this.pre.drain()) {
      this.recording.push(f);
      sink(pcm16ToBytes(f));
    }
    this.sink = sink;
    const clip = MicCapture.testClip();
    if (clip) {
      let i = 0;
      this.feed = setInterval(() => {
        if (i >= clip.length) return void (this.feed && clearInterval(this.feed));
        const f = new Int16Array(512);
        f.set(clip.subarray(i, i + 512));
        i += 512;
        this.recording?.push(f);
        sink(pcm16ToBytes(f));
      }, 32);
    }
  }

  /** Stop sending. Returns after the last partial frame has been delivered. */
  end(): void {
    if (this.feed) clearInterval(this.feed);
    this.feed = null;
    this.node?.port.postMessage('flush');
    setTimeout(() => (this.sink = null), 30);
  }

  close(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.stream = null;
    this.node = null;
  }
}
