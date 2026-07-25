<div align="center">
  <img src="docs/fox.png" alt="astra-camofox-browser" width="200" />
  <h1>astra-camofox-browser</h1>
  <p><strong>Anti-detection browser server for AI agents — Astra fork</strong></p>
  <p>
    <a href="LICENSE"><img src="https://badgen.net/github/license/alrcatraz/astra-camofox-browser" alt="License: MIT" /></a>
    <a href="https://github.com/alrcatraz/astra-camofox-browser"><img src="https://badgen.net/github/stars/alrcatraz/astra-camofox-browser" alt="GitHub stars" /></a>
    <a href="https://github.com/alrcatraz/astra-camofox-browser/commits/astra"><img src="https://badgen.net/github/last-commit/alrcatraz/astra-camofox-browser/astra" alt="Last commit" /></a>
    <a href="https://github.com/alrcatraz/astra-camofox-browser/graphs/contributors"><img src="https://badgen.net/github/contributors/alrcatraz/astra-camofox-browser" alt="Contributors" /></a>
  </p>
  <p>
    Part of the <a href="https://github.com/alrcatraz/astra-aiagent-infra"><strong>Astra AI Agent Infrastructure</strong></a> ecosystem.
  </p>
</div>

<br/>

**astra-camofox-browser** is a fork of [`jo-inc/camofox-browser`](https://github.com/jo-inc/camofox-browser) (MIT) that wraps a Camoufox-powered anti-detection browser engine in a REST API designed for AI agents. It handles accessibility-tree snapshots with stable element refs, session isolation, cookie injection, proxy routing, and YouTube transcription.

<details>
<summary><strong>Astra Adaptations</strong> — what differs from upstream</summary>

| Adaptation | Details |
|:-----------|:--------|
| **VNC** | Fixed dynamic display detection (`-displayfd`); `xvfb-run` in Docker CMD |
| **Persistence** | Podman volume-based session storage for cookies and login state |
| **Container** | Podman-first Makefile; Playwright pinned to 1.58.0 |
| **Telemetry** | Crash reporter left intact (opt-out via `CAMOFOX_CRASH_REPORT_ENABLED=false`) |

</details>

<br/>

## Quick start

```bash
git clone https://github.com/alrcatraz/astra-camofox-browser && cd astra-camofox-browser
npm install && npm start
```

Server starts at `http://localhost:9377`.

Docker:

```bash
make up
```

## One quick example

```bash
# Create a tab
curl -X POST http://localhost:9377/tabs \
  -H 'Content-Type: application/json' \
  -d '{"userId": "agent1", "sessionKey": "demo", "url": "https://example.com"}'

# Get an accessibility snapshot (returns element refs like e1, e2)
curl "http://localhost:9377/tabs/TAB_ID/snapshot?userId=agent1"

# Click an element by ref
curl -X POST http://localhost:9377/tabs/TAB_ID/click \
  -H 'Content-Type: application/json' \
  -d '{"userId": "agent1", "ref": "e1"}'
```

## Full documentation

See the [Wiki](https://github.com/alrcatraz/astra-camofox-browser/wiki) for:

- [Installation](https://github.com/alrcatraz/astra-camofox-browser/wiki/Installation) — Docker, Windows, air-gapped, OpenClaw
- [Configuration](https://github.com/alrcatraz/astra-camofox-browser/wiki/Configuration) — all environment variables
- [API Reference](https://github.com/alrcatraz/astra-camofox-browser/wiki/API-Reference) — every endpoint with examples
- [Usage](https://github.com/alrcatraz/astra-camofox-browser/wiki/Usage) — cookies, session persistence, tracing, proxy, VNC
- [Telemetry](https://github.com/alrcatraz/astra-camofox-browser/wiki/Telemetry) — privacy, self-hosting
- [Troubleshooting](https://github.com/alrcatraz/astra-camofox-browser/wiki/Troubleshooting)

## Upstream

This project is adapted from [jo-inc/camofox-browser](https://github.com/jo-inc/camofox-browser) under the MIT License. Upstream copyright and attribution are preserved.

## License

MIT — see [LICENSE](LICENSE).
