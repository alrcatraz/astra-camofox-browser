const { readFileSync } = process.getBuiltinModule('fs');
const { join } = process.getBuiltinModule('path');

const serverSource = readFileSync(join(process.cwd(), 'server.js'), 'utf-8');

function sourceBetween(startMarker, endMarker) {
  const start = serverSource.indexOf(startMarker);
  const end = serverSource.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe('launch compatibility source contract', () => {

  test('awaits virtual display display string before launch', () => {
    expect(serverSource).toMatch(/vdDisplay\s*=\s*await\s+localVirtualDisplay\.get\(\)/);
    expect(serverSource).not.toMatch(/vdDisplay\s*=\s*localVirtualDisplay\.get\(\)/);
  });

  test('sizes the default virtual display used with hardcoded 1920x1080 viewports', () => {
    const defaultVirtualDisplay = sourceBetween(
      'const DEFAULT_VIRTUAL_DISPLAY_RESOLUTION',
      'let virtualDisplay = null;'
    );
    const pluginContext = sourceBetween(
      'const pluginCtx = {',
      'const loadedPlugins = await loadPlugins'
    );

    // Astra fork: default virtual display is 1920x1080x24 (matches the baked
    // 1080p VNC screen and the hardcoded 1920x1080 browser context viewport).
    expect(defaultVirtualDisplay).toContain("DEFAULT_VIRTUAL_DISPLAY_RESOLUTION = '1920x1080x24'");
    expect(defaultVirtualDisplay).toContain('class DefaultVirtualDisplay extends VirtualDisplay');
    expect(defaultVirtualDisplay).toContain('patched[idx + 1] = DEFAULT_VIRTUAL_DISPLAY_RESOLUTION');
    expect(pluginContext).toContain('createVirtualDisplay: () => new DefaultVirtualDisplay()');
  });

  test('uses a fixed 1920x1080 browser context viewport (matches VNC screen)', () => {
    const googleProbeOptions = sourceBetween(
      'context = await candidateBrowser.newContext({',
      'const page = await context.newPage();'
    );
    const sessionContextOptions = sourceBetween(
      'const contextOptions = {',
      '// When geoip is active'
    );

    // Astra fork: fixed viewport so the browser canvas fills the 1080p VNC
    // display without letterboxing (upstream uses `viewport: null` + a 1280x720
    // default virtual display, which leaves bars on the fork's baked VNC screen).
    expect(googleProbeOptions).toMatch(/viewport:\s*\{\s*width:\s*1920,\s*height:\s*1080\s*\}/);
    expect(sessionContextOptions).toMatch(/viewport:\s*\{\s*width:\s*1920,\s*height:\s*1080\s*\}/);
    expect(`${googleProbeOptions}\n${sessionContextOptions}`).not.toMatch(/viewport\s*:\s*null/);
  });
});
