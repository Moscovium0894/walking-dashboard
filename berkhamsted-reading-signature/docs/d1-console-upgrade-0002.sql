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
