/**
 * Tests for the Cloudflare Worker crash relay (workers/crash-reporter/index.ts).
 *
 * Since the worker is TypeScript and uses Cloudflare-specific APIs (crypto.subtle,
 * Request/Response), we test the logic by importing a JS-transpiled version.
 * Instead, we test the contract: payload validation, rate limiting, dedup, and
 * routing — by simulating the worker's behavior in pure JS.
 *
 * These tests verify the relay's validation rules match what the client sends.
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerSource = readFileSync(join(__dirname, '../../workers/crash-reporter/index.ts'), 'utf-8');

// ============================================================================
// Validate the worker source exists and has expected structure
// ============================================================================

describe('worker source structure', () => {

  test('index.ts exists and is non-empty', () => {
    expect(workerSource.length).toBeGreaterThan(1000);
  });

  test('exports default fetch handler', () => {
    expect(workerSource).toContain('export default');
    expect(workerSource).toContain('async fetch(request: Request, env: Env)');
  });

  test('has POST /report route', () => {
    expect(workerSource).toContain("url.pathname === \"/report\"");
    expect(workerSource).toContain("request.method === \"POST\"");
  });

  test('has GET /source route', () => {
    expect(workerSource).toContain("url.pathname === \"/source\"");
  });

  test('has GET /health route', () => {
    expect(workerSource).toContain("url.pathname === \"/health\"");
  });

  test('uses env secrets, not hardcoded keys', () => {
    expect(workerSource).toContain('env.GH_APP_ID');
    expect(workerSource).toContain('env.GH_INSTALL_ID');
    expect(workerSource).toContain('env.GH_PRIVATE_KEY');
    // Must NOT contain actual key material (base64-encoded PEM blocks)
    expect(workerSource).not.toContain('LS0tLS1CRUdJTi'); // base64 "-----BEGIN"
    // The worker references PEM header strings in signJwt() to strip them —
    // that's code, not an embedded key. Verify no actual base64 key blobs exist.
    const base64KeyPattern = /[A-Za-z0-9+/]{100,}={0,2}/;
    expect(workerSource).not.toMatch(base64KeyPattern);
  });

  test('has CORS headers', () => {
    expect(workerSource).toContain('Access-Control-Allow-Origin');
    expect(workerSource).toContain('Access-Control-Allow-Methods');
  });

  test('has OPTIONS handler for CORS preflight', () => {
    expect(workerSource).toContain('request.method === "OPTIONS"');
  });

  test('has rate limiting by IP', () => {
    expect(workerSource).toContain('CF-Connecting-IP');
    expect(workerSource).toContain('rateLimit(ip)');
    expect(workerSource).toContain('MAX_PER_IP_PER_HOUR');
  });

  test('has dedup by signature', () => {
    expect(workerSource).toContain('isDuplicate(payload.signature)');
    expect(workerSource).toContain('recentSignatures');
  });

  test('has source verification placeholders', () => {
    expect(workerSource).toContain('__COMMIT_SHA__');
    expect(workerSource).toContain('__SOURCE_SHA256__');
  });
});

// ============================================================================
// Payload validation rules (mirrored from worker)
// ============================================================================

// Re-implement the validation logic from the worker to test it directly
const VALID_TYPES = new Set([
  'crash', 'hang', 'stuck', 'stuck:event-loop', 'stuck:tab-lock',
  'leak:native-memory', 'signal:SIGTERM', 'signal:SIGSEGV', 'signal:SIGABRT',
]);

function isValidType(type) {
  if (VALID_TYPES.has(type)) return true;
  return /^(hang|signal|stuck|leak|crash):[\w\-.:]+$/.test(type);
}

function validatePayload(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.type !== 'string' || !isValidType(data.type)) return null;
  if (typeof data.signature !== 'string' || !/^[0-9a-f]{8}$/.test(data.signature)) return null;
  if (typeof data.title !== 'string' || data.title.length === 0 || data.title.length > 256) return null;
  if (typeof data.body !== 'string' || data.body.length > 65536) return null;
  if (!Array.isArray(data.labels) || data.labels.some((l) => typeof l !== 'string')) return null;
  return {
    type: data.type,
    signature: data.signature,
    title: data.title,
    body: data.body,
    labels: data.labels.slice(0, 5),
    version: typeof data.version === 'string' ? data.version : undefined,
  };
}

describe('payload validation', () => {

  test('accepts valid crash report', () => {
    const result = validatePayload({
      type: 'crash',
      signature: 'aabb1122',
      title: '[aabb1122] crash: test',
      body: '## Error\ntest',
      labels: ['crash', 'auto-report'],
      version: '1.8.2',
    });
    expect(result).not.toBeNull();
    expect(result.type).toBe('crash');
  });

  test('accepts hang:navigate type', () => {
    const result = validatePayload({
      type: 'hang:navigate',
      signature: 'deadbeef',
      title: 'test',
      body: 'body',
      labels: ['hang'],
    });
    expect(result).not.toBeNull();
  });

  test('accepts stuck:event-loop type', () => {
    const result = validatePayload({
      type: 'stuck:event-loop',
      signature: '11223344',
      title: 'test',
      body: 'body',
      labels: ['stuck'],
    });
    expect(result).not.toBeNull();
  });

  test('accepts signal:SIGTERM type', () => {
    const result = validatePayload({
      type: 'signal:SIGTERM',
      signature: 'aabbccdd',
      title: 'test',
      body: 'body',
      labels: ['crash'],
    });
    expect(result).not.toBeNull();
  });

  test('accepts leak:native-memory type', () => {
    const result = validatePayload({
      type: 'leak:native-memory',
      signature: 'eeff0011',
      title: 'test',
      body: 'body',
      labels: ['auto-report', 'memory-leak'],
    });
    expect(result).not.toBeNull();
  });

  test('rejects unknown type', () => {
    expect(validatePayload({
      type: 'xss:injection',
      signature: 'aabb1122',
      title: 'test',
      body: 'body',
      labels: [],
    })).toBeNull();
  });

  test('rejects type with special characters', () => {
    expect(validatePayload({
      type: 'crash; rm -rf /',
      signature: 'aabb1122',
      title: 'test',
      body: 'body',
      labels: [],
    })).toBeNull();
  });

  test('rejects non-hex signature', () => {
    expect(validatePayload({
      type: 'crash',
      signature: 'not-hex!',
      title: 'test',
      body: 'body',
      labels: [],
    })).toBeNull();
  });

  test('rejects too-short signature', () => {
    expect(validatePayload({
      type: 'crash',
      signature: 'aabb',
      title: 'test',
      body: 'body',
      labels: [],
    })).toBeNull();
  });

  test('rejects too-long signature', () => {
    expect(validatePayload({
      type: 'crash',
      signature: 'aabb11223344',
      title: 'test',
      body: 'body',
      labels: [],
    })).toBeNull();
  });

  test('rejects empty title', () => {
    expect(validatePayload({
      type: 'crash',
      signature: 'aabb1122',
      title: '',
      body: 'body',
      labels: [],
    })).toBeNull();
  });

  test('rejects title > 256 chars', () => {
    expect(validatePayload({
      type: 'crash',
      signature: 'aabb1122',
      title: 'x'.repeat(257),
      body: 'body',
      labels: [],
    })).toBeNull();
  });

  test('rejects body > 64KB', () => {
    expect(validatePayload({
      type: 'crash',
      signature: 'aabb1122',
      title: 'test',
      body: 'x'.repeat(65537),
      labels: [],
    })).toBeNull();
  });

  test('rejects non-string labels', () => {
    expect(validatePayload({
      type: 'crash',
      signature: 'aabb1122',
      title: 'test',
      body: 'body',
      labels: [123],
    })).toBeNull();
  });

  test('truncates labels to 5', () => {
    const result = validatePayload({
      type: 'crash',
      signature: 'aabb1122',
      title: 'test',
      body: 'body',
      labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    expect(result.labels).toHaveLength(5);
  });

  test('rejects null payload', () => {
    expect(validatePayload(null)).toBeNull();
  });

  test('rejects string payload', () => {
    expect(validatePayload('not an object')).toBeNull();
  });

  test('rejects missing fields', () => {
    expect(validatePayload({ type: 'crash' })).toBeNull();
  });

  test('version is optional', () => {
    const result = validatePayload({
      type: 'crash',
      signature: 'aabb1122',
      title: 'test',
      body: 'body',
      labels: [],
    });
    expect(result).not.toBeNull();
    expect(result.version).toBeUndefined();
  });

  test('version must be string if present', () => {
    const result = validatePayload({
      type: 'crash',
      signature: 'aabb1122',
      title: 'test',
      body: 'body',
      labels: [],
      version: 42,
    });
    expect(result).not.toBeNull();
    expect(result.version).toBeUndefined();
  });
});

// ============================================================================
// Client↔Worker payload compatibility
// ============================================================================

describe('client↔worker payload compatibility', () => {

  // Import the client-side functions
  let stackSignature, anonymize;

  beforeAll(async () => {
    const reporter = await import('../../lib/reporter.js');
    stackSignature = reporter.stackSignature;
    anonymize = reporter.anonymize;
  });

  test('stackSignature produces valid 8-char hex accepted by worker', () => {
    const sig = stackSignature('crash', new Error('test'));
    expect(sig).toMatch(/^[0-9a-f]{8}$/);
    // Must pass worker validation
    const payload = {
      type: 'crash',
      signature: sig,
      title: `[${sig}] crash: test`,
      body: 'body',
      labels: ['crash'],
    };
    expect(validatePayload(payload)).not.toBeNull();
  });

  test('hang type from client matches worker validation', () => {
    const payload = {
      type: 'hang:navigate',
      signature: stackSignature('hang:navigate', { name: 'TimeoutError', message: 'test' }),
      title: 'test',
      body: 'body',
      labels: ['hang', 'auto-report'],
    };
    expect(validatePayload(payload)).not.toBeNull();
  });

  test('stuck type from client matches worker validation', () => {
    const payload = {
      type: 'stuck:event-loop',
      signature: stackSignature('stuck:event-loop', { name: 'EventLoopStall', message: 'idle' }),
      title: 'test',
      body: 'body',
      labels: ['stuck', 'auto-report'],
    };
    expect(validatePayload(payload)).not.toBeNull();
  });

  test('leak type from client matches worker validation', () => {
    const payload = {
      type: 'leak:native-memory',
      signature: stackSignature('leak:native-memory', { name: 'MemoryLeak', message: 'test' }),
      title: 'test',
      body: 'body',
      labels: ['auto-report', 'memory-leak'],
    };
    expect(validatePayload(payload)).not.toBeNull();
  });

  test('signal type from client matches worker validation', () => {
    const payload = {
      type: 'signal:SIGTERM',
      signature: stackSignature('signal:SIGTERM', new Error('killed')),
      title: 'test',
      body: 'body',
      labels: ['crash', 'auto-report'],
    };
    expect(validatePayload(payload)).not.toBeNull();
  });

  test('anonymized body is within 64KB limit', () => {
    // Even a large stack trace + resources + context should be under 64KB after anonymization
    const longStack = 'Error: test\n' + '    at foo (server.js:100:10)\n'.repeat(500);
    const body = anonymize(longStack);
    expect(body.length).toBeLessThan(65536);
  });

  test('title with anonymized message is within 256 chars', () => {
    const sig = 'aabb1122';
    const longMessage = 'x'.repeat(300);
    // Client truncates to 120 chars: `[sig] type: message.slice(0, 120)`
    const title = `[${sig}] crash: ${anonymize(longMessage).slice(0, 120)}`;
    expect(title.length).toBeLessThanOrEqual(256);
  });
});

// ============================================================================
// wrangler.toml config
// ============================================================================

describe('wrangler.toml', () => {

  test('exists and has correct name', () => {
    const toml = readFileSync(join(__dirname, '../../workers/crash-reporter/wrangler.toml'), 'utf-8');
    expect(toml).toContain('name = "camofox-crash-relay"');
  });
});

// ============================================================================
// Deploy workflow
// ============================================================================

describe('deploy workflow', () => {

  test('exists and triggers on worker changes', () => {
    const workflow = readFileSync(join(__dirname, '../../.github/workflows/crash-relay-deploy.yml'), 'utf-8');
    expect(workflow).toContain('workers/crash-reporter/**');
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN');
    expect(workflow).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(workflow).toContain('__COMMIT_SHA__');
    expect(workflow).toContain('__SOURCE_SHA256__');
  });

  test('only triggers on main branch', () => {
    const workflow = readFileSync(join(__dirname, '../../.github/workflows/crash-relay-deploy.yml'), 'utf-8');
    expect(workflow).toContain('branches: [main]');
  });
});
