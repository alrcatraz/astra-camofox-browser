#!/usr/bin/env node
/**
 * Sync openclaw.plugin.json and mcp package versions with package.json.
 * Run via: npm run version:sync
 * Auto-runs on npm version via the "version" lifecycle script.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

const pluginPath = join(root, 'openclaw.plugin.json');
const plugin = JSON.parse(await readFile(pluginPath, 'utf8'));
if (plugin.version !== pkg.version) {
  plugin.version = pkg.version;
  await writeFile(pluginPath, JSON.stringify(plugin, null, 2) + '\n');
  console.log(`openclaw.plugin.json version synced to ${pkg.version}`);
} else {
  console.log(`openclaw.plugin.json already at ${pkg.version}`);
}

const mcpPkgPath = join(root, 'mcp', 'package.json');
const mcpPkg = JSON.parse(await readFile(mcpPkgPath, 'utf8'));
if (mcpPkg.version !== pkg.version) {
  mcpPkg.version = pkg.version;
  await writeFile(mcpPkgPath, JSON.stringify(mcpPkg, null, 2) + '\n');
  console.log(`mcp/package.json version synced to ${pkg.version}`);
} else {
  console.log(`mcp/package.json already at ${pkg.version}`);
}

const mcpLockPath = join(root, 'mcp', 'package-lock.json');
const mcpLock = JSON.parse(await readFile(mcpLockPath, 'utf8'));
const mcpLockPackage = mcpLock.packages?.[''];
if (!mcpLockPackage) {
  throw new Error('mcp/package-lock.json is missing its root package entry');
}
if (mcpLock.version !== pkg.version || mcpLockPackage.version !== pkg.version) {
  mcpLock.version = pkg.version;
  mcpLockPackage.version = pkg.version;
  await writeFile(mcpLockPath, JSON.stringify(mcpLock, null, 2) + '\n');
  console.log(`mcp/package-lock.json version synced to ${pkg.version}`);
} else {
  console.log(`mcp/package-lock.json already at ${pkg.version}`);
}
