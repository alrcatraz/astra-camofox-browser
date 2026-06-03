const PROVIDERS = {
  amazon: {
    provider: 'amazon',
    allowedDomainSuffixes: ['amazon.com'],
    verifyUrl: 'https://www.amazon.com/gp/css/order-history',
    loginUrlPatterns: [
      /\/ap\/signin/i,
      /\/ap\/mfa/i,
      /\/gp\/signin/i,
      /\/errors\/validateCaptcha/i,
    ],
    loginTextPatterns: [
      /sign in/i,
      /email or mobile phone number/i,
      /enter your password/i,
      /authentication required/i,
      /two-step verification/i,
    ],
  },
};

export function authSessionProvider(provider) {
  const key = String(provider || '').toLowerCase();
  return PROVIDERS[key] || null;
}

export function listAuthSessionProviders() {
  return Object.keys(PROVIDERS);
}

export function cookieMatchesSuffix(cookie, suffix) {
  const domain = String(cookie?.domain || '').toLowerCase().replace(/^\./, '');
  const cleanSuffix = String(suffix || '').toLowerCase().replace(/^\./, '');
  return domain === cleanSuffix || domain.endsWith(`.${cleanSuffix}`);
}

export function sanitizeProviderCookies(providerConfig, cookies) {
  if (!Array.isArray(cookies)) {
    throw new Error('cookies must be an array');
  }
  if (cookies.length > 500) {
    throw new Error('Too many cookies. Maximum 500 per request.');
  }

  const allowedFields = ['name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite'];
  const sanitized = [];
  const invalid = [];
  const rejectedDomains = [];

  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i];
    const missing = [];
    if (!c || typeof c !== 'object') {
      invalid.push({ index: i, error: 'cookie must be an object' });
      continue;
    }
    if (typeof c.name !== 'string' || !c.name) missing.push('name');
    if (typeof c.value !== 'string') missing.push('value');
    if (typeof c.domain !== 'string' || !c.domain) missing.push('domain');
    if (missing.length) {
      invalid.push({ index: i, missing });
      continue;
    }
    const allowed = providerConfig.allowedDomainSuffixes.some((suffix) => cookieMatchesSuffix(c, suffix));
    if (!allowed) {
      rejectedDomains.push({ index: i, domain: c.domain });
      continue;
    }
    const clean = {};
    for (const k of allowedFields) {
      if (c[k] !== undefined) clean[k] = c[k];
    }
    if (!clean.path) clean.path = '/';
    sanitized.push(clean);
  }

  if (invalid.length || rejectedDomains.length) {
    const err = new Error('Invalid provider cookies');
    err.invalid = invalid;
    err.rejectedDomains = rejectedDomains;
    throw err;
  }

  return sanitized;
}

export async function verifyAuthSessionPage(page, providerConfig) {
  await page.goto(providerConfig.verifyUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const url = page.url();
  const text = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  const loginWall = providerConfig.loginUrlPatterns.some((pattern) => pattern.test(url)) ||
    providerConfig.loginTextPatterns.some((pattern) => pattern.test(text));
  return {
    provider: providerConfig.provider,
    status: loginWall ? 'needs_reauth' : 'valid',
    authenticated: !loginWall,
    url,
    verifiedAt: new Date().toISOString(),
  };
}
