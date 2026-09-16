"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../auth";
import { Plus, ChevronLeft, Search, Folder, CheckCircle, X, AlertCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";

const STATUS_META = {
  todo: { name: "To Do", color: "#8E8A96", soft: "#ECEBEE" },
  inprogress: { name: "In Progress", color: "#3E8ED0", soft: "#E3EEF9" },
  inreview: { name: "In Review", color: "#E0A93C", soft: "#FAEFD6" },
  done: { name: "Done", color: "#3FA37A", soft: "#DEF1E7" },
};
const ORDER = ["todo", "inprogress", "inreview", "done"];
const PRI = {
  low: { name: "Low", color: "#3FA37A", soft: "#DEF1E7" },
  medium: { name: "Medium", color: "#E0A93C", soft: "#FAEFD6" },
  high: { name: "High", color: "#E5536E", soft: "#FBE1E7" },
};
const PAL = [
  { c: "#7C6FF0", soft: "#ECEAFC" }, { c: "#3E8ED0", soft: "#E3EEF9" }, { c: "#3FA37A", soft: "#DEF1E7" },
  { c: "#E0A93C", soft: "#FAEFD6" }, { c: "#F0784B", soft: "#FCE7DD" }, { c: "#E5536E", soft: "#FBE1E7" },
];
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const projColor = (name) => PAL[hash(name || "x") % PAL.length];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const fromDateInput = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (d) => d ? d.toLocaleDateString("default", { month: "short", day: "numeric" }) : "—";
const isOverdue = (t) => t.due && t.status !== "done" && startOfDay(t.due) < startOfDay(new Date());
const progressFor = (t) => t.progress != null ? t.progress : ({ todo: 0, inprogress: 45, inreview: 85, done: 100 }[t.status] || 0);

function Avatars({ list, size = 20 }) {
  if (!list || !list.length) return null;
  return (
    <div className="flex items-center">
      {list.slice(0, 4).map((m, i) => (
        <span key={i} title={m.name} className="rounded-full flex items-center justify-center font-semibold shrink-0"
          style={{ width: size, height: size, background: m.c, color: "#fff", fontSize: size * 0.42, border: "2px solid var(--card)", marginLeft: i ? -7 : 0 }}>{m.i}</span>
      ))}
      {list.length > 4 && <span className="text-xs ml-1" style={{ color: "var(--muted)" }}>+{list.length - 4}</span>}
    </div>
  );
}

export default function ProjectsPage() {
  const { members } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);   // original name being renamed
  const [nameInput, setNameInput] = useState("");
  const [deleting, setDeleting] = useState(null);  // project stat object
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [actionErr, setActionErr] = useState("");

  const memberByRef = useMemo(() => {
    const map = {};
    for (const m of (members || [])) { if (m.id) map[m.id] = m; if (m.i) map[m.i] = m; }
    return map;
  }, [members]);

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/projects", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { projects: [] })).catch(() => ({ projects: [] })),
      fetch("/api/tasks", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { tasks: [] })).catch(() => ({ tasks: [] })),
    ]).then(([pj, tk]) => {
      setProjects(Array.isArray(pj.projects) ? pj.projects : []);
      setTasks((Array.isArray(tk.tasks) ? tk.tasks : []).map((t) => ({ ...t, start: t.start ? fromDateInput(t.start) : null, due: t.due ? fromDateInput(t.due) : null })));
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => projects.map((name) => {
    const pt = tasks.filter((t) => t.project === name);
    const total = pt.length;
    const done = pt.filter((t) => t.status === "done").length;
    const overdue = pt.filter(isOverdue).length;
    const progress = total ? Math.round(pt.reduce((s, t) => s + progressFor(t), 0) / total) : 0;
    const refs = [...new Set(pt.flatMap((t) => t.assignees || []))];
    const assignees = refs.map((r) => memberByRef[r]).filter(Boolean);
    const status = total === 0 ? "empty" : done === total ? "completed" : "active";
    return { name, total, done, overdue, progress, assignees, status };
  }), [projects, tasks, memberByRef]);

  const counts = useMemo(() => ({
    all: stats.length,
    active: stats.filter((p) => p.status === "active").length,
    completed: stats.filter((p) => p.status === "completed").length,
  }), [stats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stats.filter((p) => (tab === "all" || p.status === tab) && (!q || p.name.toLowerCase().includes(q)));
  }, [stats, tab, query]);

  const saveName = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setBusy(true); setErr("");
    try {
      const res = editing
        ? await fetch("/api/projects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: editing, to: name }) })
        : await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Unable to save project.");
      if (selected && editing && selected === editing) setSelected(name);
      await load();
      setCreating(false); setEditing(null); setNameInput("");
    } catch (e) { setErr(e.message || "Unable to save project."); }
    finally { setBusy(false); }
  };

  const doDelete = async (taskAction) => {
    if (!deleting) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/projects", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: deleting.name, taskAction }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Unable to delete project.");
      if (selected === deleting.name) setSelected(null);
      await load();
      setDeleting(null);
    } catch (e) { setErr(e.message || "Unable to delete project."); }
    finally { setBusy(false); }
  };

  const buildProjectsPayload = () => ({
    projects: filtered.map((p) => ({
      name: p.name, total: p.total, done: p.done, progress: p.progress, overdue: p.overdue, status: p.status,
      color: projColor(p.name).c,
      assignees: (p.assignees || []).map((m) => ({ i: m.i, c: m.c })),
    })),
  });

  const exportProjectsPng = async () => {
    try {
      setActionErr("");
      const res = await fetch("/api/projects-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildProjectsPayload()) });
      if (!res.ok) throw new Error("Unable to render projects image.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "sdc-projects.png";
      link.href = url; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setActionErr(e.message || "Unable to export projects image."); }
  };

  const sendProjectsToLark = async () => {
    try {
      setActionErr("");
      const res = await fetch("/api/lark/projects-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildProjectsPayload()) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to send projects to Lark.");
    } catch (e) { setActionErr(e.message || "Unable to send to Lark"); }
  };

  // ---------------- detail view ----------------
  if (selected) {
    const p = stats.find((x) => x.name === selected) || { name: selected, total: 0, done: 0, overdue: 0, progress: 0, assignees: [] };
    const pt = tasks.filter((t) => t.project === selected);
    return (
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <header className="px-4 sm:px-7 pt-6 pb-4 shrink-0">
          <button onClick={() => setSelected(null)} className="db-ib flex items-center gap-1.5 text-sm mb-3 rounded-lg pr-2 py-1" style={{ color: "var(--text-2)" }}>
            <ChevronLeft size={16} /> All projects
          </button>
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: projColor(p.name).c }}><Folder size={20} className="text-white" /></span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight truncate" style={{ color: "var(--text)" }}>{p.name}</h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{p.total} tasks · {p.done} done{p.overdue ? ` · ${p.overdue} overdue` : ""}</p>
            </div>
          </div>
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--muted)" }}><span>Overall progress</span><span>{p.progress}%</span></div>
            <div className="rounded-full overflow-hidden" style={{ height: 7, background: "var(--grid)" }}><div style={{ width: `${p.progress}%`, height: "100%", background: "#3FA37A" }} /></div>
          </div>
        </header>

        <div className="px-4 sm:px-7 pb-8 flex flex-col gap-5">
          {pt.length === 0 && <p className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>No tasks in this project yet.</p>}
          {ORDER.map((sid) => {
            const items = pt.filter((t) => t.status === sid);
            if (!items.length) return null;
            const s = STATUS_META[sid];
            return (
              <div key={sid}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.name}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--col)", color: "var(--text-2)" }}>{items.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((t) => {
                    const pr = PRI[t.priority] || PRI.medium; const od = isOverdue(t);
                    const who = (t.assignees || []).map((r) => memberByRef[r]).filter(Boolean);
                    return (
                      <div key={t.id} className="rounded-xl p-3.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: pr.soft, color: pr.color }}>{pr.name}</span>
                              {od && <span className="text-xs font-semibold" style={{ color: "#E5536E" }}>Overdue</span>}
                            </div>
                            <p className="font-medium" style={{ color: "var(--text)" }}>{t.title}</p>
                            {t.desc && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{t.desc}</p>}
                          </div>
                          <div className="text-xs shrink-0" style={{ color: od ? "#E5536E" : "var(--muted)" }}>{fmtDate(t.due)}</div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <Avatars list={who} size={20} />
                          <div className="flex items-center gap-2 w-32">
                            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: "var(--grid)" }}><div style={{ width: `${progressFor(t)}%`, height: "100%", background: s.color }} /></div>
                            <span className="text-xs" style={{ color: "var(--muted)" }}>{progressFor(t)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    );
  }

  // ---------------- overview ----------------
  return (
    <>
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <header className="flex items-center gap-3 px-4 sm:px-7 pt-6 pb-4 shrink-0 flex-wrap">
          <div className="mr-auto">
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Projects</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>{stats.length} projects across the team</p>
            {actionErr && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{actionErr}</p>}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects"
              className="pl-8 pr-3 py-2 text-sm rounded-full outline-none shadow-sm w-44" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={exportProjectsPng} className="tp-ib rounded-full px-3.5 py-2 text-sm font-medium shadow-sm" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>🖼️ Export PNG</button>
            <button onClick={sendProjectsToLark} className="tp-ib rounded-full px-3.5 py-2 text-sm font-medium shadow-sm" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>📤 Send to Lark</button>
          </div>
          <button onClick={() => { setEditing(null); setNameInput(""); setErr(""); setCreating(true); }} className="tp-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
            <Plus size={17} /> Create Project
          </button>
        </header>

        <div className="px-4 sm:px-7 pb-3 flex items-center gap-2 shrink-0 flex-wrap">
          {[["all", "All"], ["active", "Active"], ["completed", "Completed"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium"
              style={tab === id ? { background: ACCENT_GRAD, color: ON_ACCENT } : { background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
              {label}<span className="text-xs" style={{ opacity: 0.8 }}>{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="px-4 sm:px-7 pb-8">
          {filtered.length === 0 ? (
            <p className="text-sm py-12 text-center" style={{ color: "var(--muted)" }}>No projects here yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {filtered.map((p) => {
                const pc = projColor(p.name);
                return (
                  <div key={p.name} onClick={() => setSelected(p.name)} role="button" tabIndex={0} className="tp-card relative rounded-2xl p-5 cursor-pointer" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: pc.c }}><Folder size={19} className="text-white" /></span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: p.status === "completed" ? STATUS_META.done.soft : p.status === "empty" ? "var(--col)" : STATUS_META.inprogress.soft, color: p.status === "completed" ? STATUS_META.done.color : p.status === "empty" ? "var(--muted)" : STATUS_META.inprogress.color }}>
                          {p.status === "completed" ? "Completed" : p.status === "empty" ? "No tasks" : "Active"}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === p.name ? null : p.name); }} aria-label="Project options" className="db-ib h-7 w-7 flex items-center justify-center rounded-full" style={{ color: "var(--muted)" }}><MoreHorizontal size={16} /></button>
                      </div>
                    </div>
                    <p className="font-semibold truncate" style={{ color: "var(--text)", fontSize: 16 }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{p.total} task{p.total === 1 ? "" : "s"} · {p.done} done</p>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--muted)" }}><span>Progress</span><span>{p.progress}%</span></div>
                      <div className="rounded-full overflow-hidden" style={{ height: 6, background: "var(--grid)" }}><div style={{ width: `${p.progress}%`, height: "100%", background: "#3FA37A" }} /></div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <Avatars list={p.assignees} size={22} />
                      {p.overdue > 0 ? (
                        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#E5536E" }}><AlertCircle size={13} />{p.overdue} overdue</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}><CheckCircle size={13} />{p.done}/{p.total}</span>
                      )}
                    </div>

                    {menuFor === p.name && (
                      <div className="absolute right-4 z-20 rounded-xl shadow-2xl py-1 overflow-hidden" style={{ top: 52, minWidth: 150, background: "var(--card)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setMenuFor(null); setEditing(p.name); setNameInput(p.name); setErr(""); }} className="db-row w-full flex items-center gap-2 px-3 py-2 text-sm text-left" style={{ color: "var(--text)" }}><Pencil size={14} /> Rename</button>
                        <button onClick={() => { setMenuFor(null); setErr(""); setDeleting(p); }} className="db-row w-full flex items-center gap-2 px-3 py-2 text-sm text-left" style={{ color: "#E5536E" }}><Trash2 size={14} /> Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {menuFor && <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />}

      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,26,0.4)" }} onClick={() => !busy && (setCreating(false), setEditing(null))}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>{editing ? "Rename project" : "New project"}</h3>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="db-ib h-8 w-8 flex items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}><X size={18} /></button>
            </div>
            <div className="p-5">
              <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                placeholder="Project name" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
              {editing && <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>Tasks in this project will be updated to the new name.</p>}
              {err && <p className="text-xs mt-2" style={{ color: "#E5536E" }}>{err}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="db-ib text-sm px-4 py-2 rounded-full" style={{ color: "var(--text-2)" }}>Cancel</button>
              <button onClick={saveName} disabled={!nameInput.trim() || busy} className="tp-pill text-sm px-5 py-2 rounded-full font-medium shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT, opacity: (!nameInput.trim() || busy) ? 0.6 : 1 }}>{editing ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,26,0.4)" }} onClick={() => !busy && setDeleting(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>Delete “{deleting.name}”?</h3>
            </div>
            <div className="p-5">
              {deleting.total > 0 ? (
                <>
                  <p className="text-sm mb-3" style={{ color: "var(--text-2)" }}>This project has {deleting.total} task{deleting.total === 1 ? "" : "s"}. What should happen to {deleting.total === 1 ? "it" : "them"}?</p>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => doDelete("unlabel")} disabled={busy} className="db-row w-full text-left rounded-lg px-3 py-2.5 text-sm" style={{ border: "1px solid var(--border)", color: "var(--text)" }}>
                      <span className="font-medium">Keep the tasks</span> — just remove the project label
                    </button>
                    <button onClick={() => doDelete("delete")} disabled={busy} className="db-row w-full text-left rounded-lg px-3 py-2.5 text-sm" style={{ border: "1px solid #E5536E33", color: "#E5536E" }}>
                      <span className="font-medium">Delete the {deleting.total} task{deleting.total === 1 ? "" : "s"} too</span> — this can’t be undone
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-2)" }}>This project has no tasks. Delete it?</p>
              )}
              {err && <p className="text-xs mt-3" style={{ color: "#E5536E" }}>{err}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setDeleting(null)} className="db-ib text-sm px-4 py-2 rounded-full" style={{ color: "var(--text-2)" }}>Cancel</button>
              {deleting.total === 0 && (
                <button onClick={() => doDelete("keep")} disabled={busy} className="text-sm px-5 py-2 rounded-full font-medium shadow-md text-white" style={{ background: "#E5536E", opacity: busy ? 0.6 : 1 }}>Delete</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
