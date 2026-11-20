"use client";

import PageAccess from "../PageAccess";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, X, Search, Trash2, Pencil, GripVertical, ChevronDown, ChevronRight, ChevronLeft,
  Link2, Clock, Check, AlertCircle, Puzzle, Play, Pause, Square, Archive, RotateCcw,
  BookOpen, Minus, Settings,
} from "lucide-react";
import { scheduleItems, upcomingHolidays } from "../lib/work-calendar";

const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";

const PRI = {
  low: { name: "Low", color: "#3FA37A", soft: "rgba(63,163,122,0.14)" },
  medium: { name: "Medium", color: "#E0A93C", soft: "rgba(224,169,60,0.16)" },
  high: { name: "High", color: "#E5536E", soft: "rgba(229,83,110,0.14)" },
};
const PRIORITIES = ["low", "medium", "high"];
const UNITS = [{ id: "h", name: "hours" }, { id: "d", name: "days" }, { id: "w", name: "weeks" }];
const UNIT_SHORT = { h: "hr", d: "day", w: "week" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FALLBACK_STATUS = { id: "todo", name: "To Do", color: "#8E8A96", soft: "#ECEBEE" };

const field = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" };
const panel = { background: "var(--card)", border: "1px solid var(--border)" };

const newId = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const fmtDuration = (d) => (d && d.value ? `${d.value} ${UNIT_SHORT[d.unit] || "day"}${d.value === 1 ? "" : "s"}` : "No duration");
const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const fmtDay = (ts) => {
  const d = new Date(ts);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
};
const fmtElapsed = (ms) => {
  const m = Math.floor(ms / 6e4); const h = Math.floor(m / 60); const d = Math.floor(h / 24);
  if (d) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h) return `${h}h ${m % 60}m`;
  return `${m}m ${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}s`;
};
const runState = (f) => (!f || !f.startedAt ? "idle" : f.pausedAt ? "paused" : "running");
const elapsedOf = (f) => (!f?.startedAt ? 0 : Math.max(0, (f.pausedAt || Date.now()) - f.startedAt - (f.pausedMs || 0)));
const stepsOf = (f) => (f?.items || []).filter((i) => i.kind === "step");

async function readError(response, fallback) {
  // Keep the status code: a crashed route returns HTML, and without this the
  // page would show the same generic line for every possible cause.
  try {
    const body = await response.json();
    if (body?.error) return body.error;
  } catch { /* not JSON — fall through */ }
  return `${fallback} (HTTP ${response.status})`;
}

/* ---------------------------------- bits ---------------------------------- */

function Chip({ color, soft, outline, children, title }) {
  const style = outline
    ? { background: "transparent", border: "1px solid var(--border)", color: "var(--text-2)" }
    : { background: soft || "var(--col)", color: color || "var(--text-2)" };
  return (
    <span title={title} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap" style={style}>
      {children}
    </span>
  );
}

function Avatars({ list, size = 21 }) {
  if (!list?.length) return <span className="text-xs" style={{ color: "var(--muted)" }}>Unassigned</span>;
  return (
    <span className="flex items-center">
      {list.slice(0, 4).map((m, i) => (
        <span key={m.id} title={m.name} className="rounded-full flex items-center justify-center font-semibold shrink-0"
          style={{ width: size, height: size, background: m.c, color: "#fff", fontSize: size * 0.42, border: "2px solid var(--card)", marginLeft: i ? -7 : 0 }}>{m.i}</span>
      ))}
      {list.length > 4 && <span className="text-xs ml-1" style={{ color: "var(--muted)" }}>+{list.length - 4}</span>}
    </span>
  );
}

