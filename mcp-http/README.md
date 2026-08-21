# camofox-mcp

Streamable-HTTP MCP wrapper exposing the **Camofox** browser-automation REST
API (`http://127.0.0.1:9377`) as MCP tools, so DSH and other MCP-capable agents
can drive the live browser over MCP.

Built on [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
(Streamable HTTP transport). Node >= 20.

## Usage

```sh
export CAMOFOX_ACCESS_KEY=...      # required — Bearer token for Camofox (never echoed)
npm install
npm start                          # listens on http://127.0.0.1:3005/mcp
```

Configuration (all optional except `CAMOFOX_ACCESS_KEY`):

| Env / flag            | Default                | Meaning                                        |
| --------------------- | ---------------------- | ---------------------------------------------- |
| `CAMOFOX_ACCESS_KEY`  | *(required)*           | Camofox Bearer token. Never stored/echoed.     |
| `CAMOFOX_BASE_URL`    | `http://127.0.0.1:9377`| Camofox REST base URL.                         |
| `CAMOFOX_USER_ID`     | `dsh`                  | Default `userId` when a caller omits it.       |
| `CAMOFOX_SESSION_KEY` | = `CAMOFOX_USER_ID`    | Default `sessionKey` for tab-opening.          |
| `MCP_PORT` / `--port` | `3005`                 | HTTP listen port.                              |
| `MCP_HOST` / `--host` | `127.0.0.1`            | HTTP bind address.                             |

### MCP client wiring example

Point an MCP client at `http://127.0.0.1:3005/mcp`. The client performs the
`initialize` handshake and `tools/list` over the Streamable HTTP endpoint.

## Tool map (26 tools)

All tools forward to Camofox and return the upstream JSON to the model as text.
`userId` is required everywhere and defaults to `CAMOFOX_USER_ID` (`dsh`) when
omitted.

### Tab / session
| MCP tool               | Camofox REST                       | Notes                                            |
| ---------------------- | ---------------------------------- | ------------------------------------------------ |
| `browser_open`         | `POST /tabs`                       | `userId`, `sessionKey`, optional `url`           |
| `browser_list_tabs`    | `GET /tabs`                        | `userId`                                         |
| `browser_close_tab`    | `DELETE /tabs/:id`                 | `tabId`, `userId`                                |
| `browser_clear_session`| `DELETE /sessions/:userId`         | `userId`                                         |
| `browser_set_cookies`  | `POST /sessions/:userId/cookies`   | `userId`, `cookies[]`                            |
| `browser_recycle_group`| `DELETE /tabs/group/:listItemId`   | `listItemId`, `userId`                           |

### Navigation
| MCP tool       | Camofox REST                       | Notes                        |
| -------------- | ---------------------------------- | ---------------------------- |
| `browser_navigate` | `POST /tabs/:id/navigate`      | `url` or `macro`             |
| `browser_back`     | `POST /tabs/:id/back`          |                              |
| `browser_forward`  | `POST /tabs/:id/forward`       |                              |
| `browser_refresh`  | `POST /tabs/:id/refresh`       |                              |

### Content
| MCP tool            | Camofox REST                       | Notes                               |
| ------------------- | ---------------------------------- | ----------------------------------- |
| `browser_snapshot`  | `GET /tabs/:id/snapshot`           | accessibility snapshot (pre-rendered)|
| `browser_links`     | `GET /tabs/:id/links`              | optional `limit`                    |
| `browser_images`    | `GET /tabs/:id/images`             |                                     |
| `browser_get_downloads` | `GET /tabs/:id/downloads`      |                                     |
| `browser_screenshot`| `GET /tabs/:id/screenshot`         |                                     |
| `browser_extract`   | `POST /tabs/:id/extract`           | `schema` (JSON)                     |
| `browser_evaluate`  | `POST /tabs/:id/evaluate`          | `expression` (JS)                   |

### Interaction
| MCP tool            | Camofox REST                       | Notes                          |
| ------------------- | ---------------------------------- | ------------------------------ |
| `browser_click`     | `POST /tabs/:id/click`             | `ref` or `selector`            |
| `browser_type`      | `POST /tabs/:id/type`              | `ref`/`selector`, `text`, `pressEnter` |
| `browser_press`     | `POST /tabs/:id/press`             | `key`                          |
| `browser_scroll`    | `POST /tabs/:id/scroll`            | `direction`, `amount`          |
| `browser_upload`    | `POST /tabs/:id/upload`            | `ref`/`selector`, `path`       |
| `browser_set_viewport` | `POST /tabs/:id/viewport`       | `width`, `height`              |
| `browser_wait`      | `POST /tabs/:id/wait`              | `conditions[]`                 |
| `browser_stats`     | `GET /tabs/:id/stats`              |                                |

## Development

```sh
npm test    # keyless unit tests (tool map + client behaviour)
```

Real-API verification is a manual smoke: `POST /mcp` initialize → `tools/list`
(enumerates the 26 tools) → `browser_open` → `browser_navigate` →
`browser_snapshot` (> contains `Example Domain`) → `browser_close_tab`.

## Notes

- `userId` is required on every upstream call; a stable default is supplied
  from `CAMOFOX_USER_ID` when the model omits it.
- `POST /tabs` also requires a `sessionKey`, defaulting to `CAMOFOX_SESSION_KEY`
  (`CAMOFOX_USER_ID`).
- Health/metrics/internal Camofox endpoints (`/health`, `/metrics`, `/start`,
  `/stop`, `/traces`, `/act`, legacy tab-less `/navigate`/`/snapshot`) are not
  wrapped — they duplicate the tab-scoped abilities.
- On non-2xx the tool returns an error result with the HTTP status.
