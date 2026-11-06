/* Renders one subtask as a PNG in the same format as the task export: gradient
   header, white body, labelled blocks. Satori has no CSS grid, so every row
   here is flex. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (v) => {
  const s = String(v || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
  const d = new Date(s);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

const STATUS_COLORS = {
  todo: "#8E8A96", inprogress: "#3E8ED0", inreview: "#E0A93C",
  revision: "#7C5CD8", onhold: "#E5536E", done: "#3FA37A",
};
const statusColor = (id) => STATUS_COLORS[String(id || "").toLowerCase()] || "#8E8A96";

const W = 760, PAD = 40;

export function buildSubtaskImage(payload = {}) {
  const sub = payload.subtask || {};
  const task = payload.task || {};
  const siblings = Array.isArray(payload.siblings) ? payload.siblings.slice(0, 20) : [];
  const names = payload.statusNames || {};
  const label = (id) => names[id] || String(id || "To Do");

  const title = String(sub.title || "Untitled subtask").slice(0, 120);
  const parent = String(task.title || "").slice(0, 70);
  const note = String(sub.note || "").slice(0, 400);
  const assignees = Array.isArray(payload.assignees) ? payload.assignees.slice(0, 8) : [];
  const doneCount = siblings.filter((s) => s.status === "done").length;

  const subStatus = sub.status || "todo";
  const overdue = !!sub.due && subStatus !== "done" && new Date(sub.due) < new Date(new Date().toDateString());

  const titleLines = Math.max(1, Math.min(3, Math.ceil(title.length / 30)));
  const noteLines = note ? Math.min(8, Math.ceil(note.length / 78)) : 0;

  const HEAD = 96 + titleLines * 40;
  let bodyH = 24;
  bodyH += 34 + 22;                              // status row
  bodyH += 52;                                   // parent task block
  bodyH += 58;                                   // due / parent status / progress
  if (noteLines) bodyH += 26 + noteLines * 22 + 8;
  if (siblings.length) bodyH += 30 + siblings.length * 26 + 6;
  if (assignees.length) bodyH += 30 + 46;
  bodyH += 28;
  const H = HEAD + bodyH;

  const metaBlock = (label_, value, strong) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0" }}>{label_}</div>
      <div style={{ display: "flex", fontSize: 15, fontWeight: 600, color: strong ? "#E5536E" : "#2A2E38", marginTop: 4 }}>{value}</div>
    </div>
  );

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column",
      backgroundColor: "#FFFFFF", fontFamily: "Inter, sans-serif" }}>

      {/* header */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: HEAD,
        paddingLeft: PAD, paddingRight: PAD, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
          SDC SUBTASK
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#ffffff", fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>
          {title}
        </div>
      </div>

      {/* body */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1,
        paddingLeft: PAD, paddingRight: PAD, paddingTop: 24 }}>

        <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", height: 30, paddingLeft: 12, paddingRight: 12,
            borderRadius: 15, backgroundColor: statusColor(subStatus) }}>
            <div style={{ display: "flex", fontSize: 13, fontWeight: 700, color: "#ffffff" }}>{label(subStatus)}</div>
          </div>
          {task.project ? (
            <div style={{ display: "flex", alignItems: "center", height: 30, paddingLeft: 12, paddingRight: 12,
              borderRadius: 15, backgroundColor: "#F1F2F5", marginLeft: 10 }}>
              <div style={{ display: "flex", fontSize: 13, fontWeight: 700, color: "#6E6A76" }}>
                {String(task.project).slice(0, 40)}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginBottom: 18 }}>
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0" }}>PART OF</div>
          <div style={{ display: "flex", fontSize: 17, fontWeight: 700, color: "#1F2430", marginTop: 4 }}>
            {parent || "—"}
          </div>
        </div>

        <div style={{ display: "flex", marginBottom: 18 }}>
          {metaBlock("DUE", sub.due ? fmtDate(sub.due) : "—", overdue)}
          {metaBlock("PARENT STATUS", label(task.status))}
          {metaBlock("PARENT PROGRESS", siblings.length ? `${doneCount}/${siblings.length} done` : "—")}
        </div>

        {noteLines ? (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
            <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0", marginBottom: 6 }}>NOTE</div>
            <div style={{ display: "flex", fontSize: 15, color: "#4A4753", lineHeight: 1.45 }}>{note}</div>
          </div>
        ) : null}

        {siblings.length ? (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
            <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0", marginBottom: 8 }}>
              SUBTASKS · {doneCount}/{siblings.length}
            </div>
            {siblings.map((s, i) => {
              const isDone = s.status === "done";
              const mine = s.id && s.id === sub.id;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16, height: 16,
                    borderRadius: 4, marginRight: 10, backgroundColor: isDone ? "#3FA37A" : "#ffffff",
                    border: isDone ? "1px solid #3FA37A" : "1.5px solid #C9CBD2" }}>
                    {isDone ? (
                      <svg width="11" height="11" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", fontSize: 14, fontWeight: mine ? 700 : 400,
                    color: isDone ? "#AEB1BA" : "#3A3743", textDecoration: isDone ? "line-through" : "none" }}>
                    {String(s.title || "").slice(0, 60)}
                  </div>
                  <div style={{ display: "flex", marginLeft: "auto", fontSize: 12.5, fontWeight: 700,
                    color: statusColor(s.status) }}>{label(s.status)}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        {assignees.length ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0", marginBottom: 8 }}>ASSIGNEES</div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {assignees.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", marginRight: 16, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30,
                    borderRadius: 15, backgroundColor: a.c || "#9A9CA6", marginRight: 8 }}>
                    <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#ffffff" }}>{a.i}</div>
                  </div>
                  <div style={{ display: "flex", fontSize: 14, fontWeight: 600, color: "#3A3743" }}>
                    {String(a.name || a.i || "").slice(0, 24)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return { element, width: W, height: H };
}
