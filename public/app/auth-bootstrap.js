(() => {
  'use strict';

  const CANONICAL_ORIGIN = 'https://darkweb.zebrabyte.ro';
  const AUTH_CONFIG_URL = 'https://auth.zebrabyte.ro/v1/public/clerk-config';
  const FALLBACK_ACCOUNT_PORTAL = 'https://accounts.zebrabyte.ro';
  const AUTH_ATTEMPT_KEY = 'zbt_darkweb_auth_attempt';
  const AUTH_ATTEMPT_WINDOW_MS = 90_000;

  let configPromise = null;
  let clerkPromise = null;
  let redirecting = false;
  const nativeFetch = window.fetch.bind(window);

  function canonicalAppUrl({ authReturn = false } = {}) {
    const url = new URL('/app/', CANONICAL_ORIGIN);
    if (authReturn) url.searchParams.set('auth_return', '1');
    return url.toString();
  }

  function isCanonicalOrigin() {
    return window.location.origin === CANONICAL_ORIGIN;
  }

  function redirectToCanonical() {
    if (isCanonicalOrigin() || redirecting) return false;
    redirecting = true;
    const target = new URL(window.location.pathname || '/app/', CANONICAL_ORIGIN);
    target.search = window.location.search;
    target.hash = window.location.hash;
    window.location.replace(target.toString());
    return true;
  }

  async function clientConfig() {
    if (configPromise) return configPromise;
    configPromise = (async () => {
      try {
        const response = await nativeFetch(AUTH_CONFIG_URL, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Auth config HTTP ${response.status}`);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object') throw new Error('Invalid auth config');
        return {
          publishableKey: typeof payload.publishableKey === 'string' ? payload.publishableKey : '',
          frontendApiUrl: typeof payload.frontendApiUrl === 'string' ? payload.frontendApiUrl : 'https://clerk.zebrabyte.ro',
          accountPortalOrigin: typeof payload.accountPortalOrigin === 'string' ? payload.accountPortalOrigin : FALLBACK_ACCOUNT_PORTAL,
        };
      } catch (error) {
        console.warn('zebrabyte_auth_config_unavailable', error instanceof Error ? error.message : 'unknown');
        return {
          publishableKey: '',
          frontendApiUrl: 'https://clerk.zebrabyte.ro',
          accountPortalOrigin: FALLBACK_ACCOUNT_PORTAL,
        };
      }
    })();
    return configPromise;
  }

  function loadScript(src, attributes = {}) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => script.src === src);
      if (existing) {
        if (window.Clerk) return resolve(existing);
        existing.addEventListener('load', () => resolve(existing), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
      script.addEventListener('load', () => resolve(script), { once: true });
      script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function clerkClient() {
    if (clerkPromise) return clerkPromise;
    clerkPromise = (async () => {
      const config = await clientConfig();
      if (!config.publishableKey) return null;
      const src = `${config.frontendApiUrl.replace(/\/$/, '')}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`;
      await loadScript(src, { 'data-clerk-publishable-key': config.publishableKey });
      if (!window.Clerk || typeof window.Clerk.load !== 'function') throw new Error('ClerkJS did not initialize');
      await window.Clerk.load();
      return window.Clerk;
    })().catch((error) => {
      console.warn('zebrabyte_clerk_load_failed', error instanceof Error ? error.message : 'unknown');
      return null;
    });
    return clerkPromise;
  }

  async function sessionToken() {
    const clerk = await clerkClient();
    if (!clerk || !clerk.session || typeof clerk.session.getToken !== 'function') return null;
    try {
      const token = await clerk.session.getToken();
      return typeof token === 'string' && token ? token : null;
    } catch {
      return null;
    }
  }

  function recentAuthAttempt() {
    const value = Number(sessionStorage.getItem(AUTH_ATTEMPT_KEY) || '0');
    return Number.isFinite(value) && Date.now() - value < AUTH_ATTEMPT_WINDOW_MS;
  }

  async function signIn({ force = false } = {}) {
    if (redirecting) return;
    if (!isCanonicalOrigin()) {
      redirectToCanonical();
      return;
    }
    if (!force && recentAuthAttempt() && new URL(window.location.href).searchParams.get('auth_return') === '1') {
      showLoginProblem();
      return;
    }
    const config = await clientConfig();
    const portal = (config.accountPortalOrigin || FALLBACK_ACCOUNT_PORTAL).replace(/\/$/, '');
    const target = new URL(`${portal}/sign-in`);
    target.searchParams.set('redirect_url', canonicalAppUrl({ authReturn: true }));
    sessionStorage.setItem(AUTH_ATTEMPT_KEY, String(Date.now()));
    redirecting = true;
    window.location.assign(target.toString());
  }

  function showLoginProblem() {
    const title = document.getElementById('auth-title');
    const message = document.getElementById('auth-message');
    const detail = document.getElementById('auth-detail');
    const gate = document.getElementById('auth-gate');
    const button = document.getElementById('auth-retry');
    if (title) title.textContent = 'Sign-in could not be completed';
    if (message) message.textContent = 'Your ZebraByte account returned to the application, but no valid Clerk session was available.';
    if (detail) detail.textContent = 'Try signing in again. If this persists, verify the Clerk production domain configuration for darkweb.zebrabyte.ro.';
    if (button) button.textContent = 'Sign in again';
    gate?.classList.remove('hidden');
  }

  function clearAuthReturnMarker() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('auth_return')) return;
    url.searchParams.delete('auth_return');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    sessionStorage.removeItem(AUTH_ATTEMPT_KEY);
  }

  async function decorateAccountUi() {
    const actions = document.querySelector('.topbar-actions');
    if (!actions || document.getElementById('zbt-account-link')) return;
    const config = await clientConfig();
    const account = document.createElement('a');
    account.id = 'zbt-account-link';
    account.className = 'identity';
    account.textContent = 'Account';
    account.rel = 'noopener';
    const target = new URL(`${(config.accountPortalOrigin || FALLBACK_ACCOUNT_PORTAL).replace(/\/$/, '')}/user`);
    target.searchParams.set('redirect_url', canonicalAppUrl());
    account.href = target.toString();
    actions.appendChild(account);
  }

  function bindAuthButton() {
    const button = document.getElementById('auth-retry');
    if (!button) return;
    button.textContent = 'Sign in';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      void signIn({ force: true });
    }, true);
  }

  async function handleUnauthorized() {
    if (redirecting) return;
    if (!isCanonicalOrigin()) {
      redirectToCanonical();
      return;
    }
    const current = new URL(window.location.href);
    if (current.searchParams.get('auth_return') === '1' && recentAuthAttempt()) {
      showLoginProblem();
      return;
    }
    await signIn();
  }

  // All application API calls receive a short-lived Clerk session token when a
  // session exists. The Worker still independently verifies signature, issuer,
  // expiry and authorized party; the browser never receives a backend secret.
  window.fetch = async function zebrabyteAuthenticatedFetch(input, init = {}) {
    const requestUrl = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, window.location.href);
    const isApplicationApi = requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api/');
    if (!isApplicationApi) return nativeFetch(input, init);

    const token = await sessionToken();
    const inheritedHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(init.headers || inheritedHeaders || undefined);
    if (token && !headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);

    let response;
    if (input instanceof Request) {
      response = await nativeFetch(new Request(input, { ...init, headers }));
    } else {
      response = await nativeFetch(input, { ...init, headers });
    }

    if (response.status === 401) queueMicrotask(() => { void handleUnauthorized(); });
    if (response.ok && requestUrl.pathname === '/api/me') clearAuthReturnMarker();
    return response;
  };

  // workers.dev is useful for diagnostics, but it cannot share the production
  // ZebraByte browser session. Always enter the customer workspace on its first-
  // party hostname.
  if (window.location.hostname.endsWith('.workers.dev')) {
    redirectToCanonical();
    return;
  }

  bindAuthButton();
  void decorateAccountUi();
  void clerkClient();

  window.ZebraByteAuth = Object.freeze({
    signIn: () => signIn({ force: true }),
    account: async () => {
      const config = await clientConfig();
      const url = new URL(`${(config.accountPortalOrigin || FALLBACK_ACCOUNT_PORTAL).replace(/\/$/, '')}/user`);
      url.searchParams.set('redirect_url', canonicalAppUrl());
      window.location.assign(url.toString());
    },
  });
})();
