const PRI = {
  low: { name: "Low", color: "#3FA37A", soft: "#DEF1E7" },
  medium: { name: "Medium", color: "#E0A93C", soft: "#FAEFD6" },
  high: { name: "High", color: "#E5536E", soft: "#FBE1E7" },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDue = (v) => {
  const s = String(v || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
  const d = new Date(s);
  return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

const W = 820, PAD = 40;
const HEAD = 128, ROW_GAP = 12, TITLE_CAP = 92;

const titleLinesOf = (t) => Math.max(1, Math.min(2, Math.ceil(Math.min((t.title || "").length, TITLE_CAP) / 58)));
const hasProg = (t) => typeof t.progress === "number";
// EXACT fixed card height (card is rendered at exactly this height), so the
// image height is precise and the bottom padding equals the side padding.
const rowHeight = (t) => 28 + (titleLinesOf(t) === 2 ? 50 : 30) + 26 + (hasProg(t) ? 8 : 0);

export function buildMyTasksImage(tasks = [], opts = {}) {
  const list = (Array.isArray(tasks) ? tasks : []).slice(0, 20);
  const memberName = opts.memberName || "My";
  const memberInitials = opts.memberInitials || "";
  const memberColor = opts.memberColor || "#3E8ED0";
  const heading = opts.heading || "Task Update";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  let bodyH = 24; // top gap under the header
  if (list.length === 0) bodyH += 60;
  else { for (const t of list) bodyH += rowHeight(t); bodyH += ROW_GAP * (list.length - 1); }
  bodyH += PAD; // bottom padding == left/right
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
          <div style={{ display: "flex", fontSize: 28, color: "#ffffff", fontWeight: 700, marginTop: 2 }}>{memberName} — {heading}</div>
          <div style={{ display: "flex", fontSize: 13, color: "rgba(255,255,255,0.92)", marginTop: 2 }}>{dateStr} · {list.length} {list.length === 1 ? "task" : "tasks"}</div>
        </div>
      </div>

      {/* body */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingLeft: PAD, paddingRight: PAD, paddingTop: 24, paddingBottom: PAD }}>
        {list.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 56, fontSize: 16, color: "#9A9CA6" }}>No tasks in progress. 🎉</div>
        ) : list.map((t, i) => {
          const st = { name: t.statusName || "—", color: t.statusColor || "#8E8A96" };
          const progress = typeof t.progress === "number" ? Math.max(0, Math.min(100, t.progress)) : null;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", height: rowHeight(t), padding: 14, borderRadius: 14, backgroundColor: "#ffffff", border: "1px solid #EAEBEE", marginBottom: i < list.length - 1 ? ROW_GAP : 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", fontSize: 17, fontWeight: 700, color: "#1F2430", lineHeight: 1.25, maxWidth: 540 }}>{String(t.title || "Untitled").slice(0, TITLE_CAP)}</div>
                <div style={{ display: "flex", alignItems: "center", height: 24, paddingLeft: 10, paddingRight: 10, borderRadius: 12, backgroundColor: st.color }}>
                  <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#ffffff" }}>{st.name}</div>
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
