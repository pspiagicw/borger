const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbPath =
  process.env.BORGER_DB ||
  path.join(os.homedir(), '.local', 'share', 'borger', 'borger.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS repositories (
    location TEXT PRIMARY KEY,
    label     TEXT,
    name      TEXT NOT NULL,
    last_seen INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS archives (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_location TEXT NOT NULL,
    name          TEXT NOT NULL,
    archive_time  INTEGER NOT NULL,
    first_seen    INTEGER NOT NULL,
    UNIQUE(repo_location, name)
  );

  CREATE INDEX IF NOT EXISTS idx_archives_repo_time
    ON archives(repo_location, archive_time DESC);

  CREATE TABLE IF NOT EXISTS repo_stats (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_location     TEXT    NOT NULL,
    collected_at      INTEGER NOT NULL,
    original_size     INTEGER,
    compressed_size   INTEGER,
    deduplicated_size INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_stats_repo_time
    ON repo_stats(repo_location, collected_at DESC);
`);

const stmts = {
  upsertRepo: db.prepare(`
    INSERT INTO repositories(location, label, name, last_seen)
    VALUES(@location, @label, @name, @lastSeen)
    ON CONFLICT(location) DO UPDATE SET
      label     = excluded.label,
      name      = excluded.name,
      last_seen = excluded.last_seen
  `),

  upsertArchive: db.prepare(`
    INSERT INTO archives(repo_location, name, archive_time, first_seen)
    VALUES(@repoLocation, @name, @archiveTime, @firstSeen)
    ON CONFLICT(repo_location, name) DO NOTHING
  `),

  insertRepoStats: db.prepare(`
    INSERT INTO repo_stats(repo_location, collected_at, original_size, compressed_size, deduplicated_size)
    VALUES(@repoLocation, @collectedAt, @originalSize, @compressedSize, @dedupSize)
  `),

  getAllRepos: db.prepare(`SELECT * FROM repositories ORDER BY name COLLATE NOCASE`),

  getArchivesForRepo: db.prepare(`
    SELECT name, archive_time FROM archives
    WHERE repo_location = ?
    ORDER BY archive_time DESC
  `),

  getLatestStats: db.prepare(`
    SELECT * FROM repo_stats
    WHERE repo_location = ?
    ORDER BY collected_at DESC
    LIMIT 1
  `),
};

module.exports = {
  upsertRepository({ location, label, name }) {
    stmts.upsertRepo.run({ location, label: label ?? null, name, lastSeen: Date.now() });
  },

  upsertArchive({ repoLocation, name, archiveTime }) {
    stmts.upsertArchive.run({ repoLocation, name, archiveTime, firstSeen: Date.now() });
  },

  insertRepoStats({ repoLocation, originalSize, compressedSize, dedupSize }) {
    stmts.insertRepoStats.run({
      repoLocation,
      collectedAt: Date.now(),
      originalSize: originalSize ?? null,
      compressedSize: compressedSize ?? null,
      dedupSize: dedupSize ?? null,
    });
  },

  getAllRepositories() {
    return stmts.getAllRepos.all();
  },

  getArchivesForRepo(location) {
    return stmts.getArchivesForRepo.all(location);
  },

  getLatestStats(location) {
    return stmts.getLatestStats.get(location) ?? null;
  },
};
