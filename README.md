<div align="center">
  <img src="fox.png" alt="camofox-browser" width="200" />
  <h1>camofox-browser</h1>
  <p><strong>Headless browser server for AI agents with C++ anti-detection</strong></p>
  <p>
    <a href="https://github.com/jo-inc/camofox-browser/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build" /></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
    <a href="https://camoufox.com"><img src="https://img.shields.io/badge/engine-Camoufox-red" alt="Camoufox" /></a>
    <a href="https://hub.docker.com"><img src="https://img.shields.io/badge/docker-ready-blue" alt="Docker" /></a>
  </p>
  <p>
    Powered by <a href="https://camoufox.com">Camoufox</a> — a Firefox fork with fingerprint spoofing at the C++ level.<br/>
    The same engine behind <a href="https://askjo.ai">askjo.ai</a>'s web scraping.
  </p>
</div>

---

## Why

AI agents need to browse the real web. Playwright gets blocked. Headless Chrome gets fingerprinted. Stealth plugins become the fingerprint.

Camoufox patches Firefox at the **C++ implementation level** — `navigator.hardwareConcurrency`, WebGL renderers, AudioContext, screen geometry, WebRTC — all spoofed before JavaScript ever sees them. No shims, no wrappers, no tells.

This project wraps that engine in a REST API built for agents: accessibility snapshots instead of bloated HTML, stable element refs for clicking, and search macros for common sites.

## Features

- **C++ Anti-Detection** — bypasses Google, Cloudflare, and most bot detection
- **Element Refs** — stable `e1`, `e2`, `e3` identifiers for reliable interaction
- **Token-Efficient** — accessibility snapshots are 90% smaller than raw HTML
- **Session Isolation** — separate cookies/storage per user
- **Search Macros** — `@google_search`, `@youtube_search`, `@amazon_search`, and 10 more
- **Docker Ready** — production Dockerfile with pre-baked Camoufox binary

## Quick Start

### OpenClaw Plugin

```bash
openclaw plugins install @askjo/camofox-browser
```

**Tools:** `camofox_create_tab` · `camofox_snapshot` · `camofox_click` · `camofox_type` · `camofox_navigate` · `camofox_scroll` · `camofox_screenshot` · `camofox_close_tab` · `camofox_list_tabs`

### Standalone

```bash
git clone https://github.com/jo-inc/camofox-browser
cd camofox-browser
npm install
npm start  # downloads Camoufox on first run (~300MB)
```

### Docker

```bash
docker build -t camofox-browser .
docker run -p 3000:3000 camofox-browser
```

## Usage

```bash
# Create a tab
curl -X POST http://localhost:3000/tabs \
  -d '{"userId": "agent1", "sessionKey": "task1", "url": "https://example.com"}'

# Get page snapshot with element refs
curl "http://localhost:3000/tabs/TAB_ID/snapshot?userId=agent1"
# → { "snapshot": "[button e1] Submit  [link e2] Learn more", ... }

# Click by ref
curl -X POST http://localhost:3000/tabs/TAB_ID/click \
  -d '{"userId": "agent1", "ref": "e1"}'

# Search with macros
curl -X POST http://localhost:3000/tabs/TAB_ID/navigate \
  -d '{"userId": "agent1", "macro": "@google_search", "query": "best coffee beans"}'
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/tabs` | Create tab |
| `GET` | `/tabs/:id/snapshot` | Accessibility snapshot with refs |
| `POST` | `/tabs/:id/click` | Click element by ref |
| `POST` | `/tabs/:id/type` | Type into element |
| `POST` | `/tabs/:id/navigate` | Navigate to URL or macro |
| `POST` | `/tabs/:id/scroll` | Scroll page |
| `GET` | `/tabs/:id/screenshot` | Screenshot |
| `GET` | `/tabs/:id/links` | All links on page |
| `POST` | `/tabs/:id/back` | Go back |
| `POST` | `/tabs/:id/forward` | Go forward |
| `POST` | `/tabs/:id/refresh` | Refresh |
| `DELETE` | `/tabs/:id` | Close tab |
| `GET` | `/tabs?userId=X` | List tabs |
| `DELETE` | `/sessions/:userId` | Close all user tabs |
| `GET` | `/health` | Health check |

## Search Macros

`@google_search` · `@youtube_search` · `@amazon_search` · `@reddit_search` · `@wikipedia_search` · `@twitter_search` · `@yelp_search` · `@spotify_search` · `@netflix_search` · `@linkedin_search` · `@instagram_search` · `@tiktok_search` · `@twitch_search`

## Architecture

```
Browser Instance
└── User Session (BrowserContext) — isolated cookies/storage
    ├── Tab Group (sessionKey: "conv1")
    │   ├── Tab (google.com)
    │   └── Tab (github.com)
    └── Tab Group (sessionKey: "conv2")
        └── Tab (amazon.com)
```

Sessions auto-expire after 30 minutes of inactivity.

## Testing

```bash
npm test              # e2e tests
npm run test:live     # live Google tests
npm run test:debug    # with server output
```

## npm

```bash
npm install @askjo/camofox-browser
```

## Credits

- [Camoufox](https://camoufox.com) — Firefox-based browser with C++ anti-detection
- [OpenClaw](https://openclaw.ai) — Open-source AI agent framework
- [Amp](https://ampcode.com) — AI coding agent

## License

MIT
