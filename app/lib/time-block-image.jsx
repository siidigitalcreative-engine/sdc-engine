/* Renders a Time Blocking day as a PNG: either every member side by side or
   one person's day. Satori has no CSS grid, so every row here is flex. */

const C = {
  page: "#17141A", card: "#231E27", col: "#1F1A23", border: "#332C3A",
  text: "#F2EEF5", text2: "#BDB3C7", muted: "#8C8398", faint: "#6A6175",
};

const PAD = 26;
const ROW_H = 46;
const GUTTER = 74;
const SINGLE_LANE_W = 960;
const MULTI_LANE_W = 410;
const HEAD_H = 72;

const pad = (n) => String(n).padStart(2, "0");
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const gutter = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const hours = (m) => ((m / 60) % 1 === 0 ? m / 60 : (m / 60).toFixed(1)) + "h";

export function buildTimeBlockImage(payload = {}) {
  const members = Array.isArray(payload.members) && payload.members.length ? payload.members : [];
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
  const dayStart = Number(payload.day?.start) || 7 * 60;
  const dayEnd = Number(payload.day?.end) || 20 * 60;
  const label = String(payload.label || "").slice(0, 70);

  const rows = [];
  for (let h = dayStart / 60; h < dayEnd / 60; h++) rows.push(h);

  const laneWidth = members.length === 1 ? SINGLE_LANE_W : MULTI_LANE_W;
  const W = PAD * 2 + GUTTER + Math.max(1, members.length) * laneWidth;
  const H = PAD * 2 + 56 + HEAD_H + rows.length * ROW_H + 30;

  const blocksFor = (id) => blocks.filter((b) => b.member === id);
  const minutesFor = (id) => blocksFor(id).reduce((t, b) => t + (b.end - b.start), 0);

  // Match the main Time Blocking timeline: overlapping cards share the
  // available lane width in side-by-side columns rather than covering each other.
  const layoutFor = (id) => {
    const sorted = [...blocksFor(id)].sort((a, b) => a.start - b.start || a.end - b.end);
    const positions = new Map();
    const flush = (group) => {
      if (!group.length) return;
      const ends = [];
      for (const entry of group) {
        let column = ends.findIndex((end) => end <= entry.start);
        if (column === -1) column = ends.length;
        ends[column] = entry.end;
        positions.set(entry.id, column);
      }
      const count = ends.length;
      for (const entry of group) positions.set(entry.id, { column: positions.get(entry.id), count });
    };
    let group = [], groupEnd = -1;
    for (const entry of sorted) {
      if (group.length && entry.start >= groupEnd) {
        flush(group);
        group = [];
        groupEnd = -1;
      }
      group.push(entry);
      groupEnd = Math.max(groupEnd, entry.end);
    }
    flush(group);
    return positions;
  };

  const positionsByMember = new Map(members.map(m => [m.id, layoutFor(m.id)]));

  const element = (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column",
      backgroundColor: C.page, padding: PAD, fontFamily: "Inter, sans-serif" }}>

      <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: C.text }}>Time Blocking</div>
          <div style={{ display: "flex", fontSize: 13.5, color: C.muted, marginTop: 3 }}>{label}</div>
        </div>
        <div style={{ display: "flex", marginLeft: "auto", fontSize: 13.5, color: C.muted }}>
          {members.length === 1
            ? hours(minutesFor(members[0].id)) + " blocked"
            : hours(blocks.reduce((t, b) => t + (b.end - b.start), 0)) + " across " + members.length + " people"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", borderRadius: 14,
        border: `1px solid ${C.border}`, backgroundColor: C.card, overflow: "hidden" }}>

        {/* member headers */}
        <div style={{ display: "flex", height: HEAD_H, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", width: GUTTER, flexShrink: 0, borderRight: `1px solid ${C.border}`,
            alignItems: "flex-end", justifyContent: "flex-end", padding: "0 10px 8px 0",
            fontSize: 10.5, color: C.muted }}>GMT+8</div>
          {members.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", width: laneWidth, borderRight: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                height: 30, width: 30, borderRadius: 999, backgroundColor: m.color || "#8E8A96",
                color: "#fff", fontSize: 11, fontWeight: 700, marginBottom: 5 }}>{m.initials}</div>
              <div style={{ display: "flex", fontSize: 13, fontWeight: 600, color: C.text }}>{m.name}</div>
              <div style={{ display: "flex", fontSize: 11, color: C.muted, marginTop: 1 }}>
                {minutesFor(m.id) ? hours(minutesFor(m.id)) + " blocked" : "free"}
              </div>
            </div>
          ))}
        </div>

        {/* hour rows */}
        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          {rows.map((h) => (
            <div key={h} style={{ display: "flex", height: ROW_H, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", width: GUTTER, flexShrink: 0, justifyContent: "flex-end",
                padding: "5px 10px 0 0", borderRight: `1px solid ${C.border}`,
                fontSize: 11, color: C.muted }}>{gutter(h)}</div>
              {members.map((m, i) => (
                <div key={m.id} style={{ display: "flex", width: laneWidth, borderRight: `1px solid ${C.border}`,
                  backgroundColor: i % 2 ? "rgba(127,127,127,0.03)" : "transparent" }} />
              ))}
            </div>
          ))}

          {/* the blocks, one absolute lane per member */}
          {members.map((m, i) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", position: "absolute",
              top: 0, bottom: 0, left: GUTTER + i * laneWidth, width: laneWidth }}>
              {blocksFor(m.id).map((b) => {
                const position = positionsByMember.get(m.id)?.get(b.id) || { column: 0, count: 1 };
                const columnWidth = laneWidth / position.count;
                const top = ((b.start - dayStart) / 60) * ROW_H + 2;
                const tight = b.end - b.start < 45;
                // Never grow outside the scheduled time: doing so hides later tasks.
                const height = Math.max(18, ((b.end - b.start) / 60) * ROW_H - 4);
                return (
                  <div key={b.id} style={{
                    display: "flex", flexDirection: "column", position: "absolute", top, height,
                    left: position.column * columnWidth + 4,
                    width: Math.max(24, columnWidth - 8), overflow: "hidden",
                    borderRadius: 10, padding: "6px 10px", backgroundColor: C.card,
                    border: `1px solid ${b.color}`, color: b.color,
                  }}>
                    {b.parentTitle ? (
                      <div style={{ display: "flex", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                        textTransform: "uppercase", opacity: 0.75, wordBreak: "break-word" }}>{b.parentTitle}</div>
                    ) : null}
                    <div style={{ display: "flex", fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, wordBreak: "break-word" }}>{b.title}</div>
                    {!tight ? (
                      <div style={{ display: "flex", fontSize: 10.5, opacity: 0.8, marginTop: 1 }}>
                        {hhmm(b.start)} to {hhmm(b.end)} · {hours(b.end - b.start)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", marginTop: 12, fontSize: 11.5, color: C.faint }}>
        SDC Engine · Time Blocking
      </div>
    </div>
  );

  return { element, width: W, height: H };
}
