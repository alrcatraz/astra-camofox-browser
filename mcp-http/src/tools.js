/**
 * MCP tool map for the Camofox browser-automation wrapper.
 *
 * 26 tools covering the Camofox REST ability (tab/session, navigation,
 * content, and interaction). Each tool forwards to the Camofox upstream and
 * returns the upstream JSON to the model as text. On non-2xx the tool returns
 * an error result carrying the HTTP status.
 *
 * userId is required everywhere and defaults to `CAMOFOX_USER_ID` / 'dsh' when
 * omitted by the model.
 */
import { z } from 'zod';
import { camofoxRequest, defaultUserId, defaultSessionKey } from './camofox.js';

/** A primitive content block for a tool result. */
function textContent(text) {
  return { type: 'text', text };
}

/** Wrap a handler so Camofox errors surface as non-fatal MCP error results. */
function guarded(handler) {
  return async (args) => {
    try {
      const result = await handler(args);
      return { content: [textContent(JSON.stringify(result))] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: String(err.message || err) }],
        isError: true,
      };
    }
  };
}

/** Common userId coercion shared by tools. */
const uid = (args) => args.userId || defaultUserId();

/**
 * Register the 26 Camofox tools on the given MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerCamofoxTools(server) {
  /* ------------------------------ tab / session ------------------------------ */

  server.registerTool(
    'browser_open',
    {
      description:
        'Open a new browser tab in Camofox. Returns {tabId, url}. Pass sessionKey to open a specific session (defaults to CAMOFOX_USER_ID).',
      inputSchema: {
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        sessionKey: z.string().optional().describe('Session identifier (defaults to userId).'),
        url: z.string().optional().describe('Initial URL to load, if any.'),
      },
    },
    guarded(async (args) => {
      const body = {
        userId: uid(args),
        sessionKey: args.sessionKey || defaultSessionKey(),
      };
      if (args.url !== undefined) body.url = args.url;
      return camofoxRequest('POST', '/tabs', { body });
    }),
  );

  server.registerTool(
    'browser_list_tabs',
    {
      description: 'List open tabs for a session. Returns {running, tabs[]}.',
      inputSchema: {
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) => camofoxRequest('GET', '/tabs', { query: { userId: uid(args) } })),
  );

  server.registerTool(
    'browser_close_tab',
    {
      description: 'Close an open tab by id.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab to close.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('DELETE', `/tabs/${encodeURIComponent(args.tabId)}`, {
        query: { userId: uid(args) },
      }),
    ),
  );

  server.registerTool(
    'browser_clear_session',
    {
      description: 'Clear (destroy) a browser session by userId. Returns upstream confirmation.',
      inputSchema: {
        userId: z.string().optional().describe('Session owner to clear (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('DELETE', `/sessions/${encodeURIComponent(uid(args))}`),
    ),
  );

  server.registerTool(
    'browser_set_cookies',
    {
      description: 'Set cookies on a session. Accepts an array of cookie objects.',
      inputSchema: {
        userId: z.string().optional().describe('Session owner (default CAMOFOX_USER_ID).'),
        cookies: z.array(z.record(z.string(), z.unknown())).describe('Cookies to set.'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/sessions/${encodeURIComponent(uid(args))}/cookies`, {
        body: { cookies: args.cookies },
      }),
    ),
  );

  server.registerTool(
    'browser_recycle_group',
    {
      description: 'Recycle (delete) a tab group by its list-item id.',
      inputSchema: {
        listItemId: z.string().describe('List-item id identifying the group to recycle.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('DELETE', `/tabs/group/${encodeURIComponent(args.listItemId)}`, {
        query: { userId: uid(args) },
      }),
    ),
  );

  /* ------------------------------- navigation ------------------------------- */

  server.registerTool(
    'browser_navigate',
    {
      description:
        'Navigate a tab to a URL or run a navigation macro. Pass url or macro; userId optional.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab to navigate.'),
        url: z.string().optional().describe('URL to load.'),
        macro: z.string().optional().describe('Navigation macro name to run.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) => {
      const body = { userId: uid(args) };
      if (args.url !== undefined) body.url = args.url;
      if (args.macro !== undefined) body.macro = args.macro;
      return camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/navigate`, { body });
    }),
  );

  server.registerTool(
    'browser_back',
    {
      description: 'Navigate a tab one step back in history.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/back`, {
        body: { userId: uid(args) },
      }),
    ),
  );

  server.registerTool(
    'browser_forward',
    {
      description: 'Navigate a tab one step forward in history.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/forward`, {
        body: { userId: uid(args) },
      }),
    ),
  );

  server.registerTool(
    'browser_refresh',
    {
      description: 'Refresh the current page in a tab.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/refresh`, {
        body: { userId: uid(args) },
      }),
    ),
  );

  /* -------------------------------- content --------------------------------- */

  server.registerTool(
    'browser_snapshot',
    {
      description:
        'Return the accessibility snapshot of the current page in a tab. The snapshot is pre-rendered, so there is no snapshot() action here.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('GET', `/tabs/${encodeURIComponent(args.tabId)}/snapshot`, {
        query: { userId: uid(args) },
      }),
    ),
  );

  server.registerTool(
    'browser_links',
    {
      description: 'List the links on the current page of a tab.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        limit: z.number().optional().describe('Maximum number of links to return.'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('GET', `/tabs/${encodeURIComponent(args.tabId)}/links`, {
        query: { userId: uid(args), limit: args.limit },
      }),
    ),
  );

  server.registerTool(
    'browser_images',
    {
      description: 'List the images on the current page of a tab.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('GET', `/tabs/${encodeURIComponent(args.tabId)}/images`, {
        query: { userId: uid(args) },
      }),
    ),
  );

  server.registerTool(
    'browser_get_downloads',
    {
      description: 'List the downloads available in a tab.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('GET', `/tabs/${encodeURIComponent(args.tabId)}/downloads`, {
        query: { userId: uid(args) },
      }),
    ),
  );

  server.registerTool(
    'browser_screenshot',
    {
      description: 'Capture a screenshot of a tab. Returns image data per the upstream response.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('GET', `/tabs/${encodeURIComponent(args.tabId)}/screenshot`, {
        query: { userId: uid(args) },
      }),
    ),
  );

  server.registerTool(
    'browser_extract',
    {
      description: 'Extract structured data from a tab according to a provided JSON schema.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        schema: z
          .record(z.string(), z.unknown())
          .describe('JSON schema describing the data to extract.'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/extract`, {
        body: { userId: uid(args), schema: args.schema },
      }),
    ),
  );

  server.registerTool(
    'browser_evaluate',
    {
      description: 'Evaluate a JavaScript expression in a tab and return the result.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        expression: z.string().describe('JavaScript expression to evaluate.'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/evaluate`, {
        body: { userId: uid(args), expression: args.expression },
      }),
    ),
  );

  /* ------------------------------ interaction ------------------------------- */

  server.registerTool(
    'browser_click',
    {
      description: 'Click an element in a tab by ref (from snapshot) or CSS selector.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        ref: z.string().optional().describe('Snapshot element ref (e.g. e1) to click.'),
        selector: z.string().optional().describe('CSS selector to click.'),
      },
    },
    guarded(async (args) => {
      const body = { userId: uid(args) };
      if (args.ref !== undefined) body.ref = args.ref;
      if (args.selector !== undefined) body.selector = args.selector;
      return camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/click`, { body });
    }),
  );

  server.registerTool(
    'browser_type',
    {
      description:
        'Type text into an element in a tab identified by ref or selector. Optionally press Enter after.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        ref: z.string().optional().describe('Snapshot element ref to type into.'),
        selector: z.string().optional().describe('CSS selector of the input element.'),
        text: z.string().describe('Text to type.'),
        pressEnter: z.boolean().optional().describe('Press Enter after typing.'),
      },
    },
    guarded(async (args) => {
      const body = { userId: uid(args), text: args.text };
      if (args.ref !== undefined) body.ref = args.ref;
      if (args.selector !== undefined) body.selector = args.selector;
      if (args.pressEnter !== undefined) body.pressEnter = args.pressEnter;
      return camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/type`, { body });
    }),
  );

  server.registerTool(
    'browser_press',
    {
      description: 'Press a key in a tab (e.g. Enter, Escape, ArrowDown).',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        key: z.string().describe('Key to press.'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/press`, {
        body: { userId: uid(args), key: args.key },
      }),
    ),
  );

  server.registerTool(
    'browser_scroll',
    {
      description: 'Scroll a tab by a direction and amount.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        direction: z.string().describe('Scroll direction, e.g. up, down, left, right.'),
        amount: z.number().describe('Number of scroll steps/ticks.'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/scroll`, {
        body: { userId: uid(args), direction: args.direction, amount: args.amount },
      }),
    ),
  );

  server.registerTool(
    'browser_upload',
    {
      description: 'Upload a local file into a file-input element identified by ref or selector.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        ref: z.string().optional().describe('Snapshot element ref to upload into.'),
        selector: z.string().optional().describe('CSS selector of the file input.'),
        path: z.string().describe('Local filesystem path of the file to upload.'),
      },
    },
    guarded(async (args) => {
      const body = { userId: uid(args), path: args.path };
      if (args.ref !== undefined) body.ref = args.ref;
      if (args.selector !== undefined) body.selector = args.selector;
      return camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/upload`, { body });
    }),
  );

  server.registerTool(
    'browser_set_viewport',
    {
      description: 'Set the viewport size of a tab.',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        width: z.number().describe('Viewport width in pixels.'),
        height: z.number().describe('Viewport height in pixels.'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/viewport`, {
        body: { userId: uid(args), width: args.width, height: args.height },
      }),
    ),
  );

  server.registerTool(
    'browser_wait',
    {
      description: 'Wait for a condition in a tab (e.g. a selector or network idle).',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
        conditions: z
          .array(z.record(z.string(), z.unknown()))
          .describe('List of wait conditions, e.g. [{type: "selector", value: "#el"}].'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('POST', `/tabs/${encodeURIComponent(args.tabId)}/wait`, {
        body: { userId: uid(args), conditions: args.conditions },
      }),
    ),
  );

  server.registerTool(
    'browser_stats',
    {
      description: 'Return runtime stats for a tab (metrics, resource usage).',
      inputSchema: {
        tabId: z.string().describe('Id of the tab.'),
        userId: z.string().optional().describe('Owner of the tab session (default CAMOFOX_USER_ID).'),
      },
    },
    guarded(async (args) =>
      camofoxRequest('GET', `/tabs/${encodeURIComponent(args.tabId)}/stats`, {
        query: { userId: uid(args) },
      }),
    ),
  );
}
