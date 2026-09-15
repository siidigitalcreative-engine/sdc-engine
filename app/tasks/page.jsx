"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "../auth";
import {
  LayoutGrid, Calendar, CheckSquare, Folder, Users, BarChart, Settings,
  Plus, X, Search, Paperclip, Clock, Flag, Trash2, Tag, Sparkles, List, MoreHorizontal,
  Moon, Sun,
} from "lucide-react";

/* ---------- theme ---------- */
const CANVAS = "var(--surface)";
const SIDEBAR = "var(--sidebar)";
const ACCENT = "#F26A3C";
const ON_ACCENT = "var(--on-accent)";
const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const PAGE_BG = "var(--page)";
const ME = { i: "CN", name: "Che Navarro", role: "Digital Creative", c: "#7C6FF0" };

const STATUSES = [
  { id: "todo",       name: "To Do",       color: "#8E8A96", soft: "#ECEBEE" },
  { id: "inprogress", name: "In Progress", color: "#3E8ED0", soft: "#E3EEF9" },
  { id: "inreview",   name: "In Review",   color: "#E0A93C", soft: "#FAEFD6" },
  { id: "done",       name: "Done",        color: "#3FA37A", soft: "#DEF1E7" },
];
const PRIORITIES = [
  { id: "low",    name: "Low",    color: "#3FA37A", soft: "#DEF1E7" },
  { id: "medium", name: "Medium", color: "#E0A93C", soft: "#FAEFD6" },
  { id: "high",   name: "High",   color: "#E5536E", soft: "#FBE1E7" },
];
const PROJECTS = ["Quencha", "CRYSALIS", "Website Revamp", "FITSPIRE", "SCRUBZ", "Sunbeams Lifestyle", "PRIMEO", "Nest Design Lab", "Daily Tasks"];
const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];
const priorityOf = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[0];

