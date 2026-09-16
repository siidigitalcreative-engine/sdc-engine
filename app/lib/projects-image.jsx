const W = 1240, PAD = 24, GAP = 16, COLS = 3;
const colW = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
const HEAD = 112, CARD_H = 190, ROW_GAP = 16;

const statusLabel = (s) => (s === "completed" ? "Completed" : s === "empty" ? "No tasks" : "Active");
const statusStyle = (s) => (s === "completed" ? { bg: "#DEF1E7", fg: "#3FA37A" } : s === "empty" ? { bg: "#EEEFF2", fg: "#9A9CA6" } : { bg: "#E3EEF9", fg: "#3E8ED0" });

export function buildProjectsImage(projects = []) {
  const list = Array.isArray(projects) ? projects : [];
  const total = list.length;
  const active = list.filter((p) => p.status === "active").length;
  const completed = list.filter((p) => p.status === "completed").length;

  const rows = [];
  for (let i = 0; i < list.length; i += COLS) rows.push(list.slice(i, i + COLS));
  const H = HEAD + 22 + Math.max(1, rows.length) * (CARD_H + ROW_GAP) + 8;
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const card = (p, key) => {
    const ss = statusStyle(p.status);
    const initial = String(p.name || "?").trim().charAt(0).toUpperCase();
    return (
      <div key={key} style={{ display: "flex", flexDirection: "column", width: colW, height: CARD_H, padding: 14, borderRadius: 14, backgroundColor: "#ffffff", border: "1px solid #EAEBEE" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 11, backgroundColor: p.color || "#7C6FF0" }}>
            <div style={{ display: "flex", fontSize: 18, fontWeight: 700, color: "#ffffff" }}>{initial}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", height: 22, paddingLeft: 9, paddingRight: 9, borderRadius: 11, backgroundColor: ss.bg }}>
            <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: ss.fg }}>{statusLabel(p.status)}</div>
          </div>
        </div>

        <div style={{ fontSize: 15.5, fontWeight: 700, color: "#1F2430", marginTop: 14, lineHeight: 1.25 }}>{String(p.name || "").slice(0, 38)}</div>
        <div style={{ display: "flex", fontSize: 11.5, color: "#9A9CA6", marginTop: 8 }}>{p.total} task{p.total === 1 ? "" : "s"} · {p.done} done</div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9A9CA6" }}>
            <div style={{ display: "flex" }}>Progress</div>
            <div style={{ display: "flex" }}>{p.progress}%</div>
          </div>
          <div style={{ display: "flex", height: 6, borderRadius: 3, backgroundColor: "#EDEEF2", marginTop: 5 }}>
            <div style={{ display: "flex", width: `${p.progress}%`, height: 6, borderRadius: 3, backgroundColor: "#3FA37A" }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <div style={{ display: "flex" }}>
            {(p.assignees || []).slice(0, 4).map((a, ai) => (
              <div key={ai} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 10, backgroundColor: a.c || "#9A9CA6", marginLeft: ai ? -6 : 0, border: "1.5px solid #ffffff" }}>
                <div style={{ display: "flex", fontSize: 9, fontWeight: 700, color: "#ffffff" }}>{a.i}</div>
              </div>
            ))}
          </div>
          {p.overdue > 0 ? (
            <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: "#E5536E" }}>{p.overdue} overdue</div>
          ) : (
            <div style={{ display: "flex", fontSize: 11, color: "#9A9CA6" }}>{p.done}/{p.total}</div>
          )}
        </div>
      </div>
    );
  };

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", backgroundColor: "#F7F8FA", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: HEAD, paddingLeft: 36, paddingRight: 36, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>SDC PROJECTS</div>
        <div style={{ display: "flex", fontSize: 34, color: "#ffffff", fontWeight: 700, marginTop: 1 }}>Projects</div>
        <div style={{ display: "flex", fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 3 }}>{dateStr} · {total} projects · {active} active · {completed} completed</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingLeft: PAD, paddingRight: PAD, paddingTop: 22, paddingBottom: 8 }}>
        {rows.length === 0 ? (
          <div style={{ display: "flex", fontSize: 14, color: "#9A9CA6" }}>No projects to show.</div>
        ) : rows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", marginBottom: ROW_GAP }}>
            {row.map((p, ci) => (
              <div key={ci} style={{ display: "flex", marginLeft: ci ? GAP : 0 }}>{card(p, ci)}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return { element, width: W, height: H };
}
