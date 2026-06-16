# Granny Walking — Project Plan

_Last updated: 2026-06-16_

## Goal

A private web dashboard showing every walk Granny has recorded since 2009 — on a
map, with distances and trends — kept up to date with as little manual work as
possible. Replace the current manual chain (Garmin → BaseCamp → GPX → Memory Maps
→ hand-typed spreadsheet) with an automated pipeline.

## The one thing that stays manual

Removing the "in a car / not supposed to be logging" portions of a track is human
judgement and can't be fully automated. The plan is to get *close* to automatic:
detect and flag suspect segments, exclude them by default, and let Granny confirm
or discard each in a couple of taps on the dashboard.

## Architecture

```
  Garmin Forerunner
        │ auto-sync (phone/wifi)
        ▼
  Garmin Connect (cloud)
        │ scheduled pull (garth / python-garminconnect)
        ▼
  GitHub Action (free, runs daily)        ── the automation engine
        │  FIT → GPX → distance → flag car segments
        ▼
  Supabase
   ├── Postgres  (one row per walk: date, distance, duration, name, status)
   └── Storage   (GPX track files; simplified copy for fast map rendering)
        ▲
        │ JS client + real auth (email/password) + row-level security
        ▼
  Static dashboard (GitHub Pages / Netlify)
   ├── Map view (Leaflet) of all walks
   ├── Stats/charts (distance over time, totals per year)
   └── Review queue for flagged segments
```

## Why these choices

- **GitHub Actions for the pipeline** — Python runs natively, no serverless
  timeouts, free, lives next to the code. Better fit than Netlify/Supabase
  functions for the download+convert job.
- **Supabase for storage + auth** — gives a *real* login (the original goal),
  a queryable database that replaces the spreadsheet, and file storage for GPX.
  Free tier pauses after ~1 week of inactivity, but a weekly walker keeps it awake.
- **Static dashboard** — free hosting, nothing to maintain; just reads Supabase.

## Data model (draft — to be finalised against Granny's spreadsheet)

`walks` table:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key |
| garmin_activity_id | text | dedupe key; null for historical imports |
| date | date | walk date |
| name | text | walk name / location |
| distance_km | numeric | computed, after segment removal |
| duration_min | numeric | moving time |
| gpx_path | text | path in Supabase Storage |
| status | text | `imported`, `needs_review`, `confirmed` |
| source | text | `garmin` or `historical` |
| notes | text | optional |

_Columns will be adjusted once we see the real spreadsheet so the 2009-onward
history imports cleanly._

## Open decisions / risks

- **Garmin login is unofficial** (`garth` / `python-garminconnect`). Can break if
  Garmin changes things. 2FA handled by capturing a session token once, stored as
  a GitHub Actions secret.
- **Car-segment detection** thresholds (speed, time/distance gaps) need tuning on
  real data.
- **Historical import**: how clean is the 2009-onward spreadsheet? Do old walks
  have GPX, or only distances? (Affects whether old walks get maps or just stats.)

## Build phases (proposed)

1. **Plan & scaffold** ← _we are here_
2. Import the historical spreadsheet → Supabase (dashboard has data day one).
3. Static dashboard reading from Supabase (map + stats), behind login.
4. Python pipeline: Garmin pull → FIT→GPX → distance.
5. Car-segment flagging + dashboard review queue.
6. Schedule the pipeline as a GitHub Action.

## Needed from Otto

- The remote repo name (to add as `origin`).
- Granny's spreadsheet (to finalise the schema and plan the import).
