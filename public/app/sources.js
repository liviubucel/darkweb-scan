(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  async function api(path) {
    const response = await fetch(path, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
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

  function formatDate(value) {
    if (!value) return 'No completed scan yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function riskClass(value) {
    const risk = String(value || 'none').toLowerCase();
    return ['critical', 'high', 'medium', 'low'].includes(risk) ? risk : 'none';
  }

  function removeInternalSourceControls() {
    document.querySelector('[data-view="sources"]')?.remove();
    document.querySelector('.view[data-view-panel="sources"]')?.remove();
  }

  function rebrandCustomerSurface() {
    document.title = 'Exposure Intelligence — ZebraByte';
    document.querySelectorAll('.brand-copy small').forEach((node) => { node.textContent = 'Exposure Intelligence'; });
    const crumb = document.querySelector('.crumb span:first-child');
    if (crumb) crumb.textContent = 'Exposure Intelligence';

    const overview = document.querySelector('.view[data-view-panel="overview"]');
    if (overview) {
      const eyebrow = overview.querySelector('.eyebrow');
      const title = overview.querySelector('h1');
      const subtitle = overview.querySelector('.page-subtitle');
      if (eyebrow) eyebrow.textContent = 'EXTERNAL EXPOSURE INTELLIGENCE';
      if (title) title.textContent = 'Security exposure overview';
      if (subtitle) subtitle.textContent = 'Monitor breached data, identity exposure and externally observable risk across your approved assets.';
    }

    const posture = document.querySelector('.posture-panel');
    if (posture) {
      const heading = posture.querySelector('h2');
      if (heading) heading.textContent = 'Protection status';
      const terms = posture.querySelectorAll('dt');
      const values = posture.querySelectorAll('dd');
      const labels = ['Exposure monitoring', 'Identity intelligence', 'Evidence verification', 'Romania focus', 'Evidence retention'];
      const statuses = ['Active', 'Active', 'Enabled', 'Active', '90 days'];
      terms.forEach((node, index) => { if (labels[index]) node.textContent = labels[index]; });
      values.forEach((node, index) => { if (statuses[index]) node.textContent = statuses[index]; });
      const message = posture.querySelector('#posture-message');
      if (message) message.textContent = 'ZebraByte continuously evaluates approved assets using private intelligence sources and verified evidence.';
    }
  }

  function createExposureView() {
    const nav = document.querySelector('.nav');
    const monitoring = document.querySelector('[data-view="monitoring"]');
    if (nav && !document.querySelector('[data-view="exposures"]')) {
      const button = document.createElement('button');
      button.className = 'nav-item';
      button.type = 'button';
      button.dataset.view = 'exposures';
      button.innerHTML = '<span class="nav-icon">◇</span><span>Exposures</span>';
      nav.insertBefore(button, monitoring || nav.children[1] || null);
      button.addEventListener('click', () => showExposureView());
    }

    const content = $('content');
    if (!content || document.querySelector('.view[data-view-panel="exposures"]')) return;
    const section = document.createElement('section');
    section.className = 'view';
    section.dataset.viewPanel = 'exposures';
    section.innerHTML = `
      <div class="page-head">
        <div>
          <p class="eyebrow">EXPOSURE INTELLIGENCE</p>
          <h1>Detected exposures</h1>
          <p class="page-subtitle">Verified findings associated with your monitored identities, domains and organizations. Source infrastructure remains private to ZebraByte.</p>
        </div>
        <button class="button primary" type="button" id="exposure-new-scan">Scan an asset</button>
      </div>
      <div class="stats-grid">
        <article class="stat-card"><span>Detected exposures</span><strong id="exposure-total">—</strong><small>Completed findings</small></article>
        <article class="stat-card"><span>High priority</span><strong id="exposure-elevated">—</strong><small>High or critical risk</small></article>
        <article class="stat-card"><span>Scanning now</span><strong id="exposure-scanning">—</strong><small>Queued or active</small></article>
        <article class="stat-card"><span>Last completed scan</span><strong id="exposure-last" style="font-size:16px">—</strong><small>Most recent intelligence check</small></article>
      </div>
      <section class="panel table-panel">
        <div class="panel-head"><div><p class="panel-kicker">FINDINGS</p><h2>Exposure history</h2></div><button class="text-button" id="exposure-refresh" type="button">Refresh</button></div>
        <div id="exposure-list" class="record-list full"><div class="empty">Loading verified findings…</div></div>
      </section>`;
    content.appendChild(section);
    $('exposure-refresh')?.addEventListener('click', () => loadExposures());
    $('exposure-new-scan')?.addEventListener('click', () => {
      document.querySelector('[data-view="new"]')?.click();
    });
  }

  function showExposureView() {
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.dataset.viewPanel === 'exposures'));
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'exposures'));
    if ($('crumb-label')) $('crumb-label').textContent = 'Exposures';
    if (history.replaceState) history.replaceState(null, '', '/app/#exposures');
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadExposures().catch(() => undefined);
  }

  function findingRow(item) {
    const risk = riskClass(item.risk_level);
    const indicators = Number(item.indicator_count || 0);
    const evidence = Number(item.evidence_count || 0);
    const type = item.profile === 'identity' ? 'Identity exposure' : item.profile === 'ransomware' ? 'Ransomware signal' : item.profile === 'corporate' ? 'Corporate exposure' : 'Exposure finding';
    return `<div class="record" data-exposure-id="${escapeHtml(item.id)}" role="button" tabindex="0">
      <div class="record-main">
        <div class="record-title">${escapeHtml(item.asset || 'Monitored asset')}</div>
        <div class="record-meta"><span>${escapeHtml(type)}</span><span>${indicators} indicator${indicators === 1 ? '' : 's'}</span><span>${evidence} verified evidence item${evidence === 1 ? '' : 's'}</span><span>${escapeHtml(formatDate(item.completed_at))}</span></div>
        ${item.summary ? `<div class="muted-small" style="margin-top:8px;max-width:900px">${escapeHtml(String(item.summary).slice(0, 260))}${String(item.summary).length > 260 ? '…' : ''}</div>` : ''}
      </div>
      <div class="record-side"><span class="risk ${escapeHtml(risk)}">${escapeHtml(risk)}</span></div>
    </div>`;
  }

  async function loadExposures() {
    const root = $('exposure-list');
    if (!root) return;
    try {
      const payload = await api('/api/exposures?limit=100&offset=0');
      const stats = payload?.stats || {};
      const items = Array.isArray(payload?.items) ? payload.items : [];
      if ($('exposure-total')) $('exposure-total').textContent = String(Number(stats.exposures || 0));
      if ($('exposure-elevated')) $('exposure-elevated').textContent = String(Number(stats.elevated || 0));
      if ($('exposure-scanning')) $('exposure-scanning').textContent = String(Number(stats.scanning || 0));
      if ($('exposure-last')) $('exposure-last').textContent = formatDate(stats.lastScanAt);
      root.innerHTML = items.length
        ? items.map(findingRow).join('')
        : '<div class="empty">No verified exposure has been detected in completed scans yet.</div>';
      root.querySelectorAll('[data-exposure-id]').forEach((row) => {
        const open = () => {
          const id = row.dataset.exposureId;
          if (!id) return;
          const target = document.querySelector(`[data-investigation-id="${CSS.escape(id)}"]`);
          if (target) target.click();
          else {
            document.querySelector('[data-view="investigations"]')?.click();
            setTimeout(() => document.querySelector(`[data-investigation-id="${CSS.escape(id)}"]`)?.click(), 100);
          }
        };
        row.addEventListener('click', open);
        row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
      });
    } catch (error) {
      root.innerHTML = `<div class="empty">${escapeHtml(error.message || 'Exposure intelligence is unavailable.')}</div>`;
    }
  }

  function boot() {
    removeInternalSourceControls();
    rebrandCustomerSurface();
    createExposureView();
    if (location.hash === '#sources') history.replaceState(null, '', '/app/');
    if (location.hash === '#exposures') showExposureView();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();