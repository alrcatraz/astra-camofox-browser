import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import { register } from './index.js';

describe('persistence plugin', () => {
  let tmpDir, events, ctx, mockApp;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'camofox-persist-plugin-'));
    events = new EventEmitter();
    events.setMaxListeners(50);
    mockApp = {};
    ctx = {
      events,
      config: { cookiesDir: path.join(tmpDir, 'cookies') },
      log: jest.fn(),
    };
  });

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('skips registration when no profileDir configured', async () => {
    await register(mockApp, ctx, {});
    expect(ctx.log).toHaveBeenCalledWith('warn', expect.stringContaining('no profileDir'));
  });

  test('restores persisted state on session:creating', async () => {
    await register(mockApp, ctx, { profileDir: tmpDir });

    // Simulate a prior persisted state
    const { getUserPersistencePaths } = await import('../../lib/persistence.js');
    const { userDir, storageStatePath } = getUserPersistencePaths(tmpDir, 'user-1');
    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(storageStatePath, JSON.stringify({
      cookies: [{ name: 'sid', value: 'abc', domain: '.example.com', path: '/' }],
      origins: [],
    }));

    const contextOptions = { viewport: { width: 1280, height: 720 } };
    // session:creating is a sync emit in server.js but our handler is async — 
    // we need to wait for it
    const handlers = events.listeners('session:creating');
    for (const h of handlers) await h({ userId: 'user-1', contextOptions });

    expect(contextOptions.storageState).toBe(storageStatePath);
  });

  test('checkpoints on session:cookies:import', async () => {
    await register(mockApp, ctx, { profileDir: tmpDir });

    const mockContext = {
      storageState: jest.fn(async ({ path: p }) => {
        await fs.writeFile(p, JSON.stringify({ cookies: [{ name: 'x', value: 'y', domain: '.test.com', path: '/' }] }));
      }),
    };

    // Simulate session created then cookie import
    for (const h of events.listeners('session:created')) {
      await h({ userId: 'user-2', context: mockContext });
    }
    for (const h of events.listeners('session:cookies:import')) {
      await h({ userId: 'user-2' });
    }

    expect(mockContext.storageState).toHaveBeenCalled();

    // Verify file was written
    const { getUserPersistencePaths } = await import('../../lib/persistence.js');
    const { storageStatePath } = getUserPersistencePaths(tmpDir, 'user-2');
    const saved = JSON.parse(await fs.readFile(storageStatePath, 'utf8'));
    expect(saved.cookies[0].name).toBe('x');
  });

  test('checkpoints on session:destroyed', async () => {
    await register(mockApp, ctx, { profileDir: tmpDir });

    const mockContext = {
      storageState: jest.fn(async ({ path: p }) => {
        await fs.writeFile(p, JSON.stringify({ cookies: [], origins: [] }));
      }),
    };

    for (const h of events.listeners('session:created')) {
      await h({ userId: 'user-3', context: mockContext });
    }
    for (const h of events.listeners('session:destroyed')) {
      await h({ userId: 'user-3', reason: 'test' });
    }

    expect(mockContext.storageState).toHaveBeenCalled();
  });

  test('env var CAMOFOX_PROFILE_DIR overrides pluginConfig', async () => {
    const envDir = path.join(tmpDir, 'env-override');
    const orig = process.env.CAMOFOX_PROFILE_DIR;
    process.env.CAMOFOX_PROFILE_DIR = envDir;
    try {
      await register(mockApp, ctx, { profileDir: '/should/not/use' });
      expect(ctx.log).toHaveBeenCalledWith('info', 'persistence plugin enabled', { profileDir: envDir });
    } finally {
      if (orig === undefined) delete process.env.CAMOFOX_PROFILE_DIR;
      else process.env.CAMOFOX_PROFILE_DIR = orig;
    }
  });
});
