#!/usr/bin/env node
// One-time setup: checks Node, creates .env from .env.example, and (in a terminal) asks for your keys.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error(`Vidur needs Node 22 or newer. You have ${process.version}.`);
  process.exit(1);
}
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example. It is git-ignored and never leaves this machine except to Gnani (and your LLM, if you set one).');
} else {
  console.log('.env already exists, keeping it.');
}
let env = readFileSync('.env', 'utf8');
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim();
const set = (k, v) => { env = new RegExp(`^${k}=`, 'm').test(env) ? env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : env + `\n${k}=${v}\n`; };

if (process.stdin.isTTY && !get('GNANI_API_KEY')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nGet a key at https://app.gnani.ai/voice (Gnani API Platform).');
  const key = (await rl.question('Paste your Gnani API key (or press Enter to add it later): ')).trim();
  if (key) set('GNANI_API_KEY', key);
  if (!get('LLM_API_KEY')) {
    console.log('\nOptional: a free Groq key lets the app understand sentences the built-in parser cannot. Skip it and everything else still works.');
    const llm = (await rl.question('Groq key from https://console.groq.com/keys (Enter to skip): ')).trim();
    if (llm) { set('LLM_API_KEY', llm); set('LLM_MODEL', get('LLM_MODEL') || 'openai/gpt-oss-20b'); }
  }
  rl.close();
  writeFileSync('.env', env);
}
const ok = Boolean(get('GNANI_API_KEY'));
console.log(ok ? '\nReady. Start it with:  npm start' : '\nAdd GNANI_API_KEY to .env, then run:  npm start\nNo key yet? Try the app with scripted speech:  npm run demo:mock');
