#!/usr/bin/env node
// Postinstall: download Camoufox binaries and verify the cache is populated.
//
// Why a script instead of an inline `npx camoufox-js fetch`:
//   1. Cross-platform: avoids POSIX-only `VAR= cmd` shell syntax (Windows
//      cmd.exe does not honor it).
//   2. Defends against PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 inherited from
//      the user's shell or a CI/Docker base image. `camoufox-js` honors
//      that flag by convention (same env name as `playwright`'s skip flag),
//      which leaves the binary cache empty and makes the server crash at
//      runtime with "Version information not found".
//   3. Verifies the cache after fetch and prints a warning with actionable
//      remediation if the binary is still missing — the server will fail
//      at startup, but install itself succeeds so plugin installs don't break.
//
// Exit behavior:
//   Always exits 0. Download failures produce warnings, not hard errors.
//   This ensures `npm install` succeeds in environments where the binary
//   download is blocked (CI, firewalls, plugin installs that only need the
//   JS tooling). The server prints a clear error at startup if the binary
//   is missing.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

function camoufoxCacheDir() {
  const home = homedir();
  const plat = platform();
  if (plat === 'darwin') return join(home, 'Library', 'Caches', 'camoufox');
  if (plat === 'win32') {
    // Matches camoufox-js/dist/pkgman.js:246 which nests the app name twice:
    // %LOCALAPPDATA%\camoufox\camoufox\Cache
    const base = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
    return join(base, 'camoufox', 'camoufox', 'Cache');
  }
  return join(process.env.XDG_CACHE_HOME || join(home, '.cache'), 'camoufox');
}

function warn(message) {
  process.stderr.write(`[camofox-browser] postinstall warning: ${message}\n`);
}

// Skip binary download entirely when CAMOFOX_SKIP_DOWNLOAD is set.
// Useful for plugin-only installs or CI environments that pre-cache binaries.
if (process.env.CAMOFOX_SKIP_DOWNLOAD === '1' || process.env.CAMOFOX_SKIP_DOWNLOAD === 'true') {
  process.stderr.write('[camofox-browser] postinstall: skipping binary download (CAMOFOX_SKIP_DOWNLOAD=1)\n');
  process.exit(0);
}

const childEnv = { ...process.env };
delete childEnv.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;

const isWindows = platform() === 'win32';
const result = spawnSync(isWindows ? 'npx.cmd' : 'npx', ['camoufox-js', 'fetch'], {
  stdio: 'inherit',
  env: childEnv,
  shell: isWindows,
});

if (result.error) {
  warn(`failed to spawn npx: ${result.error.message}`);
  warn('The Camoufox browser binary was not downloaded.');
  warn('Run `npx camoufox-js fetch` manually before starting the server.');
  process.exit(0);
}

if (result.status !== 0) {
  warn(`\`npx camoufox-js fetch\` exited with code ${result.status}`);
  warn('The Camoufox browser binary may not have been downloaded.');
  warn('Run `npx camoufox-js fetch` manually before starting the server.');
  process.exit(0);
}

const versionFile = join(camoufoxCacheDir(), 'version.json');
if (!existsSync(versionFile)) {
  warn('Camoufox cache not populated after fetch.');
  warn(`  Expected file: ${versionFile}`);
  warn('  Possible causes:');
  warn('    - Network failure during binary download (check your connection)');
  warn('    - PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD re-exported by a wrapping process');
  warn('  Manual fix:  npx camoufox-js fetch');
  warn('The server will fail at startup until the binary is available.');
  process.exit(0);
}
