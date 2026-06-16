import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { makeUnits } from "./units.js";

// Granny-friendly, extensible settings — persisted in localStorage and applied
// app-wide. Add a new key here + a control on the Settings page and it just works.
const DEFAULTS = {
  units: "mi",          // "mi" | "km"
  theme: "warm",        // "warm" | "contrast"
  numbers: "rounded",   // "rounded" | "detailed" (default headline display)
  showGrandad: true,    // include Grandad's supporting footwear details
};

const KEY = "granny-walks-settings";
const SettingsContext = createContext(null);

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  const value = useMemo(() => ({
    settings,
    set: (k, v) => setSettings((s) => ({ ...s, [k]: v })),
    toggle: (k) => setSettings((s) => ({ ...s, [k]: !s[k] })),
    reset: () => setSettings({ ...DEFAULTS }),
    units: makeUnits(settings.units),
  }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function useUnits() {
  return useSettings().units;
}
