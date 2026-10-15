import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** True when this module is executed via `node path/to/script.mjs` (works on Windows). */
export function isDirectCliRun(metaUrl) {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return fileURLToPath(metaUrl) === path.resolve(entry);
  } catch {
    return false;
  }
}
