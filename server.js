const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);

const app = express();
const appAddr = process.env.APP_ADDR || ':8080';
const listenTarget = normalizeListenTarget(appAddr);
const appTimeZone = resolveTimeZone(process.env.APP_TIMEZONE);
const appTimeZoneLabel = appTimeZone === 'Asia/Kolkata' ? 'IST' : appTimeZone;
const cacheTtlMs = getEnvNumber('APP_CACHE_TTL_SECONDS', 120) * 1000;

const dashboardCache = {
  data: null,
  updatedAt: 0,
  inFlight: null,
  lastError: '',
  refreshDurationMs: 0,
};

app.use('/static', express.static(path.join(__dirname, 'web', 'static')));

app.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

app.get('/api/dashboard', async (_req, res) => {
  const viewModel = await getDashboardViewModel();
  res.status(200).json(viewModel);
});

app.get('/', (_req, res) => {
  res.status(200).type('html').send(renderShellPage());
});

if (listenTarget.host) {
  app.listen(listenTarget.port, listenTarget.host, () => {
    console.log(`server listening on ${listenTarget.host}:${listenTarget.port}`);
  });
} else {
  app.listen(listenTarget.port, () => {
    console.log(`server listening on ${listenTarget.port}`);
  });
}

function normalizeListenTarget(addr) {
  if (/^\d+$/.test(addr)) {
    return { port: Number(addr), host: '' };
  }

  if (/^:\d+$/.test(addr)) {
    return { port: Number(addr.slice(1)), host: '' };
  }

  const hostPortMatch = addr.match(/^([^:]+):(\d+)$/);
  if (hostPortMatch) {
    return {
      host: hostPortMatch[1],
      port: Number(hostPortMatch[2]),
    };
  }

  return { port: 8080, host: '' };
}

function getEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

async function getDashboardViewModel() {
  const now = new Date();
  const hasCache = Boolean(dashboardCache.data);
  const cacheAgeMs = hasCache ? now.getTime() - dashboardCache.updatedAt : Infinity;
  const isFresh = hasCache && cacheAgeMs <= cacheTtlMs;

  if (isFresh) {
    return withCacheMeta(dashboardCache.data, {
      source: 'cache',
      stale: false,
      refreshing: Boolean(dashboardCache.inFlight),
      now,
    });
  }

  if (hasCache) {
    if (!dashboardCache.inFlight) {
      void refreshDashboardCache();
    }

    return withCacheMeta(dashboardCache.data, {
      source: 'cache',
      stale: true,
      refreshing: true,
      now,
    });
  }

  try {
    await refreshDashboardCache();
    return withCacheMeta(dashboardCache.data, {
      source: 'live',
      stale: false,
      refreshing: false,
      now: new Date(),
    });
  } catch (error) {
    return {
      generatedAt: formatGeneratedAt(now),
      latest: null,
      repositories: [],
      error: error.message || String(error),
      cache: {
        source: 'none',
        stale: true,
        refreshing: false,
        lastUpdated: 'Never',
        lastUpdatedAgo: 'never',
        lastError: error.message || String(error),
        ttlSeconds: Math.floor(cacheTtlMs / 1000),
        refreshDurationMs: 0,
      },
    };
  }
}

async function refreshDashboardCache() {
  if (dashboardCache.inFlight) {
    return dashboardCache.inFlight;
  }

  dashboardCache.inFlight = (async () => {
    const startedAt = Date.now();
    const viewModel = await buildDashboardSnapshot();
    dashboardCache.data = viewModel;
    dashboardCache.updatedAt = Date.now();
    dashboardCache.lastError = '';
    dashboardCache.refreshDurationMs = Date.now() - startedAt;
    return viewModel;
  })()
    .catch((error) => {
      dashboardCache.lastError = error.message || String(error);
      throw error;
    })
    .finally(() => {
      dashboardCache.inFlight = null;
    });

  return dashboardCache.inFlight;
}

function withCacheMeta(baseViewModel, options) {
  const vm = cloneViewModel(baseViewModel);
  const lastUpdatedDate = dashboardCache.updatedAt ? new Date(dashboardCache.updatedAt) : null;

  vm.cache = {
    source: options.source,
    stale: options.stale,
    refreshing: options.refreshing,
    lastUpdated: lastUpdatedDate ? formatGeneratedAt(lastUpdatedDate) : 'Never',
    lastUpdatedAgo: lastUpdatedDate ? timeAgo(options.now.getTime() - lastUpdatedDate.getTime()) : 'never',
    lastError: dashboardCache.lastError,
    ttlSeconds: Math.floor(cacheTtlMs / 1000),
    refreshDurationMs: dashboardCache.refreshDurationMs,
  };

  return vm;
}

function cloneViewModel(viewModel) {
  return JSON.parse(JSON.stringify(viewModel));
}

