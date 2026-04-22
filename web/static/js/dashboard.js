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
        <p class="mt-5 text-sm text-slate-400">Generated at ${escapeHtml(viewModel.generatedAt || '')}</p>
      </header>
      ${errorBlock}
      <section class="grid gap-6 md:grid-cols-2">${repositories}</section>`;
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

    return `<article class="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/50">
      <h2 class="text-xl font-semibold text-white">${escapeHtml(repository.name)}</h2>

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

      <div class="mt-4 max-h-64 space-y-2 overflow-y-auto pr-2">${archiveHtml}</div>
    </article>`;
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
