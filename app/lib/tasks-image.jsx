const ORDER = ["todo", "inprogress", "inreview", "done"];
const STATUS_META = {
  todo: { name: "To Do", color: "#8E8A96" },
  inprogress: { name: "In Progress", color: "#3E8ED0" },
  inreview: { name: "In Review", color: "#E0A93C" },
  done: { name: "Done", color: "#3FA37A" },
};
const PRI = {
  low: { name: "Low", color: "#3FA37A", soft: "#DEF1E7" },
  medium: { name: "Medium", color: "#E0A93C", soft: "#FAEFD6" },
  high: { name: "High", color: "#E5536E", soft: "#FBE1E7" },
};
const fmtDue = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Returns { element, width, height } for next/og ImageResponse. Height grows with the tallest column.
export function buildTasksImage(tasks = []) {
  const list = Array.isArray(tasks) ? tasks : [];
  const byStatus = { todo: [], inprogress: [], inreview: [], done: [] };
  for (const t of list) (byStatus[t.status] ? byStatus[t.status] : byStatus.todo).push(t);

  const total = list.length;
  const done = byStatus.done.length;
  const overdue = list.filter((t) => t.overdue).length;

  const CAP = 10;
  const cols = ORDER.map((id) => {
    const arr = byStatus[id];
    return { id, meta: STATUS_META[id], total: arr.length, shown: arr.slice(0, CAP), extra: Math.max(0, arr.length - CAP) };
  });
  const maxRows = Math.max(1, ...cols.map((c) => c.shown.length + (c.extra > 0 ? 1 : 0)));

  const W = 1240, PAD = 24, GAP = 16;
  const colW = (W - PAD * 2 - GAP * 3) / 4;
  const HEAD = 112, COL_HEADER = 40, CARD_H = 84, CARD_GAP = 10;
  const boardH = COL_HEADER + maxRows * (CARD_H + CARD_GAP) + 8;
  const H = HEAD + 22 + boardH + 24;
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", backgroundColor: "#F7F8FA", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: HEAD, paddingLeft: 36, paddingRight: 36, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>SDC TASKS</div>
        <div style={{ display: "flex", fontSize: 34, color: "#ffffff", fontWeight: 700, marginTop: 1 }}>Task Board</div>
        <div style={{ display: "flex", fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 3 }}>{dateStr} · {total} tasks · {done} done · {overdue} overdue</div>
      </div>

      <div style={{ display: "flex", flexGrow: 1, paddingLeft: PAD, paddingRight: PAD, paddingTop: 22, paddingBottom: 24 }}>
        {cols.map((c, ci) => (
          <div key={c.id} style={{ display: "flex", flexDirection: "column", width: colW, marginLeft: ci ? GAP : 0 }}>
            <div style={{ display: "flex", alignItems: "center", height: COL_HEADER }}>
              <div style={{ display: "flex", width: 9, height: 9, borderRadius: 5, backgroundColor: c.meta.color, marginRight: 8 }} />
              <div style={{ display: "flex", fontSize: 14, fontWeight: 700, color: "#1F2430" }}>{c.meta.name}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 8, height: 20, minWidth: 22, paddingLeft: 6, paddingRight: 6, borderRadius: 10, backgroundColor: "#EAEBEE" }}>
                <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: "#6E6A76" }}>{c.total}</div>
              </div>
            </div>

            {c.shown.map((t, ti) => {
              const pri = PRI[t.priority] || PRI.medium;
              return (
                <div key={ti} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: colW, height: CARD_H, padding: 10, borderRadius: 12, backgroundColor: "#ffffff", border: "1px solid #EAEBEE", marginBottom: CARD_GAP }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", height: 20, paddingLeft: 8, paddingRight: 8, borderRadius: 10, backgroundColor: pri.soft }}>
                      <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: pri.color }}>{pri.name}</div>
                    </div>
                    {t.due ? (
                      <div style={{ display: "flex", fontSize: 11, fontWeight: t.overdue ? 700 : 500, color: t.overdue ? "#E5536E" : "#9A9CA6" }}>{fmtDue(t.due)}</div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", fontSize: 13, fontWeight: 600, color: "#1F2430" }}>{String(t.title || "").slice(0, 30)}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", fontSize: 11, color: "#9A9CA6" }}>{String(t.project || "").slice(0, 22)}</div>
                    <div style={{ display: "flex" }}>
                      {(t.assignees || []).slice(0, 3).map((a, ai) => (
                        <div key={ai} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 9, backgroundColor: a.c || "#9A9CA6", marginLeft: ai ? -5 : 0, border: "1.5px solid #ffffff" }}>
                          <div style={{ display: "flex", fontSize: 9, fontWeight: 700, color: "#ffffff" }}>{a.i}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {c.extra > 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 28, fontSize: 12, color: "#9A9CA6" }}>+{c.extra} more</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );

  return { element, width: W, height: H };
}
