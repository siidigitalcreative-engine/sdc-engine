const DEFAULT_ORDER = ["todo", "inprogress", "inreview", "done"];
const DEFAULT_META = {
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
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDue = (v) => {
  const s = String(v || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
  const d = new Date(s);
  return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

const PAD = 24, GAP = 16, COL_W = 286;   // fixed column width; the image widens with more columns
const HEAD = 112, COL_HEADER = 40, CARD_GAP = 10;

// caps chosen so text never exceeds the estimated line counts (no clipping)
const TITLE_CAP = 90, DESC_CAP = 112, PROJ_CAP = 60;
const titleLinesOf = (t) => Math.max(1, Math.min(3, Math.ceil(Math.min((t.title || "").length, TITLE_CAP) / 33)));
const descLinesOf = (t) => { const n = Math.min((t.desc || "").length, DESC_CAP); return n ? Math.min(3, Math.ceil(n / 38)) : 0; };
const projLinesOf = (t) => Math.max(1, Math.min(2, Math.ceil(Math.min((t.project || "").length, PROJ_CAP) / 44)));
function estimateCardHeight(t) {
  let h = 20 + 22 + 8 + titleLinesOf(t) * 19;      // padding + priority row + gap + title
  const dl = descLinesOf(t);
  if (dl) h += 6 + dl * 16;                          // description
  h += 8 + projLinesOf(t) * 15;                      // project row(s)
  const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
  if (subs.length) h += 6 + Math.min(subs.length, 4) * 15 + (subs.length > 4 ? 13 : 0); // subtasks
  h += 6 + 22;                                       // assignee row (own line)
  return h;
}

export function buildTasksImage(tasks = [], statuses = null) {
  const list = Array.isArray(tasks) ? tasks : [];

  // Column order + meta come from the live status list; fall back to defaults.
  const stdefs = (Array.isArray(statuses) && statuses.length)
    ? statuses.map((s) => ({ id: s.id, name: s.name || s.id, color: s.color || "#8E8A96" }))
    : DEFAULT_ORDER.map((id) => ({ id, ...DEFAULT_META[id] }));
  const firstId = stdefs[0] ? stdefs[0].id : "todo";

  const byStatus = {};
  for (const s of stdefs) byStatus[s.id] = [];
  for (const t of list) (byStatus[t.status] ? byStatus[t.status] : byStatus[firstId]).push(t);

  const total = list.length;
  const done = (byStatus.done || []).length;
  const overdue = list.filter((t) => t.overdue).length;

  const CAP = 100000; // effectively no cap — show every card
  const cols = stdefs.map((s) => {
    const arr = byStatus[s.id] || [];
    return { id: s.id, meta: { name: s.name, color: s.color }, total: arr.length, shown: arr.slice(0, CAP), extra: Math.max(0, arr.length - CAP) };
  });

  const N = Math.max(1, cols.length);
  const W = PAD * 2 + COL_W * N + GAP * (N - 1);

  const colHeight = (c) => {
    let h = COL_HEADER;
    for (const t of c.shown) h += estimateCardHeight(t);
    h += CARD_GAP * Math.max(0, c.shown.length - 1);   // gaps only between cards
    return h;
  };
  const maxCol = Math.max(1, ...cols.map(colHeight));
  const H = HEAD + 22 + maxCol + PAD;   // bottom padding == side padding
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", backgroundColor: "#F7F8FA", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: HEAD, paddingLeft: 36, paddingRight: 36, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>SDC TASKS</div>
        <div style={{ display: "flex", fontSize: 34, color: "#ffffff", fontWeight: 700, marginTop: 1 }}>Task Board</div>
        <div style={{ display: "flex", fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 3 }}>{dateStr} · {total} tasks · {done} done · {overdue} overdue</div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", flexGrow: 1, paddingLeft: PAD, paddingRight: PAD, paddingTop: 22, paddingBottom: PAD }}>
        {cols.map((c, ci) => (
          <div key={c.id} style={{ display: "flex", flexDirection: "column", width: COL_W, marginLeft: ci ? GAP : 0 }}>
            <div style={{ display: "flex", alignItems: "center", height: COL_HEADER }}>
              <div style={{ display: "flex", width: 9, height: 9, borderRadius: 5, backgroundColor: c.meta.color, marginRight: 8 }} />
              <div style={{ display: "flex", fontSize: 14, fontWeight: 700, color: "#1F2430" }}>{c.meta.name}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 8, height: 20, minWidth: 22, paddingLeft: 6, paddingRight: 6, borderRadius: 10, backgroundColor: "#EAEBEE" }}>
                <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: "#6E6A76" }}>{c.total}</div>
              </div>
            </div>

            {c.shown.map((t, ti) => {
              const pri = PRI[t.priority] || PRI.medium;
              const one = (t.assignees || []).length === 1 ? t.assignees[0] : null;
              return (
                <div key={ti} style={{ display: "flex", flexDirection: "column", width: COL_W, height: estimateCardHeight(t), padding: 10, borderRadius: 12, backgroundColor: "#ffffff", border: "1px solid #EAEBEE", marginBottom: ti < c.shown.length - 1 ? CARD_GAP : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", height: 20, paddingLeft: 8, paddingRight: 8, borderRadius: 10, backgroundColor: pri.soft }}>
                      <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: pri.color }}>{pri.name}</div>
                    </div>
                    {t.due ? (
                      <div style={{ fontSize: 11, fontWeight: t.overdue ? 700 : 500, color: t.overdue ? "#E5536E" : "#9A9CA6" }}>{fmtDue(t.due)}</div>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1F2430", lineHeight: 1.3 }}>{String(t.title || "").slice(0, TITLE_CAP)}</div>

                  {t.desc ? (
                    <div style={{ fontSize: 11.5, color: "#8A8F99", lineHeight: 1.3, marginTop: 4 }}>{String(t.desc).slice(0, DESC_CAP)}</div>
                  ) : null}

                  <div style={{ fontSize: 11, color: "#9A9CA6", lineHeight: 1.3, marginTop: 8 }}>{String(t.project || "").slice(0, PROJ_CAP)}</div>

                  {(Array.isArray(t.subtasks) && t.subtasks.length) ? (
                    <div style={{ display: "flex", flexDirection: "column", marginTop: 6 }}>
                      {t.subtasks.slice(0, 4).map((st, si) => (
                        <div key={si} style={{ display: "flex", alignItems: "center", marginTop: si ? 3 : 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 12, height: 12, borderRadius: 3, marginRight: 6, backgroundColor: st.done ? "#3FA37A" : "#ffffff", border: st.done ? "1px solid #3FA37A" : "1.5px solid #C9CBD2" }}>
                            {st.done ? (
                              <svg width="8" height="8" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            ) : null}
                          </div>
                          <div style={{ display: "flex", fontSize: 10.5, color: st.done ? "#B6B9C2" : "#6E7280", textDecoration: st.done ? "line-through" : "none" }}>{String(st.title || "").slice(0, 34)}</div>
                        </div>
                      ))}
                      {t.subtasks.length > 4 ? (
                        <div style={{ display: "flex", fontSize: 10, color: "#9A9CA6", marginTop: 3 }}>+{t.subtasks.length - 4} more</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", alignItems: "center", marginTop: 7 }}>
                    {one ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 9, backgroundColor: one.c || "#9A9CA6", marginRight: 6 }}>
                          <div style={{ display: "flex", fontSize: 9, fontWeight: 700, color: "#ffffff" }}>{one.i}</div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#4A4753" }}>{String(one.name || one.i || "").slice(0, 26)}</div>
                      </>
                    ) : (
                      <div style={{ display: "flex" }}>
                        {(t.assignees || []).slice(0, 4).map((a, ai) => (
                          <div key={ai} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 9, backgroundColor: a.c || "#9A9CA6", marginLeft: ai ? -5 : 0, border: "1.5px solid #ffffff" }}>
                            <div style={{ display: "flex", fontSize: 9, fontWeight: 700, color: "#ffffff" }}>{a.i}</div>
                          </div>
                        ))}
                      </div>
                    )}
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
