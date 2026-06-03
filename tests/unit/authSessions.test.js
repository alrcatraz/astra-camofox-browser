import {
  authSessionProvider,
  cookieMatchesSuffix,
  sanitizeProviderCookies,
} from '../../lib/auth-sessions.js';

describe('auth session helpers', () => {
  test('supports amazon provider', () => {
    expect(authSessionProvider('amazon')).toMatchObject({
      provider: 'amazon',
      verifyUrl: 'https://www.amazon.com/gp/css/order-history',
    });
  });

  test('matches provider cookie domains by suffix', () => {
    expect(cookieMatchesSuffix({ domain: '.amazon.com' }, 'amazon.com')).toBe(true);
    expect(cookieMatchesSuffix({ domain: 'www.amazon.com' }, 'amazon.com')).toBe(true);
    expect(cookieMatchesSuffix({ domain: 'notamazon.com' }, 'amazon.com')).toBe(false);
    expect(cookieMatchesSuffix({ domain: 'amazon.com.evil.test' }, 'amazon.com')).toBe(false);
  });

  test('sanitizes amazon cookies and strips unknown fields', () => {
    const cookies = sanitizeProviderCookies(authSessionProvider('amazon'), [
      {
        name: 'session-id',
        value: 'abc',
        domain: '.amazon.com',
        path: '/',
        secure: true,
        evil: 'nope',
      },
    ]);

    expect(cookies).toEqual([
      {
        name: 'session-id',
        value: 'abc',
        domain: '.amazon.com',
        path: '/',
        secure: true,
      },
    ]);
  });

  test('rejects non-amazon cookies for amazon auth session import', () => {
    expect(() => sanitizeProviderCookies(authSessionProvider('amazon'), [
      { name: 'sid', value: 'abc', domain: '.facebook.com', path: '/' },
    ])).toThrow('Invalid provider cookies');
  });
});
