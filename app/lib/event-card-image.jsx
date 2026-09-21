import { formatInAppTimeZone } from "./timezone";

const fmtDate = (iso) => (iso ? formatInAppTimeZone(iso, { weekday: "long", month: "short", day: "numeric", year: "numeric" }, "—") : "—");
const fmtTime = (iso) => (iso ? formatInAppTimeZone(iso, { hour: "numeric", minute: "2-digit" }, "") : "");

const W = 760, PAD = 32;
const TITLE_CAP = 90, DESC_CAP = 240;

// Returns { element, width, height } for next/og ImageResponse — a single shareable event card.
export function buildEventCardImage(event = {}) {
  const title = String(event.title || "Untitled event").slice(0, TITLE_CAP);
  const desc = String(event.desc || "").slice(0, DESC_CAP);
  const calName = String(event.calName || "");
  const calColor = event.calColor || "#E5536E";
  const attendees = Array.isArray(event.attendees) ? event.attendees.slice(0, 8) : [];
  const timeStr = event.allDay ? "All day" : `${fmtTime(event.start)} – ${fmtTime(event.end)}`;

  const titleLines = Math.max(1, Math.ceil(title.length / 34));
  const descLines = desc ? Math.min(4, Math.ceil(desc.length / 62)) : 0;

  let H = 96 + PAD * 2 + 26 + 16 + titleLines * 36;
  if (descLines) H += 10 + descLines * 22;
  H += 20 + 40; // date/time row
  if (attendees.length) H += 24 + 38;

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", backgroundColor: "#F7F8FA", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 96, paddingLeft: PAD, paddingRight: PAD, background: "linear-gradient(135deg, #FFAA62 0%, #E53E30 100%)" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>SDC EVENT</div>
          <div style={{ display: "flex", fontSize: 20, color: "#ffffff", fontWeight: 700, marginTop: 2 }}>{calName || "Calendar"}</div>
        </div>
        {event.done ? (
          <div style={{ display: "flex", alignItems: "center", height: 28, paddingLeft: 12, paddingRight: 12, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.22)" }}>
            <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#ffffff" }}>DONE</div>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: PAD }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", height: 26, paddingLeft: 10, paddingRight: 10, borderRadius: 13, backgroundColor: "#EAEBEE" }}>
            <div style={{ display: "flex", width: 8, height: 8, borderRadius: 4, backgroundColor: calColor, marginRight: 7 }} />
            <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#4A4753" }}>{calName || "Calendar"}</div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#1F2430", lineHeight: 1.25, marginTop: 16 }}>{title}</div>

        {desc ? (
          <div style={{ display: "flex", fontSize: 15, color: "#6E6A76", lineHeight: 1.4, marginTop: 10 }}>{desc}</div>
        ) : null}

        <div style={{ display: "flex", marginTop: 20, gap: 32 }}>
          <MetaCol label="DATE" value={fmtDate(event.start)} />
          <MetaCol label="TIME" value={timeStr} />
        </div>

        {attendees.length ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
            <div style={{ display: "flex", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#9A9CA6", marginBottom: 8 }}>ATTENDEES</div>
            <div style={{ display: "flex" }}>
              {attendees.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", marginRight: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 15, backgroundColor: a.c || "#9A9CA6", marginRight: 8 }}>
                    <div style={{ display: "flex", fontSize: 12, fontWeight: 700, color: "#ffffff" }}>{a.i}</div>
                  </div>
                  <div style={{ display: "flex", fontSize: 13, fontWeight: 600, color: "#4A4753" }}>{a.name}</div>
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

function MetaCol({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#9A9CA6", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", fontSize: 15, fontWeight: 600, color: "#1F2430" }}>{value}</div>
    </div>
  );
}
