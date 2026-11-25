/* Renders a locker as a PNG: every card where it sits on the board.

   Satori has no CSS grid and no object-fit on a container, so each card is an
   absolutely positioned flex box and each picture is sized to its own card. */

const C = {
  page: "#17141A", card: "#231E27", col: "#1F1A23", border: "#332C3A",
  text: "#F2EEF5", text2: "#BDB3C7", muted: "#8C8398", faint: "#6A6175",
  note: "#FBE9C6", noteEdge: "#E8D3A6", noteText: "#4A3A16",
};

const PAD = 34;        // the same gap on all four sides
const NAME_ROW = 28;
const MAX_WIDTH = 2000;          // the PNG's own ceiling, before scaling down

/* One line only, cut to what the card is actually wide enough to show.
   Satori has no text-overflow, so the budget is worked out from the card's
   width and the type size, and the tail is dropped with an ellipsis. */
function fitName(name, cardWidth, fontSize) {
  const text = String(name || "");
  const room = Math.max(0, cardWidth - 20);
  const budget = Math.floor(room / (fontSize * 0.54));
  if (text.length <= budget) return text;
  return budget > 1 ? `${text.slice(0, budget - 1)}…` : "";
}

// A card is drawn at its file's proportions, the same rule the board uses.
const drawnHeight = (item) => {
  const ratio = item.kind === "note" ? 0 : Number(item.ratio) || 0;
  return ratio ? Math.round(item.w / ratio) + NAME_ROW : item.h;
};

export function buildLockerImage(payload = {}) {
  const locker = payload.locker || {};
  const items = (Array.isArray(locker.items) ? locker.items : []).filter((i) => i && i.w && i.h);

  // the board's own extent, so the PNG is cropped to the work and not the canvas
  const spanX = items.reduce((w, i) => Math.max(w, i.x + i.w), 0);
  const spanY = items.reduce((h, i) => Math.max(h, i.y + drawnHeight(i)), 0);

  const originX = items.length ? Math.min(...items.map((i) => i.x)) : 0;
  const originY = items.length ? Math.min(...items.map((i) => i.y)) : 0;

  const boardW = Math.max(220, spanX - originX);
  const boardH = Math.max(120, spanY - originY);

  const scale = Math.min(1, (MAX_WIDTH - PAD * 2) / boardW);

  /* The picture hugs the board, so the gap on the right matches the left.
     The only reason it widens is a heading that would not otherwise fit. */
  const headingW = Math.max(
    String(locker.name || "Locker").length * 14,
    String(locker.brand || "").length * 9,
    200
  );
  const contentW = Math.max(Math.round(boardW * scale), Math.min(MAX_WIDTH - PAD * 2, headingW));

  const width = contentW + PAD * 2;

  /* The heading's real height, so the gap under it matches the one above it
     and the board is never squeezed. Lines are counted at their own size. */
  const headH = (locker.brand ? 17 + 4 : 0) + 34 + 4 + 17;
  const height = Math.round(boardH * scale) + PAD * 3 + headH;

  const element = (
    <div style={{
      width, height, display: "flex", flexDirection: "column",
      background: C.page, color: C.text, fontFamily: "Inter, InterExt",
    }}>
      {/* the heading */}
      <div style={{ display: "flex", flexDirection: "column", padding: `${PAD}px ${PAD}px 0` }}>
        {locker.brand ? (
          <div style={{ display: "flex", fontSize: 14, fontWeight: 700, letterSpacing: 1.6, color: C.muted, textTransform: "uppercase" }}>
            {locker.brand}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, marginTop: 4 }}>{locker.name || "Locker"}</div>
        <div style={{ display: "flex", fontSize: 14, color: C.faint, marginTop: 4 }}>
          {items.filter((i) => i.kind !== "note").length} file
          {items.filter((i) => i.kind !== "note").length === 1 ? "" : "s"}
          {payload.stamp ? ` · ${payload.stamp}` : ""}
        </div>
      </div>

      {/* the board */}
      <div style={{
        display: "flex", position: "relative",
        margin: `${PAD}px ${PAD}px ${PAD}px`,
        width: contentW,
        height: Math.round(boardH * scale),
      }}>
        {items.map((item) => {
          const nameSize = Math.max(9, Math.round(11.5 * scale));
          const h = drawnHeight(item);
          const left = Math.round((item.x - originX) * scale);
          const top = Math.round((item.y - originY) * scale);
          const w = Math.round(item.w * scale);
          const cardH = Math.round(h * scale);
          const mediaH = cardH - Math.round(NAME_ROW * scale);

          if (item.kind === "note") {
            return (
              <div key={item.id} style={{
                position: "absolute", left, top, width: w, height: cardH,
                display: "flex", background: C.note, border: `1px solid ${C.noteEdge}`,
                borderRadius: Math.round(12 * scale), padding: Math.round(11 * scale),
                color: C.noteText, fontSize: Math.max(11, Math.round(13 * scale)), lineHeight: 1.45,
                whiteSpace: "pre-wrap",
              }}>
                {String(item.text || "").slice(0, 600)}
              </div>
            );
          }

          return (
            <div key={item.id} style={{
              position: "absolute", left, top, width: w, height: cardH,
              display: "flex", flexDirection: "column",
              background: C.card, border: `1px solid ${C.border}`, borderRadius: Math.round(12 * scale),
              overflow: "hidden",
            }}>
              {item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" width={w} height={mediaH}
                  style={{ width: w, height: mediaH, objectFit: "cover" }} />
              ) : (
                <div style={{
                  display: "flex", width: w, height: mediaH, background: C.col,
                  alignItems: "center", justifyContent: "center", color: C.faint, fontSize: 14,
                }}>{item.kind}</div>
              )}
              <div style={{
                display: "flex", width: w, height: Math.round(NAME_ROW * scale),
                alignItems: "center", padding: `0 ${Math.round(9 * scale)}px`,
                borderTop: `1px solid ${C.border}`, color: C.text2,
                fontSize: nameSize, whiteSpace: "nowrap", overflow: "hidden",
              }}>
                {fitName(item.name, w, nameSize)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return { element, width, height };
}
