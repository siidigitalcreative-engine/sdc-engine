"use client";

import { useEffect, useState } from "react";

const DEFAULTS = {
  name: "SDC",
  tagline: "Creative team",
  signInTitle: "",
  signInSubtitle: "Sign in to your creative team workspace",
};

/* The workspace name, editable in Settings. Readable without signing in,
   because the sign-in screen shows it. */
export function useAppSettings() {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/app-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (!cancelled && body?.settings) setSettings(body.settings); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return settings;
}
