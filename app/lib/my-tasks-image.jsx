const PRI = {
  low: { name: "Low", color: "#3FA37A", soft: "#DEF1E7" },
  medium: { name: "Medium", color: "#E0A93C", soft: "#FAEFD6" },
  high: { name: "High", color: "#E5536E", soft: "#FBE1E7" },
};
const fmtDue = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return ""; } };

const W = 820, PAD = 40;
const HEAD = 128, ROW_GAP = 12, TITLE_CAP = 92;

const titleLinesOf = (t) => Math.max(1, Math.min(2, Math.ceil(Math.min((t.title || "").length, TITLE_CAP) / 58)));
// container padding (28) + title lines (22 each) + title margin (4) + project row (26) + progress row (8) + buffer (8)
const rowHeight = (t) => 28 + titleLinesOf(t) * 22 + 4 + 26 + 8 + 8;

export function buildMyTasksImage(tasks = [], opts = {}) {
  const list = (Array.isArray(tasks) ? tasks : []).slice(0, 20);
  const memberName = opts.memberName || "My";
  const memberInitials = opts.memberInitials || "";
  const memberColor = opts.memberColor || "#3E8ED0";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  let bodyH = 24;
  if (list.length === 0) bodyH += 60;
  else for (const t of list) bodyH += rowHeight(t) + ROW_GAP;
  bodyH += 20;
  const H = HEAD + bodyH;

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", backgroundColor: "#F7F8FA", fontFamily: "sans-serif" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", height: HEAD, paddingLeft: PAD, paddingRight: PAD, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.22)", marginRight: 16 }}>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#ffffff" }}>{memberInitials}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>SDC · DAILY UPDATE</div>
          <div style={{ display: "flex", fontSize: 28, color: "#ffffff", fontWeight: 700, marginTop: 2 }}>{memberName} — In Progress</div>
          <div style={{ display: "flex", fontSize: 13, color: "rgba(255,255,255,0.92)", marginTop: 2 }}>{dateStr} · {list.length} {list.length === 1 ? "task" : "tasks"}</div>
        </div>
      </div>

      {/* body */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingLeft: PAD, paddingRight: PAD, paddingTop: 24 }}>
        {list.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 56, fontSize: 16, color: "#9A9CA6" }}>No tasks in progress. 🎉</div>
        ) : list.map((t, i) => {
          const pri = PRI[t.priority] || PRI.medium;
          const progress = typeof t.progress === "number" ? Math.max(0, Math.min(100, t.progress)) : null;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", padding: 14, borderRadius: 14, backgroundColor: "#ffffff", border: "1px solid #EAEBEE", marginBottom: ROW_GAP }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", fontSize: 17, fontWeight: 700, color: "#1F2430", lineHeight: 1.25, maxWidth: 560 }}>{String(t.title || "Untitled").slice(0, TITLE_CAP)}</div>
                <div style={{ display: "flex", alignItems: "center", height: 24, paddingLeft: 10, paddingRight: 10, borderRadius: 12, backgroundColor: pri.soft }}>
                  <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: pri.color }}>{pri.name}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", fontSize: 13, color: "#7A7E88" }}>{String(t.project || "—").slice(0, 44)}</div>
                {t.due ? <div style={{ display: "flex", fontSize: 13, color: t.overdue ? "#E5536E" : "#9A9CA6", marginLeft: 12, fontWeight: t.overdue ? 700 : 500 }}>· due {fmtDue(t.due)}</div> : null}
              </div>
              {progress !== null ? (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", width: W - PAD * 2 - 28 - 60, height: 8, borderRadius: 5, backgroundColor: "#ECEDF0" }}>
                    <div style={{ display: "flex", width: (W - PAD * 2 - 28 - 60) * progress / 100, height: 8, borderRadius: 5, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }} />
                  </div>
                  <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#6E6A76", marginLeft: 10 }}>{progress}%</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  return { element, width: W, height: H };
}
