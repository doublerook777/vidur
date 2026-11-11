#!/usr/bin/env node
// Lets a phone reach the app running on this computer, over HTTPS, through a free Cloudflare quick tunnel (no account).
// The tunnel URL is public, so this turns the access code on. Usage: npm run tunnel
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

if (spawnSync('cloudflared', ['--version'], { stdio: 'ignore' }).error) {
  console.error('This needs cloudflared (free, no account). Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ and run "npm run tunnel" again.\nAlternative: Tailscale Funnel ("tailscale funnel 8080").');
  process.exit(1);
}
const code = randomBytes(4).toString('hex');
const port = process.env.PORT ?? '8080';
// hosted mode: access code required, per-session audio caps. HOST stays 127.0.0.1, so only the tunnel can reach it.
const server = spawn(process.execPath, ['scripts/start.mjs'], { stdio: 'inherit', env: { ...process.env, MODE: 'hosted', ACCESS_CODE: code, HOST: '127.0.0.1', PORT: port } });
const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
const seen = (d) => { const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m) console.log(`\nOpen this on your phone: ${m[0]}\nAccess code: ${code}\n`); };
tunnel.stdout.on('data', seen); tunnel.stderr.on('data', seen);
const stop = () => { server.kill(); tunnel.kill(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
