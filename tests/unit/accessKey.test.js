import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { launchServer } from '../../lib/launcher.js';
import { loadConfig } from '../../lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_ACCESS_KEY = 'test-access-key-' + crypto.randomUUID();
let serverProcess = null;
let serverUrl = null;

async function startServer(env) {
  const port = Math.floor(3100 + Math.random() * 900);
  const cfg = loadConfig();
  const pluginDir = path.join(__dirname, '../..');

  serverProcess = launchServer({
    pluginDir,
    port,
    env: { ...cfg.serverEnv, DEBUG_RESPONSES: 'false', ...env },
    log: { info: () => {}, error: (msg) => console.error(msg) },
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) {
        serverUrl = `http://localhost:${port}`;
        return;
      }
    } catch {}
  }
  throw new Error('Server failed to start');
}

function stopServer() {
  return new Promise((resolve) => {
    if (!serverProcess) return resolve();
    serverProcess.on('close', () => {
      serverProcess = null;
      serverUrl = null;
      resolve();
    });
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess) serverProcess.kill('SIGKILL');
    }, 5000);
  });
}

describe('Access key middleware - key not set', () => {
  beforeAll(async () => {
    await startServer({ CAMOFOX_ACCESS_KEY: '' });
  }, 120000);

  afterAll(async () => {
    await stopServer();
  }, 30000);

  test('allows requests without Authorization header (backwards compatible)', async () => {
    const res = await fetch(`${serverUrl}/health`);
    expect(res.status).toBe(200);
  });
});

describe('Access key middleware - key set', () => {
  beforeAll(async () => {
    await startServer({ CAMOFOX_ACCESS_KEY: TEST_ACCESS_KEY });
  }, 120000);

  afterAll(async () => {
    await stopServer();
  }, 30000);

  test('exempts /health from auth (Docker healthcheck)', async () => {
    const res = await fetch(`${serverUrl}/health`);
    expect(res.status).toBe(200);
  });

  test('rejects gated route without Authorization header', async () => {
    const res = await fetch(`${serverUrl}/tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u', sessionKey: 's', url: 'https://example.com' }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  test('rejects gated route with wrong bearer token', async () => {
    const res = await fetch(`${serverUrl}/tabs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-key',
      },
      body: JSON.stringify({ userId: 'u', sessionKey: 's', url: 'https://example.com' }),
    });
    expect(res.status).toBe(401);
  });

  test('cookie endpoint stays gated by CAMOFOX_API_KEY only, not access key', async () => {
    // Cookie endpoint has its own dedicated key. Presenting the access-key
    // bearer here MUST NOT be treated as authorization by the access-key
    // middleware — the cookie endpoint's own check decides (403 in this
    // configuration since CAMOFOX_API_KEY is unset and the request is non-loopback).
    const res = await fetch(`${serverUrl}/sessions/u/cookies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_ACCESS_KEY}`,
      },
      body: JSON.stringify({ cookies: [] }),
    });
    expect(res.status).not.toBe(401);
  });
});