async function buildDashboardSnapshot() {
  const now = new Date();
  const entries = await listBorgmaticArchives();
  const repositories = [];
  const healthSummary = { healthy: 0, warning: 0, critical: 0, noData: 0 };
  let latest = null;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] || {};
    const repository = entry.repository || {};
    const parsedArchives = (entry.archives || [])
      .map((archive) => {
        const parsedTime = parseArchiveTime(archive);
        if (!parsedTime) return null;
        return {
          name: archive.name || archive.archive || 'Unnamed archive',
          time: parsedTime,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.time - a.time);

    const repoName = chooseRepoName(repository);
    const locationFull = repository.location || '';
    const locationMasked = maskLocation(locationFull);

    const repoView = {
      id: `repo-${i}`,
      name: repoName,
      locationFull,
      locationMasked,
      latest: parsedArchives[0] ? formatTimestampLong(parsedArchives[0].time) : '',
      latestAgo: parsedArchives[0] ? timeAgo(now.getTime() - parsedArchives[0].time.getTime()) : '',
      archives: parsedArchives.map((archive) => ({
        name: archive.name,
        timestamp: formatTimestampShort(archive.time),
        ago: timeAgo(now.getTime() - archive.time.getTime()),
      })),
    };
    repoView.retention = buildRetentionInsights(parsedArchives);
    repoView.trend = buildMonthlyTrend(parsedArchives, now, 6);

    const health = evaluateRepositoryHealth(parsedArchives[0]?.time || null, now);
    repoView.healthStatus = health.status;
    repoView.healthLabel = health.label;
    repoView.healthReason = health.reason;
    healthSummary[health.bucket] += 1;

    if (parsedArchives[0] && (!latest || parsedArchives[0].time > latest.time)) {
      latest = {
        repository: repoName,
        time: parsedArchives[0].time,
      };
    }

    repositories.push(repoView);
  }

  repositories.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  return {
    generatedAt: formatGeneratedAt(now),
    latest: latest
      ? {
          repository: latest.repository,
          timestamp: formatTimestampLong(latest.time),
          ago: timeAgo(now.getTime() - latest.time.getTime()),
        }
      : null,
    repositories,
    healthSummary,
    error: '',
  };
}

function buildRetentionInsights(parsedArchives) {
  const totalArchives = parsedArchives.length;
  if (totalArchives === 0) {
    return {
      totalArchives: 0,
      newest: 'n/a',
      oldest: 'n/a',
      spanDays: 0,
      avgIntervalDays: 'n/a',
      largestGapDays: 'n/a',
    };
  }

  const newest = parsedArchives[0].time;
  const oldest = parsedArchives[totalArchives - 1].time;
  const spanDays = Math.max(0, Math.round((newest.getTime() - oldest.getTime()) / (24 * 60 * 60 * 1000)));

  const gapsMs = [];
  for (let i = 0; i < parsedArchives.length - 1; i += 1) {
    gapsMs.push(parsedArchives[i].time.getTime() - parsedArchives[i + 1].time.getTime());
  }

  const avgGapMs = gapsMs.length > 0 ? gapsMs.reduce((sum, value) => sum + value, 0) / gapsMs.length : null;
  const largestGapMs = gapsMs.length > 0 ? Math.max(...gapsMs) : null;

  return {
    totalArchives,
    newest: formatTimestampShort(newest),
    oldest: formatTimestampShort(oldest),
    spanDays,
    avgIntervalDays: avgGapMs ? toDayLabel(avgGapMs) : 'n/a',
    largestGapDays: largestGapMs ? toDayLabel(largestGapMs) : 'n/a',
  };
}

function toDayLabel(durationMs) {
  const days = durationMs / (24 * 60 * 60 * 1000);
  if (days < 1) {
    return '<1 day';
  }
  return `${days.toFixed(1)} days`;
}

