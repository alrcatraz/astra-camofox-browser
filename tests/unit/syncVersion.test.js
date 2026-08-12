import { afterEach, describe, expect, test } from '@jest/globals';
import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let fixture;

afterEach(async () => {
  if (fixture) await rm(fixture, { recursive: true, force: true });
  fixture = undefined;
});

describe('version synchronization', () => {
  test('keeps the standalone MCP package and lockfile at the root package version', async () => {
    fixture = await mkdtemp(join(tmpdir(), 'camofox-version-sync-'));
    await mkdir(join(fixture, 'scripts'));
    await mkdir(join(fixture, 'mcp'));
    await cp(join(ROOT, 'scripts', 'sync-version.js'), join(fixture, 'scripts', 'sync-version.js'));

    await writeFile(join(fixture, 'package.json'), JSON.stringify({ type: 'module', version: '9.8.7' }));
    await writeFile(join(fixture, 'openclaw.plugin.json'), JSON.stringify({ version: '1.0.0' }));
    await writeFile(join(fixture, 'mcp', 'package.json'), JSON.stringify({ version: '1.0.0' }));
    await writeFile(join(fixture, 'mcp', 'package-lock.json'), JSON.stringify({
      name: '@askjo/camofox-browser-mcp',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: { '': { name: '@askjo/camofox-browser-mcp', version: '1.0.0' } },
    }));

    await execFile(process.execPath, [join(fixture, 'scripts', 'sync-version.js')]);

    const plugin = JSON.parse(await readFile(join(fixture, 'openclaw.plugin.json'), 'utf8'));
    const mcpPackage = JSON.parse(await readFile(join(fixture, 'mcp', 'package.json'), 'utf8'));
    const mcpLock = JSON.parse(await readFile(join(fixture, 'mcp', 'package-lock.json'), 'utf8'));

    expect(plugin.version).toBe('9.8.7');
    expect(mcpPackage.version).toBe('9.8.7');
    expect(mcpLock.version).toBe('9.8.7');
    expect(mcpLock.packages[''].version).toBe('9.8.7');
  });
});
