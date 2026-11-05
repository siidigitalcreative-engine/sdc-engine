"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, Send, Trash2, X, Plus, Globe2, Copy, ExternalLink } from "lucide-react";
import { useAuth } from "./auth";
import { useLarkSend } from "./LarkSend";

const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ROW_H = 44;
const STANDARD_BREAKS = [
  { start: 12 * 60, end: 12 * 60 + 45, label: "Lunch Break" },
  { start: 15 * 60, end: 15 * 60 + 15, label: "Other Break" },
];
// Breaks are visual guides, but minutes inside them are not working time.
// Preserve each block's original start/end time and on-screen height.
const workingMinutes = (start, end) => {
  const from = Number(start), to = Number(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  const breakMinutes = STANDARD_BREAKS.reduce((total, period) =>
    total + Math.max(0, Math.min(to, period.end) - Math.max(from, period.start)), 0);
  return Math.max(0, to - from - breakMinutes);
};
const PROJECT_COLORS = ["#3E8ED0", "#7C5CD8", "#3FA37A", "#E0A93C", "#F0784B", "#E5536E", "#2E9B8F", "#8E8A96"];
const hash = (s) => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0; return h; };
const colorFor = (name) => PROJECT_COLORS[hash(name || "x") % PROJECT_COLORS.length];

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (m) => `${Math.floor(m / 60) % 12 === 0 ? 12 : Math.floor(m / 60) % 12}:${pad(m % 60)} ${m < 720 ? "AM" : "PM"}`;
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; // Native time-input value only
const displayTime = (m) => `${Math.floor(m / 60) % 12 || 12}:${pad(m % 60)} ${m % 1440 < 720 ? "AM" : "PM"}`;
const displayRange = (start, end) => {
  const a = displayTime(start), b = displayTime(end);
  const suffixA = a.slice(-2), suffixB = b.slice(-2);
  return suffixA === suffixB ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
};
const gutter = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const hours = (m) => ((m / 60) % 1 === 0 ? m / 60 : (m / 60).toFixed(1)) + "h";

// A single remove control for both compact and tall timeline cards.
// One SVG size, stroke, hit area and alignment across all time blocks.
function BlockRemoveButton({ onRemove, floating = false }) {
  return (
    <button
      type="button"
      aria-label="Remove time block"
      onMouseDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onRemove(); }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, minWidth: 16, flex: "0 0 16px",
        padding: 0, margin: 0, border: 0, background: "transparent",
        color: "inherit", opacity: 0.75, cursor: "pointer", lineHeight: 0,
        ...(floating ? { position: "absolute", top: 2, right: 3, zIndex: 2 } : {}),
      }}
    >
      <X size={11} strokeWidth={2.5} aria-hidden="true" style={{ display: "block", flexShrink: 0 }} />
    </button>
  );
}

