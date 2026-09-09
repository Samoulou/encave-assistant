import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));

function localSource(frame: string): string | undefined {
  // Only the terminal location is authority; a function name can contain arbitrary text.
  let location = frame.trim().slice(3);
  const wrapped = location.lastIndexOf(' (');
  if (wrapped >= 0 && location.endsWith(')')) location = location.slice(wrapped + 2, -1);
  else if (location.startsWith('async ')) location = location.slice(6);
  const match = /^(.*):([1-9]\d*):([1-9]\d*)$/.exec(location);
  if (!match) return;
  try {
    let source = match[1]!;
    if (source.startsWith('file:')) {
      const url = new URL(source);
      if (url.host || url.search || url.hash) return;
      source = fileURLToPath(url);
    }
    if (!isAbsolute(source)) return;
    source = realpathSync(source);
    const name = relative(root, source).replaceAll('\\', '/');
    if (!/^(tests|packages|apps)\/[A-Za-z0-9_./\[\]-]+\.(mjs|cjs|js|ts|tsx)$/.test(name) || !statSync(source).isFile()) return;
    return `${name}:${match[2]}:${match[3]}`;
  } catch { return; }
}

// Report existing local source locations, never assertion values or external URLs.
export function failureLocations(value: unknown): string[] {
  const locations = new Set<string>();
  let current = value;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const error = current as { stack?: unknown; cause?: unknown };
    if (typeof error.stack === 'string') {
      for (const line of error.stack.split('\n').filter(line => /^\s+at\s/.test(line))) {
        const source = localSource(line);
        if (source) locations.add(source);
      }
    }
    current = error.cause;
  }
  return [...locations].slice(0, 3);
}
