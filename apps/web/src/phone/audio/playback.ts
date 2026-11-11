/**
 * Playback of the gateway's 16 kHz PCM16 chunks through an AudioWorklet ring buffer.
 * `flush()` empties the buffer inside the next render quantum (about 3 ms), which is what makes barge-in feel instant.
 */
import { noteSpeaker } from './levels.js';
import { pcm16ToFloat } from './pcm.js';

const WORKLET = `
class PlayProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.q = []; this.cur = null; this.i = 0; this.pos = 0; this.step = 16000 / sampleRate; this.playing = false; this.last = 0;
    this.port.onmessage = (e) => { const m = e.data; if (m === 'flush') { this.q = []; this.cur = null; this.i = 0; this.pos = 0; if (this.playing) { this.playing = false; this.port.postMessage('idle'); } } else this.q.push(m); }; }
  next() { while (!this.cur || this.i >= this.cur.length) { if (!this.q.length) return false; this.cur = this.q.shift(); this.i = 0; } return true; }
  process(_in, outputs) {
    const out = outputs[0][0]; let any = false;
    for (let n = 0; n < out.length; n++) {
      if (!this.next()) { out[n] = 0; continue; }
      any = true;
      const a = this.cur[this.i]; const b = this.i + 1 < this.cur.length ? this.cur[this.i + 1] : a;
      out[n] = a + (b - a) * this.pos; this.pos += this.step;
      while (this.pos >= 1) { this.pos -= 1; this.i++; }
    }
    if (any && !this.playing) { this.playing = true; this.port.postMessage('busy'); }
    if (!any && this.playing && !this.q.length) { this.playing = false; this.port.postMessage('idle'); }
    return true;
  }
}
registerProcessor('vidur-play', PlayProcessor);
`;

export class Playback {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  /** Fires when sound starts and when the buffer runs dry. */
  onBusy: ((busy: boolean) => void) | null = null;

  async open(): Promise<void> {
    if (this.ctx) return;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, 'vidur-play', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
    node.port.onmessage = (e: MessageEvent<string>) => this.onBusy?.(e.data === 'busy');
    node.connect(ctx.destination);
    this.ctx = ctx;
    this.node = node;
  }

  async resume(): Promise<void> {
    await this.ctx?.resume();
  }

  push(pcm: Int16Array): void {
    noteSpeaker(pcm);
    const f = pcm16ToFloat(pcm);
    this.node?.port.postMessage(f, [f.buffer]);
  }

  /** performance.now() of the last flush, so tests can measure how fast barge-in silences the speaker. */
  lastFlushAt = 0;

  /** Silence now. Anything still buffered is dropped. */
  flush(): void {
    this.lastFlushAt = performance.now();
    this.node?.port.postMessage('flush');
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.node = null;
  }
}
