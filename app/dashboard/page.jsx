"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutGrid, Calendar, CheckSquare, Folder, Users, BarChart, Settings,
  Plus, ChevronLeft, ChevronRight, Moon, Sun, Sparkles, Clock, CheckCircle,
  Layers, ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../auth";

const CANVAS = "var(--surface)";
const SIDEBAR = "var(--sidebar)";
const ACCENT = "#F26A3C";
const ON_ACCENT = "var(--on-accent)";
const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const PAGE_BG = "var(--page)";

/* ---------- date helpers ---------- */
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const startOfWeek = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();
const hm = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fmtHM = (mins) => { let h = Math.floor(mins / 60); const m = mins % 60; const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return m ? `${h}:${String(m).padStart(2,"0")} ${ap}` : `${h} ${ap}`; };
const fromDateInput = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, m - 1, d);
};
const taskIsOnDay = (task, day) => {
  const start = fromDateInput(task?.start);
  return Boolean(start && isSameDay(start, day));
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- data ---------- */
const STATUSES = {
  todo: { name: "To Do", color: "#8E8A96", soft: "#ECEBEE" },
  inprogress: { name: "In Progress", color: "#3E8ED0", soft: "#E3EEF9" },
  inreview: { name: "In Review", color: "#E0A93C", soft: "#FAEFD6" },
  done: { name: "Completed", color: "#3FA37A", soft: "#DEF1E7" },
};

const PROJECTS = ["Sunbeams Lifestyle", "Quencha", "CRYSALIS", "SCRUBZ", "PRIMEO", "Website Revamp", "FITSPIRE", "Nest Design Lab", "Daily Tasks"];
const PROJ_PALETTE = [
  { color: "#7C6FF0", soft: "#ECEAFC" }, { color: "#3FA37A", soft: "#DEF1E7" }, { color: "#F0784B", soft: "#FCE7DD" },
  { color: "#E0A93C", soft: "#FAEFD6" }, { color: "#E5536E", soft: "#FBE1E7" }, { color: "#3E8ED0", soft: "#E3EEF9" },
];
const projColor = (p) => PROJ_PALETTE[Math.max(0, PROJECTS.indexOf(p)) % PROJ_PALETTE.length];

const NAV = [
  { id: "dashboard", name: "Dashboard", icon: LayoutGrid },
  { id: "calendar", name: "Calendar", icon: Calendar },
  { id: "tasks", name: "Tasks", icon: CheckSquare },
  { id: "projects", name: "Projects", icon: Folder },
  { id: "team", name: "Team Members", icon: Users },
  { id: "reports", name: "Reports", icon: BarChart },
];



export default function DashboardPage() {
  const { members, currentMember } = useAuth();
  const [memberId, setMemberId] = useState(currentMember?.id || members[0]?.id || "");
  const [day, setDay] = useState(startOfDay(new Date()));
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState(null);
  const [taskError, setTaskError] = useState("");
  const [dailyBusy, setDailyBusy] = useState("");
  const [dailyMsg, setDailyMsg] = useState("");
  const taskEtagRef = useRef(null);
  const loadingTasksRef = useRef(false);
  const now = new Date();

  const loadTasks = useCallback(async ({ force = false } = {}) => {
    if (loadingTasksRef.current) return;
    loadingTasksRef.current = true;
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
      const etag = response.headers.get("etag");
      if (etag) taskEtagRef.current = etag;
      setTasks(Array.isArray(body.tasks) ? body.tasks : []);
      setTaskError("");
    } catch (error) {
      setTaskError(error.message || "Unable to load tasks.");
    } finally {
      loadingTasksRef.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/statuses", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { statuses: null }))
      .then((b) => { if (active) setStatuses(Array.isArray(b.statuses) && b.statuses.length ? b.statuses : null); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

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

  useEffect(() => {
    if (!memberId || !members.some((x) => x.id === memberId)) {
      setMemberId(currentMember?.id || members[0]?.id || "");
    }
  }, [members, currentMember, memberId]);

  const m = members.find((x) => x.id === memberId) || currentMember || members[0];
  const mine = useMemo(() => {
    if (!m) return [];
    return tasks.filter((task) => {
      const assignees = Array.isArray(task.assignees) ? task.assignees : [];
      // Supports both current member IDs and any older task records that still contain initials.
      return assignees.includes(m.id) || assignees.includes(m.i);
    });
  }, [tasks, m]);

  const counts = useMemo(() => ({
    projects: new Set(mine.map((t) => t.project).filter(Boolean)).size,
    tasks: mine.length,
    done: mine.filter((t) => t.status === "done").length,
  }), [mine]);

  const selectedIsToday = isSameDay(day, now);
  const dayTasks = useMemo(() => {
    return mine
      .filter((task) => taskIsOnDay(task, day) || (selectedIsToday && task.status === "inprogress"))
      .sort((a, b) => {
        const aScheduled = taskIsOnDay(a, day);
        const bScheduled = taskIsOnDay(b, day);
        if (aScheduled !== bScheduled) return aScheduled ? -1 : 1;
        const aTime = a.time ? hm(a.time) : 9999;
        const bTime = b.time ? hm(b.time) : 9999;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
  }, [mine, day, selectedIsToday]);

  // The hourly schedule only shows tasks actually scheduled for the selected date.
  // "In Progress" tasks from other dates still appear in Today's tasks, but not at an incorrect time on the schedule.
  const timed = useMemo(() => mine
    .filter((task) => taskIsOnDay(task, day) && task.time)
    .sort((a, b) => hm(a.time) - hm(b.time)), [mine, day]);

  if (!m) return null;

  const statusMeta = (id) => {
    if (statuses) { const found = statuses.find((s) => s.id === id); if (found) return { name: found.name, color: found.color || "#8E8A96" }; }
    const d = STATUSES[id]; return d ? { name: d.name, color: d.color } : { name: id || "—", color: "#8E8A96" };
  };
  const myActive = mine.filter((t) => t.status !== "done");
  const dailyPayload = () => ({
    member: { memberName: m.name, memberInitials: m.i, memberColor: m.c, heading: "Task Update" },
    tasks: myActive.map((t) => {
      const sm = statusMeta(t.status);
      return {
        title: t.title, project: t.project,
        statusName: sm.name, statusColor: sm.color,
        due: t.due || null,
        overdue: !!t.due && t.status !== "done" && new Date(t.due) < startOfDay(now),
        progress: typeof t.progress === "number" ? t.progress : null,
      };
    }),
  });
  const exportDailyPng = async () => {
    setDailyBusy("png"); setDailyMsg("");
    try {
      const res = await fetch("/api/my-tasks-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dailyPayload()) });
      if (!res.ok) throw new Error("Unable to render the image.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `sdc-${m.name.split(" ")[0].toLowerCase()}-tasks.png`;
      link.href = url; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setDailyMsg(e.message || "Export failed."); }
    finally { setDailyBusy(""); }
  };
  const sendDailyToLark = async () => {
    setDailyBusy("lark"); setDailyMsg("");
    try {
      const res = await fetch("/api/lark/my-tasks-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dailyPayload()) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to send to Lark.");
      setDailyMsg("Sent to Lark ✓");
    } catch (e) { setDailyMsg(e.message || "Send to Lark failed."); }
    finally { setDailyBusy(""); }
  };

  const greeting = (() => { const h = now.getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; })();
  const dayLabel = selectedIsToday ? "Today" : day.toLocaleDateString("default", { weekday: "long", month: "short", day: "numeric" });

  return (
    <>
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <header className="flex items-center gap-3 px-4 sm:px-6 pt-6 pb-4 shrink-0 flex-wrap">
            <div className="mr-auto">
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>{greeting}, {m.name.split(" ")[0]}!</h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>Here's what's on {currentMember?.id === memberId ? "your" : m.name.split(" ")[0] + "'s"} plate</p>
              {taskError && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{taskError}</p>}
            </div>
            <div className="flex items-center">
              {members.map((x) => (
                <button key={x.id} onClick={() => setMemberId(x.id)} title={x.name}
                  className="db-pill h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ background: x.c, fontSize: 12, marginLeft: -6, border: memberId === x.id ? `2px solid ${ACCENT}` : "2px solid var(--card)", zIndex: memberId === x.id ? 2 : 1, opacity: memberId === x.id ? 1 : 0.7 }}>{x.i}</button>
              ))}
            </div>
            </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              {/* left column */}
              <div style={{ flex: "1 1 440px", minWidth: 0 }} className="flex flex-col gap-5">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <CountCard icon={Layers} label="Projects" value={counts.projects} tint="rgba(124,111,240,0.16)" tile="#7C6FF0" />
                  <CountCard icon={CheckSquare} label="Tasks" value={counts.tasks} tint="rgba(62,142,208,0.16)" tile="#3E8ED0" />
                  <CountCard icon={CheckCircle} label="Completed" value={counts.done} tint="rgba(242,106,60,0.20)" tile={ACCENT_GRAD} />
                </div>

                <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                    <h2 className="font-semibold" style={{ color: "var(--text)", fontSize: 17 }}>{dayLabel === "Today" ? "Today's tasks" : `Tasks · ${dayLabel}`}</h2>
                    <div className="flex items-center gap-2">
                      {dailyMsg && <span className="text-xs" style={{ color: dailyMsg.includes("✓") ? "#3FA37A" : "#E5536E" }}>{dailyMsg}</span>}
                      <button type="button" onClick={exportDailyPng} disabled={!!dailyBusy} title="Export your active tasks as PNG"
                        className="db-pill rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50" style={{ background: "var(--col)", color: "var(--text)", border: "1px solid var(--border)" }}>
                        🖼️ {dailyBusy === "png" ? "…" : "Export"}
                      </button>
                      <button type="button" onClick={sendDailyToLark} disabled={!!dailyBusy} title="Send your active tasks to Lark"
                        className="db-pill rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50" style={{ background: "var(--col)", color: "var(--text)", border: "1px solid var(--border)" }}>
                        📤 {dailyBusy === "lark" ? "…" : "Send to Lark"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {dayTasks.length === 0 && <p className="text-sm py-6 text-center" style={{ color: "var(--muted)" }}>{selectedIsToday ? "No tasks scheduled today or currently in progress." : "Nothing scheduled for this day."}</p>}
                    {dayTasks.map((t) => {
                      const pc = projColor(t.project); const s = STATUSES[t.status] || STATUSES.todo;
                      const scheduledThisDay = taskIsOnDay(t, day);
                      return (
                        <div key={t.id} className="db-row flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--col)" }}>
                          <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: pc.soft }}>
                            <span className="h-3 w-3 rounded-full" style={{ background: pc.color }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate" style={{ color: "var(--text)" }}>{t.title}</p>
                            <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{t.project}{scheduledThisDay && t.time ? ` · ${fmtHM(hm(t.time))}` : ""}</p>
                          </div>
                          <span className="rounded-full px-2.5 py-1 text-xs font-semibold shrink-0" style={{ background: s.soft, color: s.color }}>{s.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* right column */}
              <div style={{ flex: "1 1 320px" }} className="flex flex-col gap-5">
                <MiniCal day={day} setDay={setDay} monthCursor={monthCursor} setMonthCursor={setMonthCursor} now={now} tasks={mine} />
                <Schedule items={timed} day={day} now={now} />
              </div>
            </div>
          </div>
        </main>
    </>
  );
}

function CountCard({ icon: Icon, label, value, tint, tile }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: `linear-gradient(140deg, var(--card) 35%, ${tint})`, border: "1px solid var(--border)" }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-6" style={{ background: tile }}>
        <Icon size={18} style={{ color: tile === "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)" ? ON_ACCENT : "#fff" }} />
      </div>
      <div className="font-bold" style={{ color: "var(--text)", fontSize: 30, lineHeight: 1 }}>{value}</div>
      <div className="text-xs sm:text-sm mt-1.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

function MiniCal({ day, setDay, monthCursor, setMonthCursor, now, tasks }) {
  const cells = useMemo(() => {
    const gs = startOfWeek(startOfMonth(monthCursor));
    return Array.from({ length: 42 }, (_, i) => addDays(gs, i));
  }, [monthCursor]);
  const hasTask = (d) => tasks.some((t) => taskIsOnDay(t, d));
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold" style={{ color: "var(--text)" }}>{monthCursor.toLocaleString("default", { month: "long", year: "numeric" })}</span>
        <div className="flex gap-1">
          <button onClick={() => setMonthCursor((c) => addMonths(c, -1))} className="db-ib h-7 w-7 flex items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}><ChevronLeft size={15} /></button>
          <button onClick={() => setMonthCursor((c) => addMonths(c, 1))} className="db-ib h-7 w-7 flex items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d) => <div key={d} className="text-center pb-2" style={{ fontSize: 11, color: "var(--muted)" }}>{d}</div>)}
        {cells.map((c, i) => {
          const inMonth = c.getMonth() === monthCursor.getMonth();
          const isToday = isSameDay(c, now);
          const isSel = isSameDay(c, day);
          const dot = hasTask(c);
          return (
            <div key={i} className="flex flex-col items-center py-0.5">
              <button onClick={() => setDay(startOfDay(c))} className="db-day relative h-8 w-8 flex items-center justify-center rounded-full"
                style={isSel ? { background: ACCENT_GRAD, color: ON_ACCENT, fontWeight: 600 }
                  : { color: inMonth ? "var(--text)" : "var(--faint)", fontWeight: isToday ? 700 : 400, boxShadow: isToday ? `inset 0 0 0 1.5px ${ACCENT}` : "none" }}>
                <span style={{ fontSize: 13 }}>{c.getDate()}</span>
              </button>
              <span className="mt-0.5 h-1 w-1 rounded-full" style={{ background: dot && !isSel ? ACCENT : "transparent" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Schedule({ items, day, now }) {
  const startH = 8, endH = 18, rowH = 46;
  const isToday = isSameDay(day, now);
  const nowTop = ((minutesOf(now) - startH * 60) / 60) * rowH;
  const showNow = isToday && minutesOf(now) >= startH * 60 && minutesOf(now) <= endH * 60;
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <h2 className="font-semibold mb-4" style={{ color: "var(--text)", fontSize: 17 }}>Schedule</h2>
      <div className="relative" style={{ height: (endH - startH) * rowH }}>
        {Array.from({ length: endH - startH + 1 }, (_, i) => {
          const h = startH + i;
          return (
            <div key={h} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: i * rowH }}>
              <span style={{ fontSize: 11, color: "var(--faint)", width: 44 }}>{fmtHM(h * 60)}</span>
              <div className="flex-1" style={{ borderTop: "1px solid var(--grid)" }} />
            </div>
          );
        })}
        {items.map((t) => {
          const pc = projColor(t.project);
          const top = ((hm(t.time) - startH * 60) / 60) * rowH;
          const duration = Math.max(30, Number(t.dur) || 60);
          const height = Math.max((duration / 60) * rowH - 4, 26);
          return (
            <div key={t.id} className="absolute rounded-xl px-2.5 py-1.5 overflow-hidden" style={{ top: top + 1, height, left: 52, right: 0, background: pc.soft, borderLeft: `3px solid ${pc.color}` }}>
              <p className="font-semibold truncate" style={{ fontSize: 12, color: "#2A2833" }}>{t.title}</p>
              {height > 34 && <p className="truncate" style={{ fontSize: 11, color: "rgba(42,40,51,0.6)" }}>{fmtHM(hm(t.time))} – {fmtHM(hm(t.time) + duration)}</p>}
            </div>
          );
        })}
        {showNow && (
          <div className="absolute" style={{ top: nowTop, left: 44, right: 0, zIndex: 5 }}>
            <div style={{ height: 2, background: ACCENT }} />
            <div className="absolute rounded-full" style={{ left: -3, top: -3, height: 8, width: 8, background: ACCENT }} />
          </div>
        )}
      </div>
    </div>
  );
}
