import { useEffect, useRef, useState } from "react";

// Adds a one-shot "is it on screen yet?" flag so sections can animate in as the
// reader scrolls (the snap-and-reveal rhythm). Respects reduced-motion.
export function useInView(options = { threshold: 0.18 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      options
    );
    obs.observe(el);
    // Safety net: never leave content hidden if the observer is slow/throttled.
    const fallback = setTimeout(() => setInView(true), 1600);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);

  return [ref, inView];
}
