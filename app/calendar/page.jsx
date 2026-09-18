"use client";


import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../auth";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Search,
  Clock, AlignLeft, Sparkles, Users,
  Moon, Sun,
  LayoutGrid, Calendar as CalIcon, CheckSquare, Folder, BarChart, Settings,
} from "lucide-react";

/* ---------- theme ---------- */
const HOUR_H = 52;
const CANVAS = "var(--surface)";
const SIDEBAR = "var(--sidebar)";
const ACCENT = "#F26A3C";
const ON_ACCENT = "var(--on-accent)";
const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const TITLE_INK = "#2A2833";
const TIME_INK = "rgba(42,40,51,0.58)";
const PAGE_BG = "var(--page)";
const HEADER_BG = "var(--header)";
const NAV = [
  { id: "dashboard", name: "Dashboard", icon: LayoutGrid },
  { id: "calendar", name: "Calendar", icon: CalIcon },
  { id: "tasks", name: "Tasks", icon: CheckSquare },
  { id: "projects", name: "Projects", icon: Folder },
  { id: "team", name: "Team Members", icon: Users },
  { id: "reports", name: "Reports", icon: BarChart },
];
const ME = { i: "CN", name: "Che Navarro", role: "Digital Creative", c: "#7C6FF0" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- date helpers ---------- */
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const startOfWeek = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();
const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fromInputs = (dateStr, timeStr) => {
  const [y, m, day] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, m - 1, day, hh, mm);
};
const fmtTime = (d) => {
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "pm" : "am"; h = h % 12; if (h === 0) h = 12;
  return m === 0 ? `${h} ${ap}` : `${h}:${pad(m)} ${ap}`;
};
const fmtHour = (h) => { const ap = h >= 12 ? "pm" : "am"; let hh = h % 12; if (hh === 0) hh = 12; return `${hh} ${ap}`; };

/* ---------- data ---------- */
const today = new Date();
const at = (addDay, h, m = 0) => { const d = startOfDay(today); d.setDate(d.getDate() + addDay); d.setHours(h, m); return d; };

const SEED_CALENDARS = [
  { id: "meet",     name: "Meetings",  color: "#7C6FF0", soft: "#ECEAFC", fill: "#DAD5F6", ink: "#4B3FB5", visible: true },
  { id: "content",  name: "Content",   color: "#3FA37A", soft: "#DEF1E7", fill: "#CDEAD8", ink: "#2A7351", visible: true },
  { id: "design",   name: "Design",    color: "#F0784B", soft: "#FCE7DD", fill: "#FAD8C6", ink: "#C24E28", visible: true },
  { id: "shoots",   name: "Shoots",    color: "#E0A93C", soft: "#FAEFD6", fill: "#FBEAB2", ink: "#976C18", visible: true },
  { id: "deadline", name: "Deadlines", color: "#E5536E", soft: "#FBE1E7", fill: "#F8D3DE", ink: "#C23150", visible: true },
];

const SEED_EVENTS = [
  { id: 1, title: "Team content sync", calId: "meet", start: at(0, 10), end: at(0, 11), allDay: false, desc: "Weekly planning across all brands", attendees: ["CN", "RG", "MA"] },
  { id: 2, title: "Quencha shoot review", calId: "shoots", start: at(0, 14), end: at(0, 15, 30), allDay: false, desc: "", attendees: ["RG", "SP"] },
  { id: 3, title: "CRYSALIS launch", calId: "deadline", start: startOfDay(addDays(today, 1)), end: startOfDay(addDays(today, 1)), allDay: true, desc: "Catalog rebrand goes live", attendees: [] },
  { id: 4, title: "Design review — PRIMEO", calId: "design", start: at(1, 11), end: at(1, 12), allDay: false, desc: "", attendees: ["CN", "MA"] },
  { id: 5, title: "Reel edits", calId: "content", start: at(-1, 9, 30), end: at(-1, 11), allDay: false, desc: "", attendees: ["SP"] },
  { id: 6, title: "Vendor call", calId: "meet", start: at(2, 15), end: at(2, 16), allDay: false, desc: "", attendees: ["JL", "CN"] },
  { id: 7, title: "SCRUBZ copy", calId: "content", start: at(0, 12), end: at(0, 13), allDay: false, desc: "", attendees: [] },
];

