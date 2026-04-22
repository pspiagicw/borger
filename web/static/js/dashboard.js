(function () {
  const root = document.getElementById('dashboard-root');
  if (!root) return;

  loadDashboard();

  async function loadDashboard() {
    try {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('dashboard request failed with status ' + response.status);
      }

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

  function renderDashboard(viewModel) {
    const hero = viewModel.latest
      ? `<h1 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">Latest backup</h1>
         <p class="mt-3 text-xl text-cyan-200">${escapeHtml(viewModel.latest.timestamp)}</p>
         <p class="mt-2 text-lg text-slate-300">${escapeHtml(viewModel.latest.ago)} on <span class="font-medium text-cyan-300">${escapeHtml(viewModel.latest.repository)}</span></p>`
      : `<h1 class="mt-3 text-3xl font-semibold text-white sm:text-4xl">No backup data found</h1>
         <p class="mt-2 text-slate-300">Run borgmatic backups to populate this dashboard.</p>`;

    const cacheMeta = renderCacheMeta(viewModel.cache);
    const healthSummary = renderHealthSummary(viewModel.healthSummary);

    const errorBlock = viewModel.error
      ? `<section class="mb-8 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-rose-100">
           <h2 class="text-lg font-semibold">Failed to load backups</h2>
           <p class="mt-2 break-all text-sm">${escapeHtml(viewModel.error)}</p>
         </section>`
      : '';

    const repositories = Array.isArray(viewModel.repositories) && viewModel.repositories.length
      ? viewModel.repositories.map(renderRepositoryCard).join('')
      : '<p class="text-slate-300">No repositories found in borgmatic output.</p>';

    return `<header id="dashboard-root" class="mb-8 rounded-3xl border border-slate-800 bg-slate-900/75 p-8 shadow-2xl shadow-cyan-900/20 backdrop-blur">
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-300/90">Borgmatic Backup Dashboard</p>
        ${hero}
        ${cacheMeta}
        ${healthSummary}
        <p class="mt-5 text-sm text-slate-400">Generated at ${escapeHtml(viewModel.generatedAt || '')}</p>
      </header>
      ${errorBlock}
      <section class="grid gap-6 md:grid-cols-2">${repositories}</section>`;
  }

  function renderCacheMeta(cache) {
    if (!cache) {
      return '';
    }

    let statusClass = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    let statusText = 'Fresh cache';

    if (cache.refreshing) {
      statusClass = 'border-amber-500/40 bg-amber-500/10 text-amber-200';
      statusText = 'Refreshing in background';
    } else if (cache.stale) {
      statusClass = 'border-rose-500/40 bg-rose-500/10 text-rose-200';
      statusText = 'Stale cache';
    }

    const lastError = cache.lastError
      ? `<p class="mt-1 break-all text-xs text-rose-200">Last refresh error: ${escapeHtml(cache.lastError)}</p>`
      : '';

    return `<div class="mt-4 rounded-xl border ${statusClass} p-3">
      <p class="text-sm font-semibold">${statusText}</p>
      <p class="mt-1 text-xs">Last updated ${escapeHtml(cache.lastUpdatedAgo || 'unknown')} (${escapeHtml(cache.lastUpdated || 'unknown')})</p>
      <p class="mt-1 text-xs">Cache TTL: ${escapeHtml(String(cache.ttlSeconds || 0))}s | Refresh: ${escapeHtml(String(cache.refreshDurationMs || 0))}ms</p>
      ${lastError}
    </div>`;
  }

  function renderHealthSummary(summary) {
    if (!summary) {
      return '';
    }

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

  function renderRepositoryCard(repository) {
    const archiveHtml = Array.isArray(repository.archives) && repository.archives.length
      ? repository.archives
          .map(
            (archive) => `<div class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p class="truncate text-sm font-medium text-slate-100">${escapeHtml(archive.name)}</p>
              <p class="mt-1 text-xs text-slate-400">${escapeHtml(archive.timestamp)} (${escapeHtml(archive.ago)})</p>
            </div>`
          )
          .join('')
      : '<p class="text-sm text-slate-500">No archives available.</p>';

    const latestLine = repository.latest
      ? `<p class="mt-4 text-sm text-slate-300">Latest: <span class="text-cyan-300">${escapeHtml(repository.latest)}</span> (${escapeHtml(repository.latestAgo)})</p>`
      : '<p class="mt-4 text-sm text-slate-400">No parseable archives found.</p>';
    const retention = repository.retention || {};
    const retentionBlock = `<div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Retention Insights</p>
      <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
        <p>Archives: <span class="text-slate-100">${escapeHtml(String(retention.totalArchives ?? 0))}</span></p>
        <p>Span: <span class="text-slate-100">${escapeHtml(String(retention.spanDays ?? 0))} days</span></p>
        <p>Newest: <span class="text-slate-100">${escapeHtml(retention.newest || 'n/a')}</span></p>
        <p>Oldest: <span class="text-slate-100">${escapeHtml(retention.oldest || 'n/a')}</span></p>
        <p>Avg interval: <span class="text-slate-100">${escapeHtml(retention.avgIntervalDays || 'n/a')}</span></p>
        <p>Largest gap: <span class="text-slate-100">${escapeHtml(retention.largestGapDays || 'n/a')}</span></p>
      </div>
    </div>`;
    const trendBlock = renderTrend(repository.trend);

    return `<article class="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/50">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-xl font-semibold text-white">${escapeHtml(repository.name)}</h2>
        <span class="rounded-full border px-2.5 py-1 text-xs font-semibold ${healthBadgeClass(repository.healthStatus)}">${escapeHtml(repository.healthLabel || 'Unknown')}</span>
      </div>
      <p class="mt-1 text-xs text-slate-400">${escapeHtml(repository.healthReason || '')}</p>

      <div class="mt-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3">
        <p class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Repository URL</p>
        <p id="${escapeHtml(repository.id)}-masked" class="mt-2 truncate font-mono text-sm text-slate-300">${escapeHtml(repository.locationMasked)}</p>
        <p id="${escapeHtml(repository.id)}-full" class="mt-2 hidden break-all font-mono text-sm text-cyan-200">${escapeHtml(repository.locationFull)}</p>
        <button
          type="button"
          data-toggle-location="${escapeHtml(repository.id)}"
          class="mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          aria-expanded="false"
        >
          Show URL
        </button>
      </div>

      ${latestLine}
      ${retentionBlock}
      ${trendBlock}

      <div class="mt-4 max-h-64 space-y-2 overflow-y-auto pr-2">${archiveHtml}</div>
    </article>`;
  }

  function renderTrend(trend) {
    if (!trend || !Array.isArray(trend.points) || trend.points.length === 0) {
      return '';
    }

    const maxCount = Math.max(trend.maxCount || 1, 1);
    const bars = trend.points
      .map((point) => {
        const height = Math.max(8, Math.round((point.count / maxCount) * 56));
        return `<div class="flex flex-col items-center gap-1">
          <div class="w-7 rounded-t-md bg-cyan-400/80" style="height:${height}px" title="${escapeHtml(point.label)}: ${escapeHtml(String(point.count))}"></div>
          <span class="text-[10px] text-slate-400">${escapeHtml(point.label)}</span>
        </div>`;
      })
      .join('');

    return `<div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Backup Trend (6 months)</p>
      <div class="mt-3 flex items-end gap-2">${bars}</div>
    </div>`;
  }

  function healthBadgeClass(status) {
    if (status === 'healthy') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    if (status === 'warning') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    if (status === 'critical') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
    return 'border-slate-500/40 bg-slate-500/10 text-slate-200';
  }

  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-toggle-location]');
    if (!button) return;

    const id = button.getAttribute('data-toggle-location');
    const masked = document.getElementById(id + '-masked');
    const full = document.getElementById(id + '-full');
    if (!masked || !full) return;

    const isHidden = full.classList.contains('hidden');
    if (isHidden) {
      full.classList.remove('hidden');
      masked.classList.add('hidden');
      button.textContent = 'Hide URL';
      button.setAttribute('aria-expanded', 'true');
    } else {
      full.classList.add('hidden');
      masked.classList.remove('hidden');
      button.textContent = 'Show URL';
      button.setAttribute('aria-expanded', 'false');
    }
  });

  function escapeHtml(value) {
    const text = String(value ?? '');
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
