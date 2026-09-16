-- Multi-user: every account owns its own profile, book, images and signature.
--
-- Design notes:
--  * Ownership is structural, not checked in application code as an
--    afterthought. Every row that belongs to somebody carries user_id, and
--    every query in db.ts takes a userId parameter, so there is no query shape
--    that could return another account's data.
--  * Credentials live per user, each with its own random salt, so two accounts
--    choosing the same password store different hashes.
--  * The previous single-user rows are dropped rather than adopted: see below.
--  * Sessions are dropped rather than migrated: they carry no user_id, so there
--    is no safe way to decide whose they were. Everyone signs in again once.

CREATE TABLE users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  username         TEXT    NOT NULL,
  -- Lower-cased copy carries the uniqueness constraint, so "Otto" and "otto"
  -- cannot both be registered.
  username_lower   TEXT    NOT NULL UNIQUE,
  -- Path segment of the public signature: /signature/<slug>.
  slug             TEXT    NOT NULL UNIQUE,
  password_hash    TEXT    NOT NULL,
  password_salt    TEXT    NOT NULL,
  -- Per-user cache-busting counter, formerly the global settings.revision.
  revision         INTEGER NOT NULL DEFAULT 1,
  -- Revision the stored signature image was rendered at; 0 means none yet.
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

-- The previous single-user rows are NOT adopted into an account.
--
-- There is no safe way to decide who owns them. The credentials that identified
-- the old owner lived in Worker secrets, which are being removed, and handing
-- the data to whoever happens to register first would give a stranger somebody
-- else's date of birth. The details are re-entered at registration instead.

DROP TABLE profile;
DROP TABLE current_book;
DROP TABLE images;

-- Sessions gain an owner. Existing rows cannot be attributed, so they go.
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

-- revision moved onto each user.
DELETE FROM settings WHERE key IN ('revision', 'signature_image_revision', 'signature_image_size');
