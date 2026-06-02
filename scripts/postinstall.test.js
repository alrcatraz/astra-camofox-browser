import { afterEach, describe, expect, test } from '@jest/globals';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { childEnvForFetch, externalExecutableFromEnv } from './postinstall.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tempDirs = [];

function makeExecutable() {
  const dir = mkdtempSync(join(tmpdir(), 'camofox-postinstall-test-'));
  tempDirs.push(dir);
  const executable = join(dir, 'camoufox-bin');
  writeFileSync(executable, '#!/bin/sh\nexit 0\n');
  chmodSync(executable, 0o755);
  return executable;
}

function postinstallTestEnv(overrides = {}) {
  const env = {};
  for (const name of [
    'PATH',
    'Path',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'TMPDIR',
    'TEMP',
    'TMP',
    'SystemRoot',
    'WINDIR',
    'ComSpec',
    'PATHEXT',
  ]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  return { ...env, ...overrides };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('postinstall external executable handling', () => {
  test('uses CAMOUFOX_EXECUTABLE before compatibility aliases', () => {
    expect(externalExecutableFromEnv({
      CAMOUFOX_EXECUTABLE: '/primary',
      CAMOUFOX_EXECUTABLE_PATH: '/compat',
      CAMOFOX_EXECUTABLE_PATH: '/legacy',
    })).toEqual({ name: 'CAMOUFOX_EXECUTABLE', value: '/primary' });
  });

  test('skips bundled download when an external executable is configured', () => {
    const executable = makeExecutable();
    const result = spawnSync(process.execPath, ['scripts/postinstall.js'], {
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
      env: postinstallTestEnv({
        CAMOUFOX_EXECUTABLE: executable,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
      }),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('skipping bundled Camoufox download');
    expect(result.stderr).toBe('');
  });
});

describe('postinstall fetch child env', () => {
  test('passes an explicit whitelist to the downloader child', () => {
    const childEnv = childEnvForFetch({
      PATH: '/bin',
      HOME: '/home/agent',
      XDG_CACHE_HOME: '/home/agent/.cache',
      LOCALAPPDATA: 'C:\\Users\\agent\\AppData\\Local',
      HTTPS_PROXY: 'http://proxy.example:8080',
      npm_config_https_proxy: 'http://npm-proxy.example:8080',
      NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/',
      CAMOFOX_SKIP_DOWNLOAD: '0',
      CAMOUFOX_EXECUTABLE: '/opt/camoufox/camoufox-bin',
      CAMOUFOX_EXECUTABLE_PATH: '/compat/camoufox-bin',
      CAMOFOX_EXECUTABLE_PATH: '/legacy/camoufox-bin',
      CAMOUFOX_CACHE_DIR: '/opt/camoufox-cache',
      GITHUB_TOKEN: 'github-token',
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
      AWS_ACCESS_KEY_ID: 'should-not-leak',
      SOME_RANDOM_SECRET: 'should-not-leak',
      npm_config__authToken: 'should-not-leak',
    });

    expect(childEnv).toEqual({
      PATH: '/bin',
      HOME: '/home/agent',
      LOCALAPPDATA: 'C:\\Users\\agent\\AppData\\Local',
      XDG_CACHE_HOME: '/home/agent/.cache',
      HTTPS_PROXY: 'http://proxy.example:8080',
      npm_config_https_proxy: 'http://npm-proxy.example:8080',
      NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/',
      CAMOFOX_SKIP_DOWNLOAD: '0',
      CAMOUFOX_EXECUTABLE: '/opt/camoufox/camoufox-bin',
      CAMOUFOX_EXECUTABLE_PATH: '/compat/camoufox-bin',
      CAMOFOX_EXECUTABLE_PATH: '/legacy/camoufox-bin',
      CAMOUFOX_CACHE_DIR: '/opt/camoufox-cache',
      GITHUB_TOKEN: 'github-token',
    });
  });
});
