#!/usr/bin/env node
// Keeps a free host from sleeping: pings <url>/healthz every 5 minutes. Run it from a laptop during a demo.
// Usage: npm run keepwarm -- https://your-app.onrender.com [intervalSeconds]
const url = process.argv[2];
if (!url) { console.error('Usage: npm run keepwarm -- <url> [intervalSeconds]'); process.exit(1); }
const every = Math.max(10, Number(process.argv[3] ?? 300)) * 1000;
const ping = async () => {
  const t = Date.now();
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/healthz`, { signal: AbortSignal.timeout(90_000) });
    console.log(`${new Date().toISOString()}  ${r.status}  ${Date.now() - t} ms`);
  } catch (e) {
    console.log(`${new Date().toISOString()}  failed (${e.name})  ${Date.now() - t} ms`);
  }
};
await ping();
setInterval(ping, every);