function buildMonthlyTrend(parsedArchives, now, months) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    buckets.push({ key, label, count: 0 });
  }

  for (const archive of parsedArchives) {
    const time = archive.time;
    const key = `${time.getUTCFullYear()}-${String(time.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.find((item) => item.key === key);
    if (bucket) {
      bucket.count += 1;
    }
  }

  const maxCount = Math.max(...buckets.map((item) => item.count), 1);
  return {
    maxCount,
    points: buckets.map((item) => ({ label: item.label, count: item.count })),
  };
}

function evaluateRepositoryHealth(latestTime, now) {
  if (!latestTime) {
    return {
      status: 'no-data',
      label: 'No Data',
      reason: 'No parseable backups found',
      bucket: 'noData',
    };
  }

  const ageMs = now.getTime() - latestTime.getTime();
  const hours = ageMs / (60 * 60 * 1000);

  if (hours <= 24) {
    return {
      status: 'healthy',
      label: 'Healthy',
      reason: `Latest backup ${timeAgo(ageMs)}`,
      bucket: 'healthy',
    };
  }

  if (hours <= 72) {
    return {
      status: 'warning',
      label: 'Warning',
      reason: `Backup age is ${timeAgo(ageMs)}`,
      bucket: 'warning',
    };
  }

  return {
    status: 'critical',
    label: 'Critical',
    reason: `Backup is stale (${timeAgo(ageMs)})`,
    bucket: 'critical',
  };
}

async function listBorgmaticArchives() {
  const configDir = path.join(os.homedir(), '.config', 'borgmatic.d');
  const { stdout, stderr } = await execFileAsync(
    'borgmatic',
    ['-c', configDir, 'list', '--json'],
    {
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
    }
  ).catch((error) => {
    const stderrText = (error.stderr || '').trim();
    const detail = stderrText ? `: ${stderrText}` : '';
    throw new Error(`run borgmatic -c ${configDir} list --json failed${detail}`);
  });

  if (stderr && stderr.trim()) {
    console.warn(stderr.trim());
  }

  let entries;
  try {
    entries = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`parse borgmatic json failed: ${error.message}`);
  }

  if (!Array.isArray(entries)) {
    throw new Error('unexpected borgmatic output format');
  }

  return entries;
}

function parseArchiveTime(archive) {
  const candidates = [archive?.time, archive?.start];
  for (const rawValue of candidates) {
    if (!rawValue || typeof rawValue !== 'string') {
      continue;
    }

    const normalized = normalizeTimestamp(rawValue);
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function normalizeTimestamp(value) {
  let normalized = value.trim();
  normalized = normalized.replace(/\.(\d{3})\d+/, '.$1');

  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized += 'Z';
  }

  return normalized;
}

function chooseRepoName(repository) {
  if (repository?.label) {
    return repository.label;
  }

  const host = extractHost(repository?.location || '');
  if (host) {
    return `Repository @ ${host}`;
  }

  if (!repository?.location) {
    return 'Unknown Repository';
  }

  return 'Repository';
}

function extractHost(location) {
  if (!location) {
    return '';
  }

  if (location.includes('://')) {
    try {
      const parsed = new URL(location);
      return parsed.hostname || '';
    } catch (_error) {
      return '';
    }
  }

  if (location.includes('@')) {
    const [, rest = ''] = location.split('@', 2);
    return rest.split(':', 1)[0];
  }

  return '';
}

function maskLocation(location) {
  if (!location) {
    return 'Location unavailable';
  }

  const host = extractHost(location);
  if (host) {
    return `${host} (hidden)`;
  }

  if (location.length <= 18) {
    return 'location hidden';
  }

  return `${location.slice(0, 10)}...${location.slice(-8)}`;
}

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: appTimeZone,
  timeZoneName: 'short',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: appTimeZone,
  timeZoneName: 'short',
});

const generatedAtFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: appTimeZone,
  timeZoneName: 'short',
});

function formatTimestampLong(date) {
  return normalizeFormattedTimezone(longDateFormatter.format(date));
}

function formatTimestampShort(date) {
  return normalizeFormattedTimezone(shortDateFormatter.format(date));
}

function formatGeneratedAt(date) {
  return normalizeFormattedTimezone(generatedAtFormatter.format(date));
}

function resolveTimeZone(configuredTimeZone) {
  if (configuredTimeZone && configuredTimeZone !== 'auto') {
    return configuredTimeZone;
  }

  if (configuredTimeZone === 'auto') {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) {
      return detected;
    }
  }

  return 'Asia/Kolkata';
}

function normalizeFormattedTimezone(value) {
  if (appTimeZone === 'Asia/Kolkata') {
    return value.replace(/GMT\+5:30|UTC\+5:30/g, appTimeZoneLabel);
  }
  return value;
}

function timeAgo(deltaMs) {
  if (deltaMs < 0) {
    return 'in the future';
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) {
    return 'just now';
  }

  if (deltaMs >= day) {
    const value = Math.floor(deltaMs / day);
    return `${value} day${value === 1 ? '' : 's'} ago`;
  }

  if (deltaMs >= hour) {
    const value = Math.floor(deltaMs / hour);
    return `${value} hour${value === 1 ? '' : 's'} ago`;
  }

  const value = Math.floor(deltaMs / minute);
  return `${value} minute${value === 1 ? '' : 's'} ago`;
}

function renderShellPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Borger Dashboard</title>
  <link rel="stylesheet" href="/static/css/app.css" />
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <div class="relative isolate overflow-hidden">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,#0ea5e920_0%,#020617_45%),radial-gradient(circle_at_80%_10%,#22c55e20_0%,#020617_40%)]"></div>
    <main class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section id="dashboard-root" class="rounded-3xl border border-slate-800 bg-slate-900/75 p-8 shadow-2xl shadow-cyan-900/20 backdrop-blur">
        <p class="text-xs uppercase tracking-[0.22em] text-cyan-300/90">Borgmatic Backup Dashboard</p>
        <div class="mt-6 flex items-center gap-4">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400"></div>
          <div>
            <p class="text-lg font-semibold text-white">Loading backups...</p>
            <p class="text-sm text-slate-400">Fetching latest repository data from borgmatic.</p>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script src="/static/js/dashboard.js"></script>
</body>
</html>`;
}