function Modal({ title, onClose, children, width = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,26,0.45)" }} onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full ${width} overflow-y-auto`} style={{ background: "var(--card)", maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 sticky top-0 z-10" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-semibold" style={{ color: "var(--text)" }}>{title}</h3>
          <button onClick={onClose} className="tp-ib h-8 w-8 flex items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Confirm({ title, body, action, onClose, onConfirm }) {
  return (
    <Modal title={title} onClose={onClose} width="max-w-md">
      <div className="p-5 space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{body}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="tp-ib rounded-xl px-4 py-2 text-sm font-medium" style={{ color: "var(--text-2)" }}>Cancel</button>
          <button onClick={onConfirm} className="tp-pill rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: "#E5536E", color: "#fff" }}>{action}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------- page ---------------------------------- */

function PlugPlayPageInner() {
  const [meta, setMeta] = useState(null);
  const [flows, setFlows] = useState([]);
  const [libs, setLibs] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [view, setView] = useState("list");          // list | flow | templates
  const [listTab, setListTab] = useState("active");  // active | archived | trash
  const [currentId, setCurrentId] = useState(null);
  const [paletteDept, setPaletteDept] = useState("");
  const [tplDept, setTplDept] = useState("");
  const [tplFilter, setTplFilter] = useState("");
  const [typeEdit, setTypeEdit] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [expanded, setExpanded] = useState({});
  const [statusMenu, setStatusMenu] = useState(null);
  const [subPicker, setSubPicker] = useState(null);
  const [subDraft, setSubDraft] = useState({});
  const [drag, setDrag] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [, setTick] = useState(0);

  const [stepModal, setStepModal] = useState(null);
  const [sectionModal, setSectionModal] = useState(null);
  const [flowModal, setFlowModal] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const canvasRef = useRef(null);
  const flowsEtag = useRef(null);
  const pendingRef = useRef(null);   // queued save, if any
  const inflightRef = useRef(false); // a save is in the air
  const flow = useMemo(() => flows.find((f) => f.id === currentId) || null, [flows, currentId]);
  const statuses = meta?.statuses?.length ? meta.statuses : [FALLBACK_STATUS];
  const statusById = useMemo(() => Object.fromEntries(statuses.map((s) => [s.id, s])), [statuses]);
  const deptById = useMemo(() => Object.fromEntries((meta?.departments || []).map((d) => [d.id, d])), [meta]);
  const peopleById = useMemo(() => Object.fromEntries((meta?.people || []).map((p) => [p.id, p])), [meta]);
  const firstStatus = statuses[0]?.id || "todo";
  const doneStatus = statuses.find((s) => s.id === "done")?.id || statuses[statuses.length - 1]?.id;
  const schedule = useMemo(() => (flow ? scheduleItems(flow) : {}), [flow]);

  /* ------------------------------- loading -------------------------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [metaRes, flowRes] = await Promise.all([
          fetch("/api/plugplay/meta", { cache: "no-store" }),
          fetch("/api/plugplay/flows", { cache: "no-store" }),
        ]);
        if (!metaRes.ok) throw new Error(await readError(metaRes, "Unable to load the workspace."));
        if (!flowRes.ok) throw new Error(await readError(flowRes, "Unable to load playbooks."));
        const metaBody = await metaRes.json();
        const flowBody = await flowRes.json();
        if (!alive) return;
        flowsEtag.current = flowRes.headers.get("etag");
        setMeta(metaBody);
        setPaletteDept(metaBody.activeDept);
        setTplDept(metaBody.activeDept);
        setFlows(flowBody.flows || []);
      } catch (e) {
        if (alive) setErr(e.message || "Unable to load Plug & Play.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const loadLibrary = useCallback(async (dept) => {
    if (!dept) return;
    try {
      const res = await fetch(`/api/plugplay/templates?dept=${encodeURIComponent(dept)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Unable to load the plug library."));
      const body = await res.json();
      setLibs((cur) => ({ ...cur, [dept]: { types: body.types || [], templates: body.templates || [], canEdit: !!body.canEdit } }));
    } catch (e) { setErr(e.message || "Unable to load the plug library."); }
  }, []);

  useEffect(() => { if (paletteDept && !libs[paletteDept]) loadLibrary(paletteDept); }, [paletteDept, libs, loadLibrary]);
  useEffect(() => { if (tplDept && !libs[tplDept]) loadLibrary(tplDept); }, [tplDept, libs, loadLibrary]);
  useEffect(() => {
    if (!flow) return;
    [...new Set(flow.items.map((i) => i.dept).filter(Boolean))].filter((d) => !libs[d]).forEach((d) => loadLibrary(d));
  }, [flow, libs, loadLibrary]);

  // Only the elapsed counter needs the clock.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Playbooks are shared, so pick up other people's changes without a reload.
  // Nothing is held in the browser — this re-reads the department's blob, and
  // the ETag means an unchanged list costs a 304 and no payload.
  const refreshFlows = useCallback(async () => {
    if (pendingRef.current || inflightRef.current) return;   // never overwrite unsaved work
    if (document.visibilityState === "hidden") return;
    try {
      const res = await fetch("/api/plugplay/flows", {
        cache: "no-store",
        headers: flowsEtag.current ? { "If-None-Match": flowsEtag.current } : undefined,
      });
      if (res.status === 304 || !res.ok) return;
      const body = await res.json();
      if (pendingRef.current || inflightRef.current) return;  // an edit started mid-request
      flowsEtag.current = res.headers.get("etag");
      setFlows(body.flows || []);
    } catch { /* offline or a blip — the next pass picks it up */ }
  }, []);

  useEffect(() => {
    const every = setInterval(refreshFlows, 20000);
    const onFocus = () => refreshFlows();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(every);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshFlows]);

  /* ------------------------------- saving --------------------------------- */

  const pending = pendingRef;
  const timer = useRef(null);
  const inflight = inflightRef;
  const flushRef = useRef(null);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    // One save at a time. Two overlapping PATCHes would each answer with the
    // playbook as it was when they left, and the slower reply would undo the
    // newer edit.
    if (inflight.current) {
      if (pending.current) timer.current = setTimeout(() => flushRef.current?.(), 150);
      return;
    }
    const job = pending.current;
    pending.current = null;
    if (!job) return;

    inflight.current = true;
    setSaveState("saving");
    try {
      const res = await fetch("/api/plugplay/flows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id, data: job.data, event: job.event }),
      });
      if (!res.ok) throw new Error(await readError(res, "Unable to save the playbook."));
      const body = await res.json();
      flowsEtag.current = res.headers.get("etag");
      // Anything changed while this save was in the air is still only local,
      // so lay it back over the server's copy instead of losing it.
      const later = pending.current && pending.current.id === job.id ? pending.current.data : null;
      setFlows((body.flows || []).map((f) => (later && f.id === job.id ? { ...f, ...later } : f)));
      setSaveState(pending.current ? "saving" : "saved");
    } catch (e) {
      setSaveState("error");
      setErr(e.message || "Unable to save the playbook.");
    } finally {
      inflight.current = false;
      if (pending.current && !timer.current) timer.current = setTimeout(() => flushRef.current?.(), 150);
    }
  }, []);
  flushRef.current = flush;

  // One log entry per save, so a burst of edits doesn't flood the history.
  const queueSave = useCallback((id, data, event) => {
    if (pending.current && pending.current.id !== id) flush();
    const prev = pending.current?.data || {};
    pending.current = { id, data: { ...prev, ...data }, event: event || pending.current?.event };
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { flush(); }, 700);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (pending.current) flush(); };
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
      if (pending.current) flush();
    };
  }, [flush]);

  const patchFlow = useCallback((id, data, event) => {
    setFlows((list) => list.map((f) => (f.id === id ? { ...f, ...data } : f)));
    queueSave(id, data, event);
  }, [queueSave]);

  const setItems = useCallback((updater, event) => {
    if (!flow) return;
    const next = typeof updater === "function" ? updater(flow.items) : updater;
    patchFlow(flow.id, { items: next }, event);
  }, [flow, patchFlow]);

  /* ----------------------------- run controls ----------------------------- */

  const playFlow = (id) => {
    const f = flows.find((x) => x.id === id) || flow;
    if (!f) return;
    if (!f.startedAt) patchFlow(f.id, { startedAt: Date.now(), pausedMs: 0, pausedAt: null }, { verb: "played the playbook", kind: "run" });
    else if (f.pausedAt) patchFlow(f.id, { pausedMs: (f.pausedMs || 0) + (Date.now() - f.pausedAt), pausedAt: null }, { verb: "resumed the playbook", kind: "run" });
  };
  const pauseFlow = (id) => {
    const f = flows.find((x) => x.id === id) || flow;
    if (f?.startedAt && !f.pausedAt) patchFlow(f.id, { pausedAt: Date.now() }, { verb: "put the playbook on hold", kind: "run" });
  };
  const stopFlow = (id) => {
    const f = flows.find((x) => x.id === id) || flow;
    if (f) patchFlow(f.id, { startedAt: null, pausedAt: null, pausedMs: 0 }, { verb: "stopped the run", kind: "run" });
  };
  const archiveFlow = () => {
    if (!flow) return;
    const next = !flow.archived;
    patchFlow(flow.id, { archived: next }, { verb: next ? "archived the playbook" : "took the playbook out of the archive", kind: "edit" });
    if (next) { setListTab("archived"); setView("list"); }
  };

  /* ------------------------------- items ---------------------------------- */

  const blankStep = (dept) => ({
    kind: "step", id: newId("step"), title: "", dept: dept || meta?.activeDept || "", type: "",
    status: firstStatus, priority: "medium", duration: { value: 1, unit: "d" },
    assignees: [], subtasks: [], desc: "", notes: "", links: [],
  });
  const stepFromPlug = (tpl, dept) => ({
    ...blankStep(dept), title: tpl.title, type: tpl.type || "", priority: tpl.priority || "medium",
    duration: { ...tpl.duration }, desc: tpl.desc || "", notes: tpl.notes || "",
    links: (tpl.links || []).map((l) => ({ ...l })), templateId: tpl.id,
  });

  const insertItem = (item, index, event) =>
    setItems((list) => { const next = [...list]; next.splice(index == null ? next.length : index, 0, item); return next; }, event);

  const updateStep = (id, data, event) => setItems((list) => list.map((s) => (s.id === id ? { ...s, ...data } : s)), event);

  const applyStatus = (step, next) => {
    const patch = { status: next };
    if (next === doneStatus && step.status !== doneStatus) patch.doneAt = Date.now();
    if (next !== doneStatus) patch.doneAt = null;
    return patch;
  };

  const setStatus = (step, next) => {
    setStatusMenu(null);
    updateStep(step.id, applyStatus(step, next), { verb: `moved to ${statusById[next]?.name || next} —`, subject: step.title, kind: "step" });
  };

  const duplicateStep = (step) => setItems((list) => {
    const i = list.findIndex((x) => x.id === step.id);
    const copy = { ...JSON.parse(JSON.stringify(step)), id: newId("step"), title: `${step.title} (copy)`, doneAt: null };
    delete copy.taskId;
    const next = [...list]; next.splice(i + 1, 0, copy); return next;
  }, { verb: "duplicated", subject: step.title, kind: "step" });

  const removeItem = (item) => {
    setConfirm(null);
    setItems((list) => list.filter((x) => x.id !== item.id), {
      verb: item.kind === "section" ? "removed the section" : "removed",
      subject: item.kind === "section" ? item.label : item.title, kind: "step",
    });
  };

  const askRemove = (item) => {
    const isSec = item.kind === "section";
    setConfirm({
      title: `Delete ${isSec ? "section" : "step"}`,
      body: `Delete "${isSec ? item.label : item.title}"? ${isSec ? "The steps under it stay where they are." : item.subtasks?.length ? `Its ${item.subtasks.length} subtasks go with it.` : ""}`,
      action: "Delete",
      onConfirm: () => removeItem(item),
    });
  };

  // Ticking the last subtask finishes the step; unticking one reopens it.
  const toggleSub = (step, task) => {
    const subtasks = step.subtasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t));
    const allDone = subtasks.every((t) => t.done);
    const patch = { subtasks };
    if (allDone && step.status !== doneStatus) Object.assign(patch, applyStatus(step, doneStatus));
    if (!allDone && step.status === doneStatus) Object.assign(patch, applyStatus(step, firstStatus));
    updateStep(step.id, patch, { verb: `${task.done ? "unticked" : "ticked"} subtask`, subject: `${task.title} — ${step.title}`, kind: "sub" });
  };

  const addSub = (step) => {
    const title = (subDraft[step.id] || "").trim();
    if (!title) return;
    setSubDraft((d) => ({ ...d, [step.id]: "" }));
    updateStep(step.id, { subtasks: [...step.subtasks, { id: newId("st"), title, done: false, assignee: "" }] },
      { verb: "added subtask", subject: `${title} — ${step.title}`, kind: "sub" });
  };

  const setSubAssignee = (step, task, who) => {
    setSubPicker(null);
    updateStep(step.id, { subtasks: step.subtasks.map((t) => (t.id === task.id ? { ...t, assignee: who } : t)) },
      { verb: who ? `assigned ${peopleById[who]?.name || "someone"} to subtask` : "unassigned subtask", subject: task.title, kind: "sub" });
  };

  /* -------------------------------- drag ---------------------------------- */

  // A divider slots between rows, so it gets a line; a plug or step takes up
  // space, so it gets a card-shaped target.
  const dropStyle = () => {
    if (!drag) return "box";
    if (drag.kind === "section") return "line";
    if (drag.kind === "item") {
      const it = flow?.items.find((x) => x.id === drag.id);
      if (it?.kind === "section") return "line";
    }
    return "box";
  };

  // Aim at the nearest gap rather than at a thin strip between rows.
  const zoneFromPoint = (y) => {
    const rows = canvasRef.current?.querySelectorAll("[data-idx]") || [];
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (y < r.top + r.height / 2) return Number(row.dataset.idx);
    }
    return rows.length ? Number(rows[rows.length - 1].dataset.idx) + 1 : 0;
  };

  const onCanvasDragOver = (e) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = drag.kind === "item" ? "move" : "copy";
    const at = zoneFromPoint(e.clientY);
    if (at !== dropAt) setDropAt(at);
  };

  const onCanvasDrop = (e) => {
    if (!drag) return;
    e.preventDefault();
    const index = dropAt == null ? zoneFromPoint(e.clientY) : dropAt;
    const d = drag;
    setDrag(null); setDropAt(null);
    if (d.kind === "plug") {
      const tpl = libs[d.dept]?.templates.find((t) => t.id === d.id);
      if (tpl) insertItem(stepFromPlug(tpl, d.dept), index, { verb: "plugged in", subject: tpl.title, kind: "plug" });
    } else if (d.kind === "blank") {
      setStepModal({ mode: "new", index, step: blankStep(d.dept) });
    } else if (d.kind === "section") {
      setSectionModal({ mode: "new", index, section: { kind: "section", id: newId("sec"), label: "", dept: d.dept } });
    } else if (d.kind === "item") {
      const it = flow?.items.find((x) => x.id === d.id);
      setItems((list) => {
        const from = list.findIndex((x) => x.id === d.id);
        if (from < 0) return list;
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(next.length, index > from ? index - 1 : index)), 0, moved);
        return next;
      }, { verb: it?.kind === "section" ? "moved the section" : "reordered", subject: it?.kind === "section" ? it.label : it?.title, kind: "step" });
    }
  };

  /* ------------------------------- plugs page ------------------------------ */

  const lib = libs[tplDept] || { types: [], templates: [], canEdit: false };
  const countOfType = (id) => lib.templates.filter((t) => (id === "" ? !t.type : t.type === id)).length;
  const shownPlugs = lib.templates.filter((t) => !tplFilter || (tplFilter === "__none" ? !t.type : t.type === tplFilter));

  const saveLibrary = useCallback(async (dept, types, templates) => {
    setLibs((cur) => ({ ...cur, [dept]: { ...cur[dept], types, templates } }));
    try {
      const res = await fetch("/api/plugplay/templates", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dept, types, templates }),
      });
      if (!res.ok) throw new Error(await readError(res, "Unable to save the plugs."));
      const body = await res.json();
      setLibs((cur) => ({ ...cur, [body.dept]: { types: body.types, templates: body.templates, canEdit: true } }));
    } catch (e) { setErr(e.message || "Unable to save the plugs."); }
  }, []);

  const plugSet = (id, patch) => saveLibrary(tplDept, lib.types, lib.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const plugAdd = () => saveLibrary(tplDept, lib.types, [...lib.templates, {
    id: newId("tpl"), title: "New plug", type: tplFilter && tplFilter !== "__none" ? tplFilter : lib.types[0]?.id || "",
    priority: "medium", duration: { value: 1, unit: "d" }, desc: "", notes: "", links: [],
  }]);
  const plugDelete = (id) => saveLibrary(tplDept, lib.types, lib.templates.filter((t) => t.id !== id));
  const typeAdd = () => {
    const name = newTypeName.trim();
    if (!name) return;
    setNewTypeName("");
    saveLibrary(tplDept, [...lib.types, { id: newId("type"), name }], lib.templates);
  };
  const typeRename = (id, name) => saveLibrary(tplDept, lib.types.map((t) => (t.id === id ? { ...t, name: name.trim() || t.name } : t)), lib.templates);
  // Removing a type leaves its plugs untyped rather than deleting them.
  const typeDelete = (id) => saveLibrary(tplDept, lib.types.filter((t) => t.id !== id), lib.templates.map((t) => (t.type === id ? { ...t, type: "" } : t)));

  /* ----------------------------- playbook CRUD ---------------------------- */

  const flowsIn = (tab) => flows.filter((f) => (tab === "trash" ? f.deleted : tab === "archived" ? f.archived && !f.deleted : !f.archived && !f.deleted));

  const createFlow = async () => {
    const name = (flowModal?.name || "").trim();
    if (!name || !flowModal.depts.length) return;
    try {
      const res = await fetch("/api/plugplay/flows", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, desc: flowModal.desc, depts: flowModal.depts, from: flowModal.from || undefined,
          items: flowModal.from ? undefined : flowModal.depts.map((d) => ({ kind: "section", id: newId("sec"), label: deptById[d]?.name || "Section", dept: d })),
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Unable to create the playbook."));
      const body = await res.json();
      setFlows(body.flows || []);
      setCurrentId(body.flow?.id || null);
      setPaletteDept(flowModal.depts[0]);
      setFlowModal(null);
      setView("flow");
    } catch (e) { setErr(e.message || "Unable to create the playbook."); }
  };

  const saveFlowDetails = () => {
    const name = (flowModal?.name || "").trim();
    if (!name || !flowModal.depts.length) return;
    const renamed = flow.name !== name;
    patchFlow(flow.id, { name, desc: flowModal.desc, depts: flowModal.depts },
      { verb: renamed ? "renamed the playbook to" : "edited the playbook details", subject: renamed ? name : "", kind: "edit" });
    setFlowModal(null);
  };

  const purgeFlow = async (id) => {
    setConfirm(null);
    try {
      await flush();
      const res = await fetch("/api/plugplay/flows", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await readError(res, "Unable to delete the playbook."));
      const body = await res.json();
      setFlows(body.flows || []);
    } catch (e) { setErr(e.message || "Unable to delete the playbook."); }
  };

  /* -------------------------------- render -------------------------------- */

  if (loading) return <main className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--muted)" }}>Loading Plug &amp; Play…</main>;

  const openFlow = (id) => { setCurrentId(id); setView("flow"); setExpanded({}); setStatusMenu(null); setSubPicker(null); };
  const goList = async () => { if (pending.current) await flush(); setView("list"); };

  return (
    <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <header className="px-4 sm:px-7 pt-6 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        {view === "flow" && flow ? (
          <FlowHeader {...{ flow, deptById, doneStatus, saveState, goList, playFlow, pauseFlow, stopFlow, archiveFlow,
            setHistoryOpen, setFlowModal, setConfirm, patchFlow, setView, setListTab }} />
        ) : (
          <IndexHeader {...{ view, setView, listTab, setListTab, flowsIn, plugAdd, canEditPlugs: lib.canEdit }} />
        )}
        {err && (
          <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm" style={{ color: "#E5536E", background: "rgba(229,83,110,0.10)", border: "1px solid rgba(229,83,110,0.25)" }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span className="mr-auto">{err}</span>
            <button onClick={() => setErr("")} className="tp-ib h-6 w-6 flex items-center justify-center rounded-full"><X size={14} /></button>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 flex">
        <section ref={canvasRef} className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-7 py-6"
          onDragOver={view === "flow" ? onCanvasDragOver : undefined} onDrop={view === "flow" ? onCanvasDrop : undefined}>
          {view === "list" && (
            <PlaybookIndex {...{ flows: flowsIn(listTab), listTab, deptById, doneStatus, openFlow, playFlow, pauseFlow, stopFlow,
              patchFlow, setConfirm, purgeFlow, setFlowModal, meta }} />
          )}
          {view === "templates" && (
            <PlugsPage {...{ meta, tplDept, setTplDept, lib, tplFilter, setTplFilter, typeEdit, setTypeEdit, newTypeName, setNewTypeName,
              countOfType, shownPlugs, plugSet, plugAdd, plugDelete, typeAdd, typeRename, typeDelete }} />
          )}
          {view === "flow" && flow && (
            <FlowCanvas {...{ flow, schedule, statuses, statusById, deptById, peopleById, libs, doneStatus, expanded, setExpanded,
              drag, setDrag, dropAt, dropStyle, statusMenu, setStatusMenu, subPicker, setSubPicker, subDraft, setSubDraft,
              setStatus, duplicateStep, askRemove, setStepModal, setSectionModal, toggleSub, addSub, setSubAssignee, blankStep, meta }} />
          )}
        </section>

        {view === "flow" && (
          <aside className={`${paletteOpen ? "fixed inset-y-0 right-0 z-40 w-[88%] max-w-sm shadow-2xl" : "hidden"} lg:static lg:flex lg:w-80 xl:w-96 shrink-0 flex-col overflow-hidden`}
            style={{ background: "var(--sidebar)", borderLeft: "1px solid var(--border)" }}>
            <PlugLibrary {...{ meta, paletteDept, setPaletteDept, libs, query, setQuery, typeFilter, setTypeFilter, setDrag,
              onAdd: (tpl) => insertItem(stepFromPlug(tpl, paletteDept), null, { verb: "plugged in", subject: tpl.title, kind: "plug" }),
              onBlank: () => setStepModal({ mode: "new", index: null, step: blankStep(paletteDept) }),
              onSection: () => setSectionModal({ mode: "new", index: null, section: { kind: "section", id: newId("sec"), label: "", dept: paletteDept } }),
              onManage: () => { setTplDept(paletteDept); setView("templates"); },
              onClose: () => setPaletteOpen(false) }} />
          </aside>
        )}
      </div>

      {stepModal && (
        <StepModal data={stepModal} departments={meta?.departments || []} libs={libs} loadLibrary={loadLibrary} statuses={statuses} people={meta?.people || []}
          onClose={() => setStepModal(null)}
          onSave={(step, changed) => {
            if (stepModal.mode === "edit") updateStep(step.id, step, changed.length ? { verb: `edited ${changed.join(", ")} on`, subject: step.title, kind: "step" } : undefined);
            else insertItem(step, stepModal.index, { verb: "added the step", subject: step.title, kind: "step" });
            setStepModal(null);
          }} />
      )}

      {sectionModal && (
        <SectionModal data={sectionModal} departments={meta?.departments || []} onClose={() => setSectionModal(null)}
          onSave={(section) => {
            if (sectionModal.mode === "edit") setItems((list) => list.map((x) => (x.id === section.id ? section : x)), { verb: "renamed the section to", subject: section.label, kind: "edit" });
            else insertItem(section, sectionModal.index, { verb: "added the section", subject: section.label, kind: "edit" });
            setSectionModal(null);
          }} />
      )}

      {flowModal && (
        <FlowModal data={flowModal} setData={setFlowModal} departments={meta?.departments || []} flows={flowsIn("active")}
          onClose={() => setFlowModal(null)} onSave={flowModal.mode === "edit" ? saveFlowDetails : createFlow} />
      )}

      {historyOpen && flow && <HistoryModal flow={flow} peopleById={peopleById} onClose={() => setHistoryOpen(false)} />}
      {confirm && <Confirm {...confirm} onClose={() => setConfirm(null)} />}
    </main>
  );
}

