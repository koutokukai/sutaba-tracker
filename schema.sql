CREATE TABLE IF NOT EXISTS stores (
  store_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  pref_code INTEGER NOT NULL,
  pref_name TEXT NOT NULL,
  address TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT DEFAULT 'active',
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stores_pref ON stores(pref_code);

CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  group_id TEXT NOT NULL,
  store_id INTEGER NOT NULL,
  visited_on TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, store_id)
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
