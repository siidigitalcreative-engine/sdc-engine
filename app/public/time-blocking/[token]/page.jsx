"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, CalendarDays, Users } from "lucide-react";
import { useParams } from "next/navigation";

const ROW_H = 48;
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
  useEffect(() => { load(); }, [load]);
  const move = offset => { const d = dateFromKey(date); d.setDate(d.getDate() + offset); setDate(key(d)); };
  const start = data?.day?.start ?? 420;
  const end = data?.day?.end ?? 1200;
  const members = data?.members || [];
  const blocks = data?.blocks || [];
  const groups = useMemo(() => Object.fromEntries(members.map(member => {
    const group = blocks.filter(b => b.member === member.id);
    return [member.id, { blocks: group, positions: laneLayout(group), minutes: group.reduce((s, b) => s + b.end - b.start, 0) }];
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
                {(groups[member.id]?.blocks || []).map(b => {
                  const position = groups[member.id].positions.get(b.id) || { column: 0, columns: 1 };
                  const columns = Math.max(1, position.columns);
                  const top = (b.start - start) / 60 * ROW_H + 2;
                  const height = Math.max(18, (b.end - b.start) / 60 * ROW_H - 4);
                  return <div key={b.id} title={`${b.title} · ${humanTime(b.start)}–${humanTime(b.end)}`} style={{
                    position: "absolute", top, height, left: `calc(${position.column * 100 / columns}% + 3px)`, width: `calc(${100 / columns}% - 6px)`,
                    border: `1.5px solid ${b.color || "#3E8ED0"}`, borderLeftWidth: 3, borderRadius: 10,
                    background: "#1B1B22", padding: "7px 9px", overflow: "hidden", boxSizing: "border-box",
                  }}>
                    <div className="font-semibold text-[11px] leading-tight" style={{ color: b.color || "#8FC1FF", overflowWrap: "anywhere" }}>{b.title}</div>
                    {height > 32 && <div className="text-[10px] mt-1" style={{ color: b.color || "#8FC1FF" }}>{humanTime(b.start)}–{humanTime(b.end)} · {hours(b.end - b.start)}</div>}
                  </div>;
                })}
              </div>)}
            </div>
          </div>
        </div>
      </div>}
      <p className="text-[11px]" style={{ color: "#77717E" }}><Clock3 size={12} className="inline mr-1"/> Updates reflect the current shared timeline. Only authorized SDC team members can edit time blocks.</p>
    </div>
  </main>;
}