/* --------------------------------- headers --------------------------------- */

function IndexHeader({ view, setView, listTab, setListTab, flowsIn, plugAdd, canEditPlugs }) {
  const onPlugs = view === "templates";
  return (
    <>
      <div className="flex items-start gap-3 flex-wrap">
        <span className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT }}><Puzzle size={20} style={{ color: ON_ACCENT }} /></span>
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Plug &amp; Play</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {onPlugs
              ? "Plugs are the ready-made tasks each department keeps — set the duration, priority and type once, then plug them into any playbook."
              : "A playbook is one process from start to finish. Build it once, then run it every time."}
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex items-center gap-3 flex-wrap">
        <span className="inline-flex rounded-2xl p-1 gap-1" style={{ background: "var(--col)", border: "1px solid var(--border)" }}>
          {[["list", "Playbooks", BookOpen], ["templates", "Plugs", Puzzle]].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setView(key)} className="tp-pill inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
              style={view === key ? { background: ACCENT, color: ON_ACCENT } : { color: "var(--muted)" }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </span>
        {onPlugs ? (
          canEditPlugs && (
            <button onClick={plugAdd} className="tp-pill ml-auto rounded-xl px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-1.5" style={{ background: ACCENT, color: ON_ACCENT }}>
              <Plus size={15} /> New plug
            </button>
          )
        ) : (
          <span className="ml-auto flex gap-1">
            {[["active", "Active"], ["archived", "Archived"], ["trash", "Trash"]].map(([key, label]) => (
              <button key={key} onClick={() => setListTab(key)} className="tp-ib rounded-xl px-3 py-1.5 text-xs"
                style={listTab === key ? { background: "var(--col)", color: "var(--text)", fontWeight: 600 } : { color: "var(--muted)", fontWeight: 500 }}>
                {label} <span style={{ opacity: 0.6 }}>{flowsIn(key).length}</span>
              </button>
            ))}
          </span>
        )}
      </div>
    </>
  );
}

