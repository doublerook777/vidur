#!/usr/bin/env node
// Starts Vidur. Usage: node scripts/start.mjs [--mock] [--rebuild]
//   (no flag)  local mode with YOUR Gnani key from .env, bound to this machine only
//   --mock     no keys needed: scripted transcripts, clearly labelled "not real speech"
import { spawnSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const mock = args.has('--mock');

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(`Vidur needs Node 22 or newer. You have ${process.version}. Install it from https://nodejs.org and try again.`);
  process.exit(1);
}
if (!existsSync('node_modules')) {
  console.error('Run "npm install" first, then "npm run setup".');
  process.exit(1);
}
if (!mock && !existsSync('.env')) {
  console.error('There is no .env file. Run "npm run setup" to create one, or "npm run demo:mock" to try the app with no keys.');
  process.exit(1);
}
if (args.has('--rebuild') || !existsSync('apps/web/dist/index.html') || !existsSync('apps/server/dist/index.js')) {
  console.log('Building the app (about 20 seconds)...');
  const b = spawnSync('npm', ['run', 'build', '--silent'], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const env = { ...process.env, ...(mock ? { MODE: 'mock' } : { MODE: process.env.MODE ?? 'local' }) };
const child = spawn(process.execPath, ['apps/server/dist/index.js'], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
