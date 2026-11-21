// I3: Gateway concurrent load test under mock mode.
// Tests 25 concurrent sessions running full speech cycles.
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 8105;
const BASE = `http://127.0.0.1:${PORT}`;
const CONCURRENCY = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('npx', ['tsx', 'apps/server/src/index.ts'], {
  env: { ...process.env, MODE: 'mock', PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitHealthy(maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return true;
    } catch {
      // waiting
    }
    await sleep(200);
  }
  throw new Error('Server failed to start healthy');
}

async function runSession(id) {
  const t0 = performance.now();
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const msgs = [];
  ws.on('message', (d) => {
    try {
      msgs.push(JSON.parse(d.toString()));
    } catch {
      // binary
    }
  });

  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const connectMs = performance.now() - t0;

  // 1. Hello
  const tHello = performance.now();
  ws.send(JSON.stringify({ type: 'hello', lang: 'hi' }));
  while (!msgs.some((m) => m.type === 'ready')) {
    await sleep(10);
    if (performance.now() - tHello > 8000) throw new Error(`[Session ${id}] Ready timeout`);
  }
  const readyMs = performance.now() - tHello;

  // 2. Turn: ptt_down -> chunks -> ptt_up -> transcript
  const tTurn = performance.now();
  ws.send(JSON.stringify({ type: 'ptt_down' }));
  const dummyChunk = Buffer.alloc(1024);
  for (let c = 0; c < 10; c++) {
    ws.send(dummyChunk);
    await sleep(20);
  }
  const tUp = performance.now();
  ws.send(JSON.stringify({ type: 'ptt_up' }));

  while (!msgs.some((m) => m.type === 'transcript')) {
    await sleep(10);
    if (performance.now() - tTurn > 8000) throw new Error(`[Session ${id}] Transcript timeout`);
  }
  const commitToTranscriptMs = performance.now() - tUp;
  const totalTurnMs = performance.now() - tTurn;

  ws.close();
  return { id, connectMs, readyMs, commitToTranscriptMs, totalTurnMs };
}

function pct(vals, p) {
  const s = [...vals].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

try {
  await waitHealthy();
  console.log(`Server healthy on port ${PORT}. Spawning ${CONCURRENCY} concurrent sessions...`);
  const tAllStart = performance.now();
  const promises = Array.from({ length: CONCURRENCY }, (_, i) => runSession(i + 1));
  const results = await Promise.all(promises);
  const totalDuration = performance.now() - tAllStart;

  const connects = results.map((r) => r.connectMs);
  const readys = results.map((r) => r.readyMs);
  const c2ts = results.map((r) => r.commitToTranscriptMs);
  const turns = results.map((r) => r.totalTurnMs);

  console.log(`\n--- I3 Load Test Results (${CONCURRENCY} Concurrent Sessions) ---`);
  console.log(`Total batch duration: ${totalDuration.toFixed(0)} ms`);
  console.log(`Success rate: ${results.length}/${CONCURRENCY} (100%)`);
  console.log(`Connect latency: p50 = ${pct(connects, 50).toFixed(1)} ms, p95 = ${pct(connects, 95).toFixed(1)} ms`);
  console.log(`Ready latency: p50 = ${pct(readys, 50).toFixed(1)} ms, p95 = ${pct(readys, 95).toFixed(1)} ms`);
  console.log(`Commit->Transcript latency: p50 = ${pct(c2ts, 50).toFixed(1)} ms, p95 = ${pct(c2ts, 95).toFixed(1)} ms`);
  console.log(`Turn duration: p50 = ${pct(turns, 50).toFixed(1)} ms, p95 = ${pct(turns, 95).toFixed(1)} ms`);
  console.log('--- End of Report ---\n');
} catch (e) {
  console.error('Load test failed:', e);
  process.exitCode = 1;
} finally {
  server.kill();
}