export default function TimeBlocking({ day, onDayChange }) {
  const { currentMember } = useAuth();
  const [data, setData] = useState({ blocks: [], members: [], departments: [], day: { start: 420, end: 1200, slot: 30 } });
  const [tasks, setTasks] = useState([]);
  const [statusNames, setStatusNames] = useState({});   // status id → display name
  const [view, setView] = useState("all");          // "all" or a member id
  const [tab, setTab] = useState("tasks");
  const [projects, setProjects] = useState([]);
  const [projectDialog, setProjectDialog] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dragRef = useRef(null);
  const writeSeq = useRef(0);
  const suppressBlockClick = useRef(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSettings, setShareSettings] = useState({ enabled: false, view: "all", token: "" });
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [dialog, setDialog] = useState(null); // { mode: "add" | "edit", start, end, ... }
  const dragSrcRef = useRef(null);                   // the card being dragged onto the timeline

  const { openLarkSend, larkPicker } = useLarkSend();
  const key = dateKey(day);
  const DAY_START = data.day.start, DAY_END = data.day.end, SLOT = data.day.slot;
  const me = currentMember?.id;

  const load = useCallback(async () => {
    const seq = writeSeq.current;
    try {
      const [blockRes, taskRes, statusRes, projectRes] = await Promise.all([
        fetch(`/api/time-blocks?date=${key}`, { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
        fetch("/api/statuses", { cache: "no-store" }).catch(() => null),
        fetch("/api/projects", { cache: "no-store" }).catch(() => null),
      ]);
      const body = await blockRes.json();
      if (!blockRes.ok) throw new Error(body.error || "Unable to load the time blocks.");
      // A refetch that started before a write finished, or that lands while a
      // block is being dragged, must not undo what is on screen.
      if (seq !== writeSeq.current || dragRef.current) return;
      setData((d) => ({ ...d, ...body }));
      const taskBody = await taskRes.json().catch(() => ({}));
      setTasks(Array.isArray(taskBody.tasks) ? taskBody.tasks.filter((t) => !t.archived) : []);
      const projectBody = projectRes ? await projectRes.json().catch(() => ({})) : {};
      setProjects(Array.isArray(projectBody.projects) ? projectBody.projects : []);
      const statusBody = statusRes ? await statusRes.json().catch(() => ({})) : {};
      if (Array.isArray(statusBody.statuses)) {
        setStatusNames(Object.fromEntries(statusBody.statuses.map((s) => [s.id, s.name])));
      }
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [key]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/time-block-public", { cache: "no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load share settings.");
        setShareSettings(result);
      })
      .catch(error => setShareNotice(error.message));
  }, []);

  const saveShareSettings = async (patch) => {
    setShareBusy(true);
    setShareNotice("");
    try {
      const response = await fetch("/api/time-block-public", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save public link settings.");
      setShareSettings(result);
      setShareNotice(result.enabled ? "Public view updated. Anyone with the link can view the selected timeline." : "Public access is off. The shared link is disabled.");
    } catch (error) { setShareNotice(error.message); }
    finally { setShareBusy(false); }
  };
  const shareUrl = shareSettings.token && typeof window !== "undefined"
    ? `${window.location.origin}/public/time-blocking/${shareSettings.token}` : "";
  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setShareNotice("Link copied."); }
    catch { setShareNotice("Copy the URL from the field."); }
  };


  // Refresh linked task names when returning from the Tasks page or another tab.
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  // Linked time blocks reflect edits to their original Tasks-page record.
  // An explicitly renamed timeline block keeps its own custom title.
  const visibleBlocks = useMemo(() => {
    const taskById = new Map(tasks.map(t => [String(t.id), t]));
    const subtaskById = new Map();
    for (const task of tasks) {
      for (const subtask of task.subtasks || []) {
        subtaskById.set(String(subtask.id), { subtask, task });
      }
    }
    return (data.blocks || []).map(block => {
      if (block.kind === "task") {
        const task = taskById.get(String(block.refId));
        if (!task) return block;
        return {
          ...block,
          title: block.titleEdited ? block.title : task.title || block.title,
          project: task.project || block.project,
          color: colorFor(task.project || block.project),
        };
      }
      if (block.kind === "subtask") {
        const match = subtaskById.get(String(block.refId));
        if (!match) return block;
        return {
          ...block,
          title: block.titleEdited ? block.title : match.subtask.title || block.title,
          parentTitle: match.task.title || block.parentTitle,
          project: match.task.project || block.project,
          color: colorFor(match.task.project || block.project),
        };
      }
      return block;
    });
  }, [data.blocks, tasks]);

  const members = data.members || [];
  const blocksOf = (memberId) => visibleBlocks.filter((b) => b.member === memberId);
  const minutesOf = (memberId) => blocksOf(memberId).reduce((t, b) => t + workingMinutes(b.start, b.end), 0);
  const totalMinutes = visibleBlocks.reduce((t, b) => t + workingMinutes(b.start, b.end), 0);
  const editable = view !== "all" && view === me;

  /* ---- what can be blocked ---- */
  const myId = currentMember?.id, myInitials = currentMember?.i;
  const mine = useMemo(() => tasks.filter((t) => {
    const assignees = Array.isArray(t.assignees) ? t.assignees : [];
    return (myId && assignees.includes(myId)) || (myInitials && assignees.includes(myInitials));
  }), [tasks, myId, myInitials]);

  // "inprogress" → "In Progress", "on-hold" → "On Hold" (real names win when known).
  const statusLabel = useCallback((id) => {
    const known = { todo: "To Do", inprogress: "In Progress", inreview: "In Review", done: "Done" };
    return statusNames[id] || known[id]
      || String(id || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [statusNames]);

  const sources = useMemo(() => {
    if (tab === "projects") {
      // Real projects first, plus any project my tasks mention that is not in the
      // list yet, so a newly created one shows immediately.
      const names = [...new Set([...projects, ...mine.map((t) => t.project).filter(Boolean)])];
      return names.map((name) => ({
        id: name, kind: "project", title: name, meta: "Project", project: name,
        color: colorFor(name), est: 60,
      }));
    }
    return mine.map((t) => ({
      id: t.id, kind: "task", title: t.title, meta: `${t.project || "No project"} · ${statusLabel(t.status)}`,
      project: t.project, color: colorFor(t.project), est: 60,
      subtasks: (t.subtasks || []).map((st) => ({
        id: st.id, kind: "subtask", title: st.title, parentTitle: t.title, done: st.done,
        meta: `part of ${t.title}`, project: t.project, color: colorFor(t.project), est: 60,
      })),
    }));
  }, [mine, tab, statusLabel, projects]);

  /* ---- writing ---- */
  /* Writing used to refetch the whole day, which threw away the optimistic
     position and showed the old one until the next load caught up. The write
     response already carries the saved blocks, so use that and only refetch
     when something actually failed. */
  const send = async (method, payload) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/time-blocks", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, date: key }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "That did not save.");
      if (Array.isArray(body.blocks)) {
        writeSeq.current += 1;                 // anything still in flight is now stale
        setData((d) => ({ ...d, blocks: body.blocks }));
      } else {
        await load();
      }
      return true;
    } catch (e) {
      setError(e.message);
      await load();                            // put the board back to the truth
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Clicking a time slot or existing block opens an editor. Dropping a task
  // from the left still places it directly, just as before.
  const openAdd = (start, chosen = picked) => {
    if (!editable) return;
    const candidate = chosen || sources[0] || null;
    setDialog({
      mode: "add", sourceId: candidate ? `${candidate.kind}:${candidate.id}` : "custom",
      title: candidate?.title || "", project: candidate?.project || "",
      taskDescription: "", taskStatus: "todo", taskPriority: "medium", createdTask: null,
      start, end: Math.min(DAY_END, start + Math.max(SLOT, candidate?.est || 60)), note: "",
    });
  };

  // Where a new block should start: the next free half hour from now, or the
  // start of the day when that has passed.
  const nextFreeSlot = () => {
    const now = new Date();
    const sameDay = dateKey(now) === key;
    let start = sameDay
      ? Math.max(DAY_START, Math.ceil((now.getHours() * 60 + now.getMinutes()) / SLOT) * SLOT)
      : DAY_START;
    const mineToday = blocksOf(me);
    while (start + SLOT <= DAY_END && mineToday.some((b) => start < b.end && start + SLOT > b.start)) {
      start += SLOT;
    }
    return Math.min(start, DAY_END - SLOT);
  };

  // Straight into the new-subtask mode with the parent already chosen.
  const openNewSubtask = (parent, start) => {
    if (!editable) return;
    const at = Number.isFinite(start) ? start : nextFreeSlot();
    setDialog({
      mode: "add", sourceId: "new-subtask", parentTaskId: parent.id,
      title: "", project: parent.project || "",
      taskDescription: "", taskStatus: "todo", taskPriority: "medium", createdTask: null,
      start: at, end: Math.min(DAY_END, at + 60), note: "",
    });
  };

  const openNewTask = (start) => {
    if (!editable) return;
    const at = Number.isFinite(start) ? start : nextFreeSlot();
    setDialog({
      mode: "add", sourceId: "new-task", title: "",
      // if a project is selected in the panel, start with it
      project: picked?.kind === "project" ? picked.title : "",
      newProject: false,
      taskDescription: "", taskStatus: "todo", taskPriority: "medium", createdTask: null,
      start: at, end: Math.min(DAY_END, at + 60), note: "",
    });
  };

  const saveProject = async () => {
    const name = String(projectDialog?.name || "").trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Unable to create that project.");
      setProjects(Array.isArray(body.projects) ? body.projects : (p) => [...p, name]);
      setProjectDialog(null);
      setTab("projects");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (b) => {
    if (!editable || b.member !== me) return;
    setDialog({ mode: "edit", id: b.id, title: b.title, originalTitle: b.title, start: b.start,
      end: b.end, note: b.note || "", block: b });
  };

  const projectOptions = useMemo(
    () => [...new Set([...projects, ...tasks.map((t) => t.project).filter(Boolean)])]
      .filter((name) => name !== "Daily Tasks").sort((a, b) => a.localeCompare(b)),
    [projects, tasks]
  );

  const allSources = sources.flatMap(s => [s, ...(s.subtasks || [])]);
  const selectedSource = dialog?.mode === "add"
    ? allSources.find(s => `${s.kind}:${s.id}` === dialog.sourceId) : null;
  const dialogValid = !!dialog && String(dialog.title || "").trim() &&
    (dialog.sourceId !== "new-subtask" || !!dialog.parentTaskId) &&
    (!dialog.newProject || String(dialog.project || "").trim()) &&
    Number.isFinite(Number(dialog.start)) && Number.isFinite(Number(dialog.end)) &&
    Number(dialog.start) >= DAY_START && Number(dialog.end) <= DAY_END &&
    Number(dialog.end) > Number(dialog.start);

  const saveDialog = async () => {
    if (!dialogValid || busy) return;
    const start = Number(dialog.start), end = Number(dialog.end);
    let ok;
    if (dialog.mode === "edit") {
      ok = await send("PATCH", { id: dialog.id, start, end,
        ...(dialog.title.trim() !== dialog.originalTitle ? { title: dialog.title.trim() } : {}),
        note: dialog.note || "" });
    } else if (dialog.sourceId === "new-task") {
      // Use the existing authenticated Tasks API and the regular Time Blocks API.
      // Remember the created task if saving its time block fails, so retrying
      // never silently creates a duplicate task.
      let created = dialog.createdTask;
      if (!created) {
        setBusy(true);
        setError("");
        try {
          // A brand new project is registered first, so the task is not the only
          // place it exists.
          if (dialog.newProject && dialog.project.trim()) {
            const made = await fetch("/api/projects", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: dialog.project.trim() }),
            });
            const madeBody = await made.json().catch(() => ({}));
            if (made.ok && Array.isArray(madeBody.projects)) setProjects(madeBody.projects);
          }
          const response = await fetch("/api/tasks", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: {
              title: dialog.title.trim(), project: dialog.project.trim() || "Daily Tasks",
              desc: dialog.taskDescription || "", status: dialog.taskStatus || "todo",
              priority: dialog.taskPriority || "medium", assignees: [me],
              start: key, due: "", time: "", tags: [], attachments: [], subtasks: [],
            } }),
          });
          const result = await response.json();
          if (!response.ok || !result.task?.id) throw new Error(result.error || "Unable to create the task.");
          created = result.task;
          setDialog(d => d ? { ...d, createdTask: created } : d);
        } catch (err) {
          setError(err.message || "Unable to create the task.");
          setBusy(false);
          return;
        }
        setBusy(false);
      }
      ok = await send("POST", { block: {
        kind: "task", refId: created.id, title: created.title,
        parentTitle: "", project: created.project,
        color: colorFor(created.project), start, end, note: dialog.note || "",
      } });
    } else if (dialog.sourceId === "new-subtask") {
      // Append to the parent task's checklist through the Tasks API, then block
      // the new subtask. The created subtask is remembered so a failed block
      // save cannot add it twice.
      const parent = tasks.find((t) => t.id === dialog.parentTaskId);
      if (!parent) { setError("Pick a parent task."); return; }

      let created = dialog.createdTask;
      if (!created) {
        setBusy(true);
        setError("");
        try {
          const subtask = {
            id: `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            title: dialog.title.trim(), done: false,
          };
          const response = await fetch("/api/tasks", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: parent.id, data: { subtasks: [...(parent.subtasks || []), subtask] } }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Unable to add the subtask.");
          created = { ...subtask, parentId: parent.id, parentTitle: parent.title, project: parent.project };
          setDialog(d => (d ? { ...d, createdTask: created } : d));
          setTasks(Array.isArray(result.tasks) ? result.tasks.filter((t) => !t.archived) : tasks);
        } catch (err) {
          setError(err.message || "Unable to add the subtask.");
          setBusy(false);
          return;
        }
        setBusy(false);
      }

      ok = await send("POST", { block: {
        kind: "subtask", refId: created.id, title: created.title,
        parentTitle: created.parentTitle, project: created.project || "",
        color: colorFor(created.project), start, end, note: dialog.note || "",
      } });
    } else {
      ok = await send("POST", { block: {
        kind: selectedSource?.kind || "task", refId: selectedSource?.id || "",
        title: dialog.title.trim(), parentTitle: selectedSource?.parentTitle || "",
        project: selectedSource?.project || dialog.project || "",
        color: selectedSource?.color || colorFor(dialog.project || dialog.title),
        start, end, note: dialog.note || "",
      } });
    }
    if (ok) { setDialog(null); setPicked(null); }
  };

  // Keep drag selection in a ref: a React re-render on drag start makes the
  // browser's native drag noticeably sluggish on a busy multi-member timeline.
  const startCardDrag = (src) => { dragSrcRef.current = src; };
  const stopCardDrag = () => { dragSrcRef.current = null; };

  const place = (start, event) => {
    if (event) event.preventDefault();
    // A card dropped here is used straight from the drag, without waiting for state.
    const chosen = (event && dragSrcRef.current) || picked;
    dragSrcRef.current = null;
    if (!chosen || !editable) { setError(chosen ? "" : "Pick a task, subtask or project first."); return; }
    // Blocks may overlap: an occupied timeslot can hold multiple tasks.
    const end = Math.min(DAY_END, start + Math.max(SLOT, chosen.est));
    const nextBlock = {
      date: key, kind: chosen.kind, refId: chosen.id, title: chosen.title,
      parentTitle: chosen.parentTitle || "", project: chosen.project || "",
      color: chosen.color, start, end,
    };
    // Show the dropped task straight away. The existing POST and reload remain
    // authoritative; an unsuccessful save removes this temporary block.
    const pendingId = `pending-${crypto.randomUUID()}`;
    setData((current) => ({
      ...current,
      blocks: [...current.blocks, { ...nextBlock, id: pendingId, member: me }],
    }));
    setPicked(null);
    send("POST", { block: nextBlock });
  };

  /* ---- dragging: body moves, bottom edge resizes ---- */
  const beginDrag = (event, block, mode) => {
    if (block.member !== me) return;
    // Do not cancel the browser's normal click for a move gesture.
    // A simple click must still open the block editor; actual pointer
    // movement is handled by the drag listeners below.
    if (mode === "resize") event.preventDefault();
    event.stopPropagation();
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    dragRef.current = { id: block.id, mode, startY: clientY, start: block.start, end: block.end, live: null, moved: false };
  };

  useEffect(() => {
    const move = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const clientY = event.clientY ?? event.touches?.[0]?.clientY;
      if (Math.abs(clientY - drag.startY) < 4 && !drag.moved) return;
      drag.moved = true;
      const delta = Math.round(((clientY - drag.startY) / ROW_H) * 60 / SLOT) * SLOT;
      if (drag.mode === "resize") {
        const end = Math.min(DAY_END, Math.max(drag.start + SLOT, drag.end + delta));
        drag.live = { start: drag.start, end };
      } else {
        const length = drag.end - drag.start;
        const start = Math.max(DAY_START, Math.min(DAY_END - length, drag.start + delta));
        drag.live = { start, end: start + length };
      }
      if (drag.live) {
        setData((d) => ({
          ...d,
          blocks: d.blocks.map((b) => (b.id === drag.id ? { ...b, ...drag.live } : b)),
        }));
      }
    };

    const end = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag?.moved) {
        suppressBlockClick.current = true;
        setTimeout(() => { suppressBlockClick.current = false; }, 0);
      }
      if (drag?.live) send("PATCH", { id: drag.id, start: drag.live.start, end: drag.live.end });
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- exporting ---- */
  const exportPayload = () => ({
    date: key,
    label: day.toLocaleDateString("default", { weekday: "long", day: "numeric", month: "long" }),
    members: (view === "all" ? members : members.filter((m) => m.id === view))
      .map((m) => ({ id: m.id, name: m.name, initials: m.i, color: m.c, minutes: minutesOf(m.id) })),
    blocks: (view === "all" ? visibleBlocks : blocksOf(view)),
    day: data.day,
  });

  const exportPng = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/time-block-image", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exportPayload()),
      });
      if (!res.ok) throw new Error("Unable to render that image.");
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `time-blocking-${view === "all" ? "everyone" : (members.find((m) => m.id === view)?.i || "day").toLowerCase()}-${key}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendToLark = () => {
    const who = view === "all" ? "everyone's day" : `${members.find((m) => m.id === view)?.name || "this"} day`;
    openLarkSend("/api/lark/time-block-image", exportPayload(), { label: `${who} for ${key}`, kind: "calendar" });
  };

  /* ---- rendering ---- */
  const hoursList = [];
  for (let h = DAY_START / 60; h < DAY_END / 60; h++) hoursList.push(h);
  const lanes = view === "all" ? members : members.filter((m) => m.id === view);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = dateKey(now) === key && nowMin >= DAY_START && nowMin <= DAY_END;

  // Lay simultaneous blocks out in adjacent columns so none covers another.
  const layoutFor = (memberId) => {
    const sorted = [...blocksOf(memberId)].sort((a, b) => a.start - b.start || a.end - b.end);
    const positions = new Map();
    const flush = (group) => {
      if (!group.length) return;
      const ends = [];
      for (const entry of group) {
        let column = ends.findIndex((end) => end <= entry.start);
        if (column === -1) column = ends.length;
        ends[column] = entry.end;
        positions.set(entry.id, column);
      }
      const count = ends.length;
      for (const entry of group) positions.set(entry.id, { column: positions.get(entry.id), count });
    };
    let group = [], groupEnd = -1;
    for (const entry of sorted) {
      if (group.length && entry.start >= groupEnd) { flush(group); group = []; groupEnd = -1; }
      group.push(entry);
      groupEnd = Math.max(groupEnd, entry.end);
    }
    flush(group);
    return positions;
  };

  // When a source is dropped over an existing block, use the pointer's time.
  const pointerTime = (event, b) => {
    const box = event.currentTarget.getBoundingClientRect();
    const minute = b.start + (event.clientY - box.top) * (60 / ROW_H);
    return Math.max(DAY_START, Math.min(DAY_END - SLOT, Math.floor(minute / SLOT) * SLOT));
  };

  const block = (b, interactive, position) => {
    const top = ((b.start - DAY_START) / 60) * ROW_H + 2;
    const height = Math.max(18, ((b.end - b.start) / 60) * ROW_H - 4);
    // Match the compact PNG card format: prioritize the time range at the
    // bottom, allow the title to wrap, and hide secondary text if space is tight.
    const showTime = height >= 35;
    const showParent = Boolean(b.parentTitle?.trim()) && height >= 50;
    const titleLines = showTime ? Math.max(1, Math.min(3, Math.floor((height - (showParent ? 38 : 24)) / 12)))
      : Math.max(1, Math.min(3, Math.floor((height - (showParent ? 20 : 9)) / 12)));
    return (
      <div key={b.id}
        onMouseDown={interactive ? (e) => { if (!picked && !dragSrcRef.current) beginDrag(e, b, "move"); } : undefined}
        onTouchStart={interactive ? (e) => { if (!picked && !dragSrcRef.current) beginDrag(e, b, "move"); } : undefined}
        onClick={interactive ? (e) => {
          e.stopPropagation();
          if (suppressBlockClick.current) return;
          if (picked) openAdd(pointerTime(e, b));
          else openEdit(b);
        } : undefined}
        onDragOver={interactive ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } : undefined}
        onDrop={interactive ? (e) => { e.preventDefault(); e.stopPropagation(); place(pointerTime(e, b), e); } : undefined}
        style={{
          position: "absolute",
          left: position ? `calc(${position.column} * (100% / ${position.count}) + 4px)` : 4,
          width: position ? `calc(100% / ${position.count} - 8px)` : undefined,
          right: position ? undefined : 4,
          top, height, overflow: "hidden",
          borderRadius: 10, padding: showTime ? "5px 7px" : "2px 7px", background: "var(--card)",
          boxSizing: "border-box", display: "flex", flexDirection: "column",
          border: `1px solid ${b.color}`, color: b.color, boxShadow: `inset 3px 0 0 ${b.color}`,
          cursor: interactive ? "grab" : "default", pointerEvents: "auto",
        }}>
        {interactive && showTime && (
          <BlockRemoveButton floating onRemove={() => send("DELETE", { id: b.id })} />
        )}
        {showParent && (
          <div style={{ fontSize: 9, fontWeight: 700, lineHeight: "12px", letterSpacing: ".03em",
            textTransform: "uppercase", opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>
            {b.parentTitle}
          </div>
        )}
        {!showTime ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0,
            width: "100%", height: "100%" }}>
            <span title={b.title} style={{ fontSize: 10.5, fontWeight: 700, lineHeight: "12px",
              flex: "1 1 auto", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</span>
            <span style={{ fontSize: 9, lineHeight: "12px", opacity: 0.8, whiteSpace: "nowrap", flexShrink: 0 }}>
              {displayRange(b.start, b.end)}
            </span>
            {interactive && (
              <BlockRemoveButton onRemove={() => send("DELETE", { id: b.id })} />
            )}
          </div>
        ) : (
          <div title={b.title} style={{ fontSize: 10.5, fontWeight: 700, lineHeight: "12px",
            display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: titleLines,
            overflow: "hidden", overflowWrap: "anywhere", flexShrink: 0,
            paddingRight: interactive ? 10 : 0 }}>{b.title}</div>
        )}
        {showTime && (
          <div style={{ display: "flex", alignItems: "center", minWidth: 0, marginTop: "auto", paddingBottom: interactive ? 4 : 0,
            fontSize: 9.5, lineHeight: "12px", opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ flexShrink: 0 }}>{displayRange(b.start, b.end)}</span>
            <span style={{ overflow: "hidden", textOverflow: "clip", whiteSpace: "nowrap", minWidth: 0 }}> · {hours(workingMinutes(b.start, b.end))}</span>
          </div>
        )}
        {interactive && (
          <span onMouseDown={(e) => beginDrag(e, b, "resize")} onTouchStart={(e) => beginDrag(e, b, "resize")}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 9, cursor: "ns-resize" }} />
        )}
      </div>
    );
  };

  const weekStart = new Date(day);
  weekStart.setDate(day.getDate() - ((day.getDay() + 6) % 7));

  return (
    <div className="flex flex-col gap-3">
      {larkPicker}
      {dialog && editable && (
        <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.64)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label={dialog.mode === "edit" ? "Edit time block" : "Add time block"}
            className="rounded-2xl p-5 w-full max-w-md space-y-3"
            style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex justify-between items-center gap-2">
              <h3 className="text-lg font-semibold">{dialog.mode === "edit" ? "Edit Time Block" : "Add Time Block"}</h3>
              <button type="button" aria-label="Close" onClick={() => setDialog(null)}><X size={18}/></button>
            </div>
            {dialog.mode === "add" && (
              <div className="space-y-2">
                {/* an explicit choice rather than two commands hidden at the top of a long list */}
                <div className="flex gap-1.5">
                  {[
                    { id: "existing", label: "Existing" },
                    { id: "new-task", label: "New task" },
                    { id: "new-subtask", label: "New subtask" },
                    { id: "custom", label: "Custom" },
                  ].map((opt) => {
                    const on = opt.id === "existing"
                      ? !["new-task", "new-subtask", "custom"].includes(dialog.sourceId)
                      : dialog.sourceId === opt.id;
                    return (
                      <button key={opt.id} type="button" disabled={!!dialog.createdTask}
                        onClick={() => {
                          if (opt.id === "existing") {
                            const first = allSources[0];
                            setDialog(d => ({ ...d, sourceId: first ? `${first.kind}:${first.id}` : "custom",
                              title: first?.title || "", project: first?.project || "", createdTask: null }));
                          } else if (opt.id === "new-subtask") {
                            const firstTask = allSources.find(x => x.kind === "task");
                            setDialog(d => ({ ...d, sourceId: "new-subtask", title: "", project: firstTask?.project || "",
                              parentTaskId: firstTask?.id || "", createdTask: null }));
                          } else {
                            setDialog(d => ({ ...d, sourceId: opt.id, title: "", project: "", newProject: false, createdTask: null }));
                          }
                        }}
                        className="flex-1 rounded-xl px-2 py-2 text-xs font-semibold"
                        style={on
                          ? { background: ACCENT, color: "var(--on-accent)" }
                          : { background: "var(--col)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {dialog.sourceId === "new-subtask" && (
                  <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
                    <span>Parent task</span>
                    <div className="relative">
                      <select className="appearance-none w-full rounded-xl pl-3 pr-9 py-2 text-sm border"
                        style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                        value={dialog.parentTaskId || ""} disabled={!!dialog.createdTask}
                        onChange={(e) => {
                          const parent = allSources.find(x => x.kind === "task" && x.id === e.target.value);
                          setDialog(d => ({ ...d, parentTaskId: e.target.value, project: parent?.project || "" }));
                        }}>
                        {allSources.filter(x => x.kind === "task").map(x =>
                          <option key={x.id} value={x.id}>{x.title}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-2)" }} />
                    </div>
                  </label>
                )}

                {!["new-task", "new-subtask", "custom"].includes(dialog.sourceId) && (
                  <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
                    <span>Task or project</span>
                    <div className="relative">
                      <select className="appearance-none w-full rounded-xl pl-3 pr-9 py-2 text-sm border"
                        style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                        value={dialog.sourceId} onChange={e => {
                          const src = allSources.find(s => `${s.kind}:${s.id}` === e.target.value);
                          setDialog(d => ({ ...d, sourceId: e.target.value,
                            title: src?.title || "", project: src?.project || "", createdTask: null }));
                        }}>
                        {/* grouped, so a subtask is never mistaken for a task */}
                        <optgroup label="Tasks">
                          {allSources.filter(x => x.kind === "task").map(x =>
                            <option key={`task:${x.id}`} value={`task:${x.id}`}>{x.title}</option>)}
                        </optgroup>
                        <optgroup label="Subtasks">
                          {allSources.filter(x => x.kind === "subtask").map(x =>
                            <option key={`subtask:${x.id}`} value={`subtask:${x.id}`}>{x.title} — {x.parentTitle}</option>)}
                        </optgroup>
                        <optgroup label="Projects">
                          {allSources.filter(x => x.kind === "project").map(x =>
                            <option key={`project:${x.id}`} value={`project:${x.id}`}>{x.title}</option>)}
                        </optgroup>
                      </select>
                      <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-2)" }} />
                    </div>
                  </label>
                )}

                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {dialog.sourceId === "new-task"
                    ? "Creates the task on the Tasks page and blocks the time for it."
                    : dialog.sourceId === "new-subtask"
                      ? "Adds the subtask to that task's checklist and blocks the time for it."
                      : dialog.sourceId === "custom"
                        ? "Blocks the time only. Nothing is added to the Tasks page."
                        : "Blocks time against work that already exists."}
                </p>
              </div>
            )}
            <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
              <span>Title</span>
              <input className="w-full rounded-xl px-3 py-2 text-sm border" style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                value={dialog.title} onChange={e => setDialog(d => ({ ...d, title: e.target.value }))} maxLength={120}
                disabled={!!dialog.createdTask}/>
            </label>
            {dialog.mode === "add" && dialog.sourceId === "new-task" && (
              <div className="space-y-3">
                <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
                  <span>Project</span>
                  {/* pick one that exists, or switch the field to a new name */}
                  <div className="relative">
                    <select className="appearance-none w-full rounded-xl pl-3 pr-9 py-2 text-sm border"
                      style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                      value={dialog.newProject ? "__new" : (dialog.project || "")}
                      disabled={!!dialog.createdTask}
                      onChange={(e) => {
                        if (e.target.value === "__new") setDialog(d => ({ ...d, newProject: true, project: "" }));
                        else setDialog(d => ({ ...d, newProject: false, project: e.target.value }));
                      }}>
                      <option value="">Daily Tasks</option>
                      {projectOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                      <option value="__new">+ New project…</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-2)" }} />
                  </div>
                  {dialog.newProject && (
                    <input autoFocus className="w-full rounded-xl px-3 py-2 text-sm border mt-1.5"
                      style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                      value={dialog.project || ""} maxLength={60} disabled={!!dialog.createdTask}
                      onChange={(e) => setDialog(d => ({ ...d, project: e.target.value }))}
                      placeholder="New project name" />
                  )}
                  {dialog.newProject && (
                    <span className="block text-[11px]" style={{ color: "var(--muted)" }}>
                      Added to the Projects page when the task is created.
                    </span>
                  )}
                </label>
                <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
                  <span>Task description (optional)</span>
                  <textarea rows={2} className="w-full rounded-xl px-3 py-2 text-sm border resize-y"
                    style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                    value={dialog.taskDescription || ""} onChange={e => setDialog(d => ({ ...d, taskDescription: e.target.value }))}
                    disabled={!!dialog.createdTask}/>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
                    <span>Task status</span>
                    <div className="relative">
                      <select className="appearance-none w-full rounded-xl pl-3 pr-9 py-2 text-sm border"
                        style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                        value={dialog.taskStatus || "todo"} onChange={e => setDialog(d => ({ ...d, taskStatus: e.target.value }))}
                        disabled={!!dialog.createdTask}>
                        <option value="todo">To Do</option><option value="inprogress">In Progress</option>
                        <option value="inreview">In Review</option><option value="done">Done</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-2)" }}/>
                    </div>
                  </label>
                  <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
                    <span>Priority</span>
                    <div className="relative">
                      <select className="appearance-none w-full rounded-xl pl-3 pr-9 py-2 text-sm border"
                        style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                        value={dialog.taskPriority || "medium"} onChange={e => setDialog(d => ({ ...d, taskPriority: e.target.value }))}
                        disabled={!!dialog.createdTask}>
                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-2)" }}/>
                    </div>
                  </label>
                </div>
                {dialog.createdTask && <p className="text-xs" style={{ color: "#3FA37A" }}>
                  New task saved. Complete the time block to link it; retrying will not create another task.
                </p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {["start", "end"].map(k => <label key={k} className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
                <span>{k === "start" ? "Start time" : "End time"}</span>
                <input type="time" step={SLOT * 60} className="w-full rounded-xl px-3 py-2 text-sm border"
                  style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                  value={hhmm(dialog[k])} onChange={e => { const [h, m] = e.target.value.split(":").map(Number);
                    if (Number.isFinite(h) && Number.isFinite(m)) setDialog(d => ({ ...d, [k]: h * 60 + m })); }}/>
              </label>)}
            </div>
            <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
              <span>Notes (optional)</span>
              <textarea rows={3} maxLength={160} className="w-full rounded-xl px-3 py-2 text-sm border resize-y"
                style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                value={dialog.note} onChange={e => setDialog(d => ({ ...d, note: e.target.value }))}/>
            </label>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Multiple time blocks may overlap. Editing here changes only this timeline block, not the original task record.
            </p>
            {!dialogValid && <p className="text-xs" style={{ color: "#E5536E" }}>Enter a title and valid times within the workday, with end after start.</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {dialog.mode === "edit" && <button type="button" onClick={() => openAdd(dialog.start)}
                className="rounded-xl px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"
                style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}><Plus size={14}/> Add Another at This Time</button>}
              <button type="button" onClick={() => setDialog(null)} className="rounded-xl px-3 py-2 text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>Cancel</button>
              <button type="button" disabled={!dialogValid || busy} onClick={saveDialog} className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: ACCENT, color: "var(--on-accent)", opacity: !dialogValid || busy ? .5 : 1 }}>
                {busy ? "Saving…"
                  : dialog.mode === "edit" ? "Save Changes"
                  : dialog.sourceId === "new-task" ? "Create Task & Add Block"
                  : dialog.sourceId === "new-subtask" ? "Add Subtask & Block"
                  : "Add Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {projectDialog && editable && (
        <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setProjectDialog(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.64)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-label="Create project"
            className="rounded-2xl p-5 w-full max-w-sm space-y-3"
            style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center gap-2">
              <h3 className="text-lg font-semibold">Create Project</h3>
              <button type="button" aria-label="Close" onClick={() => setProjectDialog(null)}><X size={18}/></button>
            </div>
            <label className="block text-xs space-y-1" style={{ color: "var(--text-2)" }}>
              <span>Project name</span>
              <input autoFocus className="w-full rounded-xl px-3 py-2 text-sm border"
                style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}
                value={projectDialog.name} maxLength={60}
                onChange={(e) => setProjectDialog({ name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") saveProject(); }}
                placeholder="e.g. Quencha Zodiac Mugs" />
            </label>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Added to the Projects page, so tasks can use it straight away.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setProjectDialog(null)} className="rounded-xl px-3 py-2 text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>Cancel</button>
              <button type="button" disabled={busy || !projectDialog.name.trim()} onClick={saveProject}
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: ACCENT, color: "var(--on-accent)", opacity: busy || !projectDialog.name.trim() ? .5 : 1 }}>
                {busy ? "Saving…" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* who you are looking at */}
      <div className="flex items-center gap-2 flex-wrap">
        <Chip on={view === "all"} onClick={() => setView("all")} label="Everyone" note={hours(totalMinutes)} />
        {members.map((m) => (
          <Chip key={m.id} on={view === m.id} onClick={() => setView(m.id)}
            label={m.name.split(" ")[0] + (m.id === me ? " (you)" : "")}
            note={hours(minutesOf(m.id))} avatar={m.i} color={m.c} />
        ))}
        <span className="text-xs ml-1" style={{ color: "var(--faint)" }}>
          Everyone here can see these. Only you can change yours.
        </span>
        <div className="flex gap-2 ml-auto flex-wrap">
          <button type="button" onClick={() => setShareOpen(v => !v)}
            className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
            style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
            <Globe2 size={15}/> Public Link {shareSettings.enabled ? "· On" : "· Off"}
          </button>
          <button onClick={exportPng} disabled={busy} className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
            style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
            <Download size={15} /> {view === "all" ? "Export everyone" : "Export this day"}
          </button>
          <button onClick={sendToLark} disabled={busy} className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
            style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
            <Send size={15} /> {view === "all" ? "Send everyone" : "Send this day"}
          </button>
          {editable && (
            <>
              <button onClick={() => send("DELETE", { all: true })} disabled={busy}
                className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
                style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                <Trash2 size={15} /> Clear my day
              </button>
            </>
          )}
        </div>
      </div>

      {shareOpen && <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2"><Globe2 size={16}/> Public Time Blocking Link</h3>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Share a read-only timeline without login. Choose Everyone or one team member below.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={shareSettings.enabled} disabled={shareBusy}
            onClick={() => saveShareSettings({ enabled: !shareSettings.enabled })}
            className="rounded-full px-4 py-2 text-xs font-semibold"
            style={{ background: shareSettings.enabled ? "#287A56" : "var(--col)", color: shareSettings.enabled ? "white" : "var(--text)", border: "1px solid var(--border)" }}>
            {shareBusy ? "Saving…" : shareSettings.enabled ? "Public On · Turn Off" : "Public Off · Turn On"}
          </button>
        </div>
        <label className="block max-w-sm space-y-1.5">
          <span className="text-xs font-medium" style={{ color: "var(--text-2)" }}>Public Link View</span>
          <select value={shareSettings.view || "all"} disabled={shareBusy}
            onChange={e => saveShareSettings({ view: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ background: "var(--col)", borderColor: "var(--border)", color: "var(--text)" }}>
            <option value="all">Everyone · All team timelines</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        {shareSettings.enabled && shareUrl && <div className="flex gap-2 min-w-0 flex-wrap">
          <input readOnly aria-label="Public Time Blocking URL" value={shareUrl}
            className="min-w-0 flex-1 rounded-xl px-3 py-2 text-xs border"
            style={{ background: "var(--col)", color: "var(--text)", borderColor: "var(--border)" }}/>
          <button type="button" onClick={copyShareUrl} className="rounded-xl border px-3 py-2 text-xs font-semibold inline-flex items-center gap-1" style={{ borderColor: "var(--border)" }}><Copy size={14}/> Copy</button>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-2 text-xs font-semibold inline-flex items-center gap-1" style={{ borderColor: "var(--border)" }}><ExternalLink size={14}/> Preview</a>
        </div>}
        {shareNotice && <p role="status" className="text-xs" style={{ color: "var(--text-2)" }}>{shareNotice}</p>}
      </div>}

      {/* the week */}
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
          const on = dateKey(d) === key;
          return (
            <button key={i} onClick={() => onDayChange(d)}
              className="rounded-2xl px-3 py-2 text-center"
              style={{
                minWidth: 64,
                background: on ? ACCENT : "var(--card)",
                color: on ? "var(--on-accent)" : "var(--text-2)",
                border: `1px solid ${on ? "transparent" : "var(--border)"}`,
              }}>
              <div className="text-[10px] font-bold uppercase tracking-wider">
                {d.toLocaleDateString("default", { weekday: "short" })}
              </div>
              <div className="text-[17px] font-semibold">{d.getDate()}</div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs" style={{ color: "#E5536E" }}>{error}</p>}

      <div className="grid gap-3" style={{ gridTemplateColumns: editable ? "280px 1fr" : "1fr" }}>
        {/* what to block */}
        {editable && (
          <div className="rounded-2xl p-3.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex gap-1.5 mb-2.5">
              {["tasks", "projects"].map((t) => (
                <button key={t} onClick={() => { setTab(t); setPicked(null); }}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={t === tab
                    ? { background: ACCENT, color: "var(--on-accent)" }
                    : { background: "var(--col)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                  {t === "tasks" ? "My tasks" : "Projects"}
                </button>
              ))}
            </div>

            {/* same action as the Tasks page, and the label follows the tab */}
            <button type="button" onClick={() => (tab === "tasks" ? openNewTask() : setProjectDialog({ name: "" }))}
              className="w-full rounded-xl px-3 py-2.5 mb-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: ACCENT, color: "var(--on-accent)" }}>
              <Plus size={16} /> {tab === "tasks" ? "New Task" : "Create Project"}
            </button>

            <div className="flex flex-col gap-1.5" style={{ maxHeight: 520, overflowY: "auto" }}>
              {sources.map((s) => (
                <div key={s.id}>
                  <SourceRow s={s} picked={picked} onPick={setPicked} onDragPick={startCardDrag} onDragStop={stopCardDrag} />
                  {s.kind === "task" && (
                    <div className="flex items-center gap-3 ml-4 mt-1">
                      {s.subtasks?.length > 0 && (
                        <button onClick={() => setExpanded((prev) => {
                            const next = new Set(prev);
                            next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                            return next;
                          })}
                          className="flex items-center gap-1 text-[10.5px] font-semibold"
                          style={{ color: "var(--muted)" }}>
                          {expanded.has(s.id) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          {expanded.has(s.id) ? "Hide" : "Show"} {s.subtasks.length} subtask{s.subtasks.length === 1 ? "" : "s"}
                        </button>
                      )}
                      <button onClick={() => openNewSubtask(s)}
                        className="flex items-center gap-1 text-[10.5px] font-semibold"
                        style={{ color: "var(--text-2)" }}>
                        <Plus size={11} /> Subtask
                      </button>
                    </div>
                  )}
                  {expanded.has(s.id) && s.subtasks.map((st) => (
                    <div key={st.id} className="ml-4 mt-1.5"><SourceRow s={st} picked={picked} onPick={setPicked} onDragPick={startCardDrag} onDragStop={stopCardDrag} sub /></div>
                  ))}
                </div>
              ))}
              {!sources.length && <p className="text-xs" style={{ color: "var(--muted)" }}>Nothing to block yet.</p>}
            </div>

            <p className="text-[11.5px] mt-2.5" style={{ color: "var(--faint)" }}>
              {picked ? `Picked: ${picked.title}. Now click a slot.` : "Pick something, then click a slot on the right."}
            </p>
          </div>
        )}

        {/* the board */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-end justify-end text-[10px] pb-1.5 pr-2"
              style={{ width: 66, flex: "none", borderRight: "1px solid var(--border)", color: "var(--muted)" }}>GMT+8</div>
            {lanes.map((m) => (
              <div key={m.id} className="flex-1 text-center py-2.5 px-2"
                style={{ borderRight: "1px solid var(--border)" }}>
                <div className="mx-auto mb-1.5 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ height: 32, width: 32, fontSize: 11, background: m.c,
                    boxShadow: m.id === me ? "0 0 0 2px var(--card), 0 0 0 4px #F0784B" : "none" }}>{m.i}</div>
                <div className="text-[12.5px] font-semibold" style={{ color: m.id === me ? "#F0784B" : "var(--text)" }}>
                  {m.name}{m.id === me ? " (you)" : ""}
                </div>
                <div className="text-[10.5px]" style={{ color: "var(--muted)" }}>
                  {minutesOf(m.id) ? `${hours(minutesOf(m.id))} blocked` : "free"}
                </div>
              </div>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            {hoursList.map((h) => (
              <div key={h} className="flex" style={{ height: ROW_H, borderBottom: "1px solid var(--border)" }}>
                <div className="text-right text-[11px] pt-1 pr-2"
                  style={{
                    width: 66, flex: "none", borderRight: "1px solid var(--border)", color: "var(--muted)",
                    // the red pill replaces the hour it lands on
                    opacity: showNow && Math.abs(nowMin - h * 60) < 18 ? 0 : 1,
                  }}>
                  {gutter(h)}
                </div>
                {lanes.map((m) => (
                  <div key={m.id} className="flex-1 flex" style={{ borderRight: "1px solid var(--border)" }}>
                    {editable && m.id === me
                      ? Array.from({ length: 60 / SLOT }, (_, i) => (
                          <div key={i} className="flex-1 tp-slot"
                            title={clock(h * 60 + i * SLOT)}
                            onClick={() => openAdd(h * 60 + i * SLOT)}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                            onDrop={(e) => { e.preventDefault(); place(h * 60 + i * SLOT, e); }}
                            style={{ borderRight: ((i + 1) * SLOT) % 15 === 0 && i < 60 / SLOT - 1 ? "1px dashed var(--border)" : "none", cursor: "pointer" }} />
                        ))
                      : <div className="flex-1" />}
                  </div>
                ))}
              </div>
            ))}

            <div style={{ position: "absolute", left: 66, right: 0, top: 0, bottom: 0, pointerEvents: "none" }}>
              {lanes.map((m, i) => (
                <div key={m.id} style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: `calc(${i} * (100% / ${lanes.length}))`, width: `calc(100% / ${lanes.length})`,
                  background: i % 2 ? "rgba(127,127,127,.035)" : "transparent", pointerEvents: "none",
                }}>
                  <div style={{ position: "relative", height: "100%", pointerEvents: "none" }}>
                    {STANDARD_BREAKS.filter(b => b.end > DAY_START && b.start < DAY_END).map(b => (
                      <div key={b.label} aria-label={`${b.label}: ${clock(b.start)} to ${clock(b.end)}`}
                        style={{ position: "absolute", left: 0, right: 0,
                          top: (Math.max(b.start, DAY_START) - DAY_START) / 60 * ROW_H,
                          height: (Math.min(b.end, DAY_END) - Math.max(b.start, DAY_START)) / 60 * ROW_H,
                          background: "rgba(148, 153, 163, 0.18)", pointerEvents: "none",
                          zIndex: 0, borderTop: "1px solid rgba(163, 168, 176, 0.15)",
                          borderBottom: "1px solid rgba(163, 168, 176, 0.15)" }} />
                    ))}
                    {(() => { const positions = layoutFor(m.id); return blocksOf(m.id).map((b) => block(b, m.id === me, positions.get(b.id))); })()}
                  </div>
                </div>
              ))}
              {showNow && (
                <div style={{ position: "absolute", left: 0, right: 0, top: ((nowMin - DAY_START) / 60) * ROW_H,
                  height: 0, zIndex: 2, pointerEvents: "none" }}>
                  {/* a pill in the gutter rather than text over the hour label,
                      a dot where the line starts, then the line itself */}
                  <span style={{
                    position: "absolute", right: "100%", marginRight: 6, top: -9,
                    fontSize: 10, fontWeight: 700, lineHeight: "18px", height: 18,
                    color: "#fff", background: "#E5536E", borderRadius: 999, padding: "0 6px",
                    whiteSpace: "nowrap",
                  }}>{displayTime(nowMin)}</span>
                  <span style={{
                    position: "absolute", left: -3.5, top: -3.5, height: 7, width: 7,
                    borderRadius: 999, background: "#E5536E",
                  }} />
                  <span style={{
                    position: "absolute", left: 0, right: 0, top: 0,
                    borderTop: "1.5px solid #E5536E", opacity: 0.85,
                  }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ on, onClick, label, note, avatar, color }) {
  return (
    <button onClick={onClick} className="rounded-full inline-flex items-center gap-2 text-[12.5px] font-medium"
      style={{
        padding: avatar ? "4px 12px 4px 4px" : "7px 13px",
        background: on ? ACCENT : "var(--card)",
        color: on ? "var(--on-accent)" : "var(--text-2)",
        border: `1px solid ${on ? "transparent" : "var(--border)"}`,
      }}>
      {avatar && (
        <span className="rounded-full flex items-center justify-center text-white font-extrabold"
          style={{ height: 24, width: 24, fontSize: 10, background: color }}>{avatar}</span>
      )}
      {label}
      <span style={{ fontSize: 10.5, opacity: 0.72 }}>{note}</span>
    </button>
  );
}

function SourceRow({ s, picked, onPick, sub, onDragPick, onDragStop }) {
  const on = picked?.id === s.id;
  return (
    <button onClick={() => onPick(on ? null : s)}
      draggable
      onDragEnd={onDragStop}
      onDragStart={(e) => {
        // Picking on drag start means the drop handler already knows what to place.
        onDragPick(s);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", s.id);
      }}
      className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left"
      style={{
        background: sub ? "var(--surface)" : "var(--col)",
        border: `1px solid ${on ? "#F0784B" : "var(--border)"}`,
      }}>
      <span style={{ width: 3, alignSelf: "stretch", borderRadius: 999, background: s.color, flex: "none" }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold truncate" style={{ color: "var(--text)", fontWeight: sub ? 500 : 600 }}>
          {s.title}
        </span>
        <span className="block text-[11px] truncate" style={{ color: "var(--muted)" }}>{s.meta}</span>
      </span>
    </button>
  );
}