function packEvents(items) {
  const sorted = [...items].sort((a, b) => a.s - b.s || a.en - b.en);
  let cluster = [], clusterEnd = -1; const out = [];
  const flush = () => {
    const cols = [];
    cluster.forEach((it) => {
      let placed = false;
      for (let i = 0; i < cols.length; i++) if (cols[i] <= it.s) { it._col = i; cols[i] = it.en; placed = true; break; }
      if (!placed) { it._col = cols.length; cols.push(it.en); }
    });
    cluster.forEach((it) => (it._cols = cols.length));
    out.push(...cluster); cluster = [];
  };
  sorted.forEach((it) => { if (cluster.length && it.s >= clusterEnd) { flush(); clusterEnd = -1; } cluster.push(it); clusterEnd = Math.max(clusterEnd, it.en); });
  if (cluster.length) flush();
  return out;
}



export default function TeamCalendar() {
  const { members } = useAuth();
  const memberByRef = useMemo(() => {
    const map = {};
    members.forEach((member) => {
      map[member.id] = member;
      map[member.i] = member; // supports old seed references until they are migrated
    });
    return map;
  }, [members]);
  const normalizeMemberRefs = (refs = []) => [...new Set(refs.map((ref) => memberByRef[ref]?.id).filter(Boolean))];

  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [calendarError, setCalendarError] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);


  const toLocalISO = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return d;
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
  };
  const buildCalendarPayload = () => ({
    month: toLocalISO(cursor instanceof Date ? cursor : new Date()),
    events: (events || []).map((e) => ({
      title: e.title,
      start: e.start instanceof Date ? toLocalISO(e.start) : e.start,
      color: catOf(e.calId)?.color || "#E5536E",
      allDay: !!e.allDay,
      done: !!e.done,
      desc: e.desc || "",
    })),
  });

  const exportCalendarPng = async () => {
    try {
      setCalendarError("");
      const res = await fetch("/api/calendar-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCalendarPayload()),
      });
      if (!res.ok) throw new Error("Unable to render calendar image.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "sdc-calendar.png";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PNG EXPORT ERROR", error);
      setCalendarError(error.message || "Unable to export calendar image.");
    }
  };

  const sendToLark = async () => {
    try {
      setCalendarError("");
      const res = await fetch("/api/lark/calendar-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCalendarPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to send calendar to Lark.");
    } catch (error) {
      setCalendarError(error.message || "Unable to send to Lark");
    }
  };

  const calendarEtagRef = useRef(null);
  const loadingCalendarRef = useRef(false);
  const [calendars, setCalendars] = useState(SEED_CALENDARS);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef(null);
  const calendarExportRef = useRef(null);

  const hydrateEvents = useCallback((items = []) => (
    items.map((event) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }))
  ), []);

  const loadCalendar = useCallback(async ({ force = false } = {}) => {
    if (loadingCalendarRef.current) return;
    loadingCalendarRef.current = true;
    try {
      const headers = {};
      if (!force && calendarEtagRef.current) headers["If-None-Match"] = calendarEtagRef.current;
      const response = await fetch("/api/calendar", { headers, cache: "no-store" });
      if (response.status === 304) return;
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to load calendar events.");
      }
      const body = await response.json();
      const etag = response.headers.get("etag");
      if (etag) calendarEtagRef.current = etag;
      setEvents(hydrateEvents(Array.isArray(body.events) ? body.events : []));
      setCalendarError("");
    } catch (error) {
      setCalendarError(error.message || "Unable to load calendar events.");
    } finally {
      loadingCalendarRef.current = false;
    }
  }, [hydrateEvents]);

  const applyCalendarResponse = useCallback(async (response, fallback) => {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || fallback);
    }
    const body = await response.json();
    const etag = response.headers.get("etag");
    if (etag) calendarEtagRef.current = etag;
    setEvents(hydrateEvents(Array.isArray(body.events) ? body.events : []));
    setCalendarError("");
    return body;
  }, [hydrateEvents]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => { if ((view === "week" || view === "day") && scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H; }, [view]);
  useEffect(() => {
    loadCalendar({ force: true });
    const poll = () => {
      if (document.visibilityState === "visible") loadCalendar();
    };
    const id = window.setInterval(poll, 3000);
    const onFocus = () => loadCalendar({ force: true });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [loadCalendar]);

  const calById = useMemo(() => Object.fromEntries(calendars.map((c) => [c.id, c])), [calendars]);
  const catOf = (id) => calById[id] || { color: "#9A9AA2", soft: "#EEE", fill: "#E4E4E4", ink: "#555" };
  const visibleEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => calById[e.calId]?.visible && (!q || e.title.toLowerCase().includes(q)));
  }, [events, calById, query]);

  const openCreateAt = (startDate, allDay = false) => {
    const start = new Date(startDate); if (allDay) start.setHours(0, 0, 0, 0);
    const end = new Date(start); if (!allDay) end.setHours(start.getHours() + 1);
    setModal({ mode: "create", form: { id: null, title: "", calId: calendars[0].id, date: toDateInput(start), start: toTimeInput(start), end: toTimeInput(end), allDay, desc: "", attendees: [] } });
  };
  const openEdit = (ev) => setModal({ mode: "edit", form: { id: ev.id, title: ev.title, calId: ev.calId, date: toDateInput(ev.start), start: toTimeInput(ev.start), end: toTimeInput(ev.end), allDay: ev.allDay, done: !!ev.done, desc: ev.desc || "", attendees: normalizeMemberRefs(ev.attendees || []) } });
  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));
  const saveModal = async () => {
    if (savingEvent) return;
    const f = modal.form;
    const title = f.title.trim() || "(No title)";
    let start, end;
    if (f.allDay) { start = fromInputs(f.date, "00:00"); end = new Date(start); }
    else { start = fromInputs(f.date, f.start); end = fromInputs(f.date, f.end); if (end <= start) { end = new Date(start); end.setHours(start.getHours() + 1); } }
    const base = {
      title,
      calId: f.calId,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: f.allDay,
      done: !!f.done,
      desc: f.desc,
      attendees: normalizeMemberRefs(f.attendees),
    };

    setSavingEvent(true);
    setCalendarError("");
    try {
      const isEdit = modal.mode === "edit";
      const response = await fetch("/api/calendar", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: f.id, data: base } : { data: base }),
      });
      await applyCalendarResponse(response, isEdit ? "Unable to update event." : "Unable to create event.");
      setModal(null);
    } catch (error) {
      setCalendarError(error.message || "Unable to save event.");
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteEvent = async () => {
    if (savingEvent || !modal?.form?.id) return;
    setSavingEvent(true);
    setCalendarError("");
    try {
      const response = await fetch("/api/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modal.form.id }),
      });
      await applyCalendarResponse(response, "Unable to delete event.");
      setModal(null);
    } catch (error) {
      setCalendarError(error.message || "Unable to delete event.");
    } finally {
      setSavingEvent(false);
    }
  };

  const nav = (dir) => {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else if (view === "week") setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => addDays(c, dir));
  };
  const headerLabel = () => {
    if (view === "month") return cursor.toLocaleString("default", { month: "long", year: "numeric" });
    if (view === "day") return cursor.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" });
    const s = startOfWeek(cursor), e = addDays(s, 6);
    return s.getMonth() === e.getMonth()
      ? `${s.toLocaleString("default", { month: "long" })} ${s.getDate()}–${e.getDate()}`
      : `${s.toLocaleString("default", { month: "short" })} ${s.getDate()} – ${e.toLocaleString("default", { month: "short" })} ${e.getDate()}`;
  };

  const days = view === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
    : [startOfDay(cursor)];
  const monthCells = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor));
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor]);
  const eventsForDay = (day) =>
    visibleEvents.filter((e) => isSameDay(e.start, day)).sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));

  return (
    <>
      <main ref={calendarExportRef} className="flex-1 min-w-0 flex flex-col">
          {calendarError && (
            <div className="mx-5 mt-3 rounded-xl px-4 py-2.5 text-sm shrink-0" style={{ color: "#C23150", background: "rgba(229,83,110,0.10)", border: "1px solid rgba(229,83,110,0.24)" }}>
              {calendarError}
            </div>
          )}
          <header className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 shrink-0" style={{ background: HEADER_BG }}>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>{headerLabel()}</h2>
            <button onClick={() => setCursor(new Date())}
              className="tc-pill rounded-full px-4 py-1.5 text-sm font-medium shadow-sm ml-1"
              style={{ background: "var(--card)", color: "var(--text)" }}>Today</button>
            <div className="flex items-center">
              <button onClick={() => nav(-1)} className="tc-ib h-8 w-8 flex items-center justify-center rounded-full" aria-label="Previous"><ChevronLeft size={20} /></button>
              <button onClick={() => nav(1)} className="tc-ib h-8 w-8 flex items-center justify-center rounded-full" aria-label="Next"><ChevronRight size={20} /></button>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="relative hidden lg:block">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
                  className="pl-8 pr-3 py-2 text-sm rounded-full w-40 outline-none shadow-sm"
                  style={{ background: "var(--card)" }} />
              </div>
              <div className="flex items-center gap-1 rounded-full p-1 shadow-sm" style={{ background: "var(--card)" }}>
                {["month", "week", "day"].map((v) => (
                  <button key={v} onClick={() => setView(v)}
                    className="rounded-full px-3.5 py-1.5 text-sm capitalize font-medium transition-colors"
                    style={view === v ? { background: ACCENT_GRAD, color: ON_ACCENT } : { color: "var(--text-2)" }}>{v}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={exportCalendarPng} className="tc-pill rounded-full px-3.5 py-2 text-sm font-medium shadow-sm" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>🖼️ Export PNG</button>
                <button onClick={sendToLark} className="tc-pill rounded-full px-3.5 py-2 text-sm font-medium shadow-sm" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}>📤 Send to Lark</button>
              </div>
              <button onClick={() => { const d = new Date(cursor); d.setHours(9, 0, 0, 0); openCreateAt(d); }} className="md:hidden tc-pill flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium shadow-md" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}><Plus size={16} /> New</button>
            </div>
          </header>

          <div className="flex-1 min-h-0 flex">
            <div className="w-52 shrink-0 hidden md:flex flex-col gap-4 p-4 overflow-y-auto" style={{ borderRight: "1px solid var(--border)" }}>
              <button onClick={() => { const d = new Date(cursor); d.setHours(9, 0, 0, 0); openCreateAt(d); }}
                className="tc-pill flex items-center justify-center gap-2 rounded-full py-2.5 font-medium shadow-md shrink-0"
                style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
                <Plus size={18} /> New event
              </button>
              <MiniMonth cursor={cursor} onPick={setCursor} />
              <div className="shrink-0">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: "var(--muted)" }}>My calendars</p>
                <ul className="space-y-0.5">
                  {calendars.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => setCalendars((cs) => cs.map((x) => x.id === c.id ? { ...x, visible: !x.visible } : x))}
                        className="tc-cat w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-left">
                        <span className="h-3.5 w-3.5 rounded-md flex items-center justify-center shrink-0"
                          style={{ background: c.visible ? c.color : "transparent", border: `1.5px solid ${c.visible ? c.color : "var(--faint)"}` }}>
                          {c.visible && <span className="leading-none" style={{ fontSize: 9, color: "#fff" }}>✓</span>}
                        </span>
                        <span className="font-medium" style={{ color: c.visible ? "var(--text)" : "var(--faint)" }}>{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              {view === "month" ? (
                <MonthView cells={monthCells} cursor={cursor} today={now} eventsForDay={eventsForDay} catOf={catOf}
                  onDayCreate={(d) => { const x = new Date(d); x.setHours(9, 0, 0, 0); openCreateAt(x); }}
                  onEventClick={openEdit} onMore={(d) => { setCursor(d); setView("day"); }} />
              ) : (
                <TimeGrid days={days} now={now} scrollRef={scrollRef} catOf={catOf} events={visibleEvents} memberByRef={memberByRef}
                  onEventClick={openEdit} onSlotCreate={openCreateAt} onAllDayCreate={(d) => openCreateAt(d, true)}
                  onDayHeaderClick={(d) => { setCursor(d); setView("day"); }} />
              )}
            </div>
          </div>
        </main>

      {modal && (
        <EventModal modal={modal} calendars={calendars} members={members} setForm={setForm}
          onClose={() => !savingEvent && setModal(null)} onSave={saveModal} onDelete={deleteEvent}
          saving={savingEvent} error={calendarError} />
      )}
    </>
  );
}

