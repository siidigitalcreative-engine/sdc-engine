"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, CalendarDays, Users, X, FileText } from "lucide-react";
import { useParams } from "next/navigation";

const ROW_H = 48;
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
const pad = n => String(n).padStart(2, "0");
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const humanTime = minutes => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const hourLabel = h => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const hours = mins => `${(mins / 60).toFixed(1)}h`;
const dateFromKey = str => new Date(`${str}T12:00:00`);

function laneLayout(blocks) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const output = new Map();
  let group = [], groupEnd = -1;
  const flush = () => {
    const ends = [];
    for (const block of group) {
      let column = ends.findIndex(end => end <= block.start);
      if (column < 0) { column = ends.length; ends.push(block.end); }
      else ends[column] = block.end;
      output.set(block.id, { column });
    }
    for (const block of group) output.set(block.id, { ...output.get(block.id), columns: ends.length });
    group = []; groupEnd = -1;
  };
  for (const b of sorted) {
    if (group.length && b.start >= groupEnd) flush();
    group.push(b); groupEnd = Math.max(groupEnd, b.end);
  }
  if (group.length) flush();
  return output;
}

export default function PublicTimeBlocking() {
  const { token } = useParams();
  const [date, setDate] = useState(() => key(new Date()));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/public/time-blocking/${encodeURIComponent(token)}?date=${date}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Public timeline unavailable.");
      setData(body); setError("");
    } catch (e) { setData(null); setError(e.message); }
    finally { setLoading(false); }
  }, [token, date]);
  useEffect(() => { setSelected(null); load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = e => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected]);
  const move = offset => { const d = dateFromKey(date); d.setDate(d.getDate() + offset); setDate(key(d)); };
  const start = data?.day?.start ?? 420;
  const end = data?.day?.end ?? 1200;
  const members = data?.members || [];
  const blocks = data?.blocks || [];
  const groups = useMemo(() => Object.fromEntries(members.map(member => {
    const group = blocks.filter(b => b.member === member.id);
    return [member.id, { blocks: group, positions: laneLayout(group), minutes: group.reduce((s, b) => s + workingMinutes(b.start, b.end), 0) }];
  })), [members, blocks]);
  const titleDate = dateFromKey(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const showAll = data?.view === "all";

  return <main className="min-h-screen px-3 py-5 sm:px-6 sm:py-7" style={{ background: "#111114", color: "#F2F1F5", fontFamily: "Inter, sans-serif" }}>
    <div className="max-w-[1700px] mx-auto space-y-4">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <div><div className="text-[11px] tracking-widest font-bold uppercase" style={{ color: "#F0784B" }}>SDC ENGINE · PUBLIC TIMELINE</div>
          <h1 className="font-bold text-2xl mt-1">Time Blocking</h1><p className="text-sm mt-1" style={{ color: "#A9A4B0" }}>{titleDate}</p></div>
        <div className="flex gap-2 items-center flex-wrap">
          <button type="button" onClick={() => move(-1)} aria-label="Previous day" className="rounded-xl p-2.5" style={{ border: "1px solid #37313E" }}><ChevronLeft size={17}/></button>
          <button type="button" onClick={() => setDate(key(new Date()))} className="rounded-xl px-3 py-2 text-sm" style={{ border: "1px solid #37313E" }}>Today</button>
          <button type="button" onClick={() => move(1)} aria-label="Next day" className="rounded-xl p-2.5" style={{ border: "1px solid #37313E" }}><ChevronRight size={17}/></button>
          <label className="flex items-center gap-1.5 rounded-xl px-3 py-2" style={{ border: "1px solid #37313E" }}><CalendarDays size={15}/><input aria-label="Timeline date" type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm bg-transparent outline-none" style={{ colorScheme: "dark" }}/></label>
        </div>
      </header>
      <p className="text-xs flex gap-2 items-center" style={{ color: "#A9A4B0" }}><Users size={14}/> {showAll ? "Everyone · All team timelines" : members[0]?.name || "Team member"} · Read-only public view</p>
      {error && <div role="alert" className="rounded-xl p-5 text-sm" style={{ background: "#281C20", border: "1px solid #70454F", color: "#F9B7BA" }}>{error}</div>}
      {loading && <div className="rounded-xl p-4 text-sm" style={{ color: "#AAA4B3" }}>Loading timeline…</div>}
      {!error && data && <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid #37313E", background: "#1B1B22" }}>
        <div style={{ minWidth: Math.max(540, members.length * 230 + 66) }}>
          <div className="flex" style={{ borderBottom: "1px solid #37313E" }}>
            <div className="flex items-end justify-end text-[10px] pr-2 pb-2" style={{ width: 66, flexShrink: 0, color: "#888494", borderRight: "1px solid #37313E" }}>GMT+8</div>
            {members.map(member => <div key={member.id} className="flex-1 text-center py-3 px-2" style={{ borderRight: "1px solid #37313E" }}>
              <div className="mx-auto w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[11px]" style={{ background: member.c || "#7C6FF0" }}>{member.i}</div>
              <div className="text-xs font-semibold mt-1">{member.name}</div>
              <div className="text-[10px]" style={{ color: "#918B9C" }}>{groups[member.id]?.minutes ? `${hours(groups[member.id].minutes)} blocked` : "free"}</div>
            </div>)}
          </div>
          <div style={{ position: "relative" }}>
            {Array.from({ length: (end - start) / 60 }, (_, i) => <div key={i} className="flex" style={{ height: ROW_H, borderBottom: "1px solid #32303B" }}>
              <div className="text-right pr-2 pt-1 text-[11px]" style={{ flexShrink: 0, width: 66, borderRight: "1px solid #37313E", color: "#888494" }}>{hourLabel(start / 60 + i)}</div>
              {members.map(member => <div key={member.id} className="flex-1" style={{ borderRight: "1px solid #32303B" }}/>)}</div>)}
            <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 66, pointerEvents: "none" }}>
              {members.map((member, index) => <div key={member.id} style={{ position: "absolute", top: 0, bottom: 0, left: `${index / members.length * 100}%`, width: `${100 / members.length}%`, borderRight: "1px solid #32303B" }}>
                {STANDARD_BREAKS.filter(b => b.end > start && b.start < end).map(b => (
                  <div key={b.label} aria-label={`${b.label}: ${humanTime(b.start)}–${humanTime(b.end)}`}
                    style={{ position: "absolute", left: 0, right: 0,
                      top: (Math.max(start, b.start) - start) / 60 * ROW_H,
                      height: (Math.min(end, b.end) - Math.max(start, b.start)) / 60 * ROW_H,
                      background: "rgba(148, 153, 163, 0.18)", pointerEvents: "none",
                      borderTop: "1px solid rgba(163, 168, 176, 0.15)",
                      borderBottom: "1px solid rgba(163, 168, 176, 0.15)" }} />
                ))}
                {(groups[member.id]?.blocks || []).map(b => {
                  const position = groups[member.id].positions.get(b.id) || { column: 0, columns: 1 };
                  const columns = Math.max(1, position.columns);
                  const top = (b.start - start) / 60 * ROW_H + 2;
                  const height = Math.max(18, (b.end - b.start) / 60 * ROW_H - 4);
                  const showTime = height >= 35;
                  const showParent = Boolean(b.parentTitle?.trim()) && height >= 50;
                  const titleLines = showTime ? Math.max(1, Math.min(3, Math.floor((height - (showParent ? 36 : 24)) / 12)))
                    : Math.max(1, Math.min(3, Math.floor((height - (showParent ? 21 : 9)) / 12)));
                  return <button key={b.id} type="button" onClick={() => setSelected({ ...b, memberName: member.name })}
                    aria-label={`View details for ${b.title}`} title={`View details: ${b.title}`}
                    className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                    style={{
                      position: "absolute", top, height, left: `calc(${position.column * 100 / columns}% + 3px)`, width: `calc(${100 / columns}% - 6px)`,
                      border: `1.5px solid ${b.color || "#3E8ED0"}`, borderLeftWidth: 3, borderRadius: 5,
                      background: "#1B1B22", padding: showTime ? "5px 7px" : "2px 7px", overflow: "hidden", boxSizing: "border-box",
                      pointerEvents: "auto", cursor: "pointer", color: "inherit", display: "flex", flexDirection: "column",
                    }}>
                    {showParent && <div title={b.parentTitle} style={{ color: b.color || "#8FC1FF", fontSize: 9,
                      fontWeight: 700, lineHeight: "12px", flexShrink: 0, opacity: 0.75,
                      textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.parentTitle}
                    </div>}
                    {!showTime ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, height: "100%" }}>
                        <span title={b.title} style={{ color: b.color || "#8FC1FF", fontSize: 10.5, fontWeight: 700,
                          lineHeight: "12px", flex: "1 1 auto", minWidth: 30, whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</span>
                        <span style={{ fontSize: 9, lineHeight: "12px", color: b.color || "#8FC1FF",
                          opacity: 0.8, whiteSpace: "nowrap", flexShrink: 0 }}>
                          {humanTime(b.start)}–{humanTime(b.end)}
                        </span>
                      </div>
                    ) : (
                      <div title={b.title} style={{ color: b.color || "#8FC1FF", fontSize: 10.5, fontWeight: 700,
                        lineHeight: "12px", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: titleLines,
                        overflow: "hidden", overflowWrap: "anywhere", flexShrink: 0 }}>{b.title}</div>
                    )}
                    {showTime && <div style={{ display: "flex", minWidth: 0, marginTop: "auto", fontSize: 9.5,
                      lineHeight: "12px", color: b.color || "#8FC1FF", opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden" }}>
                      <span style={{ flexShrink: 0 }}>{humanTime(b.start)}–{humanTime(b.end)}</span>
                      <span style={{ minWidth: 0, overflow: "hidden", whiteSpace: "nowrap" }}> · {hours(workingMinutes(b.start, b.end))}</span>
                    </div>}
                  </button>;
                })}
              </div>)}
            </div>
          </div>
        </div>
      </div>}
      <p className="text-[11px]" style={{ color: "#77717E" }}><Clock3 size={12} className="inline mr-1"/> Click any task card to see its details. Only authorized SDC team members can edit time blocks.</p>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,.75)" }} onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-label={`Task details: ${selected.title}`}
          className="w-full max-w-lg rounded-2xl p-5 sm:p-6 space-y-4 overflow-y-auto"
          style={{ background: "#202027", border: "1px solid #484150", maxHeight: "90vh", color: "#F2F1F5" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: selected.color || "#F0784B" }}>{selected.kind === "subtask" ? "Subtask" : selected.kind === "project" ? "Project" : "Task"} details</p>
              <h2 className="text-lg font-bold break-words">{selected.title}</h2>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close task details" className="rounded-lg p-2 flex-shrink-0" style={{ border: "1px solid #484150" }}><X size={18}/></button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl p-3" style={{ background: "#2C2932" }}><div className="text-[11px] mb-1" style={{ color: "#AAA4B3" }}>Start</div><strong>{humanTime(selected.start)}</strong></div>
            <div className="rounded-xl p-3" style={{ background: "#2C2932" }}><div className="text-[11px] mb-1" style={{ color: "#AAA4B3" }}>End</div><strong>{humanTime(selected.end)}</strong></div>
          </div>
          <p className="text-xs" style={{ color: "#BDB7C5" }}>{titleDate} · {hours(workingMinutes(selected.start, selected.end))} · {selected.memberName}</p>
          {selected.project && <div className="text-sm"><span style={{ color: "#AAA4B3" }}>Project: </span>{selected.project}</div>}
          {selected.parentTitle && <div className="text-sm"><span style={{ color: "#AAA4B3" }}>Parent task: </span>{selected.parentTitle}</div>}
          {(selected.status || selected.priority || selected.due || selected.progress != null) && <div className="flex flex-wrap gap-2 text-xs">
            {selected.status && <span className="rounded-full px-3 py-1" style={{ background: "#36313F" }}>Status: {selected.status}</span>}
            {selected.priority && <span className="rounded-full px-3 py-1" style={{ background: "#36313F" }}>Priority: {selected.priority}</span>}
            {selected.due && <span className="rounded-full px-3 py-1" style={{ background: "#36313F" }}>Due: {selected.due}</span>}
            {selected.progress != null && <span className="rounded-full px-3 py-1" style={{ background: "#36313F" }}>Progress: {selected.progress}%</span>}
          </div>}
          {selected.description && <div className="space-y-1"><h3 className="font-semibold text-sm flex gap-2 items-center"><FileText size={15}/> Task Description</h3><p className="text-sm whitespace-pre-wrap break-words" style={{ color: "#CBC5D1" }}>{selected.description}</p></div>}
          {selected.taskNotes && <div className="space-y-1"><h3 className="font-semibold text-sm">Task Notes</h3><p className="text-sm whitespace-pre-wrap break-words" style={{ color: "#CBC5D1" }}>{selected.taskNotes}</p></div>}
          {selected.note && <div className="space-y-1"><h3 className="font-semibold text-sm">Time Block Notes</h3><p className="text-sm whitespace-pre-wrap break-words" style={{ color: "#CBC5D1" }}>{selected.note}</p></div>}
          {!selected.description && !selected.taskNotes && !selected.note && <p className="text-sm" style={{ color: "#AAA4B3" }}>No additional notes or description for this task.</p>}
          <div className="flex justify-end pt-2"><button type="button" onClick={() => setSelected(null)} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: "#F0784B", color: "#151317" }}>Close</button></div>
        </section>
      </div>}
    </div>
  </main>;
}
