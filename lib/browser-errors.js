import crypto from 'crypto';

export function safePageUrl(page) {
  try { return page?.url?.() || 'unknown'; } catch { return 'unknown'; }
}

export function urlDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function hashIdentifier(value) {
  if (value === undefined || value === null || value === '') return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

export function isDeadContextError(err) {
  const msg = err && err.message || '';
  return msg.includes('Target page, context or browser has been closed') ||
         msg.includes('browser has been closed') ||
         msg.includes('Context closed') ||
         msg.includes('Browser closed');
}

export function isPageCrashedError(err) {
  const msg = err && err.message || '';
  return msg.includes('Page crashed') ||
         msg.includes('Target crashed') ||
         msg.includes('crashed page');
}

export function isTimeoutError(err) {
  const msg = err && err.message || '';
  return msg.includes('timed out after') ||
         (msg.includes('Timeout') && msg.includes('exceeded'));
}

export function isTabLockQueueTimeout(err) {
  return err && err.message === 'Tab lock queue timeout';
}

export function isTabDestroyedError(err) {
  return err && err.message === 'Tab destroyed';
}

export function browserErrorStatus(err) {
  if (isTabDestroyedError(err) || isPageCrashedError(err)) return 410;
  if (isDeadContextError(err) || isTabLockQueueTimeout(err)) return 503;
  return err?.statusCode || null;
}

export function browserErrorCode(err) {
  if (isPageCrashedError(err)) return 'page_crashed';
  if (isTabDestroyedError(err)) return 'tab_destroyed';
  if (isDeadContextError(err)) return 'session_expired';
  if (isTabLockQueueTimeout(err)) return 'tab_unresponsive';
  return err?.code || null;
}