/* ---------- attendee avatars ---------- */
function AttendeeStack({ list, memberByRef, ring = "var(--card)", size = 18 }) {
  const visible = (list || []).map((ref) => memberByRef[ref]).filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="flex items-center">
      {visible.slice(0, 4).map((member, i) => (
        <span key={member.id} title={member.name} className="rounded-full flex items-center justify-center font-semibold shrink-0"
          style={{ width: size, height: size, background: member.c, color: "#fff", fontSize: size * 0.36, border: `1.5px solid ${ring}`, marginLeft: i ? -6 : 0 }}>
          {member.i}
        </span>
      ))}
    </div>
  );
}

/* ================= MONTH ================= */
function MonthView({ cells, cursor, today, eventsForDay, catOf, onDayCreate, onEventClick, onMore }) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
        {cells.map((cell, i) => {
          const inMonth = cell.getMonth() === cursor.getMonth();
          const isToday = isSameDay(cell, today);
          const evs = eventsForDay(cell);
          return (
            <div key={i} onClick={() => onDayCreate(cell)}
              className="tc-cell p-1.5 overflow-hidden cursor-pointer"
              style={{ borderTop: "1px solid var(--border)", borderLeft: i % 7 ? "1px solid var(--border)" : "none", background: isToday ? "rgba(242,106,60,0.12)" : inMonth ? "transparent" : "var(--dim)" }}>
              <div className="flex justify-end mb-0.5">
                <span className="h-6 px-1.5 flex items-center justify-center rounded-full text-xs font-medium"
                  style={{ minWidth: 24, ...(isToday ? { background: ACCENT_GRAD, color: ON_ACCENT } : { color: inMonth ? "var(--text-2)" : "var(--faint)" }) }}>
                  {cell.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {evs.slice(0, 3).map((ev) => {
                  const c = catOf(ev.calId);
                  return (
                    <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className="tc-evt truncate rounded-lg px-2 py-1 cursor-pointer font-semibold"
                      style={{ background: c.fill, color: TITLE_INK, fontSize: 11, textDecoration: ev.done ? "line-through" : "none", opacity: ev.done ? 0.6 : 1 }}>
                      {!ev.allDay && <span className="mr-1" style={{ color: TIME_INK }}>{fmtTime(ev.start)}</span>}
                      {ev.title}
                    </div>
                  );
                })}
                {evs.length > 3 && (
                  <div onClick={(e) => { e.stopPropagation(); onMore(cell); }}
                    className="text-xs px-2 font-medium" style={{ color: "var(--muted)" }}>+{evs.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= WEEK / DAY ================= */
function TimeGrid({ days, now, scrollRef, catOf, events, memberByRef, onEventClick, onSlotCreate, onAllDayCreate, onDayHeaderClick }) {
  const timedFor = (day) =>
    packEvents(events.filter((e) => !e.allDay && isSameDay(e.start, day))
      .map((e) => ({ ...e, s: minutesOf(e.start), en: Math.max(minutesOf(e.end), minutesOf(e.start) + 30) })));
  const allDayFor = (day) => events.filter((e) => e.allDay && isSameDay(e.start, day));

  const handleColClick = (day) => (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mins = Math.max(0, Math.min(23 * 60 + 30, Math.round(((e.clientY - rect.top) / HOUR_H) * 60 / 30) * 30));
    const d = new Date(day); d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    onSlotCreate(d);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: CANVAS }}>
      {/* day headers */}
      <div className="flex px-2 pt-3 pb-2 shrink-0">
        <div className="w-16 shrink-0" />
        {days.map((d, i) => {
          const isToday = isSameDay(d, now);
          return (
            <div key={i} className="flex-1 flex justify-center">
              <button onClick={() => onDayHeaderClick(d)}
                className="tc-pill flex items-center gap-2 rounded-full pl-2.5 pr-3.5 py-1.5"
                style={isToday ? { background: ACCENT_GRAD, color: ON_ACCENT } : { background: "transparent", color: "var(--text-2)" }}>
                <span className="text-xs uppercase" style={{ opacity: 0.7 }}>{WEEKDAYS[d.getDay()]}</span>
                <span className="text-lg font-semibold leading-none">{d.getDate()}</span>
              </button>
            </div>
          );
        })}
      </div>
      {/* all-day row */}
      <div className="flex px-2 pb-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-16 shrink-0 text-xs text-right pr-3 pt-1" style={{ color: "var(--faint)" }}>all-day</div>
        {days.map((d, i) => (
          <div key={i} onClick={() => onAllDayCreate(d)} className="flex-1 px-1 space-y-1 cursor-pointer">
            {allDayFor(d).map((ev) => {
              const c = catOf(ev.calId);
              return (
                <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  className="tc-evt truncate rounded-lg px-2 py-1 cursor-pointer font-semibold"
                  style={{ background: c.fill, color: TITLE_INK, fontSize: 11, textDecoration: ev.done ? "line-through" : "none", opacity: ev.done ? 0.6 : 1 }}>{ev.title}</div>
              );
            })}
          </div>
        ))}
      </div>
      {/* scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2">
        <div className="flex" style={{ height: 24 * HOUR_H }}>
          <div className="w-16 shrink-0 relative">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="absolute right-3 text-xs" style={{ top: h * HOUR_H - 6, color: "var(--faint)" }}>{h === 0 ? "" : fmtHour(h)}</div>
            ))}
          </div>
          {days.map((day, di) => {
            const isToday = isSameDay(day, now);
            const nowTop = (minutesOf(now) / 60) * HOUR_H;
            return (
              <div key={di} onClick={handleColClick(day)}
                className="flex-1 relative cursor-pointer"
                style={{ height: 24 * HOUR_H, borderLeft: "1px solid var(--border)", background: isToday ? "rgba(242,106,60,0.08)" : "transparent" }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute left-0 right-0" style={{ top: h * HOUR_H, borderTop: "1px solid var(--grid)", pointerEvents: "none" }} />
                ))}
                {timedFor(day).map((ev) => {
                  const c = catOf(ev.calId);
                  const top = (ev.s / 60) * HOUR_H;
                  const height = Math.max(((ev.en - ev.s) / 60) * HOUR_H, 22);
                  const w = 100 / ev._cols;
                  return (
                    <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className="tc-evt absolute rounded-xl overflow-hidden cursor-pointer flex flex-col"
                      style={{ top: top + 1, height: height - 2, left: `calc(${ev._col * w}% + 3px)`, width: `calc(${w}% - 6px)`,
                        background: c.fill, color: TITLE_INK, padding: "5px 8px", lineHeight: 1.25, opacity: ev.done ? 0.6 : 1 }}>
                      <div className="font-semibold truncate" style={{ fontSize: 11.5, textDecoration: ev.done ? "line-through" : "none" }}>{ev.title}</div>
                      {height > 36 && <div className="truncate" style={{ fontSize: 10.5, color: TIME_INK }}>{fmtTime(ev.start)} – {fmtTime(ev.end)}</div>}
                      {height > 62 && ev.attendees?.length > 0 && (
                        <div className="mt-auto pt-1"><AttendeeStack list={ev.attendees} memberByRef={memberByRef} ring={c.fill} size={19} /></div>
                      )}
                    </div>
                  );
                })}
                {isToday && (
                  <div className="absolute left-0 right-0" style={{ top: nowTop, zIndex: 10, pointerEvents: "none" }}>
                    <div style={{ height: 2, background: "#E5536E" }} />
                    <div className="absolute rounded-full" style={{ left: -4, top: -4, height: 10, width: 10, background: "#E5536E" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================= MINI MONTH ================= */
function MiniMonth({ cursor, onPick }) {
  const [view, setView] = useState(startOfMonth(cursor));
  useEffect(() => setView(startOfMonth(cursor)), [cursor]);
  const cells = useMemo(() => {
    const gs = startOfWeek(startOfMonth(view));
    return Array.from({ length: 42 }, (_, i) => addDays(gs, i));
  }, [view]);
  const now = new Date();
  return (
    <div className="select-none shrink-0 w-full">
      <div className="flex items-center justify-between gap-1 mb-2 px-1">
        <span className="text-sm font-semibold truncate min-w-0" style={{ color: "var(--text)" }}>
          {view.toLocaleString("default", { month: "long", year: "numeric" })}
        </span>
        <div className="flex gap-0.5 shrink-0">
          <button onClick={() => setView((v) => addMonths(v, -1))} aria-label="Previous month"
            className="tc-ib h-6 w-6 flex items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}><ChevronLeft size={14} /></button>
          <button onClick={() => setView((v) => addMonths(v, 1))} aria-label="Next month"
            className="tc-ib h-6 w-6 flex items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 w-full">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="flex items-center justify-center pb-1" style={{ fontSize: 10, color: "var(--muted)" }}>{d}</div>
        ))}
        {cells.map((c, i) => {
          const inMonth = c.getMonth() === view.getMonth();
          const isToday = isSameDay(c, now);
          const isSel = isSameDay(c, cursor) && !isToday;
          const st = isToday
            ? { background: ACCENT_GRAD, color: ON_ACCENT, fontWeight: 600 }
            : isSel
              ? { background: "rgba(242,106,60,0.16)", color: "var(--text)", fontWeight: 600 }
              : { color: inMonth ? "var(--text)" : "var(--faint)" };
          return (
            <div key={i} className="p-0.5 flex items-center justify-center">
              <button onClick={() => onPick(c)} style={{ fontSize: 11, ...st }}
                className={`tc-mini-day w-full aspect-square flex items-center justify-center rounded-full`}>
                {c.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= EVENT MODAL ================= */
function EventModal({ modal, calendars, members, setForm, onClose, onSave, onDelete, saving, error }) {
  const f = modal.form;
  const cal = calendars.find((c) => c.id === f.calId) || calendars[0];
  const toggleAttendee = (id) => setForm({ attendees: f.attendees.includes(id) ? f.attendees.filter((a) => a !== id) : [...f.attendees, id] });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,26,0.4)" }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ background: cal.soft }}>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: cal.color }} />
            <h3 className="font-semibold" style={{ color: cal.ink }}>{modal.mode === "edit" ? "Edit event" : "New event"}</h3>
          </div>
          <button onClick={onClose} className="tc-ib h-8 w-8 flex items-center justify-center rounded-full" style={{ color: cal.ink }}><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ color: "#C23150", background: "rgba(229,83,110,0.10)", border: "1px solid rgba(229,83,110,0.20)" }}>
              {error}
            </div>
          )}
          <input autoFocus value={f.title} onChange={(e) => setForm({ title: e.target.value })} placeholder="Add title"
            className="w-full text-lg outline-none pb-1" style={{ borderBottom: "2px solid var(--border)" }} />

          <div className="flex items-start gap-3">
            <Clock size={18} style={{ color: "var(--muted)", marginTop: 8 }} />
            <div className="flex-1 space-y-2">
              <input type="date" value={f.date} onChange={(e) => setForm({ date: e.target.value })}
                className="rounded-lg px-2.5 py-1.5 text-sm w-full" style={{ border: "1px solid var(--border)" }} />
              {!f.allDay && (
                <div className="flex items-center gap-2">
                  <input type="time" value={f.start} onChange={(e) => setForm({ start: e.target.value })} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ border: "1px solid var(--border)" }} />
                  <span style={{ color: "var(--muted)" }}>–</span>
                  <input type="time" value={f.end} onChange={(e) => setForm({ end: e.target.value })} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ border: "1px solid var(--border)" }} />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-2)" }}>
                <input type="checkbox" checked={f.allDay} onChange={(e) => setForm({ allDay: e.target.checked })} /> All day
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none" style={{ color: f.done ? "#3FA37A" : "var(--text-2)" }}>
                <input type="checkbox" checked={!!f.done} onChange={(e) => setForm({ done: e.target.checked })} /> Done
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {calendars.map((c) => (
              <button key={c.id} onClick={() => setForm({ calId: c.id })}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: c.soft, color: c.ink, outline: f.calId === c.id ? `2px solid ${c.color}` : "none", outlineOffset: 1 }}>
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex items-start gap-3">
            <Users size={18} style={{ color: "var(--muted)", marginTop: 4 }} />
            <div className="flex flex-wrap gap-1.5">
              {members.map((t) => {
                const on = f.attendees.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleAttendee(t.id)} title={t.name}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ background: t.c, fontSize: 11, opacity: on ? 1 : 0.35, outline: on ? `2px solid ${t.c}` : "none", outlineOffset: 1 }}>
                    {t.i}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <AlignLeft size={18} style={{ color: "var(--muted)", marginTop: 8 }} />
            <textarea value={f.desc} onChange={(e) => setForm({ desc: e.target.value })} rows={2} placeholder="Add description"
              className="flex-1 rounded-lg px-2.5 py-1.5 text-sm resize-none outline-none" style={{ border: "1px solid var(--border)" }} />
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          {modal.mode === "edit" ? (
            <button disabled={saving} onClick={onDelete} className="tc-ib inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg disabled:opacity-50" style={{ color: "#E5536E" }}>
              <Trash2 size={16} /> {saving ? "Saving…" : "Delete"}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button disabled={saving} onClick={onClose} className="tc-ib text-sm px-4 py-2 rounded-full disabled:opacity-50" style={{ color: "var(--text-2)" }}>Cancel</button>
            <button disabled={saving} onClick={onSave} className="tc-pill text-sm px-5 py-2 rounded-full font-medium shadow-md disabled:opacity-60" style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
