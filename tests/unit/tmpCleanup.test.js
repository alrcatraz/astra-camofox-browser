import fs from 'fs';
import os from 'os';
import path from 'path';
import { cleanupOrphanedTempFiles } from '../../lib/tmp-cleanup.js';

describe('lib/tmp-cleanup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'camofox-tmp-cleanup-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFile(name, { sizeBytes = 16, ageMs = 0 } = {}) {
    const full = path.join(tmpDir, name);
    fs.writeFileSync(full, Buffer.alloc(sizeBytes));
    if (ageMs > 0) {
      const past = (Date.now() - ageMs) / 1000;
      fs.utimesSync(full, past, past);
    }
    return full;
  }

  test('removes orphaned .fea5*.so and .5ef7*.node files older than threshold', () => {
    writeFile('.fea5abc123.so', { sizeBytes: 4300000, ageMs: 60 * 60 * 1000 });
    writeFile('.5ef7deadbeef.node', { sizeBytes: 0, ageMs: 60 * 60 * 1000 });

    const result = cleanupOrphanedTempFiles({ tmpDir, minAgeMs: 5 * 60 * 1000 });

    expect(result.scanned).toBe(2);
    expect(result.removed).toBe(2);
    expect(result.bytes).toBe(4300000);
    expect(fs.existsSync(path.join(tmpDir, '.fea5abc123.so'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.5ef7deadbeef.node'))).toBe(false);
  });

  test('leaves files younger than threshold (concurrent-instance guard)', () => {
    writeFile('.fea5beef01.so', { sizeBytes: 100, ageMs: 60 * 1000 });

    const result = cleanupOrphanedTempFiles({ tmpDir, minAgeMs: 5 * 60 * 1000 });

    expect(result.scanned).toBe(1);
    expect(result.removed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, '.fea5beef01.so'))).toBe(true);
  });

  test('leaves files that do not match the orphan patterns', () => {
    writeFile('normal.so', { ageMs: 60 * 60 * 1000 });
    writeFile('.fea5.so', { ageMs: 60 * 60 * 1000 });
    writeFile('.fea5abc.txt', { ageMs: 60 * 60 * 1000 });
    writeFile('camofox-download-abc.pdf', { ageMs: 60 * 60 * 1000 });

    const result = cleanupOrphanedTempFiles({ tmpDir, minAgeMs: 5 * 60 * 1000 });

    expect(result.scanned).toBe(0);
    expect(result.removed).toBe(0);
    expect(fs.readdirSync(tmpDir).length).toBe(4);
  });

  test('returns zeros when tmpDir does not exist', () => {
    const missing = path.join(tmpDir, 'does-not-exist');

    const result = cleanupOrphanedTempFiles({ tmpDir: missing });

    expect(result).toEqual({ scanned: 0, removed: 0, bytes: 0, skipped: 0 });
  });

  test('uses injected now for deterministic age comparison', () => {
    writeFile('.fea5abc.so', { sizeBytes: 10, ageMs: 0 });
    const filePath = path.join(tmpDir, '.fea5abc.so');
    const mtimeMs = fs.statSync(filePath).mtimeMs;

    const fresh = cleanupOrphanedTempFiles({
      tmpDir,
      minAgeMs: 5 * 60 * 1000,
      now: mtimeMs + 60 * 1000,
    });
    expect(fresh.removed).toBe(0);
    expect(fresh.skipped).toBe(1);

    const stale = cleanupOrphanedTempFiles({
      tmpDir,
      minAgeMs: 5 * 60 * 1000,
      now: mtimeMs + 10 * 60 * 1000,
    });
    expect(stale.removed).toBe(1);
  });
});
