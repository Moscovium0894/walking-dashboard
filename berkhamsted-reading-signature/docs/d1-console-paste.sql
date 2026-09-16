CREATE TABLE profile (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  name             TEXT    NOT NULL,
  date_of_birth    TEXT    NOT NULL,
  house            TEXT    NOT NULL DEFAULT '',
  school           TEXT    NOT NULL DEFAULT '',
  subtitle         TEXT    NOT NULL DEFAULT '',
  show_house       INTEGER NOT NULL DEFAULT 1,
  show_year        INTEGER NOT NULL DEFAULT 1,
  show_school      INTEGER NOT NULL DEFAULT 1,
  show_subtitle    INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT    NOT NULL
);
CREATE TABLE current_book (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  title            TEXT    NOT NULL,
  author           TEXT    NOT NULL DEFAULT '',
  cover_url        TEXT,
  isbn             TEXT,
  publication_year INTEGER,
  source           TEXT    NOT NULL DEFAULT 'manual',
  updated_at       TEXT    NOT NULL
);
CREATE TABLE images (
  key              TEXT    PRIMARY KEY,
  content_type     TEXT    NOT NULL,
  bytes            BLOB    NOT NULL,
  etag             TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);
CREATE TABLE settings (
  key              TEXT PRIMARY KEY,
  value            TEXT NOT NULL
);
CREATE TABLE sessions (
  id               TEXT    PRIMARY KEY,
  csrf_hash        TEXT    NOT NULL,
  created_at       TEXT    NOT NULL,
  expires_at       INTEGER NOT NULL
);
CREATE INDEX sessions_expires_at ON sessions (expires_at);
CREATE TABLE rate_limit (
  bucket           TEXT    PRIMARY KEY,
  count            INTEGER NOT NULL,
  window_start     INTEGER NOT NULL
);
CREATE INDEX rate_limit_window_start ON rate_limit (window_start);
CREATE TABLE book_cache (
  cache_key        TEXT    PRIMARY KEY,
  payload          TEXT    NOT NULL,
  expires_at       INTEGER NOT NULL
);
CREATE INDEX book_cache_expires_at ON book_cache (expires_at);
INSERT INTO profile (
  id, name, date_of_birth, house, school, subtitle,
  show_house, show_year, show_school, show_subtitle, updated_at
) VALUES (
  1, 'Otto Perowne', '2012-01-31', 'Bartrum', 'Berkhamsted School', '',
  1, 1, 1, 0, '1970-01-01T00:00:00.000Z'
);
INSERT INTO settings (key, value) VALUES ('revision', '1');
CREATE TABLE users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  username         TEXT    NOT NULL,
  username_lower   TEXT    NOT NULL UNIQUE,
  slug             TEXT    NOT NULL UNIQUE,
  password_hash    TEXT    NOT NULL,
  password_salt    TEXT    NOT NULL,
  revision         INTEGER NOT NULL DEFAULT 1,
  image_revision   INTEGER NOT NULL DEFAULT 0,
  image_width      INTEGER,
  image_height     INTEGER,
  created_at       TEXT    NOT NULL
);
CREATE TABLE profiles (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  date_of_birth    TEXT    NOT NULL,
  house            TEXT    NOT NULL DEFAULT '',
  school           TEXT    NOT NULL DEFAULT '',
  subtitle         TEXT    NOT NULL DEFAULT '',
  show_house       INTEGER NOT NULL DEFAULT 1,
  show_year        INTEGER NOT NULL DEFAULT 1,
  show_school      INTEGER NOT NULL DEFAULT 1,
  show_subtitle    INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT    NOT NULL
);
CREATE TABLE books (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT    NOT NULL,
  author           TEXT    NOT NULL DEFAULT '',
  cover_url        TEXT,
  isbn             TEXT,
  publication_year INTEGER,
  source           TEXT    NOT NULL DEFAULT 'manual',
  updated_at       TEXT    NOT NULL
);
CREATE TABLE user_images (
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key              TEXT    NOT NULL,
  content_type     TEXT    NOT NULL,
  bytes            BLOB    NOT NULL,
  etag             TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  PRIMARY KEY (user_id, key)
);
DROP TABLE profile;
DROP TABLE current_book;
DROP TABLE images;
DROP TABLE sessions;
CREATE TABLE sessions (
  id               TEXT    PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_hash        TEXT    NOT NULL,
  created_at       TEXT    NOT NULL,
  expires_at       INTEGER NOT NULL
);
CREATE INDEX sessions_expires_at ON sessions (expires_at);
CREATE INDEX sessions_user_id ON sessions (user_id);
DELETE FROM settings WHERE key IN ('revision', 'signature_image_revision', 'signature_image_size');
