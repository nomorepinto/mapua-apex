import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The monorepo keeps one `.env` at the repository root. Nest reads it when the
 * file is present (local dev). Lambda injects process env and has no file.
 */
export function existingRootEnv(): string | undefined {
  const candidates = [
    resolve(process.cwd(), '..', '.env'),
    resolve(process.cwd(), '.env'),
  ];
  return candidates.find((path) => existsSync(path));
}
