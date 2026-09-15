export const IMG_W = 1000;
export const IMG_H = 760;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function monthMatrix(base) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function buildCalendarElement(events = [], opts = {}) {
  const now = new Date();
  const base = opts.month ? new Date(opts.month) : now;
  const month = base.getMonth();
  const cells = monthMatrix(base);

  const byDay = {};
  for (const e of events) {
    if (!e || !e.start) continue;
    const d = new Date(e.start);
    if (Number.isNaN(d.getTime())) continue;
    (byDay[key(d)] = byDay[key(d)] || []).push(e);
  }

  const title = base.toLocaleString("en-US", { month: "long", year: "numeric" });
  const HEAD = 96, WEEK = 36;
  const rowH = (IMG_H - HEAD - WEEK) / 6;
  const colW = IMG_W / 7;

  return (
    <div style={{ width: IMG_W, height: IMG_H, display: "flex", flexDirection: "column", backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: HEAD, paddingLeft: 36, paddingRight: 36, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>SDC CALENDAR</div>
        <div style={{ display: "flex", fontSize: 36, color: "#ffffff", fontWeight: 700, marginTop: 2 }}>{title}</div>
      </div>

      <div style={{ display: "flex", height: WEEK, borderBottom: "1px solid #E9EAEE" }}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={{ display: "flex", width: colW, alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#9A9CA6" }}>{d.toUpperCase()}</div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        {[0, 1, 2, 3, 4, 5].map((w) => (
          <div key={w} style={{ display: "flex", height: rowH }}>
            {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
              const inMonth = d.getMonth() === month;
              const isToday = key(d) === key(now);
              const evs = byDay[key(d)] || [];
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", width: colW, padding: 7, borderRight: "1px solid #EDEEF2", borderBottom: "1px solid #EDEEF2", backgroundColor: inMonth ? "#ffffff" : "#FAFAFC" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 13, fontSize: 14, fontWeight: 600, color: isToday ? "#ffffff" : inMonth ? "#111014" : "#C4C6CE", backgroundColor: isToday ? "#E5536E" : "transparent" }}>{d.getDate()}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 3 }}>
                    {evs.slice(0, 3).map((e, ei) => (
                      <div key={ei} style={{ display: "flex", alignItems: "center", height: 20, borderRadius: 6, paddingLeft: 5, paddingRight: 5, marginBottom: 3, backgroundColor: "#F3F0EC" }}>
                        <div style={{ display: "flex", width: 7, height: 7, borderRadius: 4, backgroundColor: e.color || "#E5536E", marginRight: 5 }} />
                        <div style={{ display: "flex", fontSize: 11, color: "#2A2833" }}>{String(e.title || "").slice(0, 15)}</div>
                      </div>
                    ))}
                    {evs.length > 3 ? (
                      <div style={{ display: "flex", fontSize: 10, color: "#9A9CA6", paddingLeft: 3 }}>+{evs.length - 3} more</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
