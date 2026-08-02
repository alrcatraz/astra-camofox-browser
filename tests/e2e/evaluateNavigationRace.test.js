import { createClient } from '../helpers/client.js';
import { getSharedEnv } from './sharedEnv.js';

describe('Evaluate during navigation', () => {
  let serverUrl;
  let testSiteUrl;

  beforeAll(() => {
    const env = getSharedEnv();
    serverUrl = env.serverUrl;
    testSiteUrl = env.testSiteUrl;
  });

  test('accepts an evaluate body above the global JSON limit', async () => {
    const client = createClient(serverUrl);

    try {
      const { tabId } = await client.createTab(testSiteUrl);
      const expression = `/*${'x'.repeat(150 * 1024)}*/ 1 + 1`;
      const result = await client.evaluate(tabId, expression);

      expect(result.ok).toBe(true);
      expect(result.result).toBe(2);
    } finally {
      await client.cleanup();
    }
  });

  test('evaluate interrupted by a late redirect returns 409 navigation_race, then succeeds on retry', async () => {
    const client = createClient(serverUrl);

    try {
      const { tabId } = await client.createTab(`${testSiteUrl}/lateRedirect`);

      let raceError = null;
      try {
        await client.evaluate(tabId, 'new Promise(r => setTimeout(r, 5000))');
      } catch (err) {
        raceError = err;
      }

      expect(raceError).not.toBeNull();
      expect(raceError.status).toBe(409);
      expect(raceError.data.code).toBe('navigation_race');
      expect(raceError.data.retryable).toBe(true);

      await client.waitForUrl(tabId, '/pageA');
      const retry = await client.evaluate(tabId, 'document.title');
      expect(retry.ok).toBe(true);
      expect(retry.result).toBe('Page A');
    } finally {
      await client.cleanup();
    }
  });

  test('evaluate after the redirect settles succeeds without error', async () => {
    const client = createClient(serverUrl);

    try {
      const { tabId } = await client.createTab(`${testSiteUrl}/lateRedirect`);
      await client.waitForUrl(tabId, '/pageA');

      const result = await client.evaluate(tabId, '1 + 1');
      expect(result.ok).toBe(true);
      expect(result.result).toBe(2);
    } finally {
      await client.cleanup();
    }
  });
});
