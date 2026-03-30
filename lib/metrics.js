// Prometheus metrics for jo-browser.
// Isolated in lib/ to keep process.env out of server.js (OpenClaw scanner rule).
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// --- Counters ---

export const requestsTotal = new client.Counter({
  name: 'jo_browser_requests_total',
  help: 'Total HTTP requests by action and status',
  labelNames: ['action', 'status'],
  registers: [register],
});

export const tabLockTimeoutsTotal = new client.Counter({
  name: 'jo_browser_tab_lock_timeouts_total',
  help: 'Tab lock queue timeouts resulting in 503',
  registers: [register],
});

export const failuresTotal = new client.Counter({
  name: 'jo_browser_failures_total',
  help: 'Total failures by type and action',
  labelNames: ['type', 'action'],
  registers: [register],
});

export const browserRestartsTotal = new client.Counter({
  name: 'jo_browser_restarts_total',
  help: 'Browser restarts by reason',
  labelNames: ['reason'],
  registers: [register],
});

export const tabsDestroyedTotal = new client.Counter({
  name: 'jo_browser_tabs_destroyed_total',
  help: 'Tabs force-destroyed by reason',
  labelNames: ['reason'],
  registers: [register],
});

export const sessionsExpiredTotal = new client.Counter({
  name: 'jo_browser_sessions_expired_total',
  help: 'Sessions expired due to inactivity',
  registers: [register],
});

export const tabsReapedTotal = new client.Counter({
  name: 'jo_browser_tabs_reaped_total',
  help: 'Tabs reaped due to inactivity',
  registers: [register],
});

export const tabsRecycledTotal = new client.Counter({
  name: 'jo_browser_tabs_recycled_total',
  help: 'Tabs recycled when tab limit reached',
  registers: [register],
});

// --- Histograms ---

export const requestDuration = new client.Histogram({
  name: 'jo_browser_request_duration_seconds',
  help: 'Request duration in seconds by action',
  labelNames: ['action'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

export const pageLoadDuration = new client.Histogram({
  name: 'jo_browser_page_load_duration_seconds',
  help: 'Page load duration in seconds',
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

// --- Gauges ---

export const activeTabsGauge = new client.Gauge({
  name: 'jo_browser_active_tabs',
  help: 'Current number of open browser tabs',
  registers: [register],
});

export const tabLockQueueDepth = new client.Gauge({
  name: 'jo_browser_tab_lock_queue_depth',
  help: 'Current number of requests waiting for a tab lock',
  registers: [register],
});

export const memoryUsageBytes = new client.Gauge({
  name: 'jo_browser_memory_usage_bytes',
  help: 'Process RSS memory usage in bytes',
  registers: [register],
});

// Periodic memory reporter
const MEMORY_INTERVAL_MS = 30_000;
let memoryTimer = null;

export function startMemoryReporter() {
  if (memoryTimer) return;
  const report = () => memoryUsageBytes.set(process.memoryUsage().rss);
  report();
  memoryTimer = setInterval(report, MEMORY_INTERVAL_MS);
  memoryTimer.unref(); // don't keep process alive
}

export function stopMemoryReporter() {
  if (memoryTimer) { clearInterval(memoryTimer); memoryTimer = null; }
}

// Helper: derive a short action name from Express route
export function actionFromReq(req) {
  const method = req.method;
  const path = req.route?.path || req.path;
  // POST /tabs -> create_tab, DELETE /tabs/:tabId -> delete_tab, etc.
  if (path === '/tabs' && method === 'POST') return 'create_tab';
  if (path === '/tabs/:tabId' && method === 'DELETE') return 'delete_tab';
  if (path === '/tabs/group/:listItemId' && method === 'DELETE') return 'delete_tab_group';
  if (path === '/sessions/:userId' && method === 'DELETE') return 'delete_session';
  if (path === '/sessions/:userId/cookies' && method === 'POST') return 'set_cookies';
  if (path === '/tabs/open' && method === 'POST') return 'open_url';
  if (path === '/tabs' && method === 'GET') return 'list_tabs';
  // /tabs/:tabId/<action>
  const m = path.match(/^\/tabs\/:tabId\/(\w+)$/);
  if (m) return m[1]; // navigate, snapshot, click, type, scroll, etc.
  // legacy compat routes
  if (['/start', '/stop', '/navigate', '/snapshot', '/act'].includes(path)) return path.slice(1);
  if (path === '/youtube/transcript') return 'youtube_transcript';
  if (path === '/health') return 'health';
  if (path === '/metrics') return 'metrics';
  return `${method.toLowerCase()}_${path.replace(/[/:]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;
}

/**
 * Classify an error into a failure type string for metrics labeling.
 */
export function classifyError(err) {
  if (!err) return 'unknown';
  const msg = err.message || '';

  if (err.code === 'stale_refs' || err.name === 'StaleRefsError') return 'stale_refs';
  if (msg === 'Tab lock queue timeout') return 'tab_lock_timeout';
  if (msg === 'Tab destroyed') return 'tab_destroyed';
  if (msg.includes('Target page, context or browser has been closed') ||
      msg.includes('browser has been closed') ||
      msg.includes('Context closed') ||
      msg.includes('Browser closed')) return 'dead_context';
  if (msg.includes('timed out after') ||
      (msg.includes('Timeout') && msg.includes('exceeded'))) return 'timeout';
  if (msg.includes('Maximum concurrent sessions')) return 'session_limit';
  if (msg.includes('Maximum tabs per session') || msg.includes('Maximum global tabs')) return 'tab_limit';
  if (msg.includes('concurrency limit reached')) return 'concurrency_limit';
  if (msg.includes('NS_ERROR_PROXY') || msg.includes('proxy connection') ||
      msg.includes('Proxy connection')) return 'proxy';
  if (msg.includes('Browser launch timeout') || msg.includes('Failed to launch')) return 'browser_launch';
  if (msg.includes('intercepts pointer events')) return 'click_intercepted';
  if (msg.includes('not visible') || msg.includes('not an <input>')) return 'element_error';
  if (msg.includes('Blocked URL scheme') || msg.includes('Invalid URL')) return 'invalid_url';
  if (msg.includes('net::') || msg.includes('ERR_NAME') || msg.includes('ERR_CONNECTION')) return 'network';
  if (msg.includes('Navigation failed') || msg.includes('ERR_ABORTED')) return 'nav_aborted';
  return 'unknown';
}

export { register };
