"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeCtx } from "./theme";
import { AuthProvider, useAuth } from "./auth";
import Sidebar from "./Sidebar";

function readThemeCookie() {
  if (typeof document === "undefined") return null;
  const item = document.cookie.split("; ").find((entry) => entry.startsWith("sdc_theme="));
  return item ? item.split("=")[1] : null;
}

export default function AppShell({ children }) {
  return (
    <AuthProvider>
      <AppTheme>{children}</AppTheme>
    </AuthProvider>
  );
}

function AppTheme({ children }) {
  const [dark, setDark] = useState(false);
  const { currentMember } = useAuth();

  useEffect(() => {
    if (currentMember?.theme) {
      setDark(currentMember.theme === "dark");
      return;
    }

    const saved = readThemeCookie();
    if (saved === "dark" || saved === "light") {
      setDark(saved === "dark");
    }
  }, [currentMember]);

  const toggle = () => {
    setDark((current) => {
      const next = !current;

      document.cookie = `sdc_theme=${next ? "dark" : "light"}; Path=/; Max-Age=31536000; SameSite=Lax`;

      if (currentMember?.id) {
        fetch("/api/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentMember.id,
            data: { theme: next ? "dark" : "light" },
          }),
        }).catch(() => {});
      }

      return next;
    });
  };

  return (
    <ThemeCtx.Provider value={{ dark, toggle }}>
      <AppFrame dark={dark}>{children}</AppFrame>
    </ThemeCtx.Provider>
  );
}

function AppFrame({ children, dark }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, currentMember } = useAuth();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!ready) return;

    if (!currentMember && !isLogin) router.replace("/login");
    if (currentMember && isLogin) router.replace("/dashboard");
  }, [ready, currentMember, isLogin, router]);

  const shellClass = `h-screen p-3 sm:p-5 ${dark ? "theme-dark" : "theme-light"}`;

  if (!ready || (!currentMember && !isLogin) || (currentMember && isLogin)) {
    return (
      <div className={shellClass}>
        <div className="h-full rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center">
          <div className="h-9 w-9 rounded-full border-2 border-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass} style={{ minHeight: 560, background: "var(--page)", color: "var(--text)" }}>
      <div className="h-full rounded-3xl overflow-hidden shadow-2xl flex" style={{ background: "var(--surface)" }}>
        {!isLogin && <Sidebar />}
        {children}
      </div>
    </div>
  );
}
