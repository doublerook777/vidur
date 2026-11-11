#!/usr/bin/env node
// Secret scan. Usage: node scripts/scan-secrets.mjs [--staged] [--history]
// Fails (exit 1) if a file contains a live value from .env or a key-shaped string.
// Never prints a secret: only file, line and rule name.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });

const PATTERNS = [
  ['groq-key', /\bgsk_[A-Za-z0-9]{20,}/],
  ['openai-style-key', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  [
    'assigned-secret',
    // The value must mix letters and digits, so plain words like 'day_before_yesterday' do not trip it.
    /\b[A-Z0-9_]*(API_?KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*["']?\s*[=:]\s*["']?(?=[A-Za-z0-9_\-./+]*\d)(?=[A-Za-z0-9_\-./+]*[A-Za-z])[A-Za-z0-9_\-./+]{20,}/i,
  ],
];
const PLACEHOLDER = /(your|example|changeme|placeholder|xxxx|<.*>|\.\.\.)/i;
const SKIP_EXT = /\.(png|jpe?g|gif|ico|pdf|woff2?|wav|pcm|mp3|lock)$/i;
const SKIP_PATH = /^(package-lock\.json|references\/)/;

// Live values from .env (only the sensitive-looking ones).
const liveValues = [];
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (/KEY|SECRET|TOKEN|PASSWORD/.test(m[1]) && v.length >= 8) liveValues.push([m[1], v]);
  }
}

function scanText(label, text, findings) {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const [name, v] of liveValues) {
      if (line.includes(v)) findings.push(`${label}:${i + 1} live value of ${name}`);
    }
    for (const [name, re] of PATTERNS) {
      const m = line.match(re);
      if (m && !PLACEHOLDER.test(line)) findings.push(`${label}:${i + 1} ${name}`);
    }
  });
}

const findings = [];
if (args.has('--history')) {
  const revs = git(['rev-list', '--all']).split('\n').filter(Boolean);
  for (const rev of revs) {
    const files = git(['ls-tree', '-r', '--name-only', rev]).split('\n').filter(Boolean);
    for (const f of files) {
      if (SKIP_EXT.test(f) || SKIP_PATH.test(f)) continue;
      try {
        scanText(`${rev.slice(0, 7)}:${f}`, git(['show', `${rev}:${f}`]), findings);
      } catch {
        /* binary or missing */
      }
    }
  }
} else {
  const files = args.has('--staged')
    ? git(['diff', '--cached', '--name-only', '--diff-filter=ACM']).split('\n')
    : git(['ls-files', '-co', '--exclude-standard']).split('\n');
  for (const f of files.filter(Boolean)) {
    if (SKIP_EXT.test(f) || SKIP_PATH.test(f) || !existsSync(f)) continue;
    const text = args.has('--staged') ? git(['show', `:${f}`]) : readFileSync(f, 'utf8');
    scanText(f, text, findings);
  }
}

if (findings.length) {
  console.error('scan:secrets FAILED (values not shown):');
  for (const f of [...new Set(findings)]) console.error('  ' + f);
  process.exit(1);
}
console.log(`scan:secrets ok (${args.has('--history') ? 'history' : args.has('--staged') ? 'staged' : 'working tree'})`);
