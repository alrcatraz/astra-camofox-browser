#!/usr/bin/env node
/**
 * Camofox MCP server — Streamable HTTP transport.
 *
 * Exposes the Camofox browser-automation REST API as MCP tools. Serves MCP
 * over HTTP at `POST /mcp` (Streamable HTTP) with GET/DELETE rejected per the
 * stateless-spec minimal contract.
 *
 * Runs in STATELESS Streamable HTTP mode following the SDK's official
 * `simpleStatelessStreamableHttp` pattern: each request builds a fresh
 * `McpServer` + `StreamableHTTPServerTransport`, connects them, handles the
 * request, and tears both down when the response closes. This is required
 * because one `McpServer` (a single `Protocol`) may be connected to only one
 * transport at a time and the transport closes on client disconnect — so
 * per-request lifecycle is the only correct way to serve many clients.
 *
 * Our tools are stateless 1:1 wrappers over independent Camofox REST calls, so
 * no cross-request MCP session state is needed.
 *
 * Configuration (env):
 *   CAMOFOX_ACCESS_KEY  required — Bearer token for Camofox (never echoed).
 *   CAMOFOX_BASE_URL    Camofox base URL (default http://127.0.0.1:9377).
 *   CAMOFOX_USER_ID     default userId when a caller omits it (default 'dsh').
 *   MCP_PORT / --port   HTTP listen port (default 3005).
 *   MCP_HOST / --host   bind address (default 127.0.0.1).
 */
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerCamofoxTools } from './tools.js';

function argOrEnv(name, dflt) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env[`MCP_${name.toUpperCase()}`] || dflt;
}

const PORT = Number(argOrEnv('port', 3005));
const HOST = argOrEnv('host', '127.0.0.1');

/** Build a fresh McpServer with all Camofox tools registered. */
function getServer() {
  const server = new McpServer({ name: 'camofox-mcp', version: '1.0.0' }, {
    capabilities: { tools: {} },
  });
  registerCamofoxTools(server);
  return server;
}

async function handlePost(req, res) {
  if (req.headers['content-type']?.includes('application/json') === false) {
    res.writeHead(415, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Unsupported Media Type' },
        id: null,
      }),
    );
    return;
  }

  // Read + parse the body ourselves; pass the parsed OBJECT to the transport.
  // (A raw JSON string fails the transport's JSONRPCMessageSchema parse.)
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : undefined;
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error: Invalid JSON' },
        id: null,
      }),
    );
    return;
  }

  const server = getServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    res.on('close', async () => {
      await transport.close();
      await server.close();
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('camofox-mcp error:', err && err.stack ? err.stack : err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        }),
      );
    }
  }
}

const app = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. MCP endpoint is POST /mcp.' }));
      return;
    }
    if (req.method === 'POST') return handlePost(req, res);
    // Stateless mode supports POST only; reject GET/DELETE.
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      }),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('camofox-mcp error:', err && err.stack ? err.stack : err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        }),
      );
    }
  }
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`camofox-mcp listening on http://${HOST}:${PORT}/mcp`);
});
