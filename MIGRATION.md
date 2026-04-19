# Migration Guide

## Upgrading to 2.0

### Breaking Changes

#### 1. Default port changed from 3000 to 9377

The server now defaults to port `9377` instead of `3000`.

**If you rely on port 3000**, set the `CAMOFOX_PORT` environment variable:

```bash
CAMOFOX_PORT=3000 npm start
```

Or in Docker:

```bash
docker run -e CAMOFOX_PORT=3000 -p 3000:3000 camofox-browser
```

#### 2. `/youtube/transcript` now requires authentication

The YouTube transcript endpoint is now protected by the same auth middleware as other endpoints:

- If `CAMOFOX_API_KEY` is set → requires `Authorization: Bearer <key>` header
- If not set and not production → allows loopback requests (127.0.0.1 / ::1)
- In production without `CAMOFOX_API_KEY` → rejects with 403

**To restore the old unauthenticated behavior**, set `"auth": false` in the YouTube plugin config in `camofox.config.json`:

```json
{
  "plugins": {
    "youtube": { "enabled": true, "auth": false }
  }
}
```

#### 3. YouTube endpoint moved from core to plugin

`/youtube/transcript` is now provided by the `youtube` plugin instead of being built into the server. The endpoint path is unchanged, but the plugin must be enabled in `camofox.config.json`:

```json
{
  "plugins": {
    "youtube": { "enabled": true }
  }
}
```

If you're using the default config, this is already enabled. If you have a custom `camofox.config.json` with a `plugins` array, add `"youtube"` to it.

### Non-Breaking Changes

- Cookie import now uses `CAMOFOX_API_KEY` (was `BROWSER_API_KEY`)
- New plugin system for extending the server
- VNC plugin for interactive browser access
- Snapshot screenshots via `includeScreenshot=true` query param
- Download capture and DOM image extraction endpoints