function FlowHeader({ flow, deptById, doneStatus, saveState, goList, playFlow, pauseFlow, stopFlow, archiveFlow,
  setHistoryOpen, setFlowModal, setConfirm, patchFlow, setView, setListTab }) {
  const ds = (flow.depts || []).map((d) => deptById[d]).filter(Boolean);
  const steps = stepsOf(flow);
  const done = steps.filter((s) => s.status === doneStatus).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const state = runState(flow);

  return (
    <>
      <button onClick={goList} className="tp-ib inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium mb-2.5" style={{ color: "var(--text-2)" }}>
        <ChevronLeft size={14} /> All playbooks
      </button>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: ds[0]?.color || ACCENT }}>
          <Puzzle size={20} style={{ color: "#fff" }} />
        </span>
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>{flow.name}</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {ds.map((d) => d.name).join(" · ")}{ds.length ? " · " : ""}{steps.length} step{steps.length === 1 ? "" : "s"}
            {flow.startedAt ? ` · started ${fmtDay(flow.startedAt)}, ${fmtTime(new Date(flow.startedAt))}` : " · not started — dates below are projected"}
            {flow.pausedAt ? ` · on hold since ${fmtDay(flow.pausedAt)}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Run controls stay on one line at every width. */}
          <span className="flex items-center gap-2.5 shrink-0 flex-nowrap">
            {state === "idle" ? (
              <button onClick={() => playFlow(flow.id)} title="Start the playbook — this sets the target dates below"
                className="tp-pill inline-flex items-center gap-2.5 rounded-full pl-1 pr-5 text-sm font-semibold" style={{ height: 38, background: ACCENT, color: ON_ACCENT, boxShadow: "0 4px 16px rgba(229,62,48,.35)" }}>
                <span className="h-[30px] w-[30px] rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.24)" }}><Play size={13} fill="currentColor" /></span>
                Play
              </button>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 rounded-full px-4 text-xs font-semibold tabular-nums"
                  style={{ height: 38, ...(state === "paused" ? { background: "rgba(224,169,60,0.15)", color: "#E0A93C" } : { background: "rgba(63,163,122,0.14)", color: "#3FA37A" }) }}>
                  {state === "paused" ? <Pause size={11} fill="currentColor" /> : <span className="h-[7px] w-[7px] rounded-full" style={{ background: "#3FA37A" }} />}
                  {state === "paused" ? "Held at" : "Running"} {fmtElapsed(elapsedOf(flow))}
                </span>
                {state === "paused" ? (
                  <button onClick={() => playFlow(flow.id)} title="Resume — target dates pick up from now"
                    className="tp-pill inline-flex items-center gap-2.5 rounded-full pl-1 pr-5 text-sm font-semibold" style={{ height: 38, background: ACCENT, color: ON_ACCENT }}>
                    <span className="h-[30px] w-[30px] rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.24)" }}><Play size={13} fill="currentColor" /></span>
                    Resume
                  </button>
                ) : (
                  <button onClick={() => pauseFlow(flow.id)} title="Hold this playbook — the clock stops and targets slide"
                    className="tp-ib rounded-full flex items-center justify-center shrink-0"
                    style={{ height: 38, width: 38, background: "rgba(224,169,60,0.15)", color: "#E0A93C", border: "1px solid rgba(224,169,60,0.32)" }}><Pause size={15} fill="currentColor" /></button>
                )}
                <button onClick={() => stopFlow(flow.id)} title="Stop and clear the run" className="tp-ib rounded-full flex items-center justify-center shrink-0"
                  style={{ height: 38, width: 38, background: "rgba(229,83,110,0.13)", color: "#E5536E", border: "1px solid rgba(229,83,110,0.3)" }}><Square size={13} fill="currentColor" /></button>
              </>
            )}
          </span>

          <button onClick={() => setHistoryOpen(true)} title="History — who did what, and when"
            className="tp-ib rounded-xl flex items-center justify-center" style={{ height: 38, width: 38, ...field }}><Clock size={16} /></button>
          <button onClick={() => setFlowModal({ mode: "edit", name: flow.name, desc: flow.desc, depts: [...(flow.depts || [])] })}
            className="tp-ib rounded-xl px-3 text-sm font-medium inline-flex items-center gap-2" style={{ height: 38, ...field }}><Pencil size={15} /> Playbook details</button>
          <button onClick={archiveFlow} title={flow.archived ? "Take out of the archive" : "Archive — keeps it, out of the way"}
            className="tp-ib rounded-xl flex items-center justify-center" style={{ height: 38, width: 38, ...field }}>{flow.archived ? <RotateCcw size={16} /> : <Archive size={16} />}</button>
          <button onClick={() => setConfirm({
            title: "Move to Trash",
            body: `Move "${flow.name}" and its ${steps.length} steps to Trash? You can restore it from the Trash tab — tasks already created from it stay in Tasks.`,
            action: "Move to Trash",
            onConfirm: () => { patchFlow(flow.id, { deleted: true, deletedAt: Date.now() }, { verb: "moved the playbook to Trash", kind: "edit" }); setConfirm(null); setView("list"); setListTab("active"); },
          })} title="Move to Trash" className="tp-ib rounded-xl flex items-center justify-center" style={{ height: 38, width: 38, ...field, color: "#E5536E" }}><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <div className="min-w-[180px] flex-1 max-w-sm">
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--muted)" }}><span>{done} of {steps.length} done</span><span>{pct}%</span></div>
          <div className="rounded-full overflow-hidden" style={{ height: 7, background: "var(--grid)" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#3FA37A", transition: "width .2s ease" }} />
          </div>
        </div>
        <span className="text-xs ml-auto" style={{ color: saveState === "error" ? "#E5536E" : "var(--muted)" }}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "All changes saved" : saveState === "error" ? "Not saved" : ""}
        </span>
      </div>
    </>
  );
}

/* ------------------------------ playbook index ----------------------------- */

function PlaybookIndex({ flows, listTab, deptById, doneStatus, openFlow, playFlow, pauseFlow, stopFlow, patchFlow, setConfirm, purgeFlow, setFlowModal, meta }) {
  const empty = { active: "No active playbooks yet.", archived: "Nothing archived.", trash: "Trash is empty." }[listTab];
  const stop = (e) => e.stopPropagation();

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))" }}>
      {flows.map((f) => {
        const steps = stepsOf(f);
        const done = steps.filter((s) => s.status === doneStatus).length;
        const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
        const sections = f.items.filter((i) => i.kind === "section").length;
        const ds = (f.depts || []).map((d) => deptById[d]).filter(Boolean);
        const state = runState(f);
        return (
          <div key={f.id} role="button" tabIndex={0} onClick={() => openFlow(f.id)} onKeyDown={(e) => e.key === "Enter" && openFlow(f.id)}
            className="tp-card rounded-2xl p-4 text-left flex flex-col gap-2.5 cursor-pointer" style={{ ...panel, opacity: f.deleted ? 0.72 : 1 }}>
            <div className="flex items-center gap-2" style={{ minHeight: 24 }}>
              {state === "running" && <Chip color="#3FA37A" soft="rgba(63,163,122,0.14)"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "#3FA37A" }} />{fmtElapsed(elapsedOf(f))}</Chip>}
              {state === "paused" && <Chip color="#E0A93C" soft="rgba(224,169,60,0.15)"><Pause size={10} fill="currentColor" />{fmtElapsed(elapsedOf(f))}</Chip>}
              {f.archived && !f.deleted && <Chip><Archive size={11} /> Archived</Chip>}
              <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>{f.deleted ? `Trashed ${fmtDay(f.deletedAt || Date.now())}` : fmtDay(f.updatedAt)}</span>
            </div>
            <h3 className="font-semibold text-[15px] leading-snug" style={{ color: "var(--text)" }}>{f.name}</h3>
            {f.desc && <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--muted)" }}>{f.desc}</p>}
            <div className="rounded-full overflow-hidden mt-auto" style={{ height: 6, background: "var(--grid)" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#3FA37A" }} />
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
              {listTab === "trash" ? (
                <>
                  <button onClick={(e) => { stop(e); patchFlow(f.id, { deleted: false }, { verb: "restored the playbook from Trash", kind: "edit" }); }}
                    title="Restore" className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "var(--col)", color: "var(--text-2)" }}><RotateCcw size={12} /></button>
                  <button onClick={(e) => { stop(e); setConfirm({ title: "Delete for good", body: `"${f.name}" and its history will be gone for good. This cannot be undone.`, action: "Delete for good", onConfirm: () => purgeFlow(f.id) }); }}
                    title="Delete for good" className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "rgba(229,83,110,0.13)", color: "#E5536E" }}><Trash2 size={12} /></button>
                </>
              ) : state === "idle" ? (
                <button onClick={(e) => { stop(e); playFlow(f.id); openFlow(f.id); }} title="Play this playbook"
                  className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: ACCENT, color: ON_ACCENT }}><Play size={11} fill="currentColor" /></button>
              ) : (
                <>
                  {state === "paused" ? (
                    <button onClick={(e) => { stop(e); playFlow(f.id); }} title="Resume" className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: ACCENT, color: ON_ACCENT }}><Play size={11} fill="currentColor" /></button>
                  ) : (
                    <button onClick={(e) => { stop(e); pauseFlow(f.id); }} title="Hold" className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "rgba(224,169,60,0.15)", color: "#E0A93C" }}><Pause size={11} fill="currentColor" /></button>
                  )}
                  <button onClick={(e) => { stop(e); stopFlow(f.id); }} title="Stop and clear the run" className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: "rgba(229,83,110,0.13)", color: "#E5536E" }}><Square size={10} fill="currentColor" /></button>
                </>
              )}
              <span>{done}/{steps.length} done</span><span>·</span><span>{sections} section{sections === 1 ? "" : "s"}</span>
            </div>
            <div className="flex items-center gap-2 pt-3 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--muted)" }}>Departments</span>
              <span className="flex gap-1.5 ml-auto">
                {ds.map((d) => (
                  <span key={d.id} title={d.name} className="rounded-lg flex items-center justify-center text-[10px] font-bold"
                    style={{ height: 22, minWidth: 22, padding: "0 6px", background: `${d.color}1F`, color: d.color }}>{d.short}</span>
                ))}
              </span>
            </div>
          </div>
        );
      })}

      {!flows.length && <p className="col-span-full text-center text-sm py-10" style={{ color: "var(--muted)" }}>{empty}</p>}

      {listTab === "active" && (
        <button onClick={() => setFlowModal({ mode: "new", name: "", desc: "", depts: [meta?.activeDept].filter(Boolean), from: "" })}
          className="tp-card rounded-2xl p-4 flex items-center justify-center gap-2.5 text-sm font-semibold"
          style={{ minHeight: 170, background: ACCENT, color: ON_ACCENT, border: "none", boxShadow: "0 8px 26px rgba(229,62,48,.3)" }}>
          <Plus size={18} /> New playbook
        </button>
      )}
    </div>
  );
}

/* -------------------------------- plugs page ------------------------------- */

function PlugsPage({ meta, tplDept, setTplDept, lib, tplFilter, setTplFilter, typeEdit, setTypeEdit, newTypeName, setNewTypeName,
  countOfType, shownPlugs, plugSet, plugAdd, plugDelete, typeAdd, typeRename, typeDelete }) {
  const dp = (meta?.departments || []).find((d) => d.id === tplDept);
  const pill = (on) => (on ? { background: "var(--text)", color: "var(--surface)" } : { background: "transparent", border: "1px solid var(--border)", color: "var(--text-2)" });

  return (
    <>
      <div className="flex gap-1 flex-wrap mb-5" style={{ borderBottom: "1px solid var(--border)" }}>
        {(meta?.departments || []).map((d) => (
          <button key={d.id} onClick={() => { setTplDept(d.id); setTplFilter(""); }} className="px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2"
            style={{ marginBottom: -1, borderBottom: "2px solid transparent", ...(d.id === tplDept ? { color: d.color, borderBottomColor: d.color } : { color: "var(--text-2)" }) }}>
            {d.name}
            {d.id === tplDept && <span className="rounded-full px-1.5 text-[11px] font-semibold" style={{ background: "var(--col)", color: "var(--muted)" }}>{lib.templates.length}</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Task types</span>
        <button onClick={() => setTplFilter("")} className="tp-pill rounded-full px-2.5 py-1 text-xs font-medium" style={pill(tplFilter === "")}>
          All <span style={{ opacity: 0.6 }}>{lib.templates.length}</span>
        </button>
        {lib.types.map((t) => (
          <button key={t.id} onClick={() => setTplFilter(tplFilter === t.id ? "" : t.id)} className="tp-pill rounded-full px-2.5 py-1 text-xs font-medium" style={pill(tplFilter === t.id)}>
            {t.name} <span style={{ opacity: 0.6 }}>{countOfType(t.id)}</span>
          </button>
        ))}
        {countOfType("") > 0 && (
          <button onClick={() => setTplFilter(tplFilter === "__none" ? "" : "__none")} className="tp-pill rounded-full px-2.5 py-1 text-xs font-medium" style={pill(tplFilter === "__none")}>
            No type <span style={{ opacity: 0.6 }}>{countOfType("")}</span>
          </button>
        )}
        {lib.canEdit && (
          <button onClick={() => setTypeEdit((v) => !v)} className="tp-pill ml-auto rounded-xl px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
            style={typeEdit ? { background: "#E53E30", color: "#fff" } : { background: "rgba(229,62,48,0.12)", color: "#E53E30", border: "1px solid rgba(229,62,48,0.28)" }}>
            {typeEdit ? <><Check size={14} /> Done</> : <><Pencil size={13} /> Manage types</>}
          </button>
        )}
      </div>

      {typeEdit && lib.canEdit && (
        <div className="rounded-2xl p-1.5 mb-4" style={panel}>
          {lib.types.map((t) => (
            <div key={t.id} className="grid items-center gap-3 px-2.5 py-2 rounded-xl" style={{ gridTemplateColumns: "1fr auto auto" }}>
              <input defaultValue={t.name} onBlur={(e) => typeRename(t.id, e.target.value)} className="rounded-lg px-3 py-1.5 text-sm outline-none" style={field} />
              <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>{countOfType(t.id)} plug{countOfType(t.id) === 1 ? "" : "s"}</span>
              <button onClick={() => typeDelete(t.id)} title={countOfType(t.id) ? "Remove — its plugs become untyped" : "Remove"}
                className="tp-ib h-8 w-8 flex items-center justify-center rounded-lg" style={{ color: "#E5536E" }}><Trash2 size={15} /></button>
            </div>
          ))}
          <div className="flex gap-2 px-2.5 pt-2.5 pb-1.5 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && typeAdd()}
              placeholder="Add a task type — e.g. Retouch" className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none" style={field} />
            <button onClick={typeAdd} className="tp-pill rounded-lg px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-1.5" style={{ background: ACCENT, color: ON_ACCENT }}><Plus size={14} /> Add</button>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--muted)", maxWidth: "70ch" }}>
        Everyone can plug these in; only {dp?.name}&rsquo;s head or an admin can change them. An edit here applies to plugs used from now on — steps already sitting in a playbook keep what they were given.
      </p>

      <div className="hidden md:grid gap-3 px-3.5 pb-2 text-[11px] font-semibold" style={{ gridTemplateColumns: "minmax(200px,2.2fr) 1.1fr 1fr 1.25fr 34px", color: "var(--muted)" }}>
        <span>Plug</span><span>Type</span><span>Priority</span><span>Duration</span><span />
      </div>

      {shownPlugs.map((t) => (
        <div key={t.id} className="grid gap-3 items-center rounded-2xl px-3.5 py-3 mb-2.5 md:grid-cols-[minmax(200px,2.2fr)_1.1fr_1fr_1.25fr_34px] grid-cols-1" style={panel}>
          <div>
            <input defaultValue={t.title} disabled={!lib.canEdit} onBlur={(e) => plugSet(t.id, { title: e.target.value })} placeholder="Plug name"
              className="w-full rounded-lg px-3 py-1.5 text-sm font-semibold outline-none" style={field} />
            <input defaultValue={t.desc} disabled={!lib.canEdit} onBlur={(e) => plugSet(t.id, { desc: e.target.value })} placeholder="Short description shown on the card"
              className="w-full rounded-lg px-3 py-1.5 text-xs outline-none mt-1.5" style={field} />
          </div>
          <select value={t.type || ""} disabled={!lib.canEdit} onChange={(e) => plugSet(t.id, { type: e.target.value })} className="rounded-lg px-3 py-2 text-sm outline-none" style={field}>
            <option value="">No type</option>
            {lib.types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select value={t.priority} disabled={!lib.canEdit} onChange={(e) => plugSet(t.id, { priority: e.target.value })} className="rounded-lg px-3 py-2 text-sm outline-none" style={field}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRI[p].name}</option>)}
          </select>
          <span className="flex gap-2">
            <input type="number" min="0" defaultValue={t.duration.value} disabled={!lib.canEdit}
              onBlur={(e) => plugSet(t.id, { duration: { ...t.duration, value: Number(e.target.value) } })}
              className="rounded-lg px-2.5 py-2 text-sm outline-none" style={{ ...field, width: 68 }} />
            <select value={t.duration.unit} disabled={!lib.canEdit} onChange={(e) => plugSet(t.id, { duration: { ...t.duration, unit: e.target.value } })}
              className="flex-1 rounded-lg px-2 py-2 text-sm outline-none" style={field}>
              {UNITS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </span>
          {lib.canEdit && <button onClick={() => plugDelete(t.id)} className="tp-ib h-8 w-8 flex items-center justify-center rounded-lg" style={{ color: "#E5536E" }}><Trash2 size={15} /></button>}
        </div>
      ))}

      {!shownPlugs.length && <p className="text-center text-sm py-8" style={{ color: "var(--muted)" }}>No plugs here yet.</p>}

      {lib.canEdit && (
        <button onClick={plugAdd} className="tp-ib w-full rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 mt-1"
          style={{ border: "1px dashed var(--border)", color: "var(--text-2)" }}><Plus size={16} /> Add a plug</button>
      )}
    </>
  );
}

/* ------------------------------- flow canvas ------------------------------- */

function FlowCanvas({ flow, schedule, statuses, statusById, deptById, peopleById, libs, doneStatus, expanded, setExpanded,
  drag, setDrag, dropAt, dropStyle, statusMenu, setStatusMenu, subPicker, setSubPicker, subDraft, setSubDraft,
  setStatus, duplicateStep, askRemove, setStepModal, setSectionModal, toggleSub, addSub, setSubAssignee, blankStep, meta }) {

  const running = !!flow.startedAt;
  const hols = upcomingHolidays(3).map((h) => {
    const a = new Date(`${h.from}T00:00:00`); const b = h.to ? new Date(`${h.to}T00:00:00`) : null;
    return `${b ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]}`} ${h.name}`;
  }).join(" · ");

  const zone = (i) => {
    const on = dropAt === i;
    const style = dropStyle();
    return (
      <div key={`z${i}`} style={{ height: on ? (style === "line" ? 26 : 44) : 18, paddingLeft: 112, display: "flex", alignItems: "center", transition: "height .1s ease" }}>
        {on && (style === "line"
          ? <span style={{ flex: "1 1 auto", height: 3, borderRadius: 3, background: "#E53E30", boxShadow: "0 0 12px rgba(229,62,48,.6)" }} />
          : <span className="flex-1 h-full flex items-center justify-center text-xs font-medium" style={{ border: "2px dashed #E53E30", borderRadius: 14, color: "#E53E30", background: "rgba(229,62,48,.07)" }}>Drop here</span>)}
      </div>
    );
  };

  const rows = [zone(0)];
  let num = 0;

  flow.items.forEach((item, i) => {
    if (item.kind === "section") {
      const dp = item.dept ? deptById[item.dept] : null;
      let n = 0;
      for (let k = i + 1; k < flow.items.length && flow.items[k].kind !== "section"; k += 1) n += 1;
      rows.push(
        // Spacing is padding, not margin: a margin would be dead space the drop
        // target can't see.
        <div key={item.id} data-idx={i} draggable
          onDragStart={(e) => { if (e.target.closest("input,select,textarea,a,button")) { e.preventDefault(); return; } setDrag({ kind: "item", id: item.id }); }}
          onDragEnd={() => setDrag(null)} className="flex items-center gap-3 group"
          style={{ padding: "18px 4px 12px 68px", cursor: "grab", opacity: drag?.id === item.id ? 0.35 : 1 }}>
          <span className="shrink-0 flex justify-center" style={{ width: 30, color: "var(--faint)" }}><GripVertical size={15} /></span>
          {dp && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: dp.color }} />}
          <h3 className="text-[13px] font-semibold whitespace-nowrap" style={{ color: dp?.color || "var(--text)" }}>{item.label}</h3>
          <span className="text-xs whitespace-nowrap" style={{ color: "var(--muted)" }}>{n ? `${n} task${n === 1 ? "" : "s"}` : "No tasks yet"}</span>
          <span className="flex-1 min-w-[18px]" style={{ height: 1, background: "var(--border)" }} />
          <button onClick={() => setSectionModal({ mode: "edit", section: { ...item } })} className="tp-ib h-7 w-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100" style={{ color: "var(--text-2)" }}><Pencil size={14} /></button>
          <button onClick={() => askRemove(item)} className="tp-ib h-7 w-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100" style={{ color: "#E5536E" }}><Trash2 size={14} /></button>
        </div>
      );
      rows.push(zone(i + 1));
      return;
    }

    num += 1;
    const st = statusById[item.status] || FALLBACK_STATUS;
    const dp = deptById[item.dept];
    const ty = (libs[item.dept]?.types || []).find((t) => t.id === item.type);
    const isDone = item.status === doneStatus;
    const open = !!expanded[item.id];
    const people = item.assignees.map((id) => peopleById[id]).filter(Boolean);
    const subDone = item.subtasks.filter((t) => t.done).length;
    const pct = item.subtasks.length ? Math.round((subDone / item.subtasks.length) * 100) : null;
    const target = schedule[item.id]?.end;
    const late = target && !isDone && running && target.getTime() < Date.now();
    const last = !flow.items.slice(i + 1).some((x) => x.kind === "step");
    const roster = (meta?.people || []).filter((p) => p.dept === item.dept);

    rows.push(
      <div key={item.id} data-idx={i} className="flex gap-3.5">
        <div className="shrink-0 text-right" style={{ width: 54, paddingTop: 2, lineHeight: 1.15, opacity: running ? 1 : 0.5 }}
          title={running ? "Target finish" : "Projected — play the playbook to set real dates"}>
          {target && (
            <>
              <span className="block text-[10.5px] font-semibold" style={{ color: "var(--muted)" }}>{MONTHS[target.getMonth()]}</span>
              <span className="block text-lg font-bold tracking-tight" style={{ color: late ? "#E5536E" : isDone ? "#3FA37A" : "var(--text)" }}>{target.getDate()}</span>
              <span className="block text-[10.5px] mt-0.5" style={{ color: late ? "#E5536E" : "var(--muted)" }}>{fmtTime(target)}</span>
            </>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-center" style={{ width: 30 }}>
          <span className="rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ height: 30, width: 30, background: isDone ? st.color : "var(--card)", color: isDone ? "#fff" : st.color, border: `2px solid ${st.color}` }}>
            {isDone ? <Check size={14} /> : num}
          </span>
          {!last && <span className="flex-1" style={{ width: 2, background: "var(--grid)", minHeight: 14 }} />}
        </div>

        <div className="flex-1 min-w-0 pb-0.5">
          <div draggable
            onDragStart={(e) => { if (e.target.closest("input,select,textarea,a,button,[data-detail]")) { e.preventDefault(); return; } setDrag({ kind: "item", id: item.id }); }}
            onDragEnd={() => setDrag(null)}
            onClick={(e) => { if (e.target.closest("button,select,input,textarea,a,[data-detail]")) return; setStatusMenu(null); setSubPicker(null); setExpanded((x) => ({ ...x, [item.id]: !open })); }}
            className="tp-card rounded-2xl px-4 py-3.5 group cursor-pointer" style={{ ...panel, opacity: drag?.id === item.id ? 0.35 : 1 }}>

            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0" style={{ color: "var(--faint)", cursor: "grab" }}><GripVertical size={16} /></span>
              <Chip color={PRI[item.priority].color} soft={PRI[item.priority].soft}>{PRI[item.priority].name}</Chip>
              <span className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setStepModal({ mode: "edit", step: JSON.parse(JSON.stringify(item)) })} className="tp-ib h-7 w-7 flex items-center justify-center rounded-lg" style={{ color: "var(--text-2)" }}><Pencil size={14} /></button>
                <button onClick={() => askRemove(item)} className="tp-ib h-7 w-7 flex items-center justify-center rounded-lg" style={{ color: "#E5536E" }}><Trash2 size={14} /></button>
              </span>
            </div>

            <div className="pl-6">
              <p className="text-[14.5px] font-semibold leading-snug" style={{ color: "var(--text)", textDecoration: isDone ? "line-through" : "none" }}>{item.title || "Untitled step"}</p>
              {item.desc && <p className="text-xs leading-relaxed mt-1 line-clamp-2" style={{ color: "var(--muted)" }}>{item.desc}</p>}

              {/* Subtasks and progress share one line; a step without subtasks has neither. */}
              {item.subtasks.length > 0 && (
                <button onClick={() => setExpanded((x) => ({ ...x, [item.id]: !open }))} className="flex items-center gap-2.5 w-full mt-3 text-xs" style={{ color: "var(--text-2)" }}>
                  <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap">
                    {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Subtasks <span className="font-semibold tabular-nums">{subDone}/{item.subtasks.length}</span>
                  </span>
                  <span className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: "var(--grid)" }}>
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: st.color, transition: "width .25s ease" }} />
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>{pct}%</span>
                </button>
              )}

              <div className="flex items-center gap-2 flex-wrap mt-3">
                {dp && <Chip color={dp.color} soft={`${dp.color}1F`}>{dp.name}</Chip>}
                {ty && <Chip outline>{ty.name}</Chip>}
                <Chip><Clock size={11} /> {fmtDuration(item.duration)}</Chip>
                {isDone && item.doneAt && <Chip color="#3FA37A" soft="rgba(63,163,122,0.14)"><Check size={11} /> Completed {fmtDay(item.doneAt)}</Chip>}
                <span className="ml-auto relative">
                  <button onClick={() => setStatusMenu(statusMenu === item.id ? null : item.id)}
                    className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-2.5 py-1 text-xs font-medium"
                    style={{ background: st.soft || "var(--col)", color: st.color, border: `1px solid ${st.color}33` }}>
                    {st.name} <ChevronDown size={12} />
                  </button>
                  {statusMenu === item.id && (
                    <span className="absolute right-0 z-30 mt-1.5 rounded-xl p-1.5 grid gap-0.5 shadow-xl" style={{ ...panel, minWidth: 160 }}>
                      {statuses.map((s) => (
                        <button key={s.id} onClick={() => setStatus(item, s.id)} className="tp-row flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-left w-full"
                          style={s.id === item.status ? { background: "var(--col)", color: "var(--text)", fontWeight: 600 } : { color: "var(--text-2)" }}>
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} /> {s.name}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2.5 mt-3 pt-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                <Avatars list={people} />
                <span className="ml-auto flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
                  <span className="inline-flex items-center gap-1.5"><Link2 size={12} /> {item.links.length}</span>
                  <span className="inline-flex items-center gap-1.5"><Pencil size={12} /> {item.notes ? 1 : 0}</span>
                </span>
              </div>

              {open && (
                <div data-detail className="mt-3.5 pt-3.5 grid gap-2.5 text-sm" style={{ borderTop: "1px solid var(--border)", color: "var(--text-2)" }}>
                  <div className="grid gap-0.5">
                    {item.subtasks.map((task) => {
                      const who = peopleById[task.assignee];
                      return (
                        <div key={task.id} className="flex items-center gap-2.5 px-1 py-1 rounded-lg relative">
                          <button onClick={() => toggleSub(item, task)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left text-[13px]">
                            <span className="rounded-md flex items-center justify-center shrink-0" style={{ height: 17, width: 17, ...(task.done ? { background: "#3FA37A", border: "1.5px solid #3FA37A", color: "#fff" } : { border: "1.5px solid var(--faint)" }) }}>
                              {task.done && <Check size={11} />}
                            </span>
                            <span style={{ textDecoration: task.done ? "line-through" : "none", color: task.done ? "var(--muted)" : "var(--text-2)" }}>{task.title}</span>
                          </button>
                          <button onClick={() => setSubPicker(subPicker === task.id ? null : task.id)} title={who ? who.name : "Assign someone"}
                            className="rounded-full flex items-center justify-center text-[9.5px] font-semibold shrink-0"
                            style={{ height: 23, minWidth: 23, ...(who ? { background: who.c, color: "#fff" } : { border: "1.5px dashed var(--faint)", color: "var(--faint)" }) }}>
                            {who ? who.i : <Plus size={11} />}
                          </button>
                          {subPicker === task.id && (
                            <span className="absolute right-0 top-full z-30 mt-1 rounded-xl p-1.5 grid gap-0.5 shadow-xl" style={{ ...panel, minWidth: 172 }}>
                              <button onClick={() => setSubAssignee(item, task, "")} className="tp-row flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left" style={{ color: "var(--text-2)" }}>
                                <span className="rounded-full flex items-center justify-center" style={{ height: 19, width: 19, border: "1.5px dashed var(--faint)" }}><Minus size={10} /></span> Unassigned
                              </button>
                              {roster.map((m) => (
                                <button key={m.id} onClick={() => setSubAssignee(item, task, m.id)} className="tp-row flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left" style={{ color: "var(--text-2)" }}>
                                  <span className="rounded-full flex items-center justify-center text-[8px] font-semibold" style={{ height: 19, width: 19, background: m.c, color: "#fff" }}>{m.i}</span> {m.name}
                                </button>
                              ))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {!item.subtasks.length && <p className="text-[13px]" style={{ color: "var(--muted)" }}>No subtasks yet.</p>}
                  </div>

                  <div className="flex gap-2">
                    <input value={subDraft[item.id] || ""} onChange={(e) => setSubDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addSub(item)} placeholder="Add a subtask and press Enter"
                      className="flex-1 rounded-lg px-3 py-1.5 text-[13px] outline-none" style={field} />
                    <button onClick={() => addSub(item)} className="tp-ib rounded-lg px-3 text-sm font-medium" style={field}>Add</button>
                  </div>

                  {item.notes && <p className="rounded-xl px-3 py-2.5 whitespace-pre-wrap" style={{ background: "var(--col)" }}>{item.notes}</p>}
                  {item.links.map((l, li) => (
                    <a key={li} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm hover:underline" style={{ color: "#3E8ED0" }}>
                      <Link2 size={13} /> {l.label}
                    </a>
                  ))}
                  <button onClick={() => duplicateStep(item)} className="tp-ib justify-self-start rounded-lg px-3 py-1.5 text-xs font-medium" style={{ color: "var(--text-2)" }}>Duplicate step</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
    rows.push(zone(i + 1));
  });

  return (
    <div className="max-w-[880px]">
      {flow.desc && <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-2)", maxWidth: "62ch" }}>{flow.desc}</p>}
      <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--muted)", maxWidth: "70ch" }}>
        Targets follow the SII work week — Mon to Fri 8:00 AM to 6:36 PM, last working day of the week 7:00 AM to 5:36 PM, breaks excluded.
        Philippine holidays are skipped{hols ? `: next up ${hols}` : ""}.
      </p>

      {!flow.items.length && (
        <div className="rounded-2xl px-5 py-10 text-center text-sm mb-2" style={{ border: "2px dashed var(--border)", color: "var(--muted)" }}>
          Drag a plug in from the library, or add a step below.
        </div>
      )}

      {rows}

      <div className="flex gap-2.5 mt-4" style={{ paddingLeft: 112 }}>
        <button onClick={() => setStepModal({ mode: "new", index: null, step: blankStep(meta?.activeDept) })}
          className="tp-ib flex-1 rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-center gap-2" style={{ border: "1px dashed var(--border)", color: "var(--text-2)" }}>
          <Plus size={16} /> Add a step
        </button>
        <button onClick={() => setSectionModal({ mode: "new", index: null, section: { kind: "section", id: newId("sec"), label: "", dept: meta?.activeDept || "" } })}
          className="tp-ib rounded-2xl px-5 py-3 text-sm font-medium flex items-center justify-center gap-2" style={{ border: "1px dashed var(--border)", color: "var(--text-2)" }}>
          <Minus size={16} /> Add a section
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- plug library ------------------------------ */

function PlugLibrary({ meta, paletteDept, setPaletteDept, libs, query, setQuery, typeFilter, setTypeFilter, setDrag, onAdd, onBlank, onSection, onManage, onClose }) {
  const lib = libs[paletteDept] || { types: [], templates: [], canEdit: false };
  const q = query.trim().toLowerCase();
  const list = lib.templates.filter((t) => (!typeFilter || t.type === typeFilter) && (!q || t.title.toLowerCase().includes(q) || (t.desc || "").toLowerCase().includes(q)));
  const dept = (meta?.departments || []).find((d) => d.id === paletteDept);

  return (
    <>
      <div className="px-4 pt-4 pb-3.5 shrink-0 grid gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm mr-auto" style={{ color: "var(--text)" }}>Plugs</h2>
          <button onClick={onManage} title="Edit this department's plugs" className="tp-ib h-7 w-7 flex items-center justify-center rounded-lg" style={{ color: "var(--text-2)" }}><Settings size={15} /></button>
          <button onClick={onClose} className="lg:hidden tp-ib h-7 w-7 flex items-center justify-center rounded-lg" style={{ color: "var(--text-2)" }}><X size={16} /></button>
        </div>
        <select value={paletteDept} onChange={(e) => { setPaletteDept(e.target.value); setTypeFilter(""); }} className="w-full rounded-xl px-3 py-2 text-sm font-medium outline-none" style={field}>
          {(meta?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={field}>
          <Search size={15} style={{ color: "var(--muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plugs" className="w-full text-sm outline-none bg-transparent" />
        </div>
        {lib.types.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setTypeFilter("")} className="tp-pill rounded-full px-2.5 py-1 text-xs font-medium"
              style={typeFilter === "" ? { background: ACCENT, color: ON_ACCENT } : { background: "var(--col)", color: "var(--text-2)" }}>All</button>
            {lib.types.map((t) => (
              <button key={t.id} onClick={() => setTypeFilter(typeFilter === t.id ? "" : t.id)} className="tp-pill rounded-full px-2.5 py-1 text-xs font-medium"
                style={typeFilter === t.id ? { background: ACCENT, color: ON_ACCENT } : { background: "var(--col)", color: "var(--text-2)" }}>{t.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3.5 grid gap-2.5 content-start">
        <div draggable onDragStart={() => setDrag({ kind: "blank", dept: paletteDept })} onDragEnd={() => setDrag(null)} onClick={onBlank}
          className="tp-ib rounded-xl px-3 py-2.5 text-sm font-medium flex items-center gap-2.5" style={{ border: "1px dashed var(--border)", color: "var(--text-2)", cursor: "grab" }}>
          <Plus size={15} /> Blank task (not a plug)
        </div>
        <div draggable onDragStart={() => setDrag({ kind: "section", dept: paletteDept })} onDragEnd={() => setDrag(null)} onClick={onSection}
          className="tp-ib rounded-xl px-3 py-2.5 text-sm font-medium flex items-center gap-2.5" style={{ border: "1px dashed var(--border)", color: "var(--text-2)", cursor: "grab" }}>
          <Minus size={15} /> Section divider
        </div>
        <p className="text-[11px] font-semibold pt-1 px-0.5" style={{ color: "var(--muted)" }}>{dept?.name} plugs</p>

        {list.map((tpl) => {
          const ty = lib.types.find((t) => t.id === tpl.type);
          return (
            <div key={tpl.id} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "copy"; setDrag({ kind: "plug", id: tpl.id, dept: paletteDept }); }}
              onDragEnd={() => setDrag(null)} className="tp-card rounded-xl px-3 py-3" style={{ ...panel, cursor: "grab" }}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 mr-auto">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>{tpl.title}</p>
                  {tpl.desc && <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: "var(--muted)" }}>{tpl.desc}</p>}
                </div>
                <button onClick={() => onAdd(tpl)} title="Add to the end of the playbook" className="tp-ib h-7 w-7 flex items-center justify-center rounded-lg shrink-0" style={{ color: "var(--text-2)" }}><Plus size={15} /></button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                {ty && <Chip outline>{ty.name}</Chip>}
                <Chip color={PRI[tpl.priority].color} soft={PRI[tpl.priority].soft}>{PRI[tpl.priority].name}</Chip>
                <Chip><Clock size={11} /> {fmtDuration(tpl.duration)}</Chip>
              </div>
            </div>
          );
        })}
        {!list.length && <p className="text-sm py-6 text-center" style={{ color: "var(--muted)" }}>{lib.templates.length ? "Nothing matches that search." : "This department has no plugs yet."}</p>}
      </div>
    </>
  );
}

/* --------------------------------- modals ---------------------------------- */

function StepModal({ data, departments, libs, loadLibrary, statuses, people, onClose, onSave }) {
  const [step, setStep] = useState(() => ({
    ...data.step,
    links: (data.step.links || []).map((l) => ({ ...l })),
    subtasks: (data.step.subtasks || []).map((t) => ({ ...t })),
  }));
  const set = (patch) => setStep((s) => ({ ...s, ...patch }));
  useEffect(() => { if (step.dept && !libs[step.dept]) loadLibrary(step.dept); }, [step.dept, libs, loadLibrary]);

  const types = libs[step.dept]?.types || [];
  const roster = people.filter((p) => !step.dept || p.dept === step.dept);

  const save = () => {
    const title = (step.title || "").trim();
    if (!title) return;
    const was = data.step; const changed = [];
    if (was.title !== title) changed.push("title");
    if (was.dept !== step.dept) changed.push("department");
    if (was.type !== step.type) changed.push("type");
    if (was.priority !== step.priority) changed.push("priority");
    if (was.duration.value !== step.duration.value || was.duration.unit !== step.duration.unit) changed.push("duration");
    if (was.status !== step.status) changed.push("status");
    if ((was.assignees || []).join() !== (step.assignees || []).join()) changed.push("assignees");
    if (was.desc !== step.desc || was.notes !== step.notes) changed.push("details");
    if ((was.links || []).length !== step.links.filter((l) => (l.url || "").trim()).length) changed.push("links");
    if ((was.subtasks || []).length !== step.subtasks.filter((t) => (t.title || "").trim()).length) changed.push("subtasks");
    onSave({ ...step, title, links: step.links.filter((l) => (l.url || "").trim()), subtasks: step.subtasks.filter((t) => (t.title || "").trim()) }, changed);
  };

  return (
    <Modal title={data.mode === "edit" ? "Edit step" : "New step"} onClose={onClose}>
      <div className="p-5 space-y-4">
        <input autoFocus value={step.title} onChange={(e) => set({ title: e.target.value })} placeholder="Step title"
          className="w-full text-lg outline-none pb-1 bg-transparent" style={{ borderBottom: "2px solid var(--border)", color: "var(--text)" }} />

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Department</span>
            <select value={step.dept} onChange={(e) => set({ dept: e.target.value, type: "", assignees: [] })} className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field}>
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></label>
          <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Task type</span>
            <select value={step.type} onChange={(e) => set({ type: e.target.value })} className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field}>
              <option value="">No type</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></label>
          <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Status</span>
            <select value={step.status} onChange={(e) => set({ status: e.target.value })} className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field}>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Priority</span>
            <select value={step.priority} onChange={(e) => set({ priority: e.target.value })} className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRI[p].name}</option>)}
            </select></label>
          <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Duration</span>
            <input type="number" min="0" max="999" value={step.duration.value} onChange={(e) => set({ duration: { ...step.duration, value: Number(e.target.value) } })}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field} /></label>
          <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Unit</span>
            <select value={step.duration.unit} onChange={(e) => set({ duration: { ...step.duration, unit: e.target.value } })} className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field}>
              {UNITS.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select></label>
        </div>

        <div>
          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Assignees</span>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {!roster.length && <span className="text-sm" style={{ color: "var(--muted)" }}>No one listed in that department yet.</span>}
            {roster.map((p) => {
              const on = step.assignees.includes(p.id);
              return (
                <button key={p.id} onClick={() => set({ assignees: on ? step.assignees.filter((a) => a !== p.id) : [...step.assignees, p.id] })}
                  className="tp-pill flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-xs font-medium" style={on ? { background: p.c, color: "#fff" } : { background: "var(--col)", color: "var(--text-2)" }}>
                  <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: on ? "rgba(255,255,255,0.25)" : p.c, color: "#fff" }}>{p.i}</span>{p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Subtasks</span>
          <div className="space-y-2 mt-1.5">
            {step.subtasks.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <button onClick={() => set({ subtasks: step.subtasks.map((x, xi) => (xi === i ? { ...x, done: !x.done } : x)) })}
                  className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={t.done ? { background: "#3FA37A", color: "#fff" } : { border: "1px solid var(--border)", color: "var(--faint)" }}><Check size={13} /></button>
                <input value={t.title} onChange={(e) => set({ subtasks: step.subtasks.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x)) })}
                  placeholder="Subtask" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                <select value={t.assignee || ""} onChange={(e) => set({ subtasks: step.subtasks.map((x, xi) => (xi === i ? { ...x, assignee: e.target.value } : x)) })}
                  className="rounded-lg px-2 py-2 text-xs outline-none" style={{ ...field, width: 120 }}>
                  <option value="">Unassigned</option>
                  {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button onClick={() => set({ subtasks: step.subtasks.filter((_, xi) => xi !== i) })} className="tp-ib h-8 w-8 flex items-center justify-center rounded-lg shrink-0" style={{ color: "#E5536E" }}><X size={15} /></button>
              </div>
            ))}
            <button onClick={() => set({ subtasks: [...step.subtasks, { id: newId("st"), title: "", done: false, assignee: "" }] })}
              className="tp-ib rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--text-2)" }}><Plus size={14} /> Add subtask</button>
          </div>
        </div>

        <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Task description</span>
          <textarea value={step.desc} onChange={(e) => set({ desc: e.target.value })} rows={2} placeholder="What this step delivers"
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm resize-none outline-none" style={field} /></label>
        <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Notes</span>
          <textarea value={step.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Specs, reminders, anything the owner needs"
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm resize-none outline-none" style={field} /></label>

        <div>
          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Links</span>
          <div className="space-y-2 mt-1.5">
            {step.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={link.label} placeholder="Label" onChange={(e) => set({ links: step.links.map((l, li) => (li === i ? { ...l, label: e.target.value } : l)) })}
                  className="w-1/3 rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                <input value={link.url} placeholder="https://" onChange={(e) => set({ links: step.links.map((l, li) => (li === i ? { ...l, url: e.target.value } : l)) })}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                <button onClick={() => set({ links: step.links.filter((_, li) => li !== i) })} className="tp-ib h-8 w-8 flex items-center justify-center rounded-lg shrink-0" style={{ color: "#E5536E" }}><X size={15} /></button>
              </div>
            ))}
            <button onClick={() => set({ links: [...step.links, { label: "", url: "" }] })} className="tp-ib rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--text-2)" }}><Plus size={14} /> Add link</button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="tp-ib rounded-xl px-4 py-2 text-sm font-medium" style={{ color: "var(--text-2)" }}>Cancel</button>
          <button onClick={save} className="tp-pill rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: ACCENT, color: ON_ACCENT }}>{data.mode === "edit" ? "Save step" : "Add step"}</button>
        </div>
      </div>
    </Modal>
  );
}

function SectionModal({ data, departments, onClose, onSave }) {
  const deptName = useCallback((id) => departments.find((d) => d.id === id)?.name || "", [departments]);
  const [sec, setSec] = useState(() => ({ ...data.section, label: data.section.label || (data.mode === "new" ? deptName(data.section.dept) : "") }));

  return (
    <Modal title={data.mode === "edit" ? "Edit section" : "New section"} onClose={onClose} width="max-w-md">
      <div className="p-5 space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          A divider is a label only — it groups the steps underneath it so everyone can see where the work hands over.
        </p>
        <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Colour &amp; hand-over hint</span>
          <select value={sec.dept} onChange={(e) => {
            const names = departments.map((d) => d.name);
            setSec((s) => ({ ...s, dept: e.target.value, label: !s.label.trim() || names.includes(s.label.trim()) ? deptName(e.target.value) : s.label }));
          }} className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field}>
            <option value="">No department — plain label</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></label>
        <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Title text</span>
          <input autoFocus value={sec.label} onChange={(e) => setSec((s) => ({ ...s, label: e.target.value }))} placeholder="e.g. Over to Marketing"
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field} /></label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="tp-ib rounded-xl px-4 py-2 text-sm font-medium" style={{ color: "var(--text-2)" }}>Cancel</button>
          <button onClick={() => sec.label.trim() && onSave({ ...sec, label: sec.label.trim() })} className="tp-pill rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: ACCENT, color: ON_ACCENT }}>
            {data.mode === "edit" ? "Save" : "Add section"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FlowModal({ data, setData, departments, flows, onClose, onSave }) {
  const isNew = data.mode === "new";
  // Pick order is kept: the first department picked leads.
  const toggle = (id) => setData((d) => ({ ...d, depts: d.depts.includes(id) ? d.depts.filter((x) => x !== id) : [...d.depts, id] }));

  return (
    <Modal title={isNew ? "New playbook" : "Playbook details"} onClose={onClose}>
      <div className="p-5 space-y-4">
        <input autoFocus value={data.name} onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))} placeholder="Playbook name — e.g. New SKU launch"
          className="w-full text-lg outline-none pb-1 bg-transparent" style={{ borderBottom: "2px solid var(--border)", color: "var(--text)" }} />
        <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>What this process covers</span>
          <textarea value={data.desc || ""} onChange={(e) => setData((d) => ({ ...d, desc: e.target.value }))} rows={2} placeholder="When to use it, and where it ends"
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm resize-none outline-none" style={field} /></label>

        <div>
          <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Departments involved — pick every department whose work this covers</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {departments.map((d) => {
              const on = data.depts.includes(d.id);
              return (
                <button key={d.id} onClick={() => toggle(d.id)} className="tp-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
                  style={on ? { background: `${d.color}1F`, color: d.color, border: `1px solid ${d.color}55` } : { background: "var(--col)", color: "var(--text-2)", border: "1px solid transparent" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--muted)" }}>
            {isNew ? "A section is created for each, in the order you pick them. " : ""}The first one picked gives the playbook its colour.
          </p>
        </div>

        {isNew && (
          <label className="block"><span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Start from</span>
            <select value={data.from || ""} onChange={(e) => setData((d) => ({ ...d, from: e.target.value }))} className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none" style={field}>
              <option value="">An empty playbook</option>
              {flows.map((f) => <option key={f.id} value={f.id}>A copy of &quot;{f.name}&quot;</option>)}
            </select></label>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="tp-ib rounded-xl px-4 py-2 text-sm font-medium" style={{ color: "var(--text-2)" }}>Cancel</button>
          <button onClick={onSave} className="tp-pill rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: ACCENT, color: ON_ACCENT }}>{isNew ? "Create playbook" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}

function HistoryModal({ flow, peopleById, onClose }) {
  const events = [...(flow.history || [])].reverse();
  const dayLabel = (at) => {
    const d = new Date(at); const now = new Date();
    const day = new Date(d); day.setHours(0, 0, 0, 0);
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 864e5);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return fmtDay(at);
  };
  const ago = (at) => {
    const m = Math.round((Date.now() - at) / 6e4);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h}h ago` : fmtTime(new Date(at));
  };

  let lastDay = "";
  return (
    <Modal title={`History — ${flow.name}`} onClose={onClose} width="max-w-2xl">
      <div className="p-5 pt-2">
        {!events.length && <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>Nothing has happened in this playbook yet.</p>}
        {events.map((e) => {
          const who = peopleById[e.who] || { i: "?", c: "#8E8A96", name: "Someone" };
          const label = dayLabel(e.at);
          const header = label !== lastDay ? label : null;
          if (header) lastDay = label;
          return (
            <React.Fragment key={e.id}>
              {header && <p className="text-[11px] font-semibold pt-3.5 pb-1.5 px-1 sticky top-0" style={{ color: "var(--muted)", background: "var(--card)" }}>{header}</p>}
              <div className="flex items-start gap-2.5 px-1.5 py-2 rounded-xl">
                <span className="rounded-full flex items-center justify-center text-[9.5px] font-semibold shrink-0 mt-0.5" style={{ height: 24, width: 24, background: who.c, color: "#fff" }}>{who.i}</span>
                <span className="flex-1 min-w-0 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {who.name.split(" ")[0]} {e.verb}{e.subject ? <> <b style={{ color: "var(--text)" }}>{e.subject}</b></> : null}
                </span>
                <span className="text-xs whitespace-nowrap mt-1" style={{ color: "var(--muted)" }}>{ago(e.at)}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </Modal>
  );
}


export default function PlugPlayPage(props) {
  return (
    <PageAccess page="plugplay">
      <PlugPlayPageInner {...props} />
    </PageAccess>
  );
}
