function decodeProxyCredential(value) {
  if (!value) return value;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizePlaywrightProxy(proxy) {
  if (!proxy) return proxy;

  return {
    ...proxy,
    username: decodeProxyCredential(proxy.username),
    password: decodeProxyCredential(proxy.password),
  };
}

/**
 * Create a proxy pool that round-robins across multiple ports.
 * Returns null if no proxy is configured.
 *
 * @param {{ host: string, ports: number[], username: string, password: string }} config
 * @returns {{ size: number, getLaunchProxy: () => object, getNext: () => object } | null}
 */
export function createProxyPool(config) {
  const { host, ports, username, password } = config;
  if (!host || !ports || ports.length === 0) return null;

  let index = 0;

  function makeProxy(port) {
    return {
      server: `http://${host}:${port}`,
      username,
      password,
    };
  }

  return {
    size: ports.length,

    /** Proxy for browser launch (first port). Used for geoip fingerprinting. */
    getLaunchProxy() {
      return makeProxy(ports[0]);
    },

    /** Next proxy in round-robin rotation. Used per browser context. */
    getNext() {
      const port = ports[index % ports.length];
      index++;
      return makeProxy(port);
    },
  };
}
