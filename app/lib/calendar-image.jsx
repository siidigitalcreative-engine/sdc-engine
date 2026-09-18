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

// Returns { element, width, height } for next/og ImageResponse. Height grows with the agenda.
export function buildCalendarImage(events = [], opts = {}) {
  const now = new Date();
  const base = opts.month ? new Date(opts.month) : now;
  const month = base.getMonth();
  const year = base.getFullYear();
  const cells = monthMatrix(base);

  const byDay = {};
  for (const e of events) {
    if (!e || !e.start) continue;
    const d = new Date(e.start);
    if (Number.isNaN(d.getTime())) continue;
    (byDay[key(d)] = byDay[key(d)] || []).push(e);
  }

  const monthEvents = events
    .filter((e) => {
      if (!e || !e.start) return false;
      const d = new Date(e.start);
      return !Number.isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const title = base.toLocaleString("en-US", { month: "long", year: "numeric" });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const W = 1000;
  const HEAD = 96, WEEK = 34, CELL = 132;
  const GRID_H = HEAD + WEEK + CELL * 6;
  const AG_ROW = 30;
  const rows = Math.max(monthEvents.length, 1);
  const AG_H = 16 + 32 + rows * AG_ROW + 18;
  const H = GRID_H + AG_H;
  const colW = W / 7;

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: HEAD, paddingLeft: 36, paddingRight: 36, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>SDC CALENDAR</div>
        <div style={{ display: "flex", fontSize: 36, color: "#ffffff", fontWeight: 700, marginTop: 2 }}>{title}</div>
      </div>

      <div style={{ display: "flex", height: WEEK, borderBottom: "1px solid #E9EAEE" }}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={{ display: "flex", width: colW, alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#9A9CA6" }}>{d.toUpperCase()}</div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", height: CELL * 6 }}>
        {[0, 1, 2, 3, 4, 5].map((w) => (
          <div key={w} style={{ display: "flex", height: CELL }}>
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
                      <div key={ei} style={{ display: "flex", alignItems: "center", height: 20, borderRadius: 6, paddingLeft: 5, paddingRight: 5, marginBottom: 3, backgroundColor: "#F3F0EC", opacity: e.done ? 0.55 : 1 }}>
                        <div style={{ display: "flex", width: 7, height: 7, borderRadius: 4, backgroundColor: e.color || "#E5536E", marginRight: 5 }} />
                        <div style={{ display: "flex", fontSize: 11, color: "#2A2833", textDecoration: e.done ? "line-through" : "none" }}>{String(e.title || "").slice(0, 16)}</div>
                      </div>
                    ))}
                    {evs.length > 3 ? (<div style={{ display: "flex", fontSize: 10, color: "#9A9CA6", paddingLeft: 3 }}>+{evs.length - 3} more</div>) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, paddingLeft: 28, paddingRight: 28, paddingTop: 16, paddingBottom: 18, backgroundColor: "#FBFBFC" }}>
        <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: "#2A2833", marginBottom: 10 }}>Schedule this month</div>
        {monthEvents.length === 0 ? (
          <div style={{ display: "flex", fontSize: 13, color: "#9A9CA6" }}>No events scheduled.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {monthEvents.map((e, i) => {
              const d = new Date(e.start);
              const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const timeStr = e.allDay ? "All day" : fmtTime(e.start);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", height: AG_ROW, borderTop: i === 0 ? "none" : "1px solid #EEEFF2", opacity: e.done ? 0.55 : 1 }}>
                  <div style={{ display: "flex", width: 9, height: 9, borderRadius: 5, backgroundColor: e.color || "#E5536E", marginRight: 12 }} />
                  <div style={{ display: "flex", width: 172, fontSize: 13, fontWeight: 600, color: "#4A4753" }}>{dateStr}</div>
                  <div style={{ display: "flex", width: 86, fontSize: 13, color: "#9A9CA6" }}>{timeStr}</div>
                  <div style={{ display: "flex", fontSize: 13, color: "#2A2833", flexGrow: 1 }}>{String(e.title || "").slice(0, 62)}</div>
                  {e.done ? (
                    <div style={{ display: "flex", alignItems: "center", height: 20, paddingLeft: 9, paddingRight: 9, borderRadius: 10, backgroundColor: "#DEF1E7", marginLeft: 8 }}>
                      <div style={{ display: "flex", fontSize: 11, fontWeight: 700, color: "#2F8F63" }}>Done</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return { element, width: W, height: H };
}
