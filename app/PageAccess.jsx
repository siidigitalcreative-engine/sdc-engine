"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useAuth } from "./auth";

/* Wraps a page so it only renders for a department that may open it.

   The sidebar hides what a department cannot reach, but hiding a link is
   presentation, not enforcement. This asks the server, so typing the URL
   directly gets the same answer. The page's own API routes check too. */
export default function PageAccess({ page, children }) {
  const { allowedPages, canOpen, department } = useAuth();
  const [checked, setChecked] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/access?page=${encodeURIComponent(page)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => { if (!cancelled) setChecked(Boolean(body.allowed)); })
      .catch(() => { if (!cancelled) setChecked(false); });
    return () => { cancelled = true; };
  }, [page]);

  if (checked === null && !allowedPages) return null;          // still resolving
  const allowed = checked === null ? canOpen(page) : checked;
  if (allowed) return children;

  return (
    <main className="flex-1 min-w-0 flex items-center justify-center p-6">
      <div className="rounded-2xl p-10 text-center max-w-md"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="h-12 w-12 rounded-2xl inline-flex items-center justify-center mb-4"
          style={{ background: "var(--col)" }}>
          <Lock size={20} style={{ color: "var(--muted)" }} />
        </span>
        <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>This page is not open to your department</h1>
        <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
          {department ? department.name + " does not have access to this page." : "Your department does not have access to this page."}
          {" "}An admin can grant it in Settings.
        </p>
        <Link href="/dashboard" className="inline-block mt-5 rounded-full px-4 py-2 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg,#FFAA62,#E53E30)", color: "var(--on-accent)" }}>
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
