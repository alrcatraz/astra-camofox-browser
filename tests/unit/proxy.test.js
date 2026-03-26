import { normalizePlaywrightProxy, createProxyPool } from '../../lib/proxy.js';

describe('normalizePlaywrightProxy', () => {
  test('decodes percent-encoded proxy credentials', () => {
    expect(normalizePlaywrightProxy({
      server: 'http://us.decodo.com:10001',
      username: 'sp6incny2a',
      password: 'u4q4iklLj3Jof0%3DIuT',
    })).toEqual({
      server: 'http://us.decodo.com:10001',
      username: 'sp6incny2a',
      password: 'u4q4iklLj3Jof0=IuT',
    });
  });

  test('preserves raw credentials', () => {
    expect(normalizePlaywrightProxy({
      server: 'http://gate.decodo.com:7000',
      username: 'sp6incny2a',
      password: 'u4q4iklLj3Jof0=IuT',
    })).toEqual({
      server: 'http://gate.decodo.com:7000',
      username: 'sp6incny2a',
      password: 'u4q4iklLj3Jof0=IuT',
    });
  });

  test('leaves malformed percent sequences unchanged', () => {
    expect(normalizePlaywrightProxy({
      server: 'http://proxy:1234',
      username: 'user%ZZ',
      password: 'pass%ZZ',
    })).toEqual({
      server: 'http://proxy:1234',
      username: 'user%ZZ',
      password: 'pass%ZZ',
    });
  });

  test('passes through null proxy', () => {
    expect(normalizePlaywrightProxy(null)).toBeNull();
  });
});

describe('createProxyPool', () => {
  test('returns null when no host', () => {
    expect(createProxyPool({ host: '', ports: [10001], username: 'u', password: 'p' })).toBeNull();
  });

  test('returns null when no ports', () => {
    expect(createProxyPool({ host: 'proxy.example.com', ports: [], username: 'u', password: 'p' })).toBeNull();
  });

  test('single port pool', () => {
    const pool = createProxyPool({ host: 'us.decodo.com', ports: [7000], username: 'u', password: 'p' });
    expect(pool).not.toBeNull();
    expect(pool.size).toBe(1);
    expect(pool.getLaunchProxy()).toEqual({ server: 'http://us.decodo.com:7000', username: 'u', password: 'p' });
    expect(pool.getNext()).toEqual({ server: 'http://us.decodo.com:7000', username: 'u', password: 'p' });
    // Round-robin wraps back to single port
    expect(pool.getNext()).toEqual({ server: 'http://us.decodo.com:7000', username: 'u', password: 'p' });
  });

  test('multi-port round-robin', () => {
    const pool = createProxyPool({ host: 'us.decodo.com', ports: [10001, 10002, 10003], username: 'u', password: 'p' });
    expect(pool.size).toBe(3);
    expect(pool.getLaunchProxy().server).toBe('http://us.decodo.com:10001');
    expect(pool.getNext().server).toBe('http://us.decodo.com:10001');
    expect(pool.getNext().server).toBe('http://us.decodo.com:10002');
    expect(pool.getNext().server).toBe('http://us.decodo.com:10003');
    // Wraps around
    expect(pool.getNext().server).toBe('http://us.decodo.com:10001');
    expect(pool.getNext().server).toBe('http://us.decodo.com:10002');
  });

  test('10-port pool distributes evenly', () => {
    const ports = Array.from({ length: 10 }, (_, i) => 10001 + i);
    const pool = createProxyPool({ host: 'us.decodo.com', ports, username: 'u', password: 'p' });
    expect(pool.size).toBe(10);

    const counts = new Map();
    for (let i = 0; i < 100; i++) {
      const proxy = pool.getNext();
      const port = proxy.server.split(':').pop();
      counts.set(port, (counts.get(port) || 0) + 1);
    }
    // Each port should be hit exactly 10 times over 100 calls
    for (const port of ports) {
      expect(counts.get(String(port))).toBe(10);
    }
  });
});
