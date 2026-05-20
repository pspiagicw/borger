const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const db = require('./db');

const execFileAsync = promisify(execFile);
const configDir = path.join(os.homedir(), '.config', 'borgmatic.d');
const execOpts = { maxBuffer: 20 * 1024 * 1024, env: process.env };

const state = {
  lastRunAt: null,
  lastError: '',
  lastDurationMs: 0,
  running: false,
};

async function collect() {
  if (state.running) return;
  state.running = true;
  const startedAt = Date.now();
  console.log(`[collector] running borgmatic (config: ${configDir})`);

  try {
    const [listResult, infoResult] = await Promise.allSettled([
      runBorgmaticList(),
      runBorgmaticInfo(),
    ]);

    if (listResult.status === 'fulfilled') {
      processListEntries(listResult.value);
      const repoCount = listResult.value.length;
      const archiveCount = listResult.value.reduce((s, e) => s + (e.archives || []).length, 0);
      console.log(`[collector] list ok — ${repoCount} repo(s), ${archiveCount} archive(s)`);
    } else {
      throw listResult.reason;
    }

    if (infoResult.status === 'fulfilled') {
      processInfoEntries(infoResult.value);
      console.log(`[collector] info ok — size data stored`);
    } else {
      console.warn(`[collector] info failed (size data unavailable): ${infoResult.reason.message}`);
    }

    state.lastError = '';
  } catch (error) {
    state.lastError = error.message || String(error);
    throw error;
  } finally {
    state.lastRunAt = Date.now();
    state.lastDurationMs = Date.now() - startedAt;
    state.running = false;
    console.log(`[collector] done in ${state.lastDurationMs}ms`);
  }
}

function processListEntries(entries) {
  for (const entry of entries) {
    const repo = entry.repository || {};
    const location = repo.location || '';
    if (!location) continue;

    db.upsertRepository({
      location,
      label: repo.label ?? null,
      name: chooseRepoName(repo),
    });

    for (const archive of entry.archives || []) {
      const archiveTime = parseArchiveTime(archive);
      const archiveName = archive.name || archive.archive || '';
      if (!archiveTime || !archiveName) continue;
      db.upsertArchive({ repoLocation: location, name: archiveName, archiveTime: archiveTime.getTime() });
    }
  }
}

function processInfoEntries(entries) {
  for (const entry of entries) {
    const repo = entry.repository || {};
    const location = repo.location || '';
    if (!location) continue;

    const stats = entry.cache?.stats || entry.stats || {};
    db.insertRepoStats({
      repoLocation: location,
      originalSize: stats.total_size ?? null,
      compressedSize: stats.total_csize ?? null,
      dedupSize: stats.unique_csize ?? null,
    });
  }
}

async function runBorgmaticList() {
  const { stdout, stderr } = await execFileAsync(
    'borgmatic',
    ['-c', configDir, 'list', '--json'],
    execOpts,
  ).catch((error) => {
    const detail = (error.stderr || '').trim();
    throw new Error(`borgmatic list failed${detail ? ': ' + detail : ''}`);
  });

  if (stderr?.trim()) console.warn(stderr.trim());

  let entries;
  try {
    entries = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`parse borgmatic list json failed: ${error.message}`);
  }

  if (!Array.isArray(entries)) throw new Error('unexpected borgmatic list output format');
  return entries;
}

async function runBorgmaticInfo() {
  const { stdout, stderr } = await execFileAsync(
    'borgmatic',
    ['-c', configDir, 'info', '--json'],
    execOpts,
  ).catch((error) => {
    const detail = (error.stderr || '').trim();
    throw new Error(`borgmatic info failed${detail ? ': ' + detail : ''}`);
  });

  if (stderr?.trim()) console.warn(stderr.trim());

  let entries;
  try {
    entries = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`parse borgmatic info json failed: ${error.message}`);
  }

  if (!Array.isArray(entries)) throw new Error('unexpected borgmatic info output format');
  return entries;
}

function chooseRepoName(repository) {
  if (repository?.label) return repository.label;
  const host = extractHost(repository?.location || '');
  if (host) return `Repository @ ${host}`;
  if (!repository?.location) return 'Unknown Repository';
  return 'Repository';
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

function parseArchiveTime(archive) {
  const candidates = [archive?.time, archive?.start];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    let normalized = raw.trim().replace(/\.(\d{3})\d+/, '.$1');
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)) normalized += 'Z';
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

module.exports = { collect, state };
