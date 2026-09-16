-- Initial schema for the Berkhamsted reading signature.
--
-- Design notes:
--  * profile and current_book are single-row tables, pinned by a CHECK on the
--    primary key. There is exactly one person and one current book, and making
--    that an invariant of the schema keeps the queries trivial.
--  * The year group is never stored. It is derived from date_of_birth on every
--    read, so it advances on 1 September with no intervention.
--  * The images table holds the cover and logo bytes, so the email signature
--    is served entirely from our own origin.

CREATE TABLE profile (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  name             TEXT    NOT NULL,
  date_of_birth    TEXT    NOT NULL,           -- ISO YYYY-MM-DD
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
  cover_url        TEXT,                        -- original upstream URL, for reference
  isbn             TEXT,
  publication_year INTEGER,
  source           TEXT    NOT NULL DEFAULT 'manual',
  updated_at       TEXT    NOT NULL
);

-- Binary assets, re-served from our own stable endpoints.
--   'cover' - the current book's cover, fetched when the book is set.
--   'logo'  - the Berkhamsted logo, uploaded by the administrator.
-- Holding both here means the email signature loads every image from this
-- Worker, so it cannot break when a third-party cover URL moves or starts
-- refusing hotlinks, and the logo needs no separate hosting.
CREATE TABLE images (
  key              TEXT    PRIMARY KEY,
  content_type     TEXT    NOT NULL,
  bytes            BLOB    NOT NULL,
  etag             TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);

-- Small key/value store. Currently holds "revision", the counter that changes
-- whenever the profile or book changes and which drives cache busting.
CREATE TABLE settings (
  key              TEXT PRIMARY KEY,
  value            TEXT NOT NULL
);

-- Server-side sessions. Only hashes are stored, so a leaked database row
-- cannot be replayed as a session cookie.
CREATE TABLE sessions (
  id               TEXT    PRIMARY KEY,         -- SHA-256 of the cookie token
  csrf_hash        TEXT    NOT NULL,            -- SHA-256 of the CSRF token
  created_at       TEXT    NOT NULL,
  expires_at       INTEGER NOT NULL             -- unix seconds
);

CREATE INDEX sessions_expires_at ON sessions (expires_at);

-- Fixed-window rate limiting for login and mutation endpoints.
CREATE TABLE rate_limit (
  bucket           TEXT    PRIMARY KEY,
  count            INTEGER NOT NULL,
  window_start     INTEGER NOT NULL             -- unix seconds
);

CREATE INDEX rate_limit_window_start ON rate_limit (window_start);

-- Cached book-search responses, to stay well inside third-party rate limits.
CREATE TABLE book_cache (
  cache_key        TEXT    PRIMARY KEY,
  payload          TEXT    NOT NULL,            -- JSON
  expires_at       INTEGER NOT NULL             -- unix seconds
);

CREATE INDEX book_cache_expires_at ON book_cache (expires_at);

-- Seed the default profile. The year group is deliberately absent: it is
-- calculated from date_of_birth every time it is displayed.
INSERT INTO profile (
  id, name, date_of_birth, house, school, subtitle,
  show_house, show_year, show_school, show_subtitle, updated_at
) VALUES (
  1, 'Otto Perowne', '2012-01-31', 'Bartrum', 'Berkhamsted School', '',
  1, 1, 1, 0, '1970-01-01T00:00:00.000Z'
);

INSERT INTO settings (key, value) VALUES ('revision', '1');
