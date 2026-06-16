import { useEffect, useState } from "react";

// Tiny hash router — works perfectly on GitHub Pages (no server rewrites needed)
// and keeps the back button + refresh behaving. Routes look like #/calendar.
export const ROUTES = ["home", "calendar", "search", "explore", "settings"];

function current() {
  const h = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return ROUTES.includes(h) ? h : "home";
}

export function useHashRoute() {
  const [route, setRoute] = useState(current);

  useEffect(() => {
    const onHash = () => setRoute(current());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (r) => {
    window.location.hash = `#/${r}`;
    // scroll the active page back to the top on navigation
    requestAnimationFrame(() => {
      const sc = document.querySelector(".page-scroll");
      if (sc) sc.scrollTop = 0;
    });
  };

  return [route, navigate];
}
