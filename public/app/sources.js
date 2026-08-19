(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  async function api(path, options = {}) {
    const response = await fetch(path, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json', ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const text = response.status === 204 ? '' : await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { error: text }; }
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function message(text, isError = false) {
    const node = $('discovery-message');
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? '#d98e8e' : '';
  }

  function formatDate(value) {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function renderStatus(status) {
    if (!status) return;
    if ($('discovery-source-count')) $('discovery-source-count').textContent = String(status.enabledSources ?? 0);
    if ($('discovery-page-count')) $('discovery-page-count').textContent = String(status.indexedPages ?? 0);
    if ($('discovery-ro-count')) $('discovery-ro-count').textContent = String(status.romanianPages ?? 0);
    if ($('discovery-budget-count')) $('discovery-budget-count').textContent = `${Number(status.todayFetched ?? 0)} / ${Number(status.dailyBudget ?? 0)}`;
  }

  function sourceRow(item) {
    const sourceType = item.source_type === 'seed' ? 'seed' : `discovered · depth ${Number(item.depth || 0)}`;
    const status = item.enabled === 1 ? 'enabled' : 'disabled';
    const label = item.label ? `<strong>${escapeHtml(item.label)}</strong>` : '<strong>Unlabelled onion source</strong>';
    return `<div class="watch-row">
      <div class="watch-main">${label}<small>${escapeHtml(sourceType)} · ${escapeHtml(item.category || 'research')} · priority ${Number(item.priority || 0)} · RO score ${Number(item.romania_score || 0)}</small><div class="evidence-url">${escapeHtml(item.onion_url || '')}</div></div>
      <div class="watch-actions"><span class="watch-next">${escapeHtml(status)}<br>Last ${escapeHtml(formatDate(item.last_crawled_at))}</span>${item.enabled === 1 ? `<button class="icon-button" type="button" data-disable-source="${escapeHtml(item.id)}" aria-label="Disable source">×</button>` : ''}</div>
    </div>`;
  }

  async function loadStatus() {
    try {
      const health = await api('/api/health');
      const config = health?.configuration || {};
      if ($('posture-index')) $('posture-index').textContent = config.discoveryReady ? `${Number(config.indexedPages || 0)} pages` : 'Seed catalog empty';
      if ($('posture-message')) {
        const pending = [];
        if (!config.authentication) pending.push('authentication');
        if (!config.discoveryReady) pending.push('at least one approved onion seed');
        $('posture-message').textContent = pending.length ? `Production readiness pending: ${pending.join(', ')}.` : `In-house discovery active · ${Number(config.discoverySources || 0)} sources · RO focus.`;
      }
      return health;
    } catch {
      return null;
    }
  }

  async function loadSources() {
    const list = $('discovery-list');
    if (!list) return;
    try {
      const [status, payload] = await Promise.all([
        api('/api/discovery/status'),
        api('/api/discovery/sources?limit=100&offset=0'),
      ]);
      renderStatus(status);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      list.innerHTML = items.length ? items.map(sourceRow).join('') : '<div class="empty compact">No seed sources yet. Add approved public v3 onion pages to start the private crawler.</div>';
      list.querySelectorAll('[data-disable-source]').forEach((button) => button.addEventListener('click', async () => {
        if (!confirm('Disable this source and stop future crawling?')) return;
        button.disabled = true;
        try {
          await api(`/api/discovery/sources/${encodeURIComponent(button.dataset.disableSource)}`, { method: 'DELETE' });
          await loadSources();
          await loadStatus();
        } catch (error) {
          message(error.message, true);
          button.disabled = false;
        }
      }));
    } catch (error) {
      if (error.status === 401) list.innerHTML = '<div class="empty compact">Sign in with a ZebraByte administrator session to manage discovery sources.</div>';
      else if (error.status === 403) list.innerHTML = '<div class="empty compact">Organization administrator access is required to manage the global source catalog.</div>';
      else list.innerHTML = `<div class="empty compact">${escapeHtml(error.message)}</div>`;
    }
  }

  async function addSources(event) {
    event.preventDefault();
    const raw = $('discovery-urls')?.value || '';
    const urls = [...new Set(raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
    if (!urls.length) { message('Enter at least one v3 onion URL.', true); return; }
    if (urls.length > 50) { message('Add a maximum of 50 sources per request.', true); return; }
    const button = $('discovery-add');
    button.disabled = true;
    button.textContent = 'Adding…';
    try {
      const category = $('discovery-category').value;
      const priority = Number($('discovery-priority').value);
      const result = await api('/api/discovery/sources', {
        method: 'POST',
        body: { items: urls.map((url) => ({ url, category, priority })) },
      });
      $('discovery-urls').value = '';
      message(`${Number(result.added || 0)} source(s) added, ${Number(result.existing || 0)} already known; ${Number(result.queued || 0)} crawl job(s) queued.`);
      await loadSources();
      await loadStatus();
    } catch (error) {
      message(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Add sources';
    }
  }

  async function runSeeds() {
    const button = $('discovery-run');
    button.disabled = true;
    button.textContent = 'Queueing…';
    try {
      const result = await api('/api/discovery/crawl', { method: 'POST' });
      message(`${Number(result.queued || 0)} priority seed crawl job(s) queued.`);
      await loadSources();
    } catch (error) {
      message(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Refresh seeds now';
    }
  }

  function bind() {
    $('discovery-form')?.addEventListener('submit', addSources);
    $('discovery-refresh')?.addEventListener('click', loadSources);
    $('discovery-run')?.addEventListener('click', runSeeds);
    document.querySelector('[data-view="sources"]')?.addEventListener('click', () => loadSources());
  }

  async function boot() {
    bind();
    await loadStatus();
    setTimeout(() => loadStatus().catch(() => undefined), 900);
    if (location.hash === '#sources') {
      document.querySelector('[data-view="sources"]')?.click();
      await loadSources();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot().catch(() => undefined));
  else boot().catch(() => undefined);
})();
