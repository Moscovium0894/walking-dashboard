# Granny Walking

A private dashboard of Granny's walks, recorded since 2009. Replaces a manual,
five-app workflow (Garmin → BaseCamp → GPX → Memory Maps → spreadsheet) with a
mostly-automated pipeline and a web dashboard.

## What it does

1. Granny finishes a walk; her Garmin Forerunner syncs to Garmin Connect automatically.
2. A scheduled job downloads new activities, converts them, computes distance, and
   flags any "in a car / not logging" segments.
3. Walks are stored in Supabase (database + GPX file storage).
4. A private, login-protected web dashboard shows every walk on a map with stats,
   and lets Granny confirm/discard flagged segments in a couple of taps.

## Repository layout

| Folder | Purpose |
|--------|---------|
| `docs/` | Planning and architecture (`PLAN.md`). |
| `pipeline/` | Python: Garmin download → FIT→GPX → stats → Supabase. Runs in GitHub Actions. |
| `site/` | Static web dashboard (GitHub Pages / Netlify). Reads from Supabase. |
| `data/seed/` | The historical spreadsheet and import scripts (walks since 2009). |
| `data/gpx/` | Sample / exported GPX (full data lives in Supabase Storage). |
| `.github/workflows/` | Scheduled GitHub Action that runs the pipeline. |

## Status

Planning. See `docs/PLAN.md`.
