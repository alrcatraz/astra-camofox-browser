/**
 * Jest globalTeardown for e2e tests.
 * Stops the shared camofox server + test site.
 */
import fs from 'fs';

export default async function globalTeardown() {
  // Stop test site
  try {
    const { stopTestSite } = await import('../helpers/testSite.js');
    await stopTestSite();
  } catch (e) {
    console.error('[globalTeardown] test site stop error:', e.message);
  }

  // Kill camofox server
  const proc = globalThis.__CAMOFOX_SERVER_PROCESS__;
  if (proc) {
    await new Promise((resolve) => {
      proc.on('close', resolve);
      proc.kill('SIGTERM');
      const forceKillTimeout = setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 5000);
      forceKillTimeout.unref();
    });
  }

  // Clean up temp file
  const envFile = globalThis.__CAMOFOX_ENV_FILE__;
  if (envFile) {
    try { fs.unlinkSync(envFile); } catch (e) { /* ignore */ }
  }

  const uploadsTempDir = globalThis.__CAMOFOX_UPLOADS_TEMP_DIR__;
  if (uploadsTempDir) {
    try { fs.rmSync(uploadsTempDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }

  console.log('[globalTeardown] done');
}
