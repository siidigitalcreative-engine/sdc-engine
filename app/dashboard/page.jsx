"use client";

import React, { useEffect, useState, useMemo } from "react";
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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- data ---------- */
const today = new Date();
const dOff = (n) => { const d = startOfDay(today); d.setDate(d.getDate() + n); return d; };

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

const TASKS = [
  { id: 1, title: "Team content sync", project: "Sunbeams Lifestyle", status: "inprogress", who: ["CN", "RG"], date: dOff(0), time: "10:00", dur: 60 },
  { id: 2, title: "Quencha shoot review", project: "Quencha", status: "inprogress", who: ["CN"], date: dOff(0), time: "14:00", dur: 90 },
  { id: 3, title: "SCRUBZ copy review", project: "SCRUBZ", status: "todo", who: ["CN"], date: dOff(0), time: "12:00", dur: 45 },
  { id: 4, title: "CRYSALIS palette QA", project: "CRYSALIS", status: "done", who: ["CN"], date: dOff(0) },
  { id: 5, title: "PRIMEO landing review", project: "PRIMEO", status: "todo", who: ["CN", "MA"], date: dOff(0), time: "16:00", dur: 60 },
  { id: 6, title: "Checkout flow redesign", project: "Website Revamp", status: "inreview", who: ["CN", "JL"], date: dOff(1), time: "11:00", dur: 60 },
  { id: 7, title: "Design system audit", project: "Sunbeams Lifestyle", status: "done", who: ["CN"], date: dOff(-2) },
  { id: 8, title: "Reel edits — FITSPIRE", project: "FITSPIRE", status: "done", who: ["SP"], date: dOff(0), time: "09:30", dur: 60 },
  { id: 9, title: "Nest blog publish", project: "Nest Design Lab", status: "inprogress", who: ["MA"], date: dOff(0), time: "13:00", dur: 60 },
  { id: 10, title: "Vendor call", project: "Sunbeams Lifestyle", status: "todo", who: ["RG", "CN"], date: dOff(2), time: "15:00", dur: 60 },
  { id: 11, title: "Quencha PDP wireframe", project: "Quencha", status: "inprogress", who: ["CN"], date: dOff(-1), time: "10:00", dur: 120 },
  { id: 12, title: "Email QA", project: "Daily Tasks", status: "inreview", who: ["RG"], date: dOff(0), time: "11:30", dur: 30 },
];

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
  const [member, setMember] = useState(currentMember?.i || members[0]?.i || "");
  const [day, setDay] = useState(startOfDay(new Date()));
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const now = new Date();

  useEffect(() => {
    if (!member || !members.some((x) => x.i === member)) {
      setMember(currentMember?.i || members[0]?.i || "");
    }
  }, [members, currentMember, member]);

  const m = members.find((x) => x.i === member) || currentMember || members[0];
  const mine = useMemo(() => TASKS.filter((t) => t.who.includes(member)), [member]);
  const counts = useMemo(() => ({
    projects: new Set(mine.map((t) => t.project)).size,
    tasks: mine.length,
    done: mine.filter((t) => t.status === "done").length,
  }), [mine]);

  const dayTasks = useMemo(() => mine
    .filter((t) => isSameDay(t.date, day))
    .sort((a, b) => (a.time ? hm(a.time) : 9999) - (b.time ? hm(b.time) : 9999)), [mine, day]);
  const timed = dayTasks.filter((t) => t.time);

  if (!m) return null;

  const greeting = (() => { const h = now.getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; })();
  const dayLabel = isSameDay(day, now) ? "Today" : day.toLocaleDateString("default", { weekday: "long", month: "short", day: "numeric" });

  return (
    <>
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <header className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 flex-wrap">
            <div className="mr-auto">
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>{greeting}, {m.name.split(" ")[0]}!</h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>Here's what's on {currentMember?.i === member ? "your" : m.name.split(" ")[0] + "'s"} plate</p>
            </div>
            <div className="flex items-center">
              {members.map((x) => (
                <button key={x.i} onClick={() => setMember(x.i)} title={x.name}
                  className="db-pill h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ background: x.c, fontSize: 12, marginLeft: -6, border: member === x.i ? `2px solid ${ACCENT}` : "2px solid var(--card)", zIndex: member === x.i ? 2 : 1, opacity: member === x.i ? 1 : 0.7 }}>{x.i}</button>
              ))}
            </div>
            </header>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              {/* left column */}
              <div style={{ flex: "1 1 440px", minWidth: 0 }} className="flex flex-col gap-5">
                <div className="grid grid-cols-3 gap-4">
                  <CountCard icon={Layers} label="Projects" value={counts.projects} tint="rgba(124,111,240,0.16)" tile="#7C6FF0" />
                  <CountCard icon={CheckSquare} label="Tasks" value={counts.tasks} tint="rgba(62,142,208,0.16)" tile="#3E8ED0" />
                  <CountCard icon={CheckCircle} label="Completed" value={counts.done} tint="rgba(242,106,60,0.20)" tile={ACCENT_GRAD} />
                </div>

                <div className="rounded-2xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold" style={{ color: "var(--text)", fontSize: 17 }}>{dayLabel === "Today" ? "Today's tasks" : `Tasks · ${dayLabel}`}</h2>
                    <span className="flex items-center gap-1 text-sm" style={{ color: "var(--muted)" }}>Show all <ArrowUpRight size={15} /></span>
                  </div>
                  <div className="space-y-2.5">
                    {dayTasks.length === 0 && <p className="text-sm py-6 text-center" style={{ color: "var(--muted)" }}>Nothing scheduled for this day.</p>}
                    {dayTasks.map((t) => {
                      const pc = projColor(t.project); const s = STATUSES[t.status];
                      return (
                        <div key={t.id} className="db-row flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--col)" }}>
                          <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: pc.soft }}>
                            <span className="h-3 w-3 rounded-full" style={{ background: pc.color }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate" style={{ color: "var(--text)" }}>{t.title}</p>
                            <p className="text-xs truncate" style={{ color: "var(--muted)" }}>{t.project}{t.time ? ` · ${fmtHM(hm(t.time))}` : ""}</p>
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
                <MiniCal member={member} day={day} setDay={setDay} monthCursor={monthCursor} setMonthCursor={setMonthCursor} now={now} tasks={mine} />
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
    <div className="rounded-2xl p-5" style={{ background: `linear-gradient(140deg, var(--card) 35%, ${tint})`, border: "1px solid var(--border)" }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-6" style={{ background: tile }}>
        <Icon size={18} style={{ color: tile === "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)" ? ON_ACCENT : "#fff" }} />
      </div>
      <div className="font-bold" style={{ color: "var(--text)", fontSize: 30, lineHeight: 1 }}>{value}</div>
      <div className="text-sm mt-1.5" style={{ color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

function MiniCal({ member, day, setDay, monthCursor, setMonthCursor, now, tasks }) {
  const cells = useMemo(() => {
    const gs = startOfWeek(startOfMonth(monthCursor));
    return Array.from({ length: 42 }, (_, i) => addDays(gs, i));
  }, [monthCursor]);
  const hasTask = (d) => tasks.some((t) => isSameDay(t.date, d));
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
          const height = Math.max((t.dur / 60) * rowH - 4, 26);
          return (
            <div key={t.id} className="absolute rounded-xl px-2.5 py-1.5 overflow-hidden" style={{ top: top + 1, height, left: 52, right: 0, background: pc.soft, borderLeft: `3px solid ${pc.color}` }}>
              <p className="font-semibold truncate" style={{ fontSize: 12, color: "#2A2833" }}>{t.title}</p>
              {height > 34 && <p className="truncate" style={{ fontSize: 11, color: "rgba(42,40,51,0.6)" }}>{fmtHM(hm(t.time))} – {fmtHM(hm(t.time) + t.dur)}</p>}
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
