"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Lock, Users } from "lucide-react";
import PageAccess from "../PageAccess";

const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const SWATCHES = ["#7C6FF0", "#3E8ED0", "#3FA37A", "#E0A93C", "#F0784B", "#E5536E", "#2E9B8F", "#8E8A96"];

function SettingsInner() {
  const [departments, setDepartments] = useState([]);
  const [pages, setPages] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [newName, setNewName] = useState("");

  const apply = (body) => {
    setDepartments(body.departments || []);
    setPages(body.pages || []);
    setCounts(body.counts || {});
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/departments", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load departments.");
      apply(body);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (method, payload) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/departments", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "That did not save.");
      apply(body);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Always-on and admin-only pages are fixed, so no change here can lock anyone out.
  const isFixed = (page) => page.always || page.adminOnly;
  const can = (dept, page) =>
    page.always ? true : page.adminOnly ? Boolean(dept.admin) : dept.pages.includes(page.id);

  const togglePage = (dept, page) => {
    if (isFixed(page) || busy) return;
    const next = dept.pages.includes(page.id)
      ? dept.pages.filter((p) => p !== page.id)
      : [...dept.pages, page.id];
    act("PATCH", { id: dept.id, pages: next });
  };

  const switchStyle = (on) => ({
    height: 26, width: 46, borderRadius: 999, position: "relative",
    border: on ? "1px solid transparent" : "1px solid var(--border)",
    background: on ? ACCENT : "var(--col)",
  });

  return (
    <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
      <header className="px-4 sm:px-7 pt-6 pb-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Settings</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Departments, and which pages each one can open
        </p>
        {error && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{error}</p>}
      </header>

      <div className="px-4 sm:px-7 pb-8 flex flex-col gap-4" style={{ maxWidth: 980 }}>
        <section className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Departments</h2>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            A member belongs to one. A department with members cannot be removed.
          </p>

          {loading ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
          ) : departments.map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-2 flex-wrap"
              style={{ background: "var(--col)", border: "1px solid var(--border)" }}>
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />

              {renaming === d.id ? (
                <input value={draftName} onChange={(e) => setDraftName(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  onBlur={async () => {
                    if (draftName.trim() && draftName !== d.name) await act("PATCH", { id: d.id, name: draftName });
                    setRenaming(null);
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-sm outline-none"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", width: 190 }} />
              ) : (
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{d.name}</span>
              )}

              {d.admin && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: "#FCE3D6", color: "#F26A3C" }}>Admin</span>
              )}
              <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
                <Users size={12} /> {counts[d.id] || 0}
              </span>

              <div className="flex gap-1.5 ml-auto flex-wrap">
                <button disabled={busy} onClick={() => { setRenaming(d.id); setDraftName(d.name); }}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>Rename</button>
                <button disabled={busy}
                  onClick={() => act("PATCH", { id: d.id, color: SWATCHES[(SWATCHES.indexOf(d.color) + 1) % SWATCHES.length] })}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>Color</button>
                <button disabled={busy} onClick={() => act("PATCH", { id: d.id, admin: !d.admin })}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>
                  {d.admin ? "Remove admin" : "Make admin"}
                </button>
                <button disabled={busy} onClick={() => act("DELETE", { id: d.id })}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ border: "1px solid var(--border)", color: "#E5536E" }}>Remove</button>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-3 flex-wrap">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="New department, e.g. Warehouse"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newName.trim() && await act("POST", { name: newName })) setNewName("");
              }}
              className="rounded-xl px-3 py-2.5 text-sm outline-none flex-1"
              style={{ background: "var(--col)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 200 }} />
            <button disabled={busy || !newName.trim()}
              onClick={async () => { if (await act("POST", { name: newName })) setNewName(""); }}
              className="rounded-full px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              style={{ background: ACCENT, color: "var(--on-accent)" }}>
              <Plus size={15} /> Add department
            </button>
          </div>
        </section>

        <section className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Page access</h2>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            Switching a page off hides it from the sidebar and refuses it if the URL is typed directly.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th className="text-left px-2.5 py-2.5 text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>Page</th>
                  {departments.map((d) => (
                    <th key={d.id} className="text-left px-2.5 py-2.5 text-[10px] uppercase tracking-wider font-semibold"
                      style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>{d.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td className="px-2.5 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{page.name}</span>
                      <span className="block text-xs" style={{ color: "var(--muted)" }}>{page.note}</span>
                    </td>
                    {departments.map((d) => {
                      const on = can(d, page);
                      const fixed = isFixed(page);
                      return (
                        <td key={d.id} className="px-2.5 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                          <button type="button" disabled={fixed || busy} onClick={() => togglePage(d, page)}
                            style={{ ...switchStyle(on), opacity: fixed ? 0.45 : 1, cursor: fixed ? "not-allowed" : "pointer" }}>
                            <span style={{
                              position: "absolute", top: 2, left: 2, height: 20, width: 20, borderRadius: 999,
                              background: on ? "#fff" : "var(--faint)",
                              transform: on ? "translateX(20px)" : "none", transition: "transform .12s",
                            }} />
                          </button>
                          {fixed && (
                            <span className="block text-[10px] mt-1" style={{ color: "var(--faint)" }}>
                              {page.always ? "always on" : "admin only"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs mt-3 inline-flex items-start gap-1.5" style={{ color: "var(--faint)" }}>
            <Lock size={12} style={{ marginTop: 2 }} />
            Settings follows the Admin flag and Dashboard stays on for everyone, so no change here can lock anyone out.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <PageAccess page="settings">
      <SettingsInner />
    </PageAccess>
  );
}
