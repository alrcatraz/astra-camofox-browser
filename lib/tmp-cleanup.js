import fs from 'fs';
import path from 'path';

const ORPHAN_PATTERNS = [
  /^\.fea5[a-f0-9]+\.so$/,
  /^\.5ef7[a-f0-9]+\.node$/,
];

export function cleanupOrphanedTempFiles({ tmpDir, minAgeMs = 5 * 60 * 1000, now = Date.now() } = {}) {
  const result = { scanned: 0, removed: 0, bytes: 0, skipped: 0 };
  if (!tmpDir) return result;

  let entries;
  try {
    entries = fs.readdirSync(tmpDir);
  } catch {
    return result;
  }

  for (const name of entries) {
    if (!ORPHAN_PATTERNS.some((re) => re.test(name))) continue;
    result.scanned++;
    const full = path.join(tmpDir, name);
    try {
      const st = fs.statSync(full);
      if (!st.isFile()) continue;
      if (now - st.mtimeMs < minAgeMs) {
        result.skipped++;
        continue;
      }
      fs.unlinkSync(full);
      result.removed++;
      result.bytes += st.size;
    } catch {
      // file vanished, permission denied, or race with another process - skip silently
    }
  }

  return result;
}
