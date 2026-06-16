# Granny Walking

A friendly web dashboard of Granny's walks, recorded since 2009 — every walk on a
map, with distances, trends, footwear stats and fun milestones.

**Live:** https://moscovium0894.github.io/walking-dashboard/

## How it works (current design)

Granny keeps her walks in a **spreadsheet she maintains herself**. The dashboard is
a static site that reads that data through one swappable data layer
(`site/src/data/source.js`):

- **Today:** rich, realistic **demo data** so the site looks alive before the real
  sheet lands (`site/src/data/demoData.js`).
- **Next:** her published/exported spreadsheet as CSV — a one-file change in
  `source.js`. No database, no login.

> The earlier design used Supabase (database + login) and an automated Garmin
> pipeline. That full implementation is preserved on the **`supabase-version`**
> branch in case server-side accounts are wanted later. See `docs/PLAN.md`.

## Repository layout

| Folder | Purpose |
|--------|---------|
| `site/` | Static web dashboard (React + Vite, deployed to GitHub Pages). |
| `site/src/data/` | The swappable data layer (demo data now → spreadsheet next). |
| `docs/` | Planning and architecture (`PLAN.md`). |
| `data/seed/` | Where the historical spreadsheet + import scripts will live. |
| `pipeline/` | (parked) Python Garmin→GPX pipeline — only if auto-import is wanted. |
| `supabase/` | (parked) DB schema for the optional Supabase design. |
| `.github/workflows/` | `deploy.yml` builds `site/` and publishes to GitHub Pages. |

## Develop

```bash
cd site
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → site/dist
```

## Status

Live demo dashboard with sample data. Next: wire in Granny's real spreadsheet.
See `docs/PLAN.md`.
