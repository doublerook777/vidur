/**
 * Logging that cannot leak what shopkeepers say. Only timings, counts and codes may be logged.
 * A field is refused if its name suggests content (transcript, text, name, customer, amount, ...) or if its value is
 * not a short plain identifier. In strict mode (tests, development) a refused field throws, so the mistake is found
 * immediately. In production it is replaced by "[redacted]".
 */
export class PrivacyLogError extends Error {}

const FORBIDDEN_KEY = /(transcript|text|name|customer|utterance|speech|amount|phone|message|content|prompt|party|balance|note)/i;
const SAFE_STRING = /^[A-Za-z0-9_.:\-/ ]{0,60}$/;

export type Fields = Record<string, string | number | boolean | undefined>;
export type Sink = (line: string) => void;

export interface Logger {
  info(event: string, fields?: Fields): void;
  warn(event: string, fields?: Fields): void;
  error(event: string, fields?: Fields): void;
}

export function createLogger(sink: Sink = (l) => console.log(l), opts: { strict?: boolean; now?: () => number } = {}): Logger {
  const strict = opts.strict ?? process.env['NODE_ENV'] !== 'production';
  const now = opts.now ?? Date.now;
  const emit = (level: string, event: string, fields: Fields = {}): void => {
    if (!SAFE_STRING.test(event)) throw new PrivacyLogError('log event names must be short plain identifiers');
    const clean: Record<string, string | number | boolean> = {};
    let redacted = 0;
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      const badKey = FORBIDDEN_KEY.test(k);
      const badValue = typeof v === 'string' && !SAFE_STRING.test(v);
      if (badKey || badValue) {
        if (strict) throw new PrivacyLogError(`refused to log field "${k}": ${badKey ? 'name suggests content' : 'value is not a short plain identifier'}`);
        redacted++;
        continue;
      }
      clean[k] = v;
    }
    if (redacted) clean['redacted'] = redacted;
    sink(JSON.stringify({ t: now(), level, event, ...clean }));
  };
  return { info: (e, f) => emit('info', e, f), warn: (e, f) => emit('warn', e, f), error: (e, f) => emit('error', e, f) };
}
