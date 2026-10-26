/* The Print Hub overview as a PNG: the same cards the page shows, laid out in
   a grid. Satori has no CSS grid, so rows are flex and each row's height is the
   tallest card in it. */

import { printCardHeight, printCardNode, printCardWidth } from "./print-card-image";

const C = {
  page: "#17141A", border: "#332C3A",
  text: "#F2EEF5", muted: "#8C8398", faint: "#6A6175",
};

const PAD = 26;
const CARD_W = printCardWidth();
const GAP = 16;
const MAX_COLS = 3;
const MAX_CARDS = 12;   // beyond this the image gets unwieldy to read in chat

export function buildPrintOverviewImage(records = [], options = {}) {
  const all = Array.isArray(records) ? records : [];
  const rows = all.slice(0, MAX_CARDS);
  const notes = options.notes && typeof options.notes === "object" ? options.notes : {};
  const title = String(options.title || "Print Hub").slice(0, 70);
  const subtitle = String(options.subtitle || "").slice(0, 90);
  const omitted = all.length - rows.length;

  const cols = Math.max(1, Math.min(MAX_COLS, rows.length));
  const lines = [];
  for (let i = 0; i < rows.length; i += cols) lines.push(rows.slice(i, i + cols));

  const lineHeights = lines.map((line) =>
    Math.max(...line.map((r) => printCardHeight(r, { layoutNote: notes[r.layout] || "" })))
  );

  const W = PAD * 2 + cols * CARD_W + (cols - 1) * GAP;
  const HEAD = 52 + (subtitle ? 20 : 0) + 16;
  const FOOT = omitted ? 30 : 16;
  const H = PAD + HEAD + lineHeights.reduce((t, h) => t + h, 0) + GAP * Math.max(0, lines.length - 1) + FOOT + PAD;

  const element = (
    <div style={{
      width: W, height: H, display: "flex", flexDirection: "column",
      backgroundColor: C.page, padding: PAD, fontFamily: "Inter, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: C.text }}>{title}</div>
          {subtitle ? (
            <div style={{ display: "flex", fontSize: 13.5, color: C.muted, marginTop: 4 }}>{subtitle}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", marginLeft: "auto", fontSize: 13.5, color: C.muted }}>
          {all.length} record{all.length === 1 ? "" : "s"}
        </div>
      </div>

      {lines.map((line, i) => (
        <div key={i} style={{
          display: "flex", height: lineHeights[i],
          marginBottom: i === lines.length - 1 ? 0 : GAP,
        }}>
          {line.map((r, j) => (
            <div key={r.id || j} style={{ display: "flex", width: CARD_W, marginLeft: j ? GAP : 0 }}>
              {printCardNode(r, { layoutNote: notes[r.layout] || "" })}
            </div>
          ))}
          {line.length < cols ? <div style={{ display: "flex", flex: 1 }} /> : null}
        </div>
      ))}

      {omitted > 0 ? (
        <div style={{ display: "flex", marginTop: 14, fontSize: 12.5, color: C.faint }}>
          {omitted} more record{omitted === 1 ? "" : "s"} not shown. Narrow the filters to include them.
        </div>
      ) : null}
    </div>
  );

  return { element, width: W, height: H };
}
