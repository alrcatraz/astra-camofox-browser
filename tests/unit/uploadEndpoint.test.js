/**
 * Tests for the /tabs/:tabId/upload endpoint.
 *
 * The route is deeply embedded in server.js and can't be extracted without an
 * invasive refactor, so (following the project convention in
 * typeKeyboardMode.test.js / navigationTimeout.test.js) we test in two ways:
 *
 *   1. A mirrored copy of the request-validation logic, kept in sync with the
 *      route. If this diverges, integration use will catch it.
 *   2. Source-contract assertions: read server.js and assert the route exists
 *      and preserves its load-bearing behaviors (two-strategy attach, container
 *      file containment guard, no OS dialog dependency).
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverSrc = readFileSync(join(__dirname, '../../server.js'), 'utf8');

/**
 * Extracted validation logic matching the /upload endpoint in server.js.
 * Kept in sync with the route -- if this diverges, integration tests will catch it.
 *
 * Returns { status, error } for an early validation failure, or null if the
 * request provides userId and path. Individual path validation is performed by
 * resolveUploadPaths(), which has direct unit coverage in uploadPaths.test.js.
 */
function validateUploadRequest({ userId, path: filePath }) {
  if (!userId) return { status: 400, error: 'userId required' };
  if (!filePath) return { status: 400, error: 'path required (container-side file path)' };

  return null;
}

// Default when the request omits `timeout` or supplies an unusable value.
// Kept in sync with UPLOAD_UI_TIMEOUT_MS in server.js.
const DEFAULT_UPLOAD_TIMEOUT_MS = 12000;

/**
 * Mirrors the `uploadTimeout` resolution in the /upload endpoint: use the
 * caller's `timeout` when it is a finite positive number, else the default.
 */
function resolveUploadTimeout(timeout) {
  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_UPLOAD_TIMEOUT_MS;
}

describe('/upload request validation', () => {
  test('requires userId', () => {
    const r = validateUploadRequest({ path: '/tmp/a.png' });
    expect(r).toMatchObject({ status: 400, error: 'userId required' });
  });

  test('requires path', () => {
    const r = validateUploadRequest({ userId: 'agent1' });
    expect(r).toMatchObject({ status: 400, error: expect.stringContaining('path required') });
  });

  test('accepts a single string path for upload-root validation', () => {
    const r = validateUploadRequest({ userId: 'agent1', path: '/data/x.png' });
    expect(r).toBeNull();
  });

  test('defers array and entry validation to resolveUploadPaths', () => {
    const r = validateUploadRequest({ userId: 'agent1', path: ['/data/a.png', '/data/b.png'] });
    expect(r).toBeNull();
  });

  test('ref/selector are optional (an existing input[type=file] needs no trigger)', () => {
    const r = validateUploadRequest({ userId: 'agent1', path: '/data/x.png' });
    expect(r).toBeNull();
  });
});

describe('/upload timeout argument', () => {
  test('defaults when omitted', () => {
    expect(resolveUploadTimeout(undefined)).toBe(DEFAULT_UPLOAD_TIMEOUT_MS);
  });

  test('honours a positive numeric override', () => {
    expect(resolveUploadTimeout(30000)).toBe(30000);
  });

  test('falls back to the default for zero, negative, or non-numeric values', () => {
    expect(resolveUploadTimeout(0)).toBe(DEFAULT_UPLOAD_TIMEOUT_MS);
    expect(resolveUploadTimeout(-1)).toBe(DEFAULT_UPLOAD_TIMEOUT_MS);
    expect(resolveUploadTimeout('soon')).toBe(DEFAULT_UPLOAD_TIMEOUT_MS);
    expect(resolveUploadTimeout(NaN)).toBe(DEFAULT_UPLOAD_TIMEOUT_MS);
  });
});

describe('/upload source contract', () => {
  test('the route is registered', () => {
    expect(serverSrc).toMatch(/app\.post\(\s*['"]\/tabs\/:tabId\/upload['"]/);
  });

  test('delegates path validation to the upload-root resolver', () => {
    expect(serverSrc).toMatch(/import \{ resolveUploadPaths \} from '\.\/lib\/upload-paths\.js';/);
    expect(serverSrc).toMatch(/resolveUploadPaths\(\{ uploadsDir: CONFIG\.uploadsDir, filePaths:/);
  });

  test('strategy 1 sets files directly on an existing input[type=file]', () => {
    expect(serverSrc).toMatch(/setInputFiles/);
    expect(serverSrc).toMatch(/input\[type="file"\]/);
    expect(serverSrc).toMatch(/direct_input/);
  });

  test('strategy 2 arms a filechooser and activates via keyboard then forced click', () => {
    expect(serverSrc).toMatch(/waitForEvent\(\s*['"]filechooser['"]/);
    expect(serverSrc).toMatch(/keyboard\.press\(\s*['"]Enter['"]\s*\)/);
    expect(serverSrc).toMatch(/force:\s*true/);
    expect(serverSrc).toMatch(/setFiles\(/);
  });

  test('runs under the per-user and per-tab locks like the other interaction routes', () => {
    const idx = serverSrc.indexOf("app.post('/tabs/:tabId/upload'");
    const slice = serverSrc.slice(idx, idx + 4000);
    expect(slice).toMatch(/withUserLimit\(/);
    expect(slice).toMatch(/withTabLock\(/);
  });

  test('declares named timeout constants instead of inline magic numbers', () => {
    for (const name of [
      'UPLOAD_UI_TIMEOUT_MS',
      'UPLOAD_PANEL_MARGIN_MS',
      'UPLOAD_INPUT_TIMEOUT_MS',
      'UPLOAD_FOCUS_TIMEOUT_MS',
      'UPLOAD_CLICK_TIMEOUT_MS',
      'UPLOAD_PANEL_POLL_MS',
      'UPLOAD_REFS_TIMEOUT_MS',
      'UPLOAD_SETTLE_MS',
    ]) {
      expect(serverSrc).toMatch(new RegExp(`const ${name} = \\d+;`));
    }
  });

  test('resolves the overall wait budget from the request timeout with a default', () => {
    const start = serverSrc.indexOf("app.post('/tabs/:tabId/upload'");
    const end = serverSrc.indexOf('\n// Type', start);
    const block = serverSrc.slice(start, end === -1 ? undefined : end);
    expect(block).toMatch(/req\.body\.timeout/);
    expect(block).toMatch(/UPLOAD_UI_TIMEOUT_MS/);
    // The whole route body should carry no bare millisecond literals -- every
    // timeout must reference a named constant or the resolved uploadTimeout.
    expect(block).not.toMatch(/timeout:\s*\d/);
    expect(block).not.toMatch(/timeoutMs:\s*\d/);
    expect(block).not.toMatch(/waitForTimeout\(\s*\d/);
  });
});
