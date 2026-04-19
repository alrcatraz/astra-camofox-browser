/**
 * VNC plugin for camofox-browser.
 *
 * Exposes Camoufox's virtual display via noVNC so a human can interact with
 * the browser visually — log into sites, solve CAPTCHAs, approve OAuth prompts.
 * After interactive login, export the storage state via the API endpoint this
 * plugin registers.
 *
 * Architecture:
 *   Plugin replaces the default 1x1 Xvfb with a 1920x1080 display (via
 *   ctx.createVirtualDisplay factory override). vnc-watcher.sh detects the
 *   Xvfb process, attaches x11vnc, and noVNC (websockify) proxies it to a
 *   web UI on port 6080.
 *
 * Configuration (camofox.config.json):
 *   {
 *     "plugins": {
 *       "vnc": {
 *         "enabled": true,
 *         "resolution": "1920x1080",
 *         "password": "",
 *         "viewOnly": false,
 *         "vncPort": 5900,
 *         "novncPort": 6080
 *       }
 *     }
 *   }
 *
 * Or via environment variables (override config):
 *   ENABLE_VNC=1           Enable the plugin
 *   VNC_RESOLUTION=1920x1080
 *   VNC_PASSWORD=secret    Optional password for x11vnc
 *   VIEW_ONLY=1            View-only mode (no mouse/keyboard input)
 *   VNC_PORT=5900          x11vnc listen port
 *   NOVNC_PORT=6080        noVNC web UI port
 *
 * Registers:
 *   GET /sessions/:userId/storage_state — export Playwright storageState as JSON
 *
 * Events emitted:
 *   vnc:watcher:started    { pid }
 *   vnc:watcher:stopped    { code, signal }
 *   vnc:storage:exported   { userId, cookies, origins }
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../../lib/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function register(app, ctx, pluginConfig = {}) {
  const { events, config, log, sessions, VirtualDisplay } = ctx;

  // Check if VNC is enabled — env var or plugin config
  const enabled = process.env.ENABLE_VNC === '1' || pluginConfig.enabled === true;
  if (!enabled) {
    log('info', 'vnc plugin: disabled (set ENABLE_VNC=1 or plugins.vnc.enabled=true)');
    return;
  }

  // --- Override Xvfb resolution ---
  // Subclass the upstream VirtualDisplay to use a resolution humans can see.
  // Resolve resolution — user specifies WxH, we append x24 (24-bit color depth)
  const rawResolution = process.env.VNC_RESOLUTION || pluginConfig.resolution || '1920x1080';
  const resolution = rawResolution.includes('x', rawResolution.indexOf('x') + 1)
    ? rawResolution          // already has depth (e.g. '1920x1080x24')
    : `${rawResolution}x24`; // append default 24-bit depth

  class VncVirtualDisplay extends VirtualDisplay {
    get xvfb_args() {
      const args = super.xvfb_args;
      // Replace the resolution argument that follows '-screen 0'
      const idx = args.indexOf('0');
      if (idx > 0 && args[idx - 1] === '-screen') {
        const patched = [...args];
        patched[idx + 1] = resolution;
        return patched;
      }
      return args;
    }
  }

  // Replace the factory so server.js uses our display on next browser launch
  ctx.createVirtualDisplay = () => new VncVirtualDisplay();
  log('info', 'vnc plugin: overriding Xvfb resolution', { resolution });

  // --- VNC watcher process ---
  const vncPassword = process.env.VNC_PASSWORD || pluginConfig.password || '';
  const viewOnly = process.env.VIEW_ONLY === '1' || pluginConfig.viewOnly === true;
  const vncPort = process.env.VNC_PORT || pluginConfig.vncPort || '5900';
  const novncPort = process.env.NOVNC_PORT || pluginConfig.novncPort || '6080';

  log('info', 'vnc plugin enabled', {
    resolution,
    novncPort,
    vncPort,
    viewOnly,
    passwordProtected: !!vncPassword,
  });

  const watcherPath = path.join(__dirname, 'vnc-watcher.sh');
  const watcher = spawn('sh', [watcherPath], {
    env: {
      ...process.env,
      VNC_PASSWORD: vncPassword,
      VNC_RESOLUTION: resolution,
      VIEW_ONLY: viewOnly ? '1' : '0',
      VNC_PORT: String(vncPort),
      NOVNC_PORT: String(novncPort),
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: false,
  });

  watcher.on('error', (err) => {
    log('error', 'vnc watcher failed to start', { error: err.message });
  });

  watcher.on('exit', (code, signal) => {
    log('warn', 'vnc watcher exited', { code, signal });
    events.emit('vnc:watcher:stopped', { code, signal });
  });

  log('info', 'vnc watcher started', { pid: watcher.pid });
  events.emit('vnc:watcher:started', { pid: watcher.pid });

  // Clean up watcher on server shutdown
  events.on('server:shutdown', () => {
    if (watcher.exitCode === null) {
      log('info', 'killing vnc watcher on shutdown');
      watcher.kill('SIGTERM');
    }
  });

  // --- HTTP endpoint: GET /sessions/:userId/storage_state ---
  const authMiddleware = requireAuth(config);

  app.get('/sessions/:userId/storage_state', authMiddleware, async (req, res) => {
    try {
      const userId = req.params.userId;
      const session = sessions.get(String(userId));
      if (!session) {
        return res.status(404).json({ error: `No active session for userId="${userId}"` });
      }

      const state = await session.context.storageState();

      log('info', 'storage_state exported', {
        reqId: req.reqId,
        userId: String(userId),
        cookies: state.cookies?.length || 0,
        origins: state.origins?.length || 0,
      });

      events.emit('vnc:storage:exported', {
        userId: String(userId),
        cookies: state.cookies?.length || 0,
        origins: state.origins?.length || 0,
      });

      // Notify persistence plugin if active
      events.emit('session:storage:export', { userId: String(userId) });

      res.json(state);
    } catch (err) {
      log('error', 'storage_state export failed', { reqId: req.reqId, error: err.message });
      res.status(500).json({ error: err.message });
    }
  });

  log('info', 'vnc plugin: registered GET /sessions/:userId/storage_state');
}
