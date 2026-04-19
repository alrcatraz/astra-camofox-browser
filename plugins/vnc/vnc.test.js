import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';

// Mock child_process.spawn to avoid actually starting vnc-watcher.sh
const mockSpawn = jest.fn(() => {
  const proc = new EventEmitter();
  proc.pid = 12345;
  proc.exitCode = null;
  proc.kill = jest.fn();
  return proc;
});
jest.unstable_mockModule('node:child_process', () => ({
  spawn: mockSpawn,
}));

// Mock auth middleware
jest.unstable_mockModule('../../lib/auth.js', () => ({
  requireAuth: () => (_req, _res, next) => next(),
}));

// Minimal VirtualDisplay mock (real class has side-effects that break in test)
class MockVirtualDisplay {
  get xvfb_args() {
    return ['-screen', '0', '1x1x24', '-ac', '-nolisten', 'tcp'];
  }
}

const { register } = await import('./index.js');

describe('vnc plugin', () => {
  let events, ctx, mockApp, routes;

  beforeEach(() => {
    events = new EventEmitter();
    events.setMaxListeners(50);
    routes = {};
    mockApp = {
      get: jest.fn((path, ...handlers) => { routes[`GET ${path}`] = handlers; }),
    };
    ctx = {
      events,
      config: {},
      log: jest.fn(),
      sessions: new Map(),
      VirtualDisplay: MockVirtualDisplay,
      createVirtualDisplay: () => new MockVirtualDisplay(),
    };
    mockSpawn.mockClear();
  });

  test('does not register when ENABLE_VNC is not set', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, {});
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockApp.get).not.toHaveBeenCalled();
  });

  test('registers when ENABLE_VNC=1', async () => {
    process.env.ENABLE_VNC = '1';
    try {
      await register(mockApp, ctx, {});
      expect(mockSpawn).toHaveBeenCalled();
      expect(mockApp.get).toHaveBeenCalledWith(
        '/sessions/:userId/storage_state',
        expect.any(Function),
        expect.any(Function),
      );
    } finally {
      delete process.env.ENABLE_VNC;
    }
  });

  test('registers when pluginConfig.enabled is true', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, { enabled: true });
    expect(mockSpawn).toHaveBeenCalled();
  });

  test('overrides createVirtualDisplay with custom resolution', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, { enabled: true, resolution: '1280x720' });

    const vd = ctx.createVirtualDisplay();
    const args = vd.xvfb_args;
    const screenIdx = args.indexOf('0');
    expect(args[screenIdx + 1]).toBe('1280x720x24');
  });

  test('appends x24 depth to WxH resolution', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, { enabled: true, resolution: '1920x1080' });

    const vd = ctx.createVirtualDisplay();
    const args = vd.xvfb_args;
    const screenIdx = args.indexOf('0');
    expect(args[screenIdx + 1]).toBe('1920x1080x24');
  });

  test('preserves explicit depth in resolution', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, { enabled: true, resolution: '1920x1080x32' });

    const vd = ctx.createVirtualDisplay();
    const args = vd.xvfb_args;
    const screenIdx = args.indexOf('0');
    expect(args[screenIdx + 1]).toBe('1920x1080x32');
  });

  test('storage_state endpoint returns 404 for unknown user', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, { enabled: true });

    const handler = routes['GET /sessions/:userId/storage_state'].at(-1);
    const req = { params: { userId: 'unknown' }, reqId: 'test' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('storage_state endpoint returns state for active session', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, { enabled: true });

    const mockState = { cookies: [{ name: 'sid', value: 'abc' }], origins: [] };
    ctx.sessions.set('user-1', {
      context: { storageState: jest.fn(async () => mockState) },
    });

    const handler = routes['GET /sessions/:userId/storage_state'].at(-1);
    const req = { params: { userId: 'user-1' }, reqId: 'test' };
    const res = { json: jest.fn() };

    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(mockState);
  });

  test('emits vnc:storage:exported and session:storage:export on export', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, { enabled: true });

    ctx.sessions.set('user-1', {
      context: { storageState: jest.fn(async () => ({ cookies: [], origins: [] })) },
    });

    const exported = [];
    events.on('vnc:storage:exported', (e) => exported.push(e));
    events.on('session:storage:export', (e) => exported.push(e));

    const handler = routes['GET /sessions/:userId/storage_state'].at(-1);
    await handler(
      { params: { userId: 'user-1' }, reqId: 'test' },
      { json: jest.fn() },
    );

    expect(exported).toHaveLength(2);
    expect(exported[0]).toMatchObject({ userId: 'user-1' });
  });

  test('watcher is killed on server:shutdown', async () => {
    delete process.env.ENABLE_VNC;
    await register(mockApp, ctx, { enabled: true });

    const proc = mockSpawn.mock.results[0].value;
    events.emit('server:shutdown');
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
