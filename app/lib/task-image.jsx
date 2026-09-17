const PRI = {
  low: { name: "Low", color: "#3FA37A", soft: "#DEF1E7" },
  medium: { name: "Medium", color: "#E0A93C", soft: "#FAEFD6" },
  high: { name: "High", color: "#E5536E", soft: "#FBE1E7" },
};
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return "—"; } };

const W = 760, PAD = 40;
const TITLE_CAP = 120, DESC_CAP = 800;

export function buildTaskImage(task = {}) {
  const t = task || {};
  const pri = PRI[t.priority] || PRI.medium;
  const statusName = t.statusName || "To Do";
  const statusColor = t.statusColor || "#8E8A96";
  const title = String(t.title || "Untitled task").slice(0, TITLE_CAP);
  const desc = String(t.desc || "").replace(/\r\n/g, "\n").slice(0, DESC_CAP);
  const descLinesArr = desc ? desc.split("\n") : [];
  const CHARS_PER_LINE = 78; // approx chars that fit on one line at this width/size
  let descVisualLines = 0;
  for (const ln of descLinesArr) descVisualLines += Math.max(1, Math.ceil((ln.length || 1) / CHARS_PER_LINE));
  descVisualLines = Math.min(descVisualLines, 20);
  const tags = Array.isArray(t.tags) ? t.tags.slice(0, 8) : [];
  const assignees = Array.isArray(t.assignees) ? t.assignees.slice(0, 8) : [];
  const progress = typeof t.progress === "number" ? Math.max(0, Math.min(100, t.progress)) : null;
  const overdue = !!t.due && t.status !== "done" && new Date(t.due) < new Date(new Date().toDateString());

  const titleLines = Math.max(1, Math.min(3, Math.ceil(title.length / 30)));

  const HEAD = 96 + titleLines * 40;
  let bodyH = 24;                       // top pad
  bodyH += 34 + 22;                     // status/priority row + gap
  bodyH += 52;                          // project + meta grid label rows
  bodyH += 58;                          // start / due / time blocks
  if (progress !== null) bodyH += 50;   // progress bar
  if (descLinesArr.length) bodyH += 26 + descVisualLines * 22 + 8;
  if (tags.length) bodyH += 30 + 32;
  if (assignees.length) bodyH += 30 + 46;
  bodyH += 28;                          // bottom pad
  const H = HEAD + bodyH;

  const metaBlock = (label, value, strong) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 15, fontWeight: 600, color: strong ? "#E5536E" : "#2A2E38", marginTop: 4 }}>{value}</div>
    </div>
  );

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", backgroundColor: "#FFFFFF", fontFamily: "sans-serif" }}>
      {/* header */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: HEAD, paddingLeft: PAD, paddingRight: PAD, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>SDC TASK</div>
        <div style={{ display: "flex", fontSize: 32, color: "#ffffff", fontWeight: 700, marginTop: 6, lineHeight: 1.2 }}>{title}</div>
      </div>

      {/* body */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingLeft: PAD, paddingRight: PAD, paddingTop: 24 }}>
        {/* status + priority */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", height: 30, paddingLeft: 12, paddingRight: 12, borderRadius: 15, backgroundColor: statusColor }}>
            <div style={{ display: "flex", fontSize: 13, fontWeight: 700, color: "#ffffff" }}>{statusName}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", height: 30, paddingLeft: 12, paddingRight: 12, borderRadius: 15, backgroundColor: pri.soft, marginLeft: 10 }}>
            <div style={{ display: "flex", fontSize: 13, fontWeight: 700, color: pri.color }}>{pri.name} priority</div>
          </div>
        </div>

        {/* project */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 18 }}>
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0" }}>PROJECT</div>
          <div style={{ display: "flex", fontSize: 17, fontWeight: 700, color: "#1F2430", marginTop: 4 }}>{String(t.project || "—").slice(0, 60)}</div>
        </div>

        {/* start / due / time */}
        <div style={{ display: "flex", marginBottom: 18 }}>
          {metaBlock("START", t.start ? fmtDate(t.start) : "—")}
          {metaBlock("DUE", t.due ? fmtDate(t.due) : "—", overdue)}
          {metaBlock("TIME", t.time || "—")}
        </div>

        {/* progress */}
        {progress !== null ? (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0" }}>PROGRESS</div>
              <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#6E6A76" }}>{progress}%</div>
            </div>
            <div style={{ display: "flex", width: W - PAD * 2, height: 10, borderRadius: 6, backgroundColor: "#ECEDF0" }}>
              <div style={{ display: "flex", width: (W - PAD * 2) * progress / 100, height: 10, borderRadius: 6, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }} />
            </div>
          </div>
        ) : null}

        {/* description */}
        {descLinesArr.length ? (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 20 }}>
            <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0", marginBottom: 6 }}>NOTES</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {descLinesArr.map((ln, i) => (
                <div key={i} style={{ display: "flex", fontSize: 15, color: "#4A4753", lineHeight: 1.45 }}>{ln === "" ? "\u00A0" : ln}</div>
              ))}
            </div>
          </div>
        ) : null}

        {/* tags */}
        {tags.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 20 }}>
            {tags.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", height: 26, paddingLeft: 10, paddingRight: 10, borderRadius: 8, backgroundColor: "#F1F2F5", marginRight: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", fontSize: 12, fontWeight: 600, color: "#6E6A76" }}>#{String(g).slice(0, 20)}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* assignees */}
        {assignees.length ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "#A2A6B0", marginBottom: 8 }}>ASSIGNEES</div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {assignees.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", marginRight: 16, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 15, backgroundColor: a.c || "#9A9CA6", marginRight: 8 }}>
                    <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#ffffff" }}>{a.i}</div>
                  </div>
                  <div style={{ display: "flex", fontSize: 14, fontWeight: 600, color: "#3A3743" }}>{String(a.name || a.i || "").slice(0, 24)}</div>
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
