"use client";

import PageAccess from "../PageAccess";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../auth";
import {
  Archive, Search, RotateCcw, Clock, Folder, CalendarDays, Trash2, X,
} from "lucide-react";

const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";

const DEFAULT_STATUSES = [
  { id: "todo",       name: "To Do",       color: "#8E8A96", soft: "#ECEBEE" },
  { id: "inprogress", name: "In Progress", color: "#3E8ED0", soft: "#E3EEF9" },
  { id: "inreview",   name: "In Review",   color: "#E0A93C", soft: "#FAEFD6" },
  { id: "revision",   name: "Revision",    color: "#7C5CD8", soft: "#EBE4FA" },
  { id: "done",       name: "Done",        color: "#3FA37A", soft: "#DEF1E7" },
];
const PRIORITIES = {
  low:    { name: "Low",    color: "#3FA37A", soft: "#DEF1E7" },
  medium: { name: "Medium", color: "#E0A93C", soft: "#FAEFD6" },
  high:   { name: "High",   color: "#E5536E", soft: "#FBE1E7" },
};

/* ---------- date helpers (local wall-clock, i.e. Manila on the team's machines) ---------- */
const pad = (n) => String(n).padStart(2, "0");
const fromDateInput = (s) => { if (!s) return null; const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const dayKey = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
const monthKey = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : "");
const fmtDayLong = (d) => d.toLocaleDateString("default", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtMonthLong = (d) => d.toLocaleDateString("default", { month: "long", year: "numeric" });
const fmtTime = (d) => d.toLocaleTimeString("default", { hour: "numeric", minute: "2-digit" });

/* A task's archive date: when it was completed, falling back to its dates. */
function taskDate(task) {
  if (task.doneAt) return new Date(Number(task.doneAt));
  if (task.due) return task.due instanceof Date ? task.due : fromDateInput(task.due);
  if (task.start) return task.start instanceof Date ? task.start : fromDateInput(task.start);
  return null;
}

function ArchivePageInner() {
  const { members } = useAuth();
  const memberByRef = useMemo(() => {
    const map = {};
    (members || []).forEach((m) => { map[m.id] = m; map[m.i] = m; });
    return map;
  }, [members]);

  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const hydrate = useCallback((items = []) => items.map((t) => ({
    ...t,
    start: t.start ? fromDateInput(t.start) : null,
    due: t.due ? fromDateInput(t.due) : null,
    assignees: Array.isArray(t.assignees) ? t.assignees : [],
    tags: Array.isArray(t.tags) ? t.tags : [],
  })), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load archived tasks.");
      const body = await res.json();
      setTasks(hydrate(Array.isArray(body.tasks) ? body.tasks : []));
      setError("");
    } catch (e) {
      setError(e.message || "Unable to load archived tasks.");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    load();
    fetch("/api/statuses", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { statuses: DEFAULT_STATUSES }))
      .then((b) => setStatuses(Array.isArray(b.statuses) && b.statuses.length ? b.statuses : DEFAULT_STATUSES))
      .catch(() => {});
  }, [load]);

  const statusOf = useCallback(
    (id) => statuses.find((s) => s.id === id) || { id, name: id || "Unknown", color: "#8E8A96", soft: "#ECEBEE" },
    [statuses]
  );

  const archived = useMemo(() => {
    return tasks
      .filter((t) => t.archived)
      .map((t) => ({ ...t, _date: taskDate(t) }))
      .sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0));
  }, [tasks]);

  /* ---------- filter option lists, built from what's actually archived ---------- */
  const months = useMemo(() => {
    const seen = new Map();
    archived.forEach((t) => {
      if (!t._date) return;
      const key = monthKey(t._date);
      if (!seen.has(key)) seen.set(key, { key, label: fmtMonthLong(t._date), count: 0 });
      seen.get(key).count += 1;
    });
    return [...seen.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [archived]);

  const days = useMemo(() => {
    const seen = new Map();
    archived.forEach((t) => {
      if (!t._date) return;
      if (monthFilter !== "all" && monthKey(t._date) !== monthFilter) return;
      const key = dayKey(t._date);
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          label: t._date.toLocaleDateString("default", { day: "numeric", month: "short" }),
          count: 0,
        });
      }
      seen.get(key).count += 1;
    });
    return [...seen.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [archived, monthFilter]);

  const projects = useMemo(() => {
    const seen = new Set();
    archived.forEach((t) => { if (t.project) seen.add(t.project); });
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [archived]);

  const statusesPresent = useMemo(() => {
    const counts = {};
    archived.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return statuses.filter((s) => counts[s.id]).map((s) => ({ ...s, count: counts[s.id] }));
  }, [archived, statuses]);

  // A day selection stops making sense once the month changes under it.
  useEffect(() => {
    if (dayFilter !== "all" && !days.some((d) => d.key === dayFilter)) setDayFilter("all");
  }, [days, dayFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return archived.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (projectFilter !== "all" && t.project !== projectFilter) return false;
      if (monthFilter !== "all" && (!t._date || monthKey(t._date) !== monthFilter)) return false;
      if (dayFilter !== "all" && (!t._date || dayKey(t._date) !== dayFilter)) return false;
      if (!q) return true;
      return (
        String(t.title || "").toLowerCase().includes(q) ||
        String(t.project || "").toLowerCase().includes(q) ||
        (t.tags || []).some((g) => String(g).toLowerCase().includes(q))
      );
    });
  }, [archived, query, statusFilter, projectFilter, monthFilter, dayFilter]);

  /* ---------- group the filtered rows by day ---------- */
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((t) => {
      const key = t._date ? dayKey(t._date) : "undated";
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: t._date ? fmtDayLong(t._date) : "No date recorded",
          items: [],
        });
      }
      map.get(key).items.push(t);
    });
    return [...map.values()].sort((a, b) => {
      if (a.key === "undated") return 1;
      if (b.key === "undated") return -1;
      return b.key.localeCompare(a.key);
    });
  }, [filtered]);

  const thisMonthCount = useMemo(() => {
    const now = monthKey(new Date());
    return archived.filter((t) => t._date && monthKey(t._date) === now).length;
  }, [archived]);

  const filtersOn = statusFilter !== "all" || monthFilter !== "all" || dayFilter !== "all" || projectFilter !== "all" || query.trim();
  const clearFilters = () => {
    setStatusFilter("all"); setMonthFilter("all"); setDayFilter("all"); setProjectFilter("all"); setQuery("");
  };

  const restore = async (task) => {
    if (busyId) return;
    setBusyId(task.id);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, data: { archived: false } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unable to restore task.");
      }
      const body = await res.json();
      setTasks(hydrate(Array.isArray(body.tasks) ? body.tasks : []));
    } catch (e) {
      setError(e.message || "Unable to restore task.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (task) => {
    if (busyId) return;
    if (!window.confirm(`Delete "${task.title}" permanently? This cannot be undone.`)) return;
    setBusyId(task.id);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Unable to delete task.");
      }
      const body = await res.json();
      setTasks(hydrate(Array.isArray(body.tasks) ? body.tasks : []));
    } catch (e) {
      setError(e.message || "Unable to delete task.");
    } finally {
      setBusyId(null);
    }
  };

  const selectStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
      {/* toolbar */}
      <header className="flex items-center gap-3 px-4 sm:px-7 pt-6 pb-4 shrink-0 flex-wrap">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Archive</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Completed work, cleared from the board every Monday</p>
          {error && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{error}</p>}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search archive"
            className="pl-8 pr-3 py-2 text-sm rounded-full outline-none shadow-sm w-52"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
        </div>
        {filtersOn ? (
          <button onClick={clearFilters}
            className="tp-ib rounded-full px-3.5 py-2 text-sm font-medium shadow-sm inline-flex items-center gap-1.5"
            style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
            <X size={15} /> Clear filters
          </button>
        ) : null}
      </header>

      {/* stat cards */}
      <div className="px-4 sm:px-7 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <StatCard icon={Archive} tint="#F26A3C" soft="#FCE3D6" label="Archived" value={archived.length} note="all time" />
        <StatCard icon={CalendarDays} tint="#3E8ED0" soft="#E3EEF9" label="This month" value={thisMonthCount} note={fmtMonthLong(new Date())} />
        <StatCard icon={Folder} tint="#7C5CD8" soft="#EBE4FA" label="Projects" value={projects.length} note="represented" />
        <StatCard icon={Clock} tint="#3FA37A" soft="#DEF1E7" label="Showing" value={filtered.length} note={filtersOn ? "after filters" : "no filters"} />
      </div>

      {/* filters */}
      <div className="px-4 sm:px-7 pb-4 shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}
            label="All statuses" count={archived.length} />
          {statusesPresent.map((s) => (
            <FilterChip key={s.id} active={statusFilter === s.id} onClick={() => setStatusFilter(s.id)}
              label={s.name} count={s.count} dot={s.color} />
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-full px-3 py-2 text-sm outline-none shadow-sm" style={selectStyle}>
            <option value="all">All months</option>
            {months.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.count})</option>)}
          </select>
          <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}
            className="rounded-full px-3 py-2 text-sm outline-none shadow-sm" style={selectStyle}>
            <option value="all">All dates</option>
            {days.map((d) => <option key={d.key} value={d.key}>{d.label} ({d.count})</option>)}
          </select>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-full px-3 py-2 text-sm outline-none shadow-sm" style={selectStyle}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* body */}
      <div className="px-4 sm:px-7 pb-6 flex flex-col gap-5">
        {loading ? (
          <EmptyState text="Loading archive…" />
        ) : !archived.length ? (
          <EmptyState text="Nothing archived yet. Completed tasks land here every Monday." />
        ) : !filtered.length ? (
          <EmptyState text="No archived tasks match these filters." />
        ) : (
          groups.map((g) => (
            <section key={g.key}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{g.label}</h2>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--col)", color: "var(--text-2)" }}>{g.items.length}</span>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-sm"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {g.items.map((t, i) => {
                  const st = statusOf(t.status);
                  const pr = PRIORITIES[t.priority] || PRIORITIES.medium;
                  const people = (t.assignees || []).map((ref) => memberByRef[ref]).filter(Boolean);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                      style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                      <div className="min-w-0 flex-1" style={{ minWidth: 200 }}>
                        <p className="font-medium text-sm truncate" style={{ color: "var(--text)" }}>{t.title}</p>
                        <p className="text-xs truncate" style={{ color: "var(--muted)" }}>
                          {t.project || "—"}
                          {t._date ? ` · ${t.doneAt ? fmtTime(t._date) : "no time recorded"}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold shrink-0"
                        style={{ background: st.soft, color: st.color }}>{st.name}</span>
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold shrink-0"
                        style={{ background: pr.soft, color: pr.color }}>{pr.name}</span>
                      <div className="flex items-center shrink-0">
                        {people.slice(0, 4).map((m, idx) => (
                          <span key={m.id || idx} title={m.name}
                            className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
                            style={{ height: 22, width: 22, fontSize: 10, background: m.c, marginLeft: idx ? -6 : 0, border: "2px solid var(--card)" }}>
                            {m.i}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => restore(t)} disabled={busyId === t.id} title="Restore to the board"
                          className="tp-ib rounded-full px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                          style={{ background: "var(--dim)", color: "var(--text-2)" }}>
                          <RotateCcw size={14} /> Restore
                        </button>
                        <button onClick={() => remove(t)} disabled={busyId === t.id} title="Delete permanently"
                          className="tp-ib rounded-full h-8 w-8 inline-flex items-center justify-center disabled:opacity-50"
                          style={{ color: "#E5536E" }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}

function StatCard({ icon: Icon, tint, soft, label, value, note }) {
  return (
    <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: soft }}><Icon size={16} style={{ color: tint }} /></span>
        <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>{label}</span>
      </div>
      <div className="text-3xl font-semibold" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{note}</div>
    </div>
  );
}

function FilterChip({ active, onClick, label, count, dot }) {
  return (
    <button onClick={onClick}
      className="tp-ib rounded-full px-3 py-1.5 text-sm font-medium shadow-sm inline-flex items-center gap-1.5"
      style={active
        ? { background: ACCENT_GRAD, color: ON_ACCENT }
        : { background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
      {dot && !active ? <span className="h-2 w-2 rounded-full" style={{ background: dot }} /> : null}
      {label}
      <span className="text-xs font-semibold" style={{ opacity: 0.75 }}>{count}</span>
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl py-16 text-center shadow-sm"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}>
      <Archive size={28} className="mx-auto mb-3" style={{ opacity: 0.5 }} />
      <p className="text-sm">{text}</p>
    </div>
  );
}


export default function ArchivePage(props) {
  return (
    <PageAccess page="tasks">
      <ArchivePageInner {...props} />
    </PageAccess>
  );
}
