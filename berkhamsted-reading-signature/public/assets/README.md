# Brand assets

These files are the fixed site branding. They are **not** editable through the
admin dashboard: the masthead and login logo are part of the application's
design, not user content.

| File | Used for |
|---|---|
| `berkhamsted-logo.png` | the login page, and the default signature logo |
| `berkhamsted-wordmark.png` | the site masthead, recoloured white in CSS |

They are embedded into the Worker bundle at build time by
`scripts/embed-assets.mjs`, which writes `src/worker/assets.generated.ts`. That
keeps the application a single pasteable file with no separate asset upload.

**After changing either file, run `npm run build`** and commit the regenerated
`src/worker/assets.generated.ts` alongside it. CI fails if they are out of step.

Licensing is recorded in [ATTRIBUTION.md](ATTRIBUTION.md).

The only image an administrator can change is the **signature logo**, uploaded
and cropped from Profile in the dashboard. It defaults to `berkhamsted-logo.png`
when nothing has been uploaded.
