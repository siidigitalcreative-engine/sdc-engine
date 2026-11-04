/* Renders a Time Blocking day as a PNG: either every member side by side or
   one person's day. Satori has no CSS grid, so every row here is flex. */

const C = {
  page: "#17141A", card: "#231E27", col: "#1F1A23", border: "#332C3A",
  text: "#F2EEF5", text2: "#BDB3C7", muted: "#8C8398", faint: "#6A6175",
};

const PAD = 26;
const ROW_H = 46;
const STANDARD_BREAKS = [
  { start: 12 * 60, end: 12 * 60 + 45, label: "Lunch Break" },
  { start: 15 * 60, end: 15 * 60 + 15, label: "Other Break" },
];
// Breaks are visual guides, but minutes inside them are not working time.
// Preserve each block's original start/end time and on-screen height.
const workingMinutes = (start, end) => {
  const from = Number(start), to = Number(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  const breakMinutes = STANDARD_BREAKS.reduce((total, period) =>
    total + Math.max(0, Math.min(to, period.end) - Math.max(from, period.start)), 0);
  return Math.max(0, to - from - breakMinutes);
};
const GUTTER = 74;
const SINGLE_LANE_W = 960;
const MULTI_LANE_W = 410;
const HEAD_H = 72;

const pad = (n) => String(n).padStart(2, "0");
const hhmm = (m) => `${Math.floor(m / 60) % 12 || 12}:${pad(m % 60)} ${m % 1440 < 720 ? "AM" : "PM"}`;
const displayRange = (start, end) => {
  const a = hhmm(start), b = hhmm(end);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
};
const gutter = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
const hours = (m) => ((m / 60) % 1 === 0 ? m / 60 : (m / 60).toFixed(1)) + "h";

// ImageResponse/Satori cannot reliably line-clamp a flex text element.
// Wrap by characters explicitly, and cap the number of lines to the space
// actually available in a timeline card. This prevents text from spilling
// into overlapping neighbors or outside the scheduled time slot.
function boundedLines(value, maxChars, maxLines) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw || maxLines <= 0) return [];
  const chunks = raw.split(" ");
  const lines = [];
  let current = "";
  let clipped = false;
  while (chunks.length && lines.length < maxLines) {
    const word = chunks.shift();
    if (!current && word.length > maxChars) {
      current = word.slice(0, maxChars);
      chunks.unshift(word.slice(maxChars));
    } else if (!current || (current.length + 1 + word.length <= maxChars)) {
      current = current ? `${current} ${word}` : word;
    } else {
      lines.push(current);
      current = "";
      chunks.unshift(word);
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  clipped = chunks.length > 0 || (current && lines[lines.length - 1] !== current);
  if (clipped && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, Math.max(1, maxChars - 1)).trimEnd() + "…";
  }
  return lines;
}

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
  const minutesFor = (id) => blocksFor(id).reduce((t, b) => t + workingMinutes(b.start, b.end), 0);

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
            : hours(blocks.reduce((t, b) => t + workingMinutes(b.start, b.end), 0)) + " across " + members.length + " people"}
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
              {STANDARD_BREAKS.filter(b => b.end > dayStart && b.start < dayEnd).map(b => (
                <div key={b.label} style={{ display: "flex", position: "absolute", left: 0, right: 0,
                  top: (Math.max(b.start, dayStart) - dayStart) / 60 * ROW_H,
                  height: (Math.min(b.end, dayEnd) - Math.max(b.start, dayStart)) / 60 * ROW_H,
                  backgroundColor: "rgba(148, 153, 163, 0.18)",
                  borderTop: "1px solid rgba(163, 168, 176, 0.15)",
                  borderBottom: "1px solid rgba(163, 168, 176, 0.15)" }} />
              ))}
              {blocksFor(m.id).map((b) => {
                const position = positionsByMember.get(m.id)?.get(b.id) || { column: 0, count: 1 };
                const columnWidth = laneWidth / position.count;
                const top = ((b.start - dayStart) / 60) * ROW_H + 2;
                const height = Math.max(10, ((b.end - b.start) / 60) * ROW_H - 4);
                const width = Math.max(24, columnWidth - 8);
                const innerWidth = Math.max(20, width - 16);
                const narrow = innerWidth < 125;
                // Slightly smaller text leaves room for the time range on
                // narrow side-by-side cards without changing their geometry.
                const fontSize = narrow ? 9.5 : 11.5;
                const lineHeight = narrow ? 12 : 15;
                const charsPerLine = Math.max(5, Math.floor(innerWidth / (fontSize * 0.56)));
                // Very short events are only one text line high: do not apply
                // the normal 5px top/bottom padding, which clipped the glyphs.
                const compactCard = height < 35;
                const availableHeight = Math.max(0, height - (compactCard ? 2 : 12));
                const rangeLabel = displayRange(b.start, b.end);
                const fullTimeLabel = `${rangeLabel} · ${hours(workingMinutes(b.start, b.end))}`;
                const timeFontSize = narrow ? 9 : 9.5;
                // Reserve a line for the time first. A compact range fits
                // more reliably than a range with duration in narrow cards.
                const fitsText = text => text.length * timeFontSize * 0.54 <= innerWidth;
                const displayTime = availableHeight >= lineHeight + 11 && fitsText(rangeLabel);
                const timeLabel = displayTime
                  ? (fitsText(fullTimeLabel) ? fullTimeLabel : rangeLabel)
                  : "";
                // Short blocks have one line only: title first, then a compact time range.
                // Preserve at least 56px for the title before showing inline time.
                // A 15-minute card must never sacrifice its title to a time range.
                const inlineTime = compactCard && height >= 16 &&
                  innerWidth >= (rangeLabel.length * timeFontSize * 0.54 + 65);
                const inlineTimeWidth = rangeLabel.length * timeFontSize * 0.54 + 7;
                const showParent = !compactCard && Boolean(String(b.parentTitle || "").trim()) && availableHeight >= 42 && innerWidth >= 60;
                const reserved = (displayTime ? 12 : 0) + (showParent ? 12 : 0);
                const titleLineCount = compactCard ? 1 : Math.min(3, Math.max(1, Math.floor((availableHeight - reserved) / lineHeight)));
                const titleLines = inlineTime
                  ? boundedLines(b.title, Math.max(3, Math.floor((innerWidth - inlineTimeWidth) / (fontSize * 0.56))), 1)
                  : boundedLines(b.title, charsPerLine, titleLineCount);
                const parentLines = showParent ? boundedLines(b.parentTitle, Math.max(5, Math.floor(innerWidth / 5.4)), 1) : [];
                return (
                  <div key={b.id} style={{
                    display: "flex", flexDirection: "column", position: "absolute", top, height,
                    left: position.column * columnWidth + 4, width, overflow: "hidden",
                    borderRadius: 5, padding: compactCard ? "0px 5px" : "5px 7px", backgroundColor: C.card,
                    justifyContent: compactCard ? "center" : "flex-start", boxSizing: "border-box",
                    border: `1px solid ${b.color}`, color: b.color,
                  }}>
                    {parentLines.map((line, index) => (
                      <div key={`parent-${index}`} style={{ display: "flex", fontSize: 9, fontWeight: 700,
                        lineHeight: "12px", height: 12, flexShrink: 0, opacity: 0.8,
                        textTransform: "uppercase", whiteSpace: "nowrap" }}>{line}</div>
                    ))}
                    {inlineTime ? (
                      <div style={{ display: "flex", alignItems: "center", width: "100%", height: 12,
                        overflow: "hidden", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flex: 1, minWidth: 0, fontSize, fontWeight: 700,
                          whiteSpace: "nowrap", overflow: "hidden" }}>{titleLines[0] || ""}</div>
                        <div style={{ display: "flex", flexShrink: 0, fontSize: timeFontSize,
                          opacity: 0.8, whiteSpace: "nowrap", marginLeft: 5 }}>{rangeLabel}</div>
                      </div>
                    ) : titleLines.map((line, index) => (
                      <div key={`title-${index}`} style={{ display: "flex", fontSize, fontWeight: 700,
                        lineHeight: `${compactCard ? 11 : lineHeight}px`, height: compactCard ? 11 : lineHeight, flexShrink: 0,
                        overflow: "hidden", whiteSpace: "nowrap" }}>{line}</div>
                    ))}
                    {displayTime ? (
                      <div style={{ display: "flex", fontSize: timeFontSize, opacity: 0.8,
                        height: 12, lineHeight: "12px", flexShrink: 0, whiteSpace: "nowrap",
                        marginTop: "auto" }}>
                        {timeLabel}
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
