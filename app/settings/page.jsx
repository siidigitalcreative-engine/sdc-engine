"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Lock, Users } from "lucide-react";
import PageAccess from "../PageAccess";

const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const SWATCHES = ["#7C6FF0", "#3E8ED0", "#3FA37A", "#E0A93C", "#F0784B", "#E5536E", "#2E9B8F", "#8E8A96"];
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238C8398' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`;


function SettingsInner() {
  const [departments, setDepartments] = useState([]);
  const [pages, setPages] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [app, setApp] = useState({ name: "SDC", tagline: "Creative team", signInTitle: "", signInSubtitle: "" });
  const [allMembers, setAllMembers] = useState([]);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [newName, setNewName] = useState("");
  const [members, setMembers] = useState([]);
  const [expanded, setExpanded] = useState(null);

  const apply = (body) => {
    setDepartments(body.departments || []);
    setPages(body.pages || []);
    setCounts(body.counts || {});
  };

  const load = useCallback(async () => {
    try {
      const [res, memberRes, appRes] = await Promise.all([
        fetch("/api/departments", { cache: "no-store" }),
        // every department's people, so roles can be set from one place
        fetch("/api/members?all=1", { cache: "no-store" }),
        fetch("/api/app-settings", { cache: "no-store" }),
      ]);
      const appBody = await appRes.json().catch(() => ({}));
      if (appBody?.settings) setApp(appBody.settings);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load departments.");
      apply(body);
      const memberBody = await memberRes.json().catch(() => ({}));
      const list = Array.isArray(memberBody.members) ? memberBody.members : [];
      setMembers(list);
      setAllMembers(list);
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

  const saveApp = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/app-settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(app),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to save the name.");
      setApp(body.settings);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Changing what a member may do, from any department.
  const setMemberField = async (memberId, patch) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/members", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId, data: patch }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to save that member.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Moving someone between departments from this side; the member form does
  // the same thing from the other side.
  const moveMember = async (memberId, departmentId) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/members", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId, data: { department: departmentId } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to move that member.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const membersIn = (deptId) => members.filter((m) => (m.department || departments[0]?.id) === deptId);

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
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Workspace</h2>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            The name in the sidebar and on the sign-in screen.
          </p>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <label className="block text-xs" style={{ color: "var(--text-2)" }}>
              <span className="block mb-1">Name</span>
              <input value={app.name} maxLength={40} onChange={(e) => setApp({ ...app, name: e.target.value })}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--col)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </label>
            <label className="block text-xs" style={{ color: "var(--text-2)" }}>
              <span className="block mb-1">Tagline</span>
              <input value={app.tagline} maxLength={60} onChange={(e) => setApp({ ...app, tagline: e.target.value })}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--col)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </label>
            <label className="block text-xs" style={{ color: "var(--text-2)" }}>
              <span className="block mb-1">Sign-in subtitle</span>
              <input value={app.signInSubtitle} maxLength={120} onChange={(e) => setApp({ ...app, signInSubtitle: e.target.value })}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--col)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </label>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button disabled={busy} onClick={saveApp}
              className="rounded-full px-4 py-2.5 text-sm font-semibold"
              style={{ background: ACCENT, color: "var(--on-accent)" }}>Save name</button>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              The sign-in screen shows “{app.signInTitle || `Welcome to ${app.name}`}”.
            </span>
          </div>
        </section>
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
                <button disabled={busy} onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>
                  {expanded === d.id ? "Hide members" : "Members"}
                </button>
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

              {expanded === d.id && (
                <div className="w-full mt-1 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex flex-wrap gap-2 mb-2.5">
                    {membersIn(d.id).length ? membersIn(d.id).map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1"
                        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                        <span className="h-6 w-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: m.c }}>{m.i}</span>
                        <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{m.name}</span>
                      </span>
                    )) : (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>No one in this department yet.</span>
                    )}
                  </div>

                  <select value="" disabled={busy}
                    onChange={(e) => { if (e.target.value) moveMember(e.target.value, d.id); }}
                    className="rounded-xl px-3 py-2 text-xs outline-none"
                    style={{
                      background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)",
                      WebkitAppearance: "none", MozAppearance: "none", appearance: "none",
                      backgroundImage: CHEVRON, backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center", paddingRight: 34,
                    }}>
                    <option value="">Move someone into {d.name}…</option>
                    {members.filter((m) => (m.department || departments[0]?.id) !== d.id).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — currently {(departments.find((x) => x.id === (m.department || departments[0]?.id))?.name) || "unassigned"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>People and roles</h2>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            Everyone in every department. Change a department or an access level here.
          </p>

          {departments.map((d) => {
            const people = allMembers.filter((m) => (m.department || departments[0]?.id) === d.id);
            if (!people.length) return (
              <div key={d.id} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{d.name}</span>
                </div>
                <p className="text-xs ml-4.5" style={{ color: "var(--muted)" }}>No one here yet.</p>
              </div>
            );
            return (
              <div key={d.id} className="mb-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{d.name}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{people.length}</span>
                </div>

                {people.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-xl px-2.5 py-2 mb-1.5 flex-wrap"
                    style={{ background: "var(--col)", border: "1px solid var(--border)" }}>
                    <span className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
                      style={{ height: 26, width: 26, fontSize: 10, background: m.c }}>{m.i}</span>
                    <span className="text-sm font-medium min-w-0 truncate" style={{ color: "var(--text)" }}>{m.name}</span>
                    <span className="text-xs truncate" style={{ color: "var(--muted)" }}>{m.role}</span>

                    <div className="flex gap-1.5 ml-auto flex-wrap">
                      <select value={m.department || departments[0]?.id || ""} disabled={busy}
                        onChange={(e) => setMemberField(m.id, { department: e.target.value })}
                        className="rounded-full px-3 py-1.5 text-xs outline-none"
                        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
                        {departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>

                      <select value={m.accessLevel || "member"} disabled={busy}
                        onChange={(e) => setMemberField(m.id, { accessLevel: e.target.value })}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold outline-none"
                        style={{
                          background: m.accessLevel === "admin" ? "#FCE3D6" : m.accessLevel === "hod" ? "#E3EEF9" : "var(--card)",
                          color: m.accessLevel === "admin" ? "#F26A3C" : m.accessLevel === "hod" ? "#3E8ED0" : "var(--text-2)",
                          border: "1px solid var(--border)",
                        }}>
                        <option value="admin">Management / Admin / HOD Admin</option>
                        <option value="hod">HOD</option>
                        <option value="member">Member</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>
            Management, Admin and HOD Admin see every department and can switch the view. HOD and Member see only their own.
          </p>
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
