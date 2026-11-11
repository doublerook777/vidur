export type Mode = 'hosted' | 'local' | 'mock';

export interface Config {
  mode: Mode;
  port: number;
  /** Bind address. local mode binds to loopback only. */
  host: string;
  gnaniApiKey: string | null;
  llm: { apiKey: string; baseUrl: string; model: string } | null;
  accessCode: string | null;
}

export class ConfigError extends Error {}

const MODES: readonly Mode[] = ['hosted', 'local', 'mock'];

/** Reads configuration from an env-like object. Error messages name variables, never values. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const get = (k: string): string | null => {
    const v = env[k]?.trim();
    return v ? v : null;
  };

  const mode = (get('MODE') ?? 'local') as Mode;
  if (!MODES.includes(mode)) {
    throw new ConfigError(`MODE must be one of ${MODES.join(', ')}`);
  }

  const missing: string[] = [];
  const gnaniApiKey = get('GNANI_API_KEY');
  if (mode !== 'mock' && !gnaniApiKey) missing.push('GNANI_API_KEY');

  const accessCode = get('ACCESS_CODE');
  if (mode === 'hosted' && !accessCode) missing.push('ACCESS_CODE');

  if (missing.length) {
    throw new ConfigError(`Missing required environment variables for MODE=${mode}: ${missing.join(', ')}`);
  }

  const portRaw = get('PORT') ?? '8080';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT must be an integer from 1 to 65535');
  }

  // The LLM is optional. A key without a model (or the reverse) is a mistake worth failing on.
  const llmKey = get('LLM_API_KEY');
  const llmModel = get('LLM_MODEL');
  if (Boolean(llmKey) !== Boolean(llmModel)) {
    throw new ConfigError('LLM_API_KEY and LLM_MODEL must be set together, or both left empty');
  }
  const llm =
    llmKey && llmModel
      ? { apiKey: llmKey, baseUrl: get('LLM_BASE_URL') ?? 'https://api.groq.com/openai/v1', model: llmModel }
      : null;

  return {
    mode,
    port,
    host: mode === 'local' || mode === 'mock' ? '127.0.0.1' : '0.0.0.0',
    gnaniApiKey: mode === 'mock' ? null : gnaniApiKey,
    llm,
    accessCode,
  };
}
