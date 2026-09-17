"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "../auth";
import {
  LayoutGrid, Calendar, CheckSquare, Folder, Users, BarChart, Settings,
  Plus, X, Search, Paperclip, Clock, Flag, Trash2, Tag, Sparkles, List, MoreHorizontal,
  Moon, Sun, ChevronDown,
} from "lucide-react";

/* ---------- theme ---------- */
const CANVAS = "var(--surface)";
const SIDEBAR = "var(--sidebar)";
const ACCENT = "#F26A3C";
const ON_ACCENT = "var(--on-accent)";
const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const PAGE_BG = "var(--page)";
const ME = { i: "CN", name: "Che Navarro", role: "Digital Creative", c: "#7C6FF0" };

const DEFAULT_STATUSES = [
  { id: "todo",       name: "To Do",       color: "#8E8A96", soft: "#ECEBEE", isDefault: true },
  { id: "inprogress", name: "In Progress", color: "#3E8ED0", soft: "#E3EEF9", isDefault: true },
  { id: "inreview",   name: "In Review",   color: "#E0A93C", soft: "#FAEFD6", isDefault: true },
  { id: "done",       name: "Done",        color: "#3FA37A", soft: "#DEF1E7", isDefault: true },
];
// Runtime list of statuses (defaults + any custom ones loaded from the API).
// Kept in a module-level ref so the module-level statusOf() — used by TaskCard
// and the list view — always resolves the latest custom statuses.
let STATUS_RUNTIME = DEFAULT_STATUSES.slice();
const setStatusRuntime = (list) => { STATUS_RUNTIME = (Array.isArray(list) && list.length) ? list : DEFAULT_STATUSES.slice(); };
const PRIORITIES = [
  { id: "low",    name: "Low",    color: "#3FA37A", soft: "#DEF1E7" },
  { id: "medium", name: "Medium", color: "#E0A93C", soft: "#FAEFD6" },
  { id: "high",   name: "High",   color: "#E5536E", soft: "#FBE1E7" },
];
const PROJECTS = ["Quencha", "CRYSALIS", "Website Revamp", "FITSPIRE", "SCRUBZ", "Sunbeams Lifestyle", "PRIMEO", "Nest Design Lab", "Daily Tasks"];
const statusOf = (id) => STATUS_RUNTIME.find((s) => s.id === id) || STATUS_RUNTIME[0];
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
  const { members, currentMember: authCurrentMember, member } = useAuth();
  const currentMember = authCurrentMember || member || members.find((m) => m.id === "cn" || m.i === "CN") || null;
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
  const [projects, setProjects] = useState([]);
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);

  const applyStatuses = useCallback((list) => {
    const next = (Array.isArray(list) && list.length) ? list : DEFAULT_STATUSES;
    setStatusRuntime(next);   // keep module-level statusOf in sync before re-render
    setStatuses(next);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((b) => { if (active) setProjects(Array.isArray(b.projects) ? b.projects : []); })
      .catch(() => {});
    fetch("/api/statuses", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { statuses: DEFAULT_STATUSES }))
      .then((b) => { if (active) applyStatuses(Array.isArray(b.statuses) ? b.statuses : DEFAULT_STATUSES); })
      .catch(() => {});
    return () => { active = false; };
  }, [applyStatuses]);

  const addStatus = async (name) => {
    const res = await fetch("/api/statuses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Unable to add status.");
    const list = Array.isArray(body.statuses) ? body.statuses : [];
    applyStatuses(list);
    return list;
  };
  const deleteStatus = async (id) => {
    const res = await fetch("/api/statuses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Unable to delete status.");
    const list = Array.isArray(body.statuses) ? body.statuses : [];
    applyStatuses(list);
    // a deleted status sends its tasks back to "todo" server-side — refresh tasks
    loadTasks({ force: true });
    return list;
  };

  const addProject = async (name) => {
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Unable to add project.");
    const list = Array.isArray(body.projects) ? body.projects : [];
    setProjects(list);
    return list;
  };
  const deleteProject = async (name) => {
    const res = await fetch("/api/projects", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Unable to delete project.");
    const list = Array.isArray(body.projects) ? body.projects : [];
    setProjects(list);
    return list;
  };
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
    id: null, title: "", project: projects[0] || "", desc: "", notes: "", status, priority: "medium",
    assignees: [], start: toDateInput(dOff(0)), due: "", time: "", tags: [], attachments: [],
  });
  const openCreate = (status) => setModal({ mode: "create", form: blank(status) });
  const openEdit = (t) => setModal({ mode: "edit", form: { ...t, assignees: normalizeMemberRefs(t.assignees), start: toDateInput(t.start), due: toDateInput(t.due), tags: [...t.tags], attachments: [...t.attachments] } });
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));
  const patchForm = (fn) => setModal((m) => (m ? { ...m, form: { ...m.form, ...fn(m.form) } } : m));
  const save = async () => {
    if (savingTask || !modal) return;
    const f = modal.form;
    const base = {
      title: f.title.trim() || "Untitled task",
      project: f.project,
      desc: f.desc,
      notes: f.notes || "",
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

  const buildTasksPayload = () => ({
    statuses: (statuses || []).map((s) => ({ id: s.id, name: s.name, color: s.color })),
    tasks: (tasks || []).map((t) => ({
      title: t.title,
      project: t.project,
      status: t.status,
      priority: t.priority,
      due: t.due instanceof Date ? t.due.toISOString() : (t.due || null),
      overdue: isOverdue(t),
      desc: t.desc || "",
      assignees: (t.assignees || []).map((ref) => memberByRef[ref]).filter(Boolean).map((m) => ({ i: m.i, c: m.c, name: m.name })),
    })),
  });

  const exportTasksPng = async () => {
    try {
      setTaskError("");
      const res = await fetch("/api/tasks-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildTasksPayload()) });
      if (!res.ok) throw new Error("Unable to render tasks image.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "sdc-task-board.png";
      link.href = url; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setTaskError(e.message || "Unable to export tasks image."); }
  };

  const sendTasksToLark = async () => {
    try {
      setTaskError("");
      const res = await fetch("/api/lark/tasks-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildTasksPayload()) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to send tasks to Lark.");
    } catch (e) { setTaskError(e.message || "Unable to send to Lark"); }
  };

  return (
    <>
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
          {/* toolbar */}
          <header className="flex items-center gap-3 px-4 sm:px-7 pt-6 pb-4 shrink-0 flex-wrap">
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
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={exportTasksPng} className="tp-ib rounded-full px-3.5 py-2 text-sm font-medium shadow-sm" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>🖼️ Export PNG</button>
              <button onClick={sendTasksToLark} className="tp-ib rounded-full px-3.5 py-2 text-sm font-medium shadow-sm" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>📤 Send to Lark</button>
            </div>
            <button onClick={() => openCreate("todo")} className="tp-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
              <Plus size={17} /> New task
            </button>
          </header>

          {/* stat cards */}
          <div className="px-4 sm:px-7 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            <StatCard icon={CheckSquare} tint="#F26A3C" soft="#FCE3D6" label="Total tasks" value={stats.total} note="all tasks" />
            <StatCard icon={Clock} tint="#3E8ED0" soft="#E3EEF9" label="In progress" value={stats.inprogress} note="being worked on" />
            <StatCard icon={CheckSquare} tint="#3FA37A" soft="#DEF1E7" label="Completed" value={stats.done} note="finished" />
            <StatCard icon={Flag} tint="#E5536E" soft="#FBE1E7" label="Overdue" value={stats.overdue} note="past due date" />
          </div>

          {/* body */}
          {view === "board" ? (
            <div className="px-4 sm:px-7 pb-6">
              <div className="flex flex-col md:flex-row gap-4 items-start">
                {statuses.map((s) => {
                  const items = filtered.filter((t) => t.status === s.id);
                  const isOver = overCol === s.id;
                  return (
                    <div key={s.id} className="flex flex-col rounded-2xl w-full md:flex-1 md:min-w-0" style={{ background: isOver ? "var(--grid)" : "var(--col)", outline: isOver ? `2px dashed ${ACCENT}` : "none" }}
                      onDragOver={(e) => { e.preventDefault(); setOverCol(s.id); }} onDragLeave={() => setOverCol((c) => (c === s.id ? null : c))} onDrop={(e) => { e.preventDefault(); drop(s.id); }}>
                      <div className="flex items-center gap-2 px-3 py-3 shrink-0">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.name}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--card)", color: "var(--text-2)" }}>{items.length}</span>
                      </div>
                      <div className="px-2.5 pb-2 space-y-2.5">
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
            <div className="overflow-x-auto px-4 sm:px-7 pb-6">
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

      {modal && <TaskModal modal={modal} members={members} setForm={setForm} patchForm={patchForm} onClose={() => !savingTask && setModal(null)} onSave={save} onDelete={remove} saving={savingTask} projects={projects} onAddProject={addProject} onDeleteProject={deleteProject} statuses={statuses} onAddStatus={addStatus} onDeleteStatus={deleteStatus} memberByRef={memberByRef} />}
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
      <div className="flex items-center gap-1.5 mb-1.5">
        <Pill label={p.name} color={p.color} soft={p.soft} />
        {t.project && <span className="rounded-full px-2 py-0.5 text-xs truncate min-w-0" style={{ background: "var(--col)", color: "var(--text-2)" }}>{t.project}</span>}
        <span className="ml-auto shrink-0" style={{ color: "var(--faint)" }}><MoreHorizontal size={16} /></span>
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
function TaskModal({ modal, members, setForm, patchForm, onClose, onSave, onDelete, saving = false, projects = [], onAddProject, onDeleteProject, statuses = [], onAddStatus, onDeleteStatus, memberByRef = {} }) {
  const f = modal.form;
  const fileRef = useRef(null);
  const [tagDraft, setTagDraft] = useState("");
  const [projDraft, setProjDraft] = useState("");
  const [projError, setProjError] = useState("");
  const [projBusy, setProjBusy] = useState(false);
  const handleAddProject = async () => {
    const name = projDraft.trim();
    if (!name) return;
    setProjBusy(true); setProjError("");
    try { await onAddProject(name); setForm({ project: name }); setProjDraft(""); }
    catch (e) { setProjError(e.message || "Unable to add project."); }
    finally { setProjBusy(false); }
  };
  const handleDeleteProject = async () => {
    if (!f.project) return;
    setProjBusy(true); setProjError("");
    const removed = f.project;
    try { const list = await onDeleteProject(removed); if (Array.isArray(list) && !list.includes(removed)) setForm({ project: list[0] || "" }); }
    catch (e) { setProjError(e.message || "Unable to delete project."); }
    finally { setProjBusy(false); }
  };

  const [statusDraft, setStatusDraft] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const currentStatus = statuses.find((s) => s.id === f.status);
  const canDeleteStatus = currentStatus && !currentStatus.isDefault;
  const handleAddStatus = async () => {
    const name = statusDraft.trim();
    if (!name) return;
    setStatusBusy(true); setStatusError("");
    try {
      const list = await onAddStatus(name);
      const added = Array.isArray(list) ? list.find((s) => s.name.toLowerCase() === name.toLowerCase()) : null;
      if (added) setForm({ status: added.id });
      setStatusDraft("");
    } catch (e) { setStatusError(e.message || "Unable to add status."); }
    finally { setStatusBusy(false); }
  };
  const handleDeleteStatus = async () => {
    if (!canDeleteStatus) return;
    setStatusBusy(true); setStatusError("");
    try { await onDeleteStatus(f.status); setForm({ status: "todo" }); }
    catch (e) { setStatusError(e.message || "Unable to delete status."); }
    finally { setStatusBusy(false); }
  };

  // Per-task Export PNG / Send to Lark
  const [taskImgBusy, setTaskImgBusy] = useState("");   // "" | "png" | "lark"
  const [taskImgMsg, setTaskImgMsg] = useState("");
  const singleTaskPayload = () => ({
    task: {
      title: f.title, project: f.project, status: f.status, priority: f.priority,
      due: f.due instanceof Date ? f.due.toISOString() : (f.due || null),
      start: f.start instanceof Date ? f.start.toISOString() : (f.start || null),
      time: f.time || "", desc: f.desc || "", tags: f.tags || [],
      progress: typeof f.progress === "number" ? f.progress : null,
      statusName: (statuses.find((s) => s.id === f.status) || {}).name || "",
      statusColor: (statuses.find((s) => s.id === f.status) || {}).color || "#8E8A96",
      assignees: (f.assignees || []).map((ref) => memberByRef[ref]).filter(Boolean).map((m) => ({ i: m.i, c: m.c, name: m.name })),
      attachments: (f.attachments || []).map((a) => ({ name: a.name, url: a.url || "" })),
    },
  });
  const exportTaskPng = async () => {
    setTaskImgBusy("png"); setTaskImgMsg("");
    try {
      const res = await fetch("/api/task-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(singleTaskPayload()) });
      if (!res.ok) throw new Error("Unable to render task image.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `sdc-task-${(f.title || "task").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40)}.png`;
      link.href = url; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setTaskImgMsg(e.message || "Unable to export."); }
    finally { setTaskImgBusy(""); }
  };
  const sendTaskToLark = async () => {
    setTaskImgBusy("lark"); setTaskImgMsg("");
    try {
      const res = await fetch("/api/lark/task-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(singleTaskPayload()) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to send to Lark.");
      setTaskImgMsg("Sent to Lark ✓");
    } catch (e) { setTaskImgMsg(e.message || "Unable to send to Lark."); }
    finally { setTaskImgBusy(""); }
  };

  const toggleAssignee = (id) => setForm({ assignees: f.assignees.includes(id) ? f.assignees.filter((a) => a !== id) : [...f.assignees, id] });
  const addTag = () => { const v = tagDraft.trim().replace(/^#/, ""); if (v && !f.tags.includes(v)) setForm({ tags: [...f.tags, v] }); setTagDraft(""); };
  // Chunked upload through our own server (no direct browser→Blob call).
  const uploadChunked = async (file, key) => {
    const CHUNK = 3 * 1024 * 1024; // 3 MB parts (under the serverless body limit)
    const startRes = await fetch("/api/upload?action=start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, contentType: file.type || "" }),
    });
    const start = await startRes.json().catch(() => ({}));
    if (!startRes.ok) throw new Error(start.error || "Could not start upload.");
    const { pathname, key: mkey, uploadId } = start;

    const total = Math.max(1, Math.ceil(file.size / CHUNK));
    const parts = [];
    let uploaded = 0;
    for (let i = 0; i < total; i += 1) {
      const chunk = file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK));
      const partNumber = i + 1;
      const q = new URLSearchParams({ action: "part", pathname, key: mkey, uploadId, partNumber: String(partNumber) });
      const res = await fetch(`/api/upload?${q.toString()}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: chunk });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Part ${partNumber} failed.`);
      parts.push({ etag: d.etag, partNumber });
      uploaded += chunk.size;
      const pct = Math.round((uploaded / file.size) * 100);
      patchForm((form) => ({ attachments: (form.attachments || []).map((a) => (a.key === key ? { ...a, progress: pct } : a)) }));
    }

    const compRes = await fetch("/api/upload?action=complete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pathname, key: mkey, uploadId, parts }),
    });
    const comp = await compRes.json().catch(() => ({}));
    if (!compRes.ok) throw new Error(comp.error || "Could not finalize upload.");
    return { url: comp.url, contentType: file.type || "" };
  };

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const HARD_MAX = 50 * 1024 * 1024; // 50 MB
    for (const file of files) {
      const key = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (file.size > HARD_MAX) {
        patchForm((form) => ({ attachments: [...(form.attachments || []), { key, name: file.name, size: file.size, uploading: false, error: true }] }));
        continue;
      }
      patchForm((form) => ({ attachments: [...(form.attachments || []), { key, name: file.name, size: file.size, uploading: true, progress: 0 }] }));
      try {
        const result = await uploadChunked(file, key);
        patchForm((form) => ({ attachments: (form.attachments || []).map((a) => (a.key === key ? { name: a.name, size: a.size, url: result.url, contentType: result.contentType || "" } : a)) }));
      } catch (err) {
        patchForm((form) => ({ attachments: (form.attachments || []).map((a) => (a.key === key ? { ...a, uploading: false, error: true } : a)) }));
      }
    }
  };
  const uploadingCount = (f.attachments || []).filter((a) => a.uploading).length;
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
              <div className="flex gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <select value={f.project} onChange={(e) => setForm({ project: e.target.value })} className="appearance-none w-full rounded-lg pl-2.5 pr-9 py-2 text-sm outline-none" style={{ ...field, color: "var(--text)" }}>
                    {projects.length === 0 && <option value="">No projects yet</option>}
                    {projects.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-2)" }} />
                </div>
                <button type="button" title="Delete this project" onClick={handleDeleteProject} disabled={!f.project || projBusy}
                  className="tp-ib rounded-lg flex items-center justify-center shrink-0" style={{ width: 34, border: "1px solid var(--border)", color: "#E5536E" }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <input value={projDraft} onChange={(e) => setProjDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddProject(); } }}
                  placeholder="New project…" className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-sm outline-none" style={field} />
                <button type="button" title="Add project" onClick={handleAddProject} disabled={!projDraft.trim() || projBusy}
                  className="tp-ib rounded-lg flex items-center justify-center shrink-0" style={{ width: 34, border: "1px solid var(--border)", color: "var(--text-2)" }}>
                  <Plus size={16} />
                </button>
              </div>
              {projError && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{projError}</p>}
            </Labeled>
            <Labeled label="Status">
              <div className="flex gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <select value={f.status} onChange={(e) => setForm({ status: e.target.value })} className="appearance-none w-full rounded-lg pl-2.5 pr-9 py-2 text-sm outline-none" style={{ ...field, color: "var(--text)" }}>
                    {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-2)" }} />
                </div>
                <button type="button" title={canDeleteStatus ? "Delete this status" : "Default statuses can't be deleted"} onClick={handleDeleteStatus} disabled={!canDeleteStatus || statusBusy}
                  className="tp-ib rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40" style={{ width: 34, border: "1px solid var(--border)", color: "#E5536E" }}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                <input value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddStatus(); } }}
                  placeholder="New status…" className="flex-1 min-w-0 rounded-lg px-2.5 py-2 text-sm outline-none" style={field} />
                <button type="button" title="Add status" onClick={handleAddStatus} disabled={!statusDraft.trim() || statusBusy}
                  className="tp-ib rounded-lg flex items-center justify-center shrink-0" style={{ width: 34, border: "1px solid var(--border)", color: "var(--text-2)" }}>
                  <Plus size={16} />
                </button>
              </div>
              {statusError && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{statusError}</p>}
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

          <Labeled label="Notes (long details — not shown on cards)">
            <textarea value={f.notes || ""} onChange={(e) => setForm({ notes: e.target.value })} rows={5} placeholder="Full details, checklists, specs… kept on the task only."
              className="w-full rounded-lg px-2.5 py-2 text-sm outline-none resize-y" style={field} />
          </Labeled>

          <Labeled label="Attachments">
            <div className="space-y-1.5">
              {f.attachments.map((a, i) => (
                <div key={a.key || i} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm" style={{ background: "var(--col)" }}>
                  <Paperclip size={14} style={{ color: a.error ? "#E5536E" : "var(--muted)" }} />
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate flex-1 hover:underline" style={{ color: "var(--text)" }}>{a.name}</a>
                  ) : (
                    <span className="truncate flex-1" style={{ color: "var(--text)" }}>{a.name}</span>
                  )}
                  {a.uploading ? (
                    <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>{a.progress ? `${a.progress}%` : "Uploading…"}</span>
                  ) : a.error ? (
                    <span className="text-xs shrink-0" style={{ color: "#E5536E" }}>Failed</span>
                  ) : a.url ? (
                    <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>{formatBytes(a.size)}</span>
                  ) : (
                    <span className="text-xs shrink-0" title="Uploaded before file storage was enabled — re-attach to get a link" style={{ color: "var(--faint)" }}>no link</span>
                  )}
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

        <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!f.title || !!taskImgBusy || uploadingCount > 0} onClick={exportTaskPng}
            className="tp-ib rounded-full px-3.5 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>
            🖼️ {taskImgBusy === "png" ? "Rendering…" : "Export PNG"}
          </button>
          <button type="button" disabled={!f.title || !!taskImgBusy || uploadingCount > 0} onClick={sendTaskToLark}
            className="tp-ib rounded-full px-3.5 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>
            📤 {taskImgBusy === "lark" ? "Sending…" : "Send to Lark"}
          </button>
          {taskImgMsg && <span className="text-xs" style={{ color: taskImgMsg.includes("✓") ? "#3FA37A" : "#E5536E" }}>{taskImgMsg}</span>}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 sticky bottom-0" style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}>
          {modal.mode === "edit" ? (
            <button disabled={saving} onClick={onDelete} className="tp-ib inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ color: "#E5536E" }}><Trash2 size={16} /> Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <button disabled={saving} onClick={onClose} className="tp-ib text-sm px-4 py-2 rounded-full disabled:opacity-50" style={{ color: "var(--text-2)" }}>Cancel</button>
            <button disabled={saving || uploadingCount > 0} onClick={onSave} className="tp-pill text-sm px-5 py-2 rounded-full font-medium shadow-md disabled:opacity-60" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>{saving ? "Saving…" : uploadingCount > 0 ? "Uploading…" : "Save task"}</button>
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
