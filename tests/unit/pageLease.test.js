import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('page leases', () => {
  test('protect page creation and recovery until callers release the lease', () => {
    const root = resolve(__dirname, '../..');
    const script = `
      import assert from 'node:assert/strict';
      import {
        acquirePageLease, hasActivePageLeases, isPageLeased,
        releasePageLease, setLeasedPage,
      } from './lib/page-lease.js';
      import { createPageWithSessionRecovery } from './lib/new-page-recovery.js';

      const session = { tabGroups: new Map() };
      const page = {};
      const lease = acquirePageLease(session);
      assert.equal(hasActivePageLeases(session), true);
      setLeasedPage(lease, page);
      assert.equal(isPageLeased(session, page), true);
      releasePageLease(session, lease);
      releasePageLease(session, lease);
      assert.equal(hasActivePageLeases(session), false);

      const oldSession = { context: { newPage: async () => { throw new Error('context closed'); } } };
      const recoveryPage = {};
      const newSession = { context: { newPage: async () => recoveryPage } };
      let current = oldSession;
      const result = await createPageWithSessionRecovery({
        userId: 'user-1', session: oldSession, timeoutMs: 1,
        withTimeout: (promise) => promise,
        isTimeoutError: () => false, isDeadContextError: () => true,
        currentSession: () => current,
        destroySession: async () => { current = null; },
        getSession: async () => { current = newSession; return newSession; },
        log: () => {},
      });
      assert.equal(hasActivePageLeases(oldSession), false);
      assert.equal(result.page, recoveryPage);
      assert.equal(isPageLeased(newSession, recoveryPage), true);
      releasePageLease(newSession, result.lease);
      assert.equal(hasActivePageLeases(newSession), false);
    `;

    execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: root,
      stdio: 'pipe',
    });
  });
});
