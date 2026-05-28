import {
  safePageUrl,
  urlDomain,
  hashIdentifier,
  isPageCrashedError,
  isDeadContextError,
  browserErrorStatus,
  browserErrorCode,
} from '../../lib/browser-errors.js';

describe('browser error normalization', () => {
  test('safePageUrl never throws on undefined or destroyed pages', () => {
    expect(safePageUrl(undefined)).toBe('unknown');
    expect(safePageUrl({ url: () => { throw new TypeError('Cannot read properties of undefined (reading \'url\')'); } })).toBe('unknown');
    expect(safePageUrl({ url: () => 'https://example.com/path?secret=1' })).toBe('https://example.com/path?secret=1');
  });

  test('extracts only URL domain for Sentry context', () => {
    expect(urlDomain('https://sub.example.com/path?token=secret')).toBe('sub.example.com');
    expect(urlDomain('unknown')).toBe('unknown');
  });

  test('hashIdentifier is stable and does not expose raw ids', () => {
    const hash = hashIdentifier('user-123');
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
    expect(hash).toBe(hashIdentifier('user-123'));
    expect(hash).not.toContain('user-123');
  });

  test('page crashes normalize to 410 page_crashed', () => {
    const err = new Error('page.goto: Page crashed');
    expect(isPageCrashedError(err)).toBe(true);
    expect(browserErrorStatus(err)).toBe(410);
    expect(browserErrorCode(err)).toBe('page_crashed');
  });

  test('dead browser contexts normalize to 503 session_expired', () => {
    const err = new Error('Target page, context or browser has been closed');
    expect(isDeadContextError(err)).toBe(true);
    expect(browserErrorStatus(err)).toBe(503);
    expect(browserErrorCode(err)).toBe('session_expired');
  });
});
