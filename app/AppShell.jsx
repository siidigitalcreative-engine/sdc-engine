"use client";
import { useState, useEffect } from "react";
import { ThemeCtx } from "./theme";
import Sidebar from "./Sidebar";

export default function AppShell({ children }) {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    try { const v = localStorage.getItem("sdc-theme"); if (v) setDark(v === "dark"); } catch {}
  }, []);
  const toggle = () => setDark((d) => {
    const next = !d;
    try { localStorage.setItem("sdc-theme", next ? "dark" : "light"); } catch {}
    return next;
  });
  return (
    <ThemeCtx.Provider value={{ dark, toggle }}>
      <div className={`h-screen p-3 sm:p-5 ${dark ? "theme-dark" : "theme-light"}`} style={{ minHeight: 560, background: "var(--page)", color: "var(--text)", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="h-full rounded-3xl overflow-hidden shadow-2xl flex" style={{ background: "var(--surface)" }}>
          <Sidebar />
          {children}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
