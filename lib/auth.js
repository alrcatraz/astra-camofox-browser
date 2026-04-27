/**
 * Shared auth middleware for camofox-browser.
 *
 * Extracts the duplicated auth pattern from cookie/storage_state endpoints
 * into a reusable Express middleware factory.
 *
 * Policy (requireAuth / per-route):
 *   - If CAMOFOX_API_KEY is set, require Bearer token match (timing-safe).
 *   - If CAMOFOX_ACCESS_KEY is set, also accept it as an alternative (superkey).
 *   - If neither key set and NODE_ENV !== production, allow loopback (127.0.0.1 / ::1).
 *   - Otherwise, reject.
 *
 * Policy (accessKeyMiddleware / global):
 *   - If CAMOFOX_ACCESS_KEY is set, require Bearer match on all routes except
 *     /health, cookie import (own CAMOFOX_API_KEY), and /stop (own CAMOFOX_ADMIN_KEY).
 *   - If not set, pass through (backward-compatible).
 */

import crypto from 'crypto';

/**
 * Timing-safe string comparison.
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to burn constant time, then return false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Check if an address is loopback.
 */
function isLoopbackAddress(address) {
  if (!address) return false;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

/**
 * Create an Express middleware that enforces API key auth.
 *
 * Accepts CAMOFOX_API_KEY as primary token. When CAMOFOX_ACCESS_KEY is also
 * configured, it is accepted as an alternative ("superkey") so that routes
 * gated by both the global access-key middleware AND this per-route middleware
 * don't require two different tokens in a single Authorization header.
 *
 * @param {object} config - Must have { apiKey, nodeEnv }; optionally { accessKey }
 * @param {object} [options]
 * @param {string} [options.errorMessage] - Custom error message when rejecting unauthenticated requests
 * @returns {function} Express middleware (req, res, next)
 */
export function requireAuth(config, options = {}) {
  const errorMessage = options.errorMessage ||
    'This endpoint requires CAMOFOX_API_KEY except for loopback requests in non-production environments.';

  return (req, res, next) => {
    const auth = String(req.headers['authorization'] || '');
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1] : null;

    // Accept API key
    if (config.apiKey && token && timingSafeCompare(token, config.apiKey)) {
      return next();
    }

    // Accept access key as alternative (superkey)
    if (config.accessKey && token && timingSafeCompare(token, config.accessKey)) {
      return next();
    }

    // If API key is configured, a valid token was required — reject
    if (config.apiKey) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // No API key configured — allow loopback in non-production
    const remoteAddress = req.socket?.remoteAddress || '';
    const allowUnauthedLocal = config.nodeEnv !== 'production' && isLoopbackAddress(remoteAddress);
    if (!allowUnauthedLocal) {
      return res.status(403).json({ error: errorMessage });
    }

    next();
  };
}

/**
 * Global access-key middleware factory.
 *
 * When CAMOFOX_ACCESS_KEY is set, requires `Authorization: Bearer <key>` on
 * every route except:
 *   - GET /health (Docker/Fly healthcheck)
 *   - POST /sessions/:userId/cookies (gated by its own CAMOFOX_API_KEY)
 *   - POST /stop (gated by its own CAMOFOX_ADMIN_KEY via x-admin-key header)
 *
 * When CAMOFOX_ACCESS_KEY is not set, passes through (backward-compatible).
 *
 * @param {object} config - Must have { accessKey }
 * @returns {function} Express middleware (req, res, next)
 */
export function accessKeyMiddleware(config) {
  return (req, res, next) => {
    if (!config.accessKey) return next();

    // Exempt healthcheck
    if (req.path === '/health') return next();

    // Exempt routes with their own dedicated auth
    if (req.method === 'POST' && /^\/sessions\/[^/]+\/cookies$/.test(req.path)) return next();
    if (req.method === 'POST' && req.path === '/stop') return next();

    const auth = String(req.headers['authorization'] || '');
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match || !timingSafeCompare(match[1], config.accessKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
}

// Re-export utilities so server.js can still use them directly
export { timingSafeCompare, isLoopbackAddress };
