import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In production (GitHub Pages) the site lives at a sub-path:
//   https://<user>.github.io/walking-dashboard/
// In local dev we serve from the root so it's simpler to preview.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/walking-dashboard/" : "/",
}));
