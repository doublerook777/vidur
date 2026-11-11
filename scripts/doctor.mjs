#!/usr/bin/env node
// Checks that Vidur is ready to run: Node version, .env, your Gnani key against both speech sockets, the optional LLM key, the port.
// Never prints a key. Usage: npm run doctor
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import WebSocket from 'ws';

const env = { ...Object.fromEntries((existsSync('.env') ? readFileSync('.env', 'utf8') : '').split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]])), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(GNANI_|LLM_|PORT|MODE)/.test(k))) };
let failed = 0;
const line = (ok, msg, fix) => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}${!ok && fix ? `\n     -> ${fix}` : ''}`); };

line(Number(process.versions.node.split('.')[0]) >= 22, `Node ${process.version} (need 22 or newer)`, 'Install Node 22+ from https://nodejs.org');
line(existsSync('.env') || Boolean(process.env.GNANI_API_KEY), existsSync('.env') ? '.env file present' : 'no .env file, but the key comes from the environment', 'Run: npm run setup');
if (existsSync('.env')) {
  const mode = (statSync('.env').mode & 0o777).toString(8);
  line(process.platform === 'win32' || (statSync('.env').mode & 0o077) === 0, `.env permissions are private (${mode})`, 'Run: chmod 600 .env');
}
const key = env.GNANI_API_KEY ?? '';
line(Boolean(key), 'GNANI_API_KEY is set', 'Get one at https://app.gnani.ai/voice and run: npm run setup');

function probe(url, headers) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    const t = setTimeout(() => { ws.terminate(); resolve('timeout'); }, 8000);
    ws.on('unexpected-response', (_q, r) => { clearTimeout(t); resolve(r.statusCode === 401 ? 'rejected' : r.statusCode === 402 ? 'nocredit' : r.statusCode === 429 ? 'ratelimited' : `http ${r.statusCode}`); });
    ws.on('error', (e) => { clearTimeout(t); resolve(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT/.test(String(e)) ? 'offline' : 'error'); });
    ws.on('message', (d) => { if (JSON.parse(d.toString()).type === 'connected') { clearTimeout(t); ws.close(); resolve('ok'); } });
    ws.on('open', () => { if (/tts/.test(url)) { clearTimeout(t); ws.close(); resolve('ok'); } });
  });
}
const WHY = { rejected: 'The key was refused. Check it for typos at https://app.gnani.ai/voice', nocredit: 'The key is valid but has no credit left.', ratelimited: 'Rate limited. Wait a minute and run the check again.', offline: 'Cannot reach api.vachana.ai. Check your internet connection.', timeout: 'No answer within 8 seconds. Check your connection.', error: 'The connection failed.' };
if (key) {
  const stt = await probe('wss://api.vachana.ai/stt/v3/stream', { 'x-api-key-id': key, model: 'prisma-v3.0', language_code: 'hi-IN', format: 'codemix', 'x-sample-rate': '16000' });
  line(stt === 'ok', 'Speech-to-text (Prisma) accepts the key', WHY[stt] ?? `Unexpected answer: ${stt}`);
  const tts = await probe('wss://api.vachana.ai/api/v1/tts', { 'X-API-Key-ID': key });
  line(tts === 'ok', 'Text-to-speech (Timbre) accepts the key', WHY[tts] ?? `Unexpected answer: ${tts}`);
}
if (env.LLM_API_KEY) {
  try {
    const r = await fetch(`${(env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${env.LLM_API_KEY}` }, signal: AbortSignal.timeout(8000) });
    line(r.ok, 'Optional LLM key works', r.status === 401 ? 'The LLM key was refused. Fix it, or clear LLM_API_KEY to run without the LLM.' : `The LLM endpoint answered ${r.status}.`);
  } catch {
    line(false, 'Optional LLM key works', 'Cannot reach the LLM endpoint. The app still works without it.');
  }
  line(Boolean(env.LLM_MODEL), 'LLM_MODEL is set along with the key', 'Set LLM_MODEL, for example openai/gpt-oss-20b');
} else {
  console.log('ok   No LLM key: the built-in parser handles everything (optional)');
}
const port = Number(env.PORT || 8080);
const free = await new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.listen(port, '127.0.0.1', () => s.close(() => res(true))); });
line(free, `Port ${port} is free`, `Something else uses port ${port}. Stop it, or set PORT in .env`);
console.log(failed ? `\n${failed} problem(s). Fix the lines marked FAIL, then run this again.` : '\nAll good. Start it with: npm start');
process.exit(failed ? 1 : 0);
