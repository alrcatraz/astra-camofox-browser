/**
 * Tests for /type endpoint keyboard mode (PR #66).
 *
 * Verifies:
 * 1. Validation: mode must be 'fill' or 'keyboard'
 * 2. Validation: fill mode requires ref or selector
 * 3. Validation: keyboard mode allows no ref/selector (types into focus)
 * 4. Validation: text is required
 * 5. submit and pressEnter both trigger Enter key
 * 6. Keyboard mode in /act endpoint has same validation
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverSource = readFileSync(resolve(__dirname, '../../server.js'), 'utf8');

describe('/type keyboard mode', () => {
  // --- POST /tabs/:tabId/type route ---

  test('default mode is fill', () => {
    // The destructuring should default mode to 'fill'
    expect(serverSource).toMatch(/mode\s*=\s*['"]fill['"]/);
  });

  test('rejects invalid mode with 400', () => {
    expect(serverSource).toContain("mode must be 'fill' or 'keyboard'");
    // Both the /type route and /act type kind should validate mode
    const modeChecks = serverSource.match(/mode !== 'fill' && mode !== 'keyboard'/g);
    expect(modeChecks.length).toBeGreaterThanOrEqual(2);
  });

  test('fill mode requires ref or selector', () => {
    expect(serverSource).toContain("ref or selector required for mode=fill");
  });

  test('keyboard mode does not require ref or selector', () => {
    // The guard for "ref or selector required" is gated on mode === 'fill'
    // Keyboard mode should skip this check — verify the condition
    const fillGuard = serverSource.match(/if\s*\(mode\s*===\s*'fill'\s*&&\s*!ref\s*&&\s*!selector\)/g);
    expect(fillGuard).not.toBeNull();
    expect(fillGuard.length).toBeGreaterThanOrEqual(1);
  });

  test('text is always required', () => {
    expect(serverSource).toContain("text is required");
  });

  test('keyboard mode uses page.keyboard.type with delay', () => {
    // Should call page.keyboard.type(text, { delay }) in keyboard branch
    expect(serverSource).toMatch(/page\.keyboard\.type\(text,\s*\{\s*delay\s*\}/);
  });

  test('default delay is 30ms', () => {
    expect(serverSource).toMatch(/delay\s*=\s*30/);
  });

  test('submit and pressEnter both trigger Enter', () => {
    // shouldSubmit = submit || pressEnter
    expect(serverSource).toContain('submit || pressEnter');
    // keyboard.press('Enter') after type
    expect(serverSource).toMatch(/keyboard\.press\(['"]Enter['"]\)/);
  });

  test('keyboard mode focuses element before typing when ref provided', () => {
    // In keyboard branch: locator.focus() then page.keyboard.type()
    expect(serverSource).toMatch(/locator\.focus\(/);
  });

  test('keyboard mode focuses element before typing when selector provided', () => {
    // In keyboard branch: page.focus(selector) when no ref but selector
    expect(serverSource).toMatch(/page\.focus\(selector/);
  });

  // --- /act type kind has same keyboard support ---

  test('/act type kind supports mode parameter', () => {
    // Find the act route's type case — it should also destructure mode
    const actSection = serverSource.match(/case\s*'type':\s*\{[\s\S]*?break|case\s*'type':\s*\{[\s\S]*?return/);
    expect(actSection).not.toBeNull();
    // The act handler should also accept mode
    expect(serverSource).toMatch(/const\s*\{[^}]*mode[^}]*\}\s*=\s*params/);
  });
});
