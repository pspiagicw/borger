(function () {
  loadDashboard();

  async function loadDashboard(forceRefresh) {
    const root = document.getElementById('dashboard-root');
    if (!root) return;

    const query = forceRefresh ? '?refresh=1' : '';

    try {
      const response = await fetch('/api/dashboard' + query, { cache: 'no-store' });
      if (!response.ok) throw new Error('dashboard request failed with status ' + response.status);
      const viewModel = await response.json();
      root.outerHTML = renderDashboard(viewModel);
    } catch (error) {
      root.innerHTML =
        '<p class="text-xs uppercase tracking-[0.22em] text-cyan-300/90">Borgmatic Backup Dashboard</p>' +
        '<h1 class="mt-4 text-2xl font-semibold text-rose-200">Failed to load dashboard</h1>' +
        '<p class="mt-2 text-sm text-rose-100">' + escapeHtml(error.message || String(error)) + '</p>' +
        '<button onclick="location.reload()" class="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20">Retry</button>';
    }
  }

  // --- top-level render ---------------------------------------------------

  function renderDashboard(vm) {
    const hero = vm.latest
      ? `<h1 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">Latest backup</h1>
         <p class="mt-3 text-xl text-cyan-200">${escapeHtml(vm.latest.timestamp)}</p>
         <p class="mt-2 text-lg text-slate-300">${escapeHtml(vm.latest.ago)} on <span class="font-medium text-cyan-300">${escapeHtml(vm.latest.repository)}</span></p>`
      : `<h1 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">No backup data yet</h1>
         <p class="mt-2 text-slate-300">Collector is running — data will appear once borgmatic responds.</p>`;

    const errorBlock = vm.error
      ? `<section class="mb-8 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-rose-100">
           <h2 class="text-lg font-semibold">Failed to load backups</h2>
           <p class="mt-2 break-all text-sm">${escapeHtml(vm.error)}</p>
         </section>`
      : '';

    const repositories = Array.isArray(vm.repositories) && vm.repositories.length
      ? vm.repositories.map(renderRepositoryCard).join('')
      : '<p class="text-slate-300">No repositories found yet.</p>';

    return `<section id="dashboard-root">
      <header class="mb-8 rounded-3xl border border-slate-800 bg-slate-900/75 p-8 shadow-2xl shadow-cyan-900/20 backdrop-blur">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs uppercase tracking-[0.22em] text-cyan-300/90">Borgmatic Backup Dashboard</p>
          <button type="button" data-manual-refresh class="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60">Refresh Now</button>
        </div>
        ${hero}
        ${renderCollectorMeta(vm.collector)}
        ${renderHealthSummary(vm.healthSummary)}
        <p class="mt-5 text-sm text-slate-400">Generated at ${escapeHtml(vm.generatedAt || '')}</p>
      </header>
      ${errorBlock}
      <section class="grid gap-6 md:grid-cols-2">${repositories}</section>
    </section>`;
  }

  // --- collector meta panel -----------------------------------------------

  function renderCollectorMeta(c) {
    if (!c) return '';

    let cls = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    let label = 'Collector up to date';

    if (c.running) {
      cls = 'border-amber-500/40 bg-amber-500/10 text-amber-200';
      label = 'Collecting now…';
    } else if (c.lastError) {
      cls = 'border-rose-500/40 bg-rose-500/10 text-rose-200';
      label = 'Last collection failed';
    } else if (!c.lastRunAt) {
      cls = 'border-slate-500/40 bg-slate-500/10 text-slate-300';
      label = 'Waiting for first collection';
    }

    const errorLine = c.lastError
      ? `<p class="mt-1 break-all text-xs text-rose-200">Error: ${escapeHtml(c.lastError)}</p>`
      : '';

    const whenLine = c.lastRunAt
      ? `<p class="mt-1 text-xs">Last run ${escapeHtml(c.lastRunAgo || '')} (${escapeHtml(c.lastRunAt)}) — ${escapeHtml(String(c.lastDurationMs || 0))} ms</p>`
      : '';

    return `<div class="mt-4 rounded-xl border ${cls} p-3">
      <p class="text-sm font-semibold">${label}</p>
      ${whenLine}
      <p class="mt-1 text-xs">Runs every ${escapeHtml(String(Math.floor((c.intervalSeconds || 600) / 60)))} min</p>
      ${errorLine}
    </div>`;
  }

  // --- health summary chips -----------------------------------------------

  function renderHealthSummary(summary) {
    if (!summary) return '';
    return `<div class="mt-4 flex flex-wrap gap-2">
      ${healthChip('Healthy', summary.healthy || 0, 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200')}
      ${healthChip('Warning', summary.warning || 0, 'border-amber-500/40 bg-amber-500/10 text-amber-200')}
      ${healthChip('Critical', summary.critical || 0, 'border-rose-500/40 bg-rose-500/10 text-rose-200')}
      ${healthChip('No Data', summary.noData || 0, 'border-slate-500/40 bg-slate-500/10 text-slate-200')}
    </div>`;
  }

  function healthChip(label, value, classes) {
    return `<span class="rounded-full border px-3 py-1 text-xs font-semibold ${classes}">${escapeHtml(label)}: ${escapeHtml(String(value))}</span>`;
  }

  // --- repository card ----------------------------------------------------

  function renderRepositoryCard(repo) {
    const latestLine = repo.latest
      ? `<p class="mt-4 text-sm text-slate-300">Latest: <span class="text-cyan-300">${escapeHtml(repo.latest)}</span> (${escapeHtml(repo.latestAgo)})</p>`
      : '<p class="mt-4 text-sm text-slate-400">No archives yet.</p>';

    return `<article class="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/50">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-xl font-semibold text-white">${escapeHtml(repo.name)}</h2>
        <span class="rounded-full border px-2.5 py-1 text-xs font-semibold ${healthBadgeClass(repo.healthStatus)}">${escapeHtml(repo.healthLabel || 'Unknown')}</span>
      </div>
      <p class="mt-1 text-xs text-slate-400">${escapeHtml(repo.healthReason || '')}</p>

      ${renderBackupCounts(repo.backupCounts)}

      <div class="mt-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3">
        <p class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Repository URL</p>
        <p id="${escapeHtml(repo.id)}-masked" class="mt-2 truncate font-mono text-sm text-slate-300">${escapeHtml(repo.locationMasked)}</p>
        <p id="${escapeHtml(repo.id)}-full" class="mt-2 hidden break-all font-mono text-sm text-cyan-200">${escapeHtml(repo.locationFull)}</p>
        <button
          type="button"
          data-toggle-location="${escapeHtml(repo.id)}"
          class="mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          aria-expanded="false"
        >Show URL</button>
      </div>

      ${latestLine}
      ${renderDotTimeline(repo.timeline)}
      ${renderSizePanel(repo.size)}
      ${renderRetentionInsights(repo.retention)}
    </article>`;
  }

  // --- backup counts ------------------------------------------------------

  function renderBackupCounts(counts) {
    if (!counts) return '';
    return `<div class="mt-3 grid grid-cols-3 gap-2">
      ${countStat(counts.today, 'Today')}
      ${countStat(counts.thisWeek, 'This week')}
      ${countStat(counts.thisMonth, 'This month')}
    </div>`;
  }

  function countStat(value, label) {
    const color = value === 0 ? 'text-rose-300' : 'text-white';
    return `<div class="rounded-lg border border-slate-700 bg-slate-950/50 px-2 py-2 text-center">
      <p class="text-xl font-bold ${color}">${escapeHtml(String(value))}</p>
      <p class="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">${escapeHtml(label)}</p>
    </div>`;
  }

  // --- dot timeline -------------------------------------------------------

  function renderDotTimeline(timeline) {
    if (!timeline) return '';

    const { startMs, endMs, windowDays, points } = timeline;
    const rangeMs = endMs - startMs;
    const W = 400;
    const CY = 16;        // vertical center of tick area
    const TICK_H = 14;    // tick height
    const LABEL_Y = 38;   // month label y
    const SVG_H = 44;     // total SVG height
    const PAD = 6;        // left/right padding to avoid clipping edge dots

    const ticks = (points || []).map((p) => {
      const frac = (p.ms - startMs) / rangeMs;
      const x = (PAD + frac * (W - 2 * PAD)).toFixed(1);
      return `<rect x="${x}" y="${(CY - TICK_H / 2).toFixed(1)}" width="2" height="${TICK_H}" rx="1" fill="#22d3ee" opacity="0.75"><title>${escapeHtml(p.name)}</title></rect>`;
    }).join('');

    const monthBoundaries = getMonthBoundaries(startMs, endMs);
    const monthMarks = monthBoundaries.map(({ ms, label }) => {
      const frac = (ms - startMs) / rangeMs;
      const x = (PAD + frac * (W - 2 * PAD)).toFixed(1);
      return `<line x1="${x}" y1="${CY - 8}" x2="${x}" y2="${CY + 8}" stroke="#334155" stroke-width="0.8"/>
              <text x="${x}" y="${LABEL_Y}" text-anchor="middle" fill="#64748b" font-size="5">${escapeHtml(label)}</text>`;
    }).join('');

    const count = (points || []).length;
    const countLabel = `${count} backup${count !== 1 ? 's' : ''} in last ${windowDays} days`;

    return `<div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div class="flex items-baseline justify-between">
        <p class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Backup Timeline</p>
        <p class="text-xs text-slate-500">${escapeHtml(countLabel)}</p>
      </div>
      <div class="mt-2">
        <svg viewBox="0 0 ${W} ${SVG_H}" style="width:100%;height:${SVG_H}px" preserveAspectRatio="none" aria-hidden="true">
          <line x1="${PAD}" y1="${CY}" x2="${W - PAD}" y2="${CY}" stroke="#1e293b" stroke-width="1.5"/>
          ${monthMarks}
          ${ticks}
        </svg>
      </div>
    </div>`;
  }

  function getMonthBoundaries(startMs, endMs) {
    const boundaries = [];
    const d = new Date(startMs);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getTime() < endMs) {
      boundaries.push({
        ms: d.getTime(),
        label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return boundaries;
  }

  // --- size panel ---------------------------------------------------------

  function renderSizePanel(size) {
    if (!size) return '';

    const original = formatBytes(size.originalSize);
    const dedup = formatBytes(size.dedupSize);

    let ratioStr = '';
    if (size.originalSize && size.dedupSize && size.dedupSize > 0) {
      const ratio = size.originalSize / size.dedupSize;
      ratioStr = `<p class="col-span-2 text-xs text-slate-400">Dedup ratio: <span class="text-slate-200">${ratio.toFixed(1)}×</span></p>`;
    }

    return `<div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div class="flex items-baseline justify-between">
        <p class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Repository Size</p>
        <p class="text-xs text-slate-500">as of ${escapeHtml(size.collectedAgo || '')}</p>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <p>Protected: <span class="text-slate-100">${escapeHtml(original)}</span></p>
        <p>On disk: <span class="text-slate-100">${escapeHtml(dedup)}</span></p>
        ${ratioStr}
      </div>
    </div>`;
  }

  // --- retention insights -------------------------------------------------

  function renderRetentionInsights(retention) {
    if (!retention) return '';
    return `<div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Retention</p>
      <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <p>Archives: <span class="text-slate-100">${escapeHtml(String(retention.totalArchives ?? 0))}</span></p>
        <p>Span: <span class="text-slate-100">${escapeHtml(String(retention.spanDays ?? 0))} days</span></p>
        <p>Avg interval: <span class="text-slate-100">${escapeHtml(retention.avgIntervalDays || 'n/a')}</span></p>
        <p>Largest gap: <span class="text-slate-100">${escapeHtml(retention.largestGapDays || 'n/a')}</span></p>
      </div>
    </div>`;
  }

  // --- helpers ------------------------------------------------------------

  function healthBadgeClass(status) {
    if (status === 'healthy') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    if (status === 'warning') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    if (status === 'critical') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    return 'border-slate-500/40 bg-slate-500/10 text-slate-200';
  }

  function formatBytes(bytes) {
    if (bytes == null) return 'n/a';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // --- events -------------------------------------------------------------

  document.addEventListener('click', function (event) {
    const refreshButton = event.target.closest('[data-manual-refresh]');
    if (refreshButton) {
      void manualRefresh(refreshButton);
      return;
    }

    const toggleButton = event.target.closest('[data-toggle-location]');
    if (!toggleButton) return;

    const id = toggleButton.getAttribute('data-toggle-location');
    const masked = document.getElementById(id + '-masked');
    const full = document.getElementById(id + '-full');
    if (!masked || !full) return;

    const isHidden = full.classList.contains('hidden');
    if (isHidden) {
      full.classList.remove('hidden');
      masked.classList.add('hidden');
      toggleButton.textContent = 'Hide URL';
      toggleButton.setAttribute('aria-expanded', 'true');
    } else {
      full.classList.add('hidden');
      masked.classList.remove('hidden');
      toggleButton.textContent = 'Show URL';
      toggleButton.setAttribute('aria-expanded', 'false');
    }
  });

  async function manualRefresh(button) {
    button.disabled = true;
    button.textContent = 'Collecting…';
    await loadDashboard(true);
  }
})();
