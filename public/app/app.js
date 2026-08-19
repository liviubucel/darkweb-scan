(() => {
  'use strict';

  const state = {
    me: null,
    investigations: [],
    watchlists: [],
    health: null,
    currentId: null,
    detailTimer: null,
    filter: '',
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value, withTime = true) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  }

  function relativeDate(value) {
    if (!value) return 'Never';
    const delta = Date.now() - Date.parse(value);
    if (!Number.isFinite(delta)) return formatDate(value);
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(value, false);
  }

  function toast(message, type = '') {
    const stack = $('toast-stack');
    if (!stack) return;
    const node = document.createElement('div');
    node.className = `toast ${type}`.trim();
    node.textContent = message;
    stack.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  async function api(path, options = {}) {
    const init = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json', ...(options.headers || {}) },
    };
    if (options.body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    const response = await fetch(path, init);
    let payload = null;
    if (response.status !== 204) {
      const text = await response.text();
      try { payload = text ? JSON.parse(text) : null; }
      catch { payload = { error: text || `HTTP ${response.status}` }; }
    }
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function showAuthGate(message, detail = '') {
    const gate = $('auth-gate');
    $('auth-message').textContent = message;
    $('auth-detail').textContent = detail;
    gate?.classList.remove('hidden');
  }

  function hideAuthGate() {
    $('auth-gate')?.classList.add('hidden');
  }

  function closeMobileNav() {
    $('sidebar')?.classList.remove('open');
    $('mobile-shade')?.classList.remove('show');
  }

  const labels = {
    overview: 'Overview', new: 'New investigation', investigations: 'Investigations',
    detail: 'Investigation', monitoring: 'Monitoring', sources: 'Sources', intelligence: 'Intelligence',
  };

  function showView(name) {
    $$('.view').forEach((view) => view.classList.toggle('active', view.dataset.viewPanel === name));
    $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name || (name === 'detail' && item.dataset.view === 'investigations')));
    $('crumb-label').textContent = labels[name] || name;
    closeMobileNav();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (name !== 'detail' && state.detailTimer) {
      clearTimeout(state.detailTimer);
      state.detailTimer = null;
    }
    if (history.replaceState) history.replaceState(null, '', name === 'overview' ? '/app/' : `/app/#${name}`);
  }

  function statusPill(status) {
    const value = String(status || 'unknown').toLowerCase();
    return `<span class="status-pill ${escapeHtml(value)}">${escapeHtml(value)}</span>`;
  }

  function riskLabel(risk) {
    const value = String(risk || 'none').toLowerCase();
    return `<span class="risk ${escapeHtml(value)}">${escapeHtml(value)}</span>`;
  }

  function investigationRecord(item) {
    const profile = item.profile || 'general';
    const sources = Number(item.source_count || 0);
    return `<div class="record" data-investigation-id="${escapeHtml(item.id)}" role="button" tabindex="0">
      <div class="record-main">
        <div class="record-title">${escapeHtml(item.query || 'Untitled investigation')}</div>
        <div class="record-meta"><span>${escapeHtml(profile)}</span><span>${sources} source${sources === 1 ? '' : 's'}</span><span>${escapeHtml(relativeDate(item.created_at))}</span></div>
      </div>
      <div class="record-side">${riskLabel(item.risk_level)}<div style="margin-top:7px">${statusPill(item.status)}</div></div>
    </div>`;
  }

  function bindInvestigationRows(root) {
    root.querySelectorAll('[data-investigation-id]').forEach((row) => {
      const open = () => openDetail(row.dataset.investigationId);
      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
    });
  }

  function renderUsage() {
    const usage = state.me?.usage;
    const plan = state.me?.plan || 'free';
    if (!usage) return;
    const used = Number(usage.investigations || 0);
    const limit = Math.max(1, Number(usage.limit || 1));
    const percent = Math.min(100, Math.round((used / limit) * 100));
    $('mini-usage-value').textContent = `${used} / ${limit}`;
    $('mini-usage-bar').style.width = `${percent}%`;
    $('mini-plan').textContent = `${plan} plan · ${usage.remaining} remaining`;
    $('new-quota-note').textContent = `${usage.remaining} of ${limit} investigations remaining this month`;
    $('identity-label').textContent = `${plan.toUpperCase()} · ${String(state.me.orgId || '').replace('personal:', 'Personal workspace ')}`;
  }

  function renderStats() {
    const items = state.investigations;
    const running = items.filter((item) => ['queued', 'running'].includes(String(item.status))).length;
    const elevated = items.filter((item) => ['high', 'critical'].includes(String(item.risk_level))).length;
    $('stat-total').textContent = String(items.length);
    $('stat-running').textContent = String(running);
    $('stat-risk').textContent = String(elevated);
    $('stat-watchlists').textContent = String(state.watchlists.length);
    $('stat-total-note').textContent = items.length ? `Latest ${relativeDate(items[0]?.created_at)}` : 'No investigations yet';
  }

  function renderInvestigations() {
    const overview = $('overview-investigations');
    const full = $('investigations-list');
    const query = state.filter.trim().toLowerCase();
    const filtered = query
      ? state.investigations.filter((item) => [item.query, item.profile, item.status, item.risk_level].some((value) => String(value || '').toLowerCase().includes(query)))
      : state.investigations;

    if (!state.investigations.length) {
      overview.innerHTML = '<div class="empty compact">No investigations yet. Start your first defensive search.</div>';
      full.innerHTML = '<div class="empty">No investigations yet. Use “New investigation” to start one.</div>';
    } else {
      overview.innerHTML = state.investigations.slice(0, 5).map(investigationRecord).join('');
      full.innerHTML = filtered.length ? filtered.map(investigationRecord).join('') : '<div class="empty">No investigations match this filter.</div>';
      bindInvestigationRows(overview);
      bindInvestigationRows(full);
    }
    renderStats();
  }

  function watchlistRow(item) {
    return `<div class="watch-row">
      <div class="watch-main"><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.type)} · ${escapeHtml(item.profile)} · every ${Number(item.interval_hours || 0)}h</small></div>
      <div class="watch-actions"><span class="watch-next">Next ${escapeHtml(relativeDate(item.next_run_at))}<br>Last ${escapeHtml(relativeDate(item.last_run_at))}</span><button class="icon-button" type="button" data-delete-watch="${escapeHtml(item.id)}" aria-label="Delete watchlist">×</button></div>
    </div>`;
  }

  function renderWatchlists() {
    const root = $('watchlists-list');
    if (!state.watchlists.length) root.innerHTML = '<div class="empty compact">No monitoring targets configured.</div>';
    else root.innerHTML = state.watchlists.map(watchlistRow).join('');
    root.querySelectorAll('[data-delete-watch]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Delete this monitoring target?')) return;
      button.disabled = true;
      try {
        await api(`/api/watchlists/${encodeURIComponent(button.dataset.deleteWatch)}`, { method: 'DELETE' });
        state.watchlists = state.watchlists.filter((item) => item.id !== button.dataset.deleteWatch);
        renderWatchlists(); renderStats(); toast('Watchlist deleted.', 'success');
      } catch (error) { toast(error.message, 'error'); button.disabled = false; }
    }));
    renderStats();

    const free = state.me?.plan === 'free';
    ['watch-type', 'watch-value', 'watch-interval', 'watch-profile', 'create-watchlist'].forEach((id) => { if ($(id)) $(id).disabled = free; });
    if (free) $('create-watchlist').textContent = 'Paid plan required';
  }

  async function loadHealth() {
    try {
      const health = await api('/api/health');
      state.health = health;
      $('service-dot').className = `service-dot ${health.ok ? 'ok' : 'bad'}`;
      $('health-badge').textContent = health.ready ? 'Operational' : 'Configuration pending';
      $('health-badge').className = `health-badge ${health.ready ? 'ok' : ''}`;
      $('posture-db').textContent = health.configuration?.database ? 'Connected' : 'Unavailable';
      $('posture-ai').textContent = 'Native';
      if ($('posture-index')) {
        const pages = Number(health.configuration?.indexedPages || 0);
        const sources = Number(health.configuration?.discoverySources || 0);
        $('posture-index').textContent = pages > 0 ? `${pages} indexed` : sources > 0 ? 'Seeded' : 'Awaiting seeds';
      }
      const pending = [];
      if (!health.configuration?.authentication) pending.push('authentication');
      if (!health.configuration?.discoveryReady) pending.push('crawler seed sources');
      $('posture-message').textContent = pending.length ? `Production readiness pending: ${pending.join(', ')}.` : 'Production dependencies are configured.';
      return health;
    } catch (error) {
      $('service-dot').className = 'service-dot bad';
      $('health-badge').textContent = 'Unavailable';
      $('health-badge').className = 'health-badge bad';
      $('posture-message').textContent = 'Health endpoint is unavailable.';
      return null;
    }
  }

  async function loadSession() {
    try {
      state.me = await api('/api/me');
      hideAuthGate();
      renderUsage();
      return true;
    } catch (error) {
      const authConfigured = state.health?.configuration?.authentication;
      if (error.status === 401) {
        showAuthGate('Redirecting to ZebraByte sign-in…', 'Authentication is enforced by the Worker API; no anonymous scans are permitted.');
      } else if (error.status === 503 && !authConfigured) {
        showAuthGate('Authentication has not been configured for this deployment yet.', 'Configure the Clerk issuer and JWKS bindings in Cloudflare before enabling customer access.');
      } else {
        showAuthGate('The workspace could not verify your session.', error.message || 'Authentication request failed.');
      }
      $('identity-label').textContent = 'Session required';
      return false;
    }
  }

  async function loadInvestigations() {
    const payload = await api('/api/investigations?limit=50&offset=0');
    state.investigations = Array.isArray(payload?.items) ? payload.items : [];
    renderInvestigations();
  }

  async function loadWatchlists() {
    const payload = await api('/api/watchlists');
    state.watchlists = Array.isArray(payload?.items) ? payload.items : [];
    renderWatchlists();
  }

  async function refreshWorkspace({ silent = false } = {}) {
    try {
      await Promise.all([loadInvestigations(), loadWatchlists()]);
      if (!silent) toast('Workspace refreshed.', 'success');
    } catch (error) {
      if (error.status === 401) showAuthGate('Your session has expired.', 'Redirecting to ZebraByte sign-in…');
      else if (!silent) toast(error.message, 'error');
    }
  }

  async function openDetail(id) {
    if (!id) return;
    state.currentId = id;
    showView('detail');
    $('detail-query').textContent = 'Loading investigation…';
    $('detail-summary').textContent = 'Loading evidence and analysis…';
    try {
      const [detail, sourcesPayload, artifactsPayload] = await Promise.all([
        api(`/api/investigations/${encodeURIComponent(id)}`),
        api(`/api/investigations/${encodeURIComponent(id)}/sources`),
        api(`/api/investigations/${encodeURIComponent(id)}/artifacts`),
      ]);
      const sources = Array.isArray(sourcesPayload?.items) ? sourcesPayload.items : [];
      const artifacts = Array.isArray(artifactsPayload?.items) ? artifactsPayload.items : [];
      renderDetail(detail, sources, artifacts);
      if (['queued', 'running'].includes(String(detail?.status))) {
        state.detailTimer = setTimeout(() => openDetail(id), 4500);
      }
    } catch (error) {
      $('detail-summary').textContent = error.message;
      toast(error.message, 'error');
    }
  }

  function renderDetail(detail, sources, artifacts) {
    const status = String(detail?.status || 'unknown');
    $('detail-query').textContent = detail?.query || 'Untitled investigation';
    $('detail-status').textContent = status;
    $('detail-status').className = `status-pill ${status}`;
    $('detail-profile').textContent = detail?.profile || 'general';
    $('detail-created').textContent = formatDate(detail?.created_at);
    $('detail-risk').textContent = detail?.risk_level || (['queued', 'running'].includes(status) ? 'Pending' : 'None');
    $('detail-source-count').textContent = String(detail?.source_count ?? sources.length);
    $('detail-artifact-count').textContent = String(artifacts.length);
    $('detail-origin').textContent = detail?.origin || 'manual';
    $('detail-summary').textContent = detail?.summary || (status === 'failed' ? detail?.error_message || 'Investigation failed.' : status === 'completed' ? 'No grounded summary was produced.' : 'Investigation is running. Evidence and the grounded assessment will appear here when the workflow completes.');
    $('source-count-label').textContent = String(sources.length);
    $('artifact-count-label').textContent = String(artifacts.length);

    $('delete-investigation').disabled = ['queued', 'running'].includes(status);

    $('detail-sources').innerHTML = sources.length ? sources.map((source) => `<div class="evidence-row">
      <div class="evidence-title">${escapeHtml(source.title || `Source ${source.ordinal || ''}`)}</div>
      <div class="evidence-url">${escapeHtml(source.onion_url || 'Source URL withheld')}</div>
      <div class="evidence-foot"><span>SHA-256 ${escapeHtml(String(source.content_sha256 || '').slice(0, 16))}…</span><span>${escapeHtml(formatDate(source.fetched_at))}</span></div>
    </div>`).join('') : '<div class="empty compact">No sources retained yet.</div>';

    $('detail-artifacts').innerHTML = artifacts.length ? artifacts.map((artifact) => `<div class="artifact-row"><span class="artifact-type">${escapeHtml(artifact.type)}</span><span class="artifact-value">${escapeHtml(artifact.value)}</span></div>`).join('') : '<div class="empty compact">No indicators extracted yet.</div>';
  }

  async function startInvestigation(event) {
    event.preventDefault();
    const button = $('start-investigation');
    const query = $('investigation-query').value.trim();
    const profile = $('investigation-profile').value;
    if (!query) return;
    button.disabled = true;
    button.textContent = 'Starting…';
    try {
      const result = await api('/api/investigations', { method: 'POST', body: { query, profile } });
      toast('Investigation queued.', 'success');
      $('investigation-query').value = '';
      await loadSession().catch(() => undefined);
      await loadInvestigations().catch(() => undefined);
      openDetail(result.id);
    } catch (error) {
      if (error.status === 401) showAuthGate('Your session has expired.', 'Redirecting to ZebraByte sign-in…');
      else toast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Start investigation';
    }
  }

  async function createWatchlist(event) {
    event.preventDefault();
    const button = $('create-watchlist');
    button.disabled = true;
    const body = {
      type: $('watch-type').value,
      value: $('watch-value').value.trim(),
      intervalHours: Number($('watch-interval').value),
      profile: $('watch-profile').value,
    };
    try {
      await api('/api/watchlists', { method: 'POST', body });
      $('watch-value').value = '';
      await loadWatchlists();
      await loadInvestigations().catch(() => undefined);
      toast('Monitoring target created. Initial investigation queued.', 'success');
    } catch (error) { toast(error.message, 'error'); }
    finally { button.disabled = state.me?.plan === 'free'; }
  }

  async function askIntelligence(event) {
    event.preventDefault();
    const question = $('intelligence-query').value.trim();
    if (!question) return;
    const button = $('ask-intelligence');
    const root = $('intelligence-answer');
    button.disabled = true;
    button.textContent = 'Searching evidence…';
    root.innerHTML = '<div class="answer-empty"><span>✦</span><p>Searching indexed investigations and generating a grounded answer…</p></div>';
    try {
      const result = await api('/api/intelligence/ask', { method: 'POST', body: { query: question } });
      root.innerHTML = `<div class="answer-meta">${Number(result.contextCount || 0)} indexed context chunk${Number(result.contextCount || 0) === 1 ? '' : 's'} used</div><div class="answer-content">${escapeHtml(result.answer || 'No answer returned.')}</div>`;
    } catch (error) {
      root.innerHTML = `<div class="answer-empty"><span>!</span><p>${escapeHtml(error.message)}</p></div>`;
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Ask Intelligence';
    }
  }

  function updateWatchDefaults() {
    const type = $('watch-type').value;
    const placeholder = { domain: 'example.com', email: 'security@example.com', brand: 'ZebraByte', person: 'Approved person name', keyword: 'Approved threat keyword' }[type];
    $('watch-value').placeholder = placeholder;
    $('watch-profile').value = ['email', 'person'].includes(type) ? 'identity' : ['domain', 'brand'].includes(type) ? 'corporate' : 'general';
  }

  function bindEvents() {
    $$('.nav-item').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
    $$('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
    $('investigation-form').addEventListener('submit', startInvestigation);
    $('watchlist-form').addEventListener('submit', createWatchlist);
    $('intelligence-form').addEventListener('submit', askIntelligence);
    $('watch-type').addEventListener('change', updateWatchDefaults);
    $('refresh-investigations').addEventListener('click', () => loadInvestigations().then(() => toast('Investigations refreshed.', 'success')).catch((error) => toast(error.message, 'error')));
    $('refresh-watchlists').addEventListener('click', () => loadWatchlists().then(() => toast('Watchlists refreshed.', 'success')).catch((error) => toast(error.message, 'error')));
    $('investigation-filter').addEventListener('input', (event) => { state.filter = event.target.value; renderInvestigations(); });
    $('detail-back').addEventListener('click', () => showView('investigations'));
    $('delete-investigation').addEventListener('click', async () => {
      if (!state.currentId || !confirm('Delete this completed investigation and retained evidence?')) return;
      const button = $('delete-investigation'); button.disabled = true;
      try {
        await api(`/api/investigations/${encodeURIComponent(state.currentId)}`, { method: 'DELETE' });
        state.investigations = state.investigations.filter((item) => item.id !== state.currentId);
        state.currentId = null; renderInvestigations(); showView('investigations'); toast('Investigation and retained evidence deleted.', 'success');
      } catch (error) { toast(error.message, 'error'); button.disabled = false; }
    });
    $('auth-retry').addEventListener('click', async () => {
      if (window.ZebraByteAuth?.signIn) {
        await window.ZebraByteAuth.signIn();
        return;
      }
      $('auth-retry').disabled = true;
      $('auth-retry').textContent = 'Checking…';
      await loadHealth();
      const ok = await loadSession();
      if (ok) await refreshWorkspace({ silent: true });
      $('auth-retry').disabled = false;
      $('auth-retry').textContent = 'Sign in';
    });
    $('mobile-menu').addEventListener('click', () => { $('sidebar').classList.add('open'); $('mobile-shade').classList.add('show'); });
    $('mobile-close').addEventListener('click', closeMobileNav);
    $('mobile-shade').addEventListener('click', closeMobileNav);
  }

  async function boot() {
    bindEvents();
    updateWatchDefaults();
    const hashView = location.hash.replace('#', '');
    if (['overview', 'new', 'investigations', 'monitoring', 'sources', 'intelligence'].includes(hashView)) showView(hashView);
    await loadHealth();
    const authenticated = await loadSession();
    if (!authenticated) return;
    try {
      await refreshWorkspace({ silent: true });
    } catch (error) { toast(error.message, 'error'); }
    setInterval(() => {
      if (!document.hidden && state.me) refreshWorkspace({ silent: true }).catch(() => undefined);
    }, 30000);
  }

  boot().catch((error) => {
    console.error('workspace_boot_failed', error);
    showAuthGate('The workspace could not start.', 'Refresh the page or check the Cloudflare deployment logs.');
  });
})();
