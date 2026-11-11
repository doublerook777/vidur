import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { coreBanner } from '@vidur/core';

import { ConfigError, loadConfig } from './config.js';
import { createLlmParser } from './llm.js';
import { createLogger } from './logger.js';
import { startMockGnani } from './mock-gnani/index.js';
import { createGateway } from './server.js';

export function serverBanner(): string {
  return `vidur gateway - ${coreBanner()}`;
}

const DEFAULT_SCRIPT = ['Mohan ka 340 udhaar', 'Mohan ka total?', 'Sunita ne 200 jama kiye', 'Aaj kitna udhaar gaya?', 'galat'];
const MOCK_SCRIPT: string[] = (() => {
  try {
    const j = JSON.parse(process.env['MOCK_SCRIPT'] ?? 'null') as unknown;
    return Array.isArray(j) && j.every((x) => typeof x === 'string') ? (j as string[]) : DEFAULT_SCRIPT;
  } catch {
    return DEFAULT_SCRIPT;
  }
})();

async function main(): Promise<void> {
  try {
    process.loadEnvFile?.(fileURLToPath(new URL('../../../.env', import.meta.url)));
  } catch {
    /* no .env: variables may come from the host */
  }
  const log = createLogger();
  let config;
  try {
    config = loadConfig(process.env);
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`Cannot start: ${e.message}. Copy .env.example to .env and fill it in, or run "npm run demo:mock" with no keys.`);
      process.exit(1);
    }
    throw e;
  }
  let mock: Awaited<ReturnType<typeof startMockGnani>> | null = null;
  if (config.mode === 'mock') {
    mock = await startMockGnani({});
    config = { ...config, gnaniApiKey: 'mock', gnaniBaseUrl: mock.url.replace('http', 'ws') };
    const refill = (): void => mock?.scriptTranscripts(MOCK_SCRIPT);
    refill();
    setInterval(refill, 20_000).unref();
  }
  const staticDir = fileURLToPath(new URL('../../web/dist', import.meta.url));
  const gw = await createGateway({
    config,
    log,
    // Mock mode makes no outside calls at all, so the LLM is never used there.
    ...(config.llm && config.mode !== 'mock' ? { llm: createLlmParser(config.llm, log) } : {}),
    ...(existsSync(staticDir) ? { staticDir } : {}),
    ...(process.env['ADMIN_KEY'] ? { adminKey: process.env['ADMIN_KEY'] } : {}),
  });
  console.log(`Vidur is running at ${gw.url}  (mode: ${config.mode}${config.mode === 'mock' ? ', NOT real speech' : ''})`);
}

const invokedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (invokedDirectly) void main();