/* ---------- helpers ---------- */
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dOff = (n) => { const d = startOfDay(new Date()); d.setDate(d.getDate() + n); return d; };
const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (d) => d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
const fromDateInput = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (d) => d ? d.toLocaleDateString("default", { month: "short", day: "numeric" }) : "—";
const isOverdue = (t) => t.due && t.status !== "done" && startOfDay(t.due) < startOfDay(new Date());
const formatBytes = (b) => { if (!b) return "0 KB"; const kb = b / 1024; return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`; };
const progressFor = (t) => t.progress != null ? t.progress : ({ todo: 0, inprogress: 45, inreview: 85, done: 100 }[t.status] || 0);

/* ---------- seed ---------- */
const SEED = [
  { id: 1, title: "Wireframe Quencha PDP", project: "Quencha", desc: "Two-column layout with sticky add-to-cart", status: "inprogress", priority: "high", assignees: ["CN", "RG"], start: dOff(-1), due: dOff(2), time: "", tags: ["web", "ux"], attachments: [{ name: "pdp-wireframe.fig", size: 2415000 }], progress: 45 },
  { id: 2, title: "Update brand colors — CRYSALIS", project: "CRYSALIS", desc: "Apply rebrand palette across the catalog", status: "todo", priority: "medium", assignees: ["MA"], start: dOff(0), due: dOff(4), time: "", tags: ["brand"], attachments: [], progress: 0 },
  { id: 3, title: "Checkout flow redesign", project: "Website Revamp", desc: "Reduce checkout from 4 steps to 2", status: "inreview", priority: "high", assignees: ["CN", "JL", "SP"], start: dOff(-4), due: dOff(1), time: "14:00", tags: ["web", "cro"], attachments: [{ name: "flow.pdf", size: 530000 }, { name: "specs.docx", size: 82000 }], progress: 85 },
  { id: 4, title: "Reel edits — FITSPIRE", project: "FITSPIRE", desc: "Three reels for launch week", status: "done", priority: "low", assignees: ["SP"], start: dOff(-6), due: dOff(-2), time: "", tags: ["content"], attachments: [], progress: 100 },
  { id: 5, title: "Email template QA", project: "Daily Tasks", desc: "Check rendering in Outlook and mobile", status: "inreview", priority: "medium", assignees: ["RG"], start: dOff(-2), due: dOff(0), time: "", tags: ["email", "qa"], attachments: [], progress: 80 },
  { id: 6, title: "Product shoot — SCRUBZ", project: "SCRUBZ", desc: "Studio booking and shot list", status: "todo", priority: "medium", assignees: ["RG", "SP"], start: dOff(1), due: dOff(5), time: "09:00", tags: ["shoot"], attachments: [], progress: 0 },
  { id: 7, title: "Design system audit", project: "Sunbeams Lifestyle", desc: "Consolidate button and form tokens", status: "inprogress", priority: "medium", assignees: ["CN", "MA"], start: dOff(-3), due: dOff(3), time: "", tags: ["design", "system"], attachments: [{ name: "audit.xlsx", size: 120000 }], progress: 50 },
  { id: 8, title: "Fix nav overflow bug", project: "Website Revamp", desc: "Mobile menu clips on iOS Safari", status: "todo", priority: "high", assignees: ["JL"], start: dOff(-2), due: dOff(-1), time: "", tags: ["bug", "web"], attachments: [], progress: 0 },
  { id: 9, title: "Landing hero animation", project: "PRIMEO", desc: "Subtle parallax on scroll", status: "inprogress", priority: "low", assignees: ["CN"], start: dOff(0), due: dOff(6), time: "", tags: ["web", "motion"], attachments: [], progress: 35 },
  { id: 10, title: "Publish blog — Nest Design Lab", project: "Nest Design Lab", desc: "SEO pass and hero image", status: "done", priority: "low", assignees: ["MA"], start: dOff(-8), due: dOff(-5), time: "", tags: ["content", "seo"], attachments: [], progress: 100 },
];

const NAV = [
  { id: "dashboard", name: "Dashboard", icon: LayoutGrid },
  { id: "calendar", name: "Calendar", icon: Calendar },
  { id: "tasks", name: "Tasks", icon: CheckSquare },
  { id: "projects", name: "Projects", icon: Folder },
  { id: "team", name: "Team Members", icon: Users },
  { id: "reports", name: "Reports", icon: BarChart },
];



export default function TasksPage() {
  const { members } = useAuth();
  const memberByRef = useMemo(() => {
    const map = {};
    members.forEach((member) => {
      map[member.id] = member;
      map[member.i] = member; // supports old seed references until they are migrated
    });
    return map;
  }, [members]);
  const normalizeMemberRefs = useCallback((refs = []) => [...new Set(
    refs
      .map((ref) => {
        const key = String(ref || "").trim();
        if (!key) return null;
        return memberByRef[key]?.id || key;
      })
      .filter(Boolean)
  )], [memberByRef]);

  const [active, setActive] = useState("tasks");
  const [tasks, setTasks] = useState([]);
  const [taskError, setTaskError] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const taskEtagRef = useRef(null);
  const loadingTasksRef = useRef(false);
  const mutationGenerationRef = useRef(0);
  const [view, setView] = useState("board");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const hydrateTasks = useCallback((items = []) => (
    items.map((task) => ({
      ...task,
      start: task.start ? fromDateInput(task.start) : null,
      due: task.due ? fromDateInput(task.due) : null,
      assignees: Array.isArray(task.assignees) ? task.assignees : [],
      tags: Array.isArray(task.tags) ? task.tags : [],
      attachments: Array.isArray(task.attachments) ? task.attachments : [],
    }))
  ), []);

  const loadTasks = useCallback(async ({ force = false } = {}) => {
    if (loadingTasksRef.current) return;
    loadingTasksRef.current = true;
    const generationAtStart = mutationGenerationRef.current;
    try {
      const headers = {};
      if (!force && taskEtagRef.current) headers["If-None-Match"] = taskEtagRef.current;
      const response = await fetch("/api/tasks", { headers, cache: "no-store" });
      if (response.status === 304) return;
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to load tasks.");
      }
      const body = await response.json();

      // Ignore a GET that started before a create/edit/delete operation.
      // Otherwise an older response can visually undo a task edit even after
      // the Blob write already succeeded.
      if (generationAtStart !== mutationGenerationRef.current) return;

      const etag = response.headers.get("etag");
      if (etag) taskEtagRef.current = etag;
      setTasks(hydrateTasks(Array.isArray(body.tasks) ? body.tasks : []));
      setTaskError("");
    } catch (error) {
      if (generationAtStart === mutationGenerationRef.current) {
        setTaskError(error.message || "Unable to load tasks.");
      }
    } finally {
      loadingTasksRef.current = false;
    }
  }, [hydrateTasks]);

  const applyTaskResponse = useCallback(async (response, fallback) => {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || fallback);
    }
    const body = await response.json();
    const etag = response.headers.get("etag");
    if (etag) taskEtagRef.current = etag;
    setTasks(hydrateTasks(Array.isArray(body.tasks) ? body.tasks : []));
    setTaskError("");
    return body;
  }, [hydrateTasks]);

  useEffect(() => {
    loadTasks({ force: true });
    const poll = () => {
      if (document.visibilityState === "visible") loadTasks();
    };
    const id = window.setInterval(poll, 3000);
    const onFocus = () => loadTasks({ force: true });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [loadTasks]);

  // Member references are normalized only when opening/saving a task.
  // Do not rewrite task state merely because the member list refreshed; doing
  // so can make an unsaved local transformation look like persisted data.


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) =>
      t.title.toLowerCase().includes(q) || t.project.toLowerCase().includes(q) || t.tags.some((g) => g.toLowerCase().includes(q)));
  }, [tasks, query]);

  const stats = useMemo(() => ({
    total: tasks.length,
    inprogress: tasks.filter((t) => t.status === "inprogress").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks]);

  const blank = (status = "todo") => ({
    id: null, title: "", project: PROJECTS[0], desc: "", status, priority: "medium",
    assignees: [], start: toDateInput(dOff(0)), due: "", time: "", tags: [], attachments: [],
  });
  const openCreate = (status) => setModal({ mode: "create", form: blank(status) });
  const openEdit = (t) => setModal({ mode: "edit", form: { ...t, assignees: normalizeMemberRefs(t.assignees), start: toDateInput(t.start), due: toDateInput(t.due), tags: [...t.tags], attachments: [...t.attachments] } });
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));
  const save = async () => {
    if (savingTask || !modal) return;
    const f = modal.form;
    const base = {
      title: f.title.trim() || "Untitled task",
      project: f.project,
      desc: f.desc,
      status: f.status,
      priority: f.priority,
      // The modal stores stable member IDs. Save those exact IDs instead of
      // resolving them again through a possibly-refreshing member map.
      assignees: [...new Set((f.assignees || []).map((id) => String(id)).filter(Boolean))],
      start: f.start || "",
      due: f.due || "",
      time: f.time || "",
      tags: [...f.tags],
      attachments: [...f.attachments],
      progress: f.progress,
    };

    setSavingTask(true);
    setTaskError("");
    mutationGenerationRef.current += 1;
    try {
      const isEdit = modal.mode === "edit";
      const response = await fetch("/api/tasks", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: f.id, data: base } : { data: base }),
      });
      await applyTaskResponse(response, isEdit ? "Unable to update task." : "Unable to create task.");
      setModal(null);
    } catch (error) {
      setTaskError(error.message || "Unable to save task.");
    } finally {
      setSavingTask(false);
    }
  };

  const remove = async () => {
    if (savingTask || !modal?.form?.id) return;
    setSavingTask(true);
    setTaskError("");
    mutationGenerationRef.current += 1;
    try {
      const response = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modal.form.id }),
      });
      await applyTaskResponse(response, "Unable to delete task.");
      setModal(null);
    } catch (error) {
      setTaskError(error.message || "Unable to delete task.");
    } finally {
      setSavingTask(false);
    }
  };

  const drop = async (statusId) => {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (id == null) return;

    const previous = tasks;
    mutationGenerationRef.current += 1;
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: statusId } : t)));
    setTaskError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, data: { status: statusId } }),
      });
      await applyTaskResponse(response, "Unable to move task.");
    } catch (error) {
      setTasks(previous);
      setTaskError(error.message || "Unable to move task.");
      loadTasks({ force: true });
    }
  };

  return (
    <>
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* toolbar */}
          <header className="flex items-center gap-3 px-5 sm:px-7 pt-6 pb-4 shrink-0 flex-wrap">
            <div className="mr-auto">
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Tasks</h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>Add and track work across the team</p>
              {taskError && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{taskError}</p>}
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks"
                className="pl-8 pr-3 py-2 text-sm rounded-full outline-none shadow-sm w-44" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
            </div>
            <div className="flex items-center gap-1 rounded-full p-1 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              {[["board", LayoutGrid], ["list", List]].map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm capitalize font-medium"
                  style={view === v ? { background: ACCENT_GRAD, color: ON_ACCENT } : { color: "var(--text-2)" }}><Icon size={15} />{v}</button>
              ))}
            </div>
            <button onClick={() => openCreate("todo")} className="tp-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
              <Plus size={17} /> New task
            </button>
          </header>

          {/* stat cards */}
          <div className="px-5 sm:px-7 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <StatCard icon={CheckSquare} tint="#F26A3C" soft="#FCE3D6" label="Total tasks" value={stats.total} note="all tasks" />
            <StatCard icon={Clock} tint="#3E8ED0" soft="#E3EEF9" label="In progress" value={stats.inprogress} note="being worked on" />
            <StatCard icon={CheckSquare} tint="#3FA37A" soft="#DEF1E7" label="Completed" value={stats.done} note="finished" />
            <StatCard icon={Flag} tint="#E5536E" soft="#FBE1E7" label="Overdue" value={stats.overdue} note="past due date" />
          </div>

          {/* body */}
          {view === "board" ? (
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-5 sm:px-7 pb-6">
              <div className="flex gap-4 h-full" style={{ minWidth: "min-content" }}>
                {STATUSES.map((s) => {
                  const items = filtered.filter((t) => t.status === s.id);
                  const isOver = overCol === s.id;
                  return (
                    <div key={s.id} className="flex flex-col rounded-2xl shrink-0" style={{ width: 288, background: isOver ? "var(--grid)" : "var(--col)", outline: isOver ? `2px dashed ${ACCENT}` : "none" }}
                      onDragOver={(e) => { e.preventDefault(); setOverCol(s.id); }} onDragLeave={() => setOverCol((c) => (c === s.id ? null : c))} onDrop={(e) => { e.preventDefault(); drop(s.id); }}>
                      <div className="flex items-center gap-2 px-3 py-3 shrink-0">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.name}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--card)", color: "var(--text-2)" }}>{items.length}</span>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 space-y-2.5">
                        {items.map((t) => (
                          <TaskCard key={t.id} t={t} memberByRef={memberByRef} onClick={() => openEdit(t)}
                            onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null); }} dragging={dragId === t.id} />
                        ))}
                      </div>
                      <button onClick={() => openCreate(s.id)} className="tp-ib m-2.5 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium shrink-0" style={{ color: "var(--text-2)", background: "var(--dim)" }}>
                        <Plus size={15} /> Add task
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto px-5 sm:px-7 pb-6">
              <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--muted)" }} className="text-left">
                      {["Task", "Project", "Assignees", "Priority", "Status", "Due date"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const s = statusOf(t.status), p = priorityOf(t.priority), od = isOverdue(t);
                      return (
                        <tr key={t.id} onClick={() => openEdit(t)} className="tp-row cursor-pointer" style={{ borderBottom: "1px solid var(--grid)" }}>
                          <td className="px-4 py-3">
                            <div className="font-medium" style={{ color: "var(--text)" }}>{t.title}</div>
                            {t.attachments.length > 0 && <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "var(--muted)" }}><Paperclip size={11} />{t.attachments.length}</div>}
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>{t.project}</td>
                          <td className="px-4 py-3"><AttendeeStack list={t.assignees} memberByRef={memberByRef} ring="var(--card)" size={22} /></td>
                          <td className="px-4 py-3"><Pill label={p.name} color={p.color} soft={p.soft} /></td>
                          <td className="px-4 py-3"><Pill label={s.name} color={s.color} soft={s.soft} /></td>
                          <td className="px-4 py-3" style={{ color: od ? "#E5536E" : "var(--text-2)", fontWeight: od ? 600 : 400 }}>{fmtDate(t.due)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

      {modal && <TaskModal modal={modal} members={members} setForm={setForm} onClose={() => !savingTask && setModal(null)} onSave={save} onDelete={remove} saving={savingTask} />}
    </>
  );
}

/* ---------- bits ---------- */
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

function Pill({ label, color, soft }) {
  return <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: soft, color }}>{label}</span>;
}

function AttendeeStack({ list, memberByRef, ring = "var(--card)", size = 22 }) {
  const visible = (list || []).map((ref) => memberByRef[ref]).filter(Boolean);
  if (!visible.length) return <span style={{ color: "var(--faint)" }} className="text-xs">—</span>;
  return (
    <div className="flex items-center">
      {visible.slice(0, 4).map((member, i) => (
        <span key={member.id} title={member.name} className="rounded-full flex items-center justify-center font-semibold shrink-0"
          style={{ width: size, height: size, background: member.c, color: "#fff", fontSize: size * 0.36, border: `2px solid ${ring}`, marginLeft: i ? -7 : 0 }}>{member.i}</span>
      ))}
    </div>
  );
}

function TaskCard({ t, memberByRef, onClick, onDragStart, onDragEnd, dragging }) {
  const p = priorityOf(t.priority), s = statusOf(t.status), prog = progressFor(t), od = isOverdue(t);
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}
      className="tp-card rounded-2xl p-3 cursor-pointer" style={{ background: "var(--card)", border: "1px solid var(--border)", opacity: dragging ? 0.4 : 1 }}>
      <div className="flex items-center justify-between mb-1.5">
        <Pill label={p.name} color={p.color} soft={p.soft} />
        <span style={{ color: "var(--faint)" }}><MoreHorizontal size={16} /></span>
      </div>
      <div className="font-semibold leading-snug" style={{ color: "var(--text)", fontSize: 14 }}>{t.title}</div>
      {t.desc && <div className="text-xs mt-1" style={{ color: "var(--muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.desc}</div>}
      {t.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {t.tags.map((g) => <span key={g} className="rounded-md px-1.5 py-0.5 text-xs" style={{ background: "var(--col)", color: "var(--muted)" }}>#{g}</span>)}
        </div>
      )}
      <div className="mt-2.5">
        <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--muted)" }}><span>Progress</span><span>{prog}%</span></div>
        <div className="rounded-full overflow-hidden" style={{ height: 5, background: "var(--grid)" }}><div style={{ width: `${prog}%`, height: "100%", background: s.color }} /></div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: "1px solid var(--grid)" }}>
        <AttendeeStack list={t.assignees} memberByRef={memberByRef} size={20} />
        <div className="flex items-center gap-2.5 text-xs" style={{ color: od ? "#E5536E" : "var(--muted)", fontWeight: od ? 600 : 400 }}>
          {t.attachments.length > 0 && <span className="flex items-center gap-0.5" style={{ color: "var(--muted)" }}><Paperclip size={12} />{t.attachments.length}</span>}
          <span className="flex items-center gap-1"><Clock size={12} />{fmtDate(t.due)}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- modal ---------- */
function TaskModal({ modal, members, setForm, onClose, onSave, onDelete, saving = false }) {
  const f = modal.form;
  const fileRef = useRef(null);
  const [tagDraft, setTagDraft] = useState("");
  const toggleAssignee = (id) => setForm({ assignees: f.assignees.includes(id) ? f.assignees.filter((a) => a !== id) : [...f.assignees, id] });
  const addTag = () => { const v = tagDraft.trim().replace(/^#/, ""); if (v && !f.tags.includes(v)) setForm({ tags: [...f.tags, v] }); setTagDraft(""); };
  const onFiles = (e) => { const add = Array.from(e.target.files).map((x) => ({ name: x.name, size: x.size })); setForm({ attachments: [...f.attachments, ...add] }); e.target.value = ""; };
  const field = { border: "1px solid var(--border)", background: "var(--card)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,26,0.4)" }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto" style={{ background: "var(--card)", maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 sticky top-0" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-semibold" style={{ color: "var(--text)" }}>{modal.mode === "edit" ? "Edit task" : "New task"}</h3>
          <button onClick={onClose} className="tp-ib h-8 w-8 flex items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <input autoFocus value={f.title} onChange={(e) => setForm({ title: e.target.value })} placeholder="Task title"
            className="w-full text-lg outline-none pb-1" style={{ borderBottom: "2px solid var(--border)" }} />

          <textarea value={f.desc} onChange={(e) => setForm({ desc: e.target.value })} rows={2} placeholder="Description / note"
            className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none" style={field} />

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Project">
              <select value={f.project} onChange={(e) => setForm({ project: e.target.value })} className="w-full rounded-lg px-2.5 py-2 text-sm outline-none" style={field}>
                {PROJECTS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Labeled>
            <Labeled label="Status">
              <select value={f.status} onChange={(e) => setForm({ status: e.target.value })} className="w-full rounded-lg px-2.5 py-2 text-sm outline-none" style={field}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Labeled>
          </div>

          <Labeled label="Priority">
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button key={p.id} onClick={() => setForm({ priority: p.id })} className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: p.soft, color: p.color, outline: f.priority === p.id ? `2px solid ${p.color}` : "none", outlineOffset: 1 }}>{p.name}</button>
              ))}
            </div>
          </Labeled>

          <div className="grid grid-cols-3 gap-3">
            <Labeled label="Start"><input type="date" value={f.start} onChange={(e) => setForm({ start: e.target.value })} className="w-full rounded-lg px-2 py-2 text-sm outline-none" style={field} /></Labeled>
            <Labeled label="Due"><input type="date" value={f.due} onChange={(e) => setForm({ due: e.target.value })} className="w-full rounded-lg px-2 py-2 text-sm outline-none" style={field} /></Labeled>
            <Labeled label="Time"><input type="time" value={f.time} onChange={(e) => setForm({ time: e.target.value })} className="w-full rounded-lg px-2 py-2 text-sm outline-none" style={field} /></Labeled>
          </div>

          <Labeled label="Assignees">
            <div className="flex flex-wrap gap-1.5">
              {members.map((t) => {
                const on = f.assignees.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleAssignee(t.id)} title={t.name} className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ background: t.c, fontSize: 11, opacity: on ? 1 : 0.35, outline: on ? `2px solid ${t.c}` : "none", outlineOffset: 1 }}>{t.i}</button>
                );
              })}
            </div>
          </Labeled>

          <Labeled label="Tags">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1.5" style={field}>
              {f.tags.map((g) => (
                <span key={g} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs" style={{ background: "var(--col)", color: "var(--text-2)" }}>
                  #{g}<button onClick={() => setForm({ tags: f.tags.filter((x) => x !== g) })} className="tp-chip-x" style={{ opacity: 0.5 }}><X size={11} /></button>
                </span>
              ))}
              <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Add tag…" className="flex-1 text-sm outline-none py-0.5" style={{ minWidth: 80 }} />
            </div>
          </Labeled>

          <Labeled label="Attachments">
            <div className="space-y-1.5">
              {f.attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm" style={{ background: "var(--col)" }}>
                  <Paperclip size={14} style={{ color: "var(--muted)" }} />
                  <span className="truncate flex-1" style={{ color: "var(--text)" }}>{a.name}</span>
                  <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>{formatBytes(a.size)}</span>
                  <button onClick={() => setForm({ attachments: f.attachments.filter((_, x) => x !== i) })} style={{ color: "var(--faint)" }}><X size={14} /></button>
                </div>
              ))}
              <input ref={fileRef} type="file" multiple onChange={onFiles} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} className="tp-ib flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium w-full justify-center" style={{ color: "var(--text-2)", background: "var(--col)" }}>
                <Plus size={15} /> Attach files
              </button>
            </div>
          </Labeled>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 sticky bottom-0" style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}>
          {modal.mode === "edit" ? (
            <button disabled={saving} onClick={onDelete} className="tp-ib inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ color: "#E5536E" }}><Trash2 size={16} /> Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button disabled={saving} onClick={onClose} className="tp-ib text-sm px-4 py-2 rounded-full disabled:opacity-50" style={{ color: "var(--text-2)" }}>Cancel</button>
            <button disabled={saving} onClick={onSave} className="tp-pill text-sm px-5 py-2 rounded-full font-medium shadow-md disabled:opacity-60" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>{saving ? "Saving…" : "Save task"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>{label}</p>
      {children}
    </div>
  );
}
