import { shouldDropOperationalError } from '../../lib/sentry.js';

describe('sentry operational error filtering', () => {
  test('drops Playwright page JavaScript errors surfaced through Firefox internals', () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'url')");
    err.stack = [
      "TypeError: Cannot read properties of undefined (reading 'url')",
      '    at /app/node_modules/playwright-core/lib/coreBundle.js:42785:1',
      '    at FFPage._onUncaughtError (/app/node_modules/playwright-core/lib/coreBundle.js:43470:1)',
      '    at _Page.addPageError (/app/node_modules/playwright-core/lib/coreBundle.js:19951:1)',
    ].join('\n');

    expect(shouldDropOperationalError(err)).toBe(true);
  });

  test('keeps ordinary application errors', () => {
    expect(shouldDropOperationalError(new Error('route handler failed'))).toBe(false);
  });
});
