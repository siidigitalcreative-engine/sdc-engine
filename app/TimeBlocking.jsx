"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, Send, Trash2, Wand2 } from "lucide-react";
import { useAuth } from "./auth";
import { useLarkSend } from "./LarkSend";

const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ROW_H = 44;
const PROJECT_COLORS = ["#3E8ED0", "#7C5CD8", "#3FA37A", "#E0A93C", "#F0784B", "#E5536E", "#2E9B8F", "#8E8A96"];
const hash = (s) => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0; return h; };
const colorFor = (name) => PROJECT_COLORS[hash(name || "x") % PROJECT_COLORS.length];

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const gutter = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const hours = (m) => ((m / 60) % 1 === 0 ? m / 60 : (m / 60).toFixed(1)) + "h";

export default function TimeBlocking({ day, onDayChange }) {
  const { currentMember } = useAuth();
  const [data, setData] = useState({ blocks: [], members: [], departments: [], day: { start: 420, end: 1200, slot: 30 } });
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("all");          // "all" or a member id
  const [tab, setTab] = useState("tasks");
  const [expanded, setExpanded] = useState(new Set());
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dragRef = useRef(null);

  const { openLarkSend, larkPicker } = useLarkSend();
  const key = dateKey(day);
  const DAY_START = data.day.start, DAY_END = data.day.end, SLOT = data.day.slot;
  const me = currentMember?.id;

  const load = useCallback(async () => {
    try {
      const [blockRes, taskRes] = await Promise.all([
        fetch(`/api/time-blocks?date=${key}`, { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
      ]);
      const body = await blockRes.json();
      if (!blockRes.ok) throw new Error(body.error || "Unable to load the time blocks.");
      setData((d) => ({ ...d, ...body }));
      const taskBody = await taskRes.json().catch(() => ({}));
      setTasks(Array.isArray(taskBody.tasks) ? taskBody.tasks.filter((t) => !t.archived) : []);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const members = data.members || [];
  const blocksOf = (memberId) => (data.blocks || []).filter((b) => b.member === memberId);
  const minutesOf = (memberId) => blocksOf(memberId).reduce((t, b) => t + (b.end - b.start), 0);
  const totalMinutes = (data.blocks || []).reduce((t, b) => t + (b.end - b.start), 0);
  const editable = view !== "all" && view === me;

  /* ---- what can be blocked ---- */
  const sources = useMemo(() => {
    if (tab === "projects") {
      const names = [...new Set(tasks.map((t) => t.project).filter(Boolean))];
      return names.map((name) => ({
        id: name, kind: "project", title: name, meta: "Project", project: name,
        color: colorFor(name), est: 60,
      }));
    }
    return tasks.map((t) => ({
      id: t.id, kind: "task", title: t.title, meta: `${t.project || "No project"} · ${t.status}`,
      project: t.project, color: colorFor(t.project), est: 60,
      subtasks: (t.subtasks || []).map((st) => ({
        id: st.id, kind: "subtask", title: st.title, parentTitle: t.title, done: st.done,
        meta: `part of ${t.title}`, project: t.project, color: colorFor(t.project), est: 60,
      })),
    }));
  }, [tasks, tab]);

  /* ---- writing ---- */
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
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      await load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const place = (start, event) => {
    if (event) event.preventDefault();
    if (!picked || !editable) { setError(picked ? "" : "Pick a task, subtask or project first."); return; }
    let end = Math.min(DAY_END, start + picked.est);
    blocksOf(me).forEach((b) => { if (b.start >= start && b.start < end) end = Math.min(end, b.start); });
    if (end - start < SLOT) { setError("No room there. Try a free slot."); return; }
    send("POST", {
      block: {
        date: key, kind: picked.kind, refId: picked.id, title: picked.title,
        parentTitle: picked.parentTitle || "", project: picked.project || "",
        color: picked.color, start, end,
      },
    });
    setPicked(null);
  };

  const autoFill = async () => {
    const taken = new Set(blocksOf(me).map((b) => b.refId));
    const open = tasks.filter((t) => t.status !== "done" && !taken.has(t.id)).slice(0, 8);
    for (const t of open) {
      const mine = blocksOf(me);
      let slot = DAY_START;
      while (slot < DAY_END) {
        const end = Math.min(slot + 60, DAY_END);
        const clash = mine.some((b) => slot < b.end && end > b.start);
        if (!clash && end - slot >= SLOT) {
          // eslint-disable-next-line no-await-in-loop
          await send("POST", { block: {
            date: key, kind: "task", refId: t.id, title: t.title, project: t.project || "",
            color: colorFor(t.project), start: slot, end } });
          break;
        }
        slot += SLOT;
      }
    }
  };

  /* ---- dragging: body moves, bottom edge resizes ---- */
  const beginDrag = (event, block, mode) => {
    if (block.member !== me) return;
    event.preventDefault();
    event.stopPropagation();
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    dragRef.current = { id: block.id, mode, startY: clientY, start: block.start, end: block.end, live: null };
  };

  useEffect(() => {
    const move = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const clientY = event.clientY ?? event.touches?.[0]?.clientY;
      const delta = Math.round(((clientY - drag.startY) / ROW_H) * 60 / SLOT) * SLOT;
      const mine = blocksOf(me).filter((b) => b.id !== drag.id);
      const clash = (s, e) => mine.some((b) => s < b.end && e > b.start);

      if (drag.mode === "resize") {
        const end = Math.min(DAY_END, Math.max(drag.start + SLOT, drag.end + delta));
        if (!clash(drag.start, end)) drag.live = { start: drag.start, end };
      } else {
        const length = drag.end - drag.start;
        const start = Math.max(DAY_START, Math.min(DAY_END - length, drag.start + delta));
        if (!clash(start, start + length)) drag.live = { start, end: start + length };
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
    blocks: (view === "all" ? data.blocks : blocksOf(view)),
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

  const block = (b, interactive) => {
    const top = ((b.start - DAY_START) / 60) * ROW_H + 2;
    const height = ((b.end - b.start) / 60) * ROW_H - 4;
    const tight = b.end - b.start < 45;
    return (
      <div key={b.id}
        onMouseDown={interactive ? (e) => beginDrag(e, b, "move") : undefined}
        onTouchStart={interactive ? (e) => beginDrag(e, b, "move") : undefined}
        style={{
          position: "absolute", left: 4, right: 4, top, height, overflow: "hidden",
          borderRadius: 10, padding: "7px 10px 7px 11px", background: "var(--card)",
          border: `1px solid ${b.color}`, color: b.color, boxShadow: `inset 3px 0 0 ${b.color}`,
          cursor: interactive ? "grab" : "default",
        }}>
        {interactive && (
          <span onMouseDown={(e) => { e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); send("DELETE", { id: b.id }); }}
            style={{ position: "absolute", top: 3, right: 7, fontSize: 13, fontWeight: 700, opacity: 0.6, cursor: "pointer" }}>×</span>
        )}
        {b.parentTitle && (
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
            opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {b.parentTitle}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{b.title}</div>
        {!tight && (
          <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 1 }}>
            {hhmm(b.start)} to {hhmm(b.end)} · {hours(b.end - b.start)}
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
              <button onClick={autoFill} disabled={busy}
                className="rounded-full px-3.5 py-2 text-sm font-semibold inline-flex items-center gap-1.5"
                style={{ background: ACCENT, color: "var(--on-accent)" }}>
                <Wand2 size={15} /> Auto-fill
              </button>
            </>
          )}
        </div>
      </div>

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

            <div className="flex flex-col gap-1.5" style={{ maxHeight: 520, overflowY: "auto" }}>
              {sources.map((s) => (
                <div key={s.id}>
                  <SourceRow s={s} picked={picked} onPick={setPicked} onDragPick={setPicked} />
                  {s.subtasks?.length > 0 && (
                    <button onClick={() => setExpanded((prev) => {
                        const next = new Set(prev);
                        next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                        return next;
                      })}
                      className="flex items-center gap-1 text-[10.5px] font-semibold ml-4 mt-1"
                      style={{ color: "var(--muted)" }}>
                      {expanded.has(s.id) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      {expanded.has(s.id) ? "Hide" : "Show"} {s.subtasks.length} subtask{s.subtasks.length === 1 ? "" : "s"}
                    </button>
                  )}
                  {expanded.has(s.id) && s.subtasks.map((st) => (
                    <div key={st.id} className="ml-4 mt-1.5"><SourceRow s={st} picked={picked} onPick={setPicked} onDragPick={setPicked} sub /></div>
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
                            onClick={() => place(h * 60 + i * SLOT)}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                            onDrop={(e) => { e.preventDefault(); place(h * 60 + i * SLOT, e); }}
                            style={{ borderRight: i === 0 ? "1px dashed var(--border)" : "none", cursor: "pointer" }} />
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
                  <div style={{ position: "relative", height: "100%", pointerEvents: "auto" }}>
                    {blocksOf(m.id).map((b) => block(b, m.id === me))}
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
                  }}>{hhmm(nowMin)}</span>
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

function SourceRow({ s, picked, onPick, sub, onDragPick }) {
  const on = picked?.id === s.id;
  return (
    <button onClick={() => onPick(on ? null : s)}
      draggable
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
