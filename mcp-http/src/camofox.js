/**
 * Camofox REST client.
 *
 * Thin wrapper around the Camofox browser-automation HTTP API (http://127.0.0.1:9377).
 * The Camofox ACCESS key is read from `CAMOFOX_ACCESS_KEY` and sent as
 * `Authorization: Bearer <key>` on every upstream request. The key is never
 * stored, logged, or echoed by this module.
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:9377';

/** Resolve the Camofox base URL, honouring an explicit override. */
export function camofoxBaseUrl() {
  return process.env.CAMOFOX_BASE_URL || DEFAULT_BASE_URL;
}

/** Default userId to use when a caller omits it. */
export function defaultUserId() {
  return process.env.CAMOFOX_USER_ID || 'dsh';
}

/** Default sessionKey to use when a caller omits it (mirrors userId). */
export function defaultSessionKey() {
  return process.env.CAMOFOX_SESSION_KEY || defaultUserId();
}

/** Guard so the key is never blended into an echoed URL or body. */
function authHeaders() {
  const key = process.env.CAMOFOX_ACCESS_KEY;
  if (!key) {
    throw new Error(
      'CAMOFOX_ACCESS_KEY is not set. Export it before starting the server to authenticate against Camofox.',
    );
  }
  return { Authorization: `Bearer ${key}` };
}

/**
 * Perform an upstream Camofox request and return the parsed JSON body.
 * On non-2xx, throws an Error carrying the HTTP status.
 */
export async function camofoxRequest(method, path, { query, body } = {}) {
  const url = new URL(path, camofoxBaseUrl());
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const init = { method, headers: { ...authHeaders() } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const detail = parsed && parsed.error ? `: ${parsed.error}` : '';
    throw new Error(`Camofox ${method} ${path} -> HTTP ${res.status}${detail}`);
  }
  return parsed;
}
