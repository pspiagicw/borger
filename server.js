const express = require('express');
const path = require('path');

const db = require('./internal/db');
const collector = require('./internal/collector');

const app = express();
const appAddr = process.env.APP_ADDR || ':8080';
const listenTarget = normalizeListenTarget(appAddr);
const appTimeZone = resolveTimeZone(process.env.APP_TIMEZONE);
const appTimeZoneLabel = appTimeZone === 'Asia/Kolkata' ? 'IST' : appTimeZone;
const collectIntervalMs = getEnvNumber('APP_COLLECT_INTERVAL_SECONDS', 600) * 1000;
const timelineWindowMs = 90 * 24 * 60 * 60 * 1000;

// Kick off an immediate collection, then repeat on interval.
void collector.collect().catch((err) => console.error('Initial collection failed:', err.message));
setInterval(() => {
  void collector.collect().catch((err) => console.error('Periodic collection failed:', err.message));
}, collectIntervalMs);

app.use('/static', express.static(path.join(__dirname, 'web', 'static')));

app.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

app.get('/api/dashboard', async (req, res) => {
  if (req.query.refresh === '1') {
    try {
      await collector.collect();
    } catch (_error) {
      // non-fatal — return whatever is already in the DB
    }
  }
  res.status(200).json(buildViewModelFromDb());
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

// --- view model -----------------------------------------------------------

function buildViewModelFromDb() {
  const now = new Date();
  const repos = db.getAllRepositories();
  const repositories = [];
  const healthSummary = { healthy: 0, warning: 0, critical: 0, noData: 0 };
  let latestOverall = null;

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const archives = db.getArchivesForRepo(repo.location);
    const latestStats = db.getLatestStats(repo.location);

    const sorted = archives.sort((a, b) => b.archive_time - a.archive_time);
    const latestTime = sorted[0] ? new Date(sorted[0].archive_time) : null;

    const health = evaluateRepositoryHealth(latestTime, now);
    healthSummary[health.bucket] += 1;

    const repoView = {
      id: `repo-${i}`,
      name: repo.name,
      locationFull: repo.location,
      locationMasked: maskLocation(repo.location),
      latest: latestTime ? formatTimestampLong(latestTime) : '',
      latestAgo: latestTime ? timeAgo(now.getTime() - latestTime.getTime()) : '',
      healthStatus: health.status,
      healthLabel: health.label,
      healthReason: health.reason,
      retention: buildRetentionInsights(sorted),
      timeline: buildTimeline(sorted, now),
      size: latestStats ? buildSizeView(latestStats, now) : null,
    };

    if (latestTime && (!latestOverall || latestTime > latestOverall.time)) {
      latestOverall = { repository: repo.name, time: latestTime };
    }

    repositories.push(repoView);
  }

  const cs = collector.state;
  return {
    generatedAt: formatGeneratedAt(now),
    latest: latestOverall
      ? {
          repository: latestOverall.repository,
          timestamp: formatTimestampLong(latestOverall.time),
          ago: timeAgo(now.getTime() - latestOverall.time.getTime()),
        }
      : null,
    repositories,
    healthSummary,
    error: '',
    collector: {
      lastRunAt: cs.lastRunAt ? formatGeneratedAt(new Date(cs.lastRunAt)) : null,
      lastRunAgo: cs.lastRunAt ? timeAgo(now.getTime() - cs.lastRunAt) : null,
      lastError: cs.lastError,
      lastDurationMs: cs.lastDurationMs,
      intervalSeconds: Math.floor(collectIntervalMs / 1000),
      running: cs.running,
    },
  };
}

function buildTimeline(sortedArchives, now) {
  const endMs = now.getTime();
  const startMs = endMs - timelineWindowMs;
  const points = sortedArchives
    .filter((a) => a.archive_time >= startMs)
    .map((a) => ({ ms: a.archive_time, name: a.name }));
  return { startMs, endMs, windowDays: 90, points };
}

function buildRetentionInsights(sortedArchives) {
  const totalArchives = sortedArchives.length;
  if (totalArchives === 0) {
    return { totalArchives: 0, newest: 'n/a', oldest: 'n/a', spanDays: 0, avgIntervalDays: 'n/a', largestGapDays: 'n/a' };
  }

  const newest = new Date(sortedArchives[0].archive_time);
  const oldest = new Date(sortedArchives[totalArchives - 1].archive_time);
  const spanDays = Math.max(0, Math.round((newest - oldest) / (24 * 60 * 60 * 1000)));

  const gapsMs = [];
  for (let i = 0; i < sortedArchives.length - 1; i++) {
    gapsMs.push(sortedArchives[i].archive_time - sortedArchives[i + 1].archive_time);
  }

  const avgGapMs = gapsMs.length > 0 ? gapsMs.reduce((s, v) => s + v, 0) / gapsMs.length : null;
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

function buildSizeView(stats, now) {
  return {
    originalSize: stats.original_size,
    compressedSize: stats.compressed_size,
    dedupSize: stats.deduplicated_size,
    collectedAt: formatTimestampShort(new Date(stats.collected_at)),
    collectedAgo: timeAgo(now.getTime() - stats.collected_at),
  };
}

// --- domain logic ----------------------------------------------------------

function evaluateRepositoryHealth(latestTime, now) {
  if (!latestTime) {
    return { status: 'no-data', label: 'No Data', reason: 'No parseable backups found', bucket: 'noData' };
  }

  const ageMs = now.getTime() - latestTime.getTime();
  const hours = ageMs / (60 * 60 * 1000);

  if (hours <= 24) {
    return { status: 'healthy', label: 'Healthy', reason: `Latest backup ${timeAgo(ageMs)}`, bucket: 'healthy' };
  }

  if (hours <= 72) {
    return { status: 'warning', label: 'Warning', reason: `Backup age is ${timeAgo(ageMs)}`, bucket: 'warning' };
  }

  return { status: 'critical', label: 'Critical', reason: `Backup is stale (${timeAgo(ageMs)})`, bucket: 'critical' };
}

function maskLocation(location) {
  if (!location) return 'Location unavailable';
  const host = extractHost(location);
  if (host) return `${host} (hidden)`;
  if (location.length <= 18) return 'location hidden';
  return `${location.slice(0, 10)}...${location.slice(-8)}`;
}

function extractHost(location) {
  if (!location) return '';
  if (location.includes('://')) {
    try { return new URL(location).hostname || ''; } catch { return ''; }
  }
  if (location.includes('@')) {
    const [, rest = ''] = location.split('@', 2);
    return rest.split(':', 1)[0];
  }
  return '';
}

function toDayLabel(durationMs) {
  const days = durationMs / (24 * 60 * 60 * 1000);
  if (days < 1) return '<1 day';
  return `${days.toFixed(1)} days`;
}

// --- formatting ------------------------------------------------------------

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
  timeZone: appTimeZone, timeZoneName: 'short',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
  timeZone: appTimeZone, timeZoneName: 'short',
});

const generatedAtFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  timeZone: appTimeZone, timeZoneName: 'short',
});

function formatTimestampLong(date) { return normalizeFormattedTimezone(longDateFormatter.format(date)); }
function formatTimestampShort(date) { return normalizeFormattedTimezone(shortDateFormatter.format(date)); }
function formatGeneratedAt(date) { return normalizeFormattedTimezone(generatedAtFormatter.format(date)); }

function resolveTimeZone(configured) {
  if (configured && configured !== 'auto') return configured;
  if (configured === 'auto') {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) return detected;
  }
  return 'Asia/Kolkata';
}

function normalizeFormattedTimezone(value) {
  if (appTimeZone === 'Asia/Kolkata') return value.replace(/GMT\+5:30|UTC\+5:30/g, appTimeZoneLabel);
  return value;
}

function timeAgo(deltaMs) {
  if (deltaMs < 0) return 'in the future';
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (deltaMs < minute) return 'just now';
  if (deltaMs >= day) { const v = Math.floor(deltaMs / day); return `${v} day${v === 1 ? '' : 's'} ago`; }
  if (deltaMs >= hour) { const v = Math.floor(deltaMs / hour); return `${v} hour${v === 1 ? '' : 's'} ago`; }
  const v = Math.floor(deltaMs / minute);
  return `${v} minute${v === 1 ? '' : 's'} ago`;
}

// --- utilities -------------------------------------------------------------

function normalizeListenTarget(addr) {
  if (/^\d+$/.test(addr)) return { port: Number(addr), host: '' };
  if (/^:\d+$/.test(addr)) return { port: Number(addr.slice(1)), host: '' };
  const m = addr.match(/^([^:]+):(\d+)$/);
  if (m) return { host: m[1], port: Number(m[2]) };
  return { port: 8080, host: '' };
}

function getEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

// --- shell page ------------------------------------------------------------

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
            <p class="text-sm text-slate-400">Reading from local database.</p>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script src="/static/js/dashboard.js"></script>
</body>
</html>`;
}
