/* Renders a single subtask as a PNG: the parent task above it, its own status,
   dates, and where it sits among its siblings. Satori has no CSS grid, so
   every row here is flex. */

const C = {
  page: "#17141A", card: "#231E27", col: "#1F1A23", border: "#332C3A",
  text: "#F2EEF5", text2: "#BDB3C7", muted: "#8C8398", faint: "#6A6175",
};

const W = 760;
const PAD = 26;

const STATUS_FALLBACK = { c: "#8E8A96", s: "#ECEBEE" };
const STATUS_COLORS = {
  todo: { c: "#8E8A96", s: "#ECEBEE" },
  inprogress: { c: "#3E8ED0", s: "#E3EEF9" },
  inreview: { c: "#E0A93C", s: "#FAEFD6" },
  revision: { c: "#7C5CD8", s: "#EBE4FA" },
  onhold: { c: "#E5536E", s: "#FBE1E7" },
  done: { c: "#3FA37A", s: "#DEF1E7" },
};
const statusStyle = (id) => STATUS_COLORS[String(id || "").toLowerCase()] || STATUS_FALLBACK;

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function buildSubtaskImage(payload = {}) {
  const sub = payload.subtask || {};
  const task = payload.task || {};
  const siblings = Array.isArray(payload.siblings) ? payload.siblings.slice(0, 8) : [];
  const names = payload.statusNames || {};
  const label = (id) => names[id] || String(id || "todo");

  const title = String(sub.title || "Untitled subtask").slice(0, 70);
  const note = String(sub.note || "").slice(0, 220);
  const parent = String(task.title || "").slice(0, 70);
  const doneCount = siblings.filter((s) => s.status === "done").length;

  const titleLines = Math.min(2, Math.ceil(title.length / 36) || 1);
  const noteLines = note ? Math.min(3, Math.ceil(note.length / 68)) : 0;
  const H = PAD * 2 + 22 + 18 + titleLines * 30 + 44 + 96
    + (noteLines ? 14 + 20 + noteLines * 19 : 0)
    + (siblings.length ? 16 + 20 + siblings.length * 24 : 0) + 30;

  const st = statusStyle(sub.status);
  const chip = (text, fg, bg, key) => (
    <div key={key} style={{
      display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start",
      height: 26, paddingLeft: 12, paddingRight: 12, paddingBottom: 1, borderRadius: 999,
      backgroundColor: bg, color: fg, fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>{text}</div>
  );

  const cell = (k, v) => (
    <div key={k} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "11px 14px" }}>
      <div style={{ display: "flex", fontSize: 9.5, letterSpacing: 0.7, textTransform: "uppercase",
        fontWeight: 700, color: C.muted }}>{k}</div>
      <div style={{ display: "flex", fontSize: 13.5, fontWeight: 600, marginTop: 3,
        color: v ? C.text : C.faint }}>{v || "Not set"}</div>
    </div>
  );

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column",
      backgroundColor: C.page, padding: PAD, fontFamily: "Inter, sans-serif" }}>

      <div style={{ display: "flex", fontSize: 10, fontWeight: 800, letterSpacing: 1.6,
        textTransform: "uppercase", color: "#F0784B" }}>SDC Engine · Subtask</div>

      <div style={{ display: "flex", fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
        textTransform: "uppercase", color: C.muted, marginTop: 14 }}>{parent}</div>

      <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: C.text, marginTop: 4, lineHeight: 1.25 }}>
        {title}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {chip(label(sub.status), st.c, st.s)}
        {task.project ? chip(task.project, C.text2, C.col) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 14,
        border: `1px solid ${C.border}`, borderRadius: 12, backgroundColor: C.card }}>
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
          {cell("Due", fmtDate(sub.due))}
          {cell("Assignee", payload.assignee || null)}
        </div>
        <div style={{ display: "flex" }}>
          {cell("Parent status", label(task.status))}
          {cell("Parent progress", siblings.length ? `${doneCount} of ${siblings.length} done` : null)}
        </div>
      </div>

      {noteLines ? (
        <div style={{ display: "flex", marginTop: 14, backgroundColor: C.col,
          borderLeft: `2px solid ${C.faint}`, borderRadius: "0 10px 10px 0", padding: "10px 13px" }}>
          <div style={{ display: "flex", fontSize: 12.5, color: C.text2, lineHeight: 1.5 }}>{note}</div>
        </div>
      ) : null}

      {siblings.length ? (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
          <div style={{ display: "flex", fontSize: 9.5, letterSpacing: 0.7, textTransform: "uppercase",
            fontWeight: 700, color: C.muted, marginBottom: 6 }}>All subtasks</div>
          {siblings.map((s, i) => {
            const mine = s.id === sub.id;
            const ss = statusStyle(s.status);
            return (
              <div key={s.id || i} style={{ display: "flex", alignItems: "center", height: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: 13, width: 13, borderRadius: 4, marginRight: 9,
                  border: `1.3px solid ${s.status === "done" ? "#3FA37A" : C.faint}`,
                  backgroundColor: s.status === "done" ? "#3FA37A" : "transparent",
                  color: "#fff", fontSize: 9, fontWeight: 700 }}>{s.status === "done" ? "✓" : ""}</div>
                <div style={{ display: "flex", fontSize: 12, color: mine ? C.text : C.text2,
                  fontWeight: mine ? 700 : 400 }}>{String(s.title || "").slice(0, 46)}</div>
                <div style={{ display: "flex", marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: ss.c }}>
                  {label(s.status)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ display: "flex", marginTop: 14, fontSize: 10.5, color: C.faint }}>
        {payload.footer || ""}
      </div>
    </div>
  );

  return { element, width: W, height: H };
}
