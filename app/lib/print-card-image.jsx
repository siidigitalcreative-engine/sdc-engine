/* Renders a Print Hub record card as a PNG that matches the on-screen card.

   Every number below is the app's own CSS value, multiplied by SCALE. Keeping
   them 1:1 with the page is what makes the export look like the card rather
   than a lookalike, and the single scale factor keeps the PNG crisp.

   Satori (next/og) has no CSS grid, so every row here is flex, and any element
   with more than one child carries an explicit display:flex. */

const C = {
  page: "#17141A", card: "#231E27", col: "#1F1A23", dim: "#2A2430",
  border: "#332C3A", text: "#F2EEF5", text2: "#BDB3C7", muted: "#8C8398", faint: "#6A6175",
};
const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";

const MODE_META = { Cylinder: { c: "#F0784B", s: "#FCE7DD" }, Flat: { c: "#3E8ED0", s: "#E3EEF9" } };
const INK = {
  Primer: { c: "#E0A93C", s: "#FAEFD6" }, White: { c: "#6A7382", s: "#E9ECF1" },
  CMYK: { c: "#7C5CD8", s: "#EBE4FA" }, Varnish: { c: "#3E8ED0", s: "#E3EEF9" },
};
const COLORS = {
  Black: { c: "#2B2630", s: "#E6E3EA", n: 1 },
  White: { c: "#6A7382", s: "#E9ECF1", n: 1 },
  CMYK: { c: "#7C5CD8", s: "#EBE4FA", n: 4 },
};
const STATUS = {
  "Not started": "#8E8A96", "Sample done": "#E0A93C", Approved: "#3FA37A",
  Printed: "#2E9B8F", "In production": "#3E8ED0", "On hold": "#E5536E",
};
const SWATCHES = ["#7C6FF0", "#3E8ED0", "#3FA37A", "#E0A93C", "#F0784B", "#E5536E", "#2E9B8F", "#8E8A96"];
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const swatch = (n) => SWATCHES[hash(String(n || "x")) % SWATCHES.length];
const statusColor = (n) => STATUS[n] || swatch(n);
const methodColor = (n) => (n === "Direct Print" ? "#7C5CD8" : n === "Sticker Print" ? "#3FA37A" : swatch(n));
const tint = (hex) => `${hex}22`;

/* ---- the app's measurements, in CSS pixels ---- */
const SCALE = 1.7;
const px = (n) => Math.round(n * SCALE);

const BASE_CARD_W = 400;         // a card on the page, roughly a third of the board
const CARD_PAD = 16;             // .ps-rec padding
const BLOCK_GAP = 13;            // .ps-rec gap
const PAGE_PAD = 20;

const M = {
  modeH: 24, modeGap: 8,
  brand: 10, brandLH: 12, brandGap: 3,
  title: 15, titleLH: 20,
  sub: 12, subLH: 16, subGap: 4,
  stripH: 44,
  shot: 150,
  tilePadY: 9, tileK: 10, tileKLH: 12, tileVGap: 4, tileV: 16, tileVLH: 18, tileUGap: 2, tileU: 11.5, tileULH: 13,
  cellPadY: 11, cellPadX: 13, k: 10, kLH: 12, vGap: 3, v: 13.5, vLH: 18, unit: 11.5,
  groupHeadT: 9, groupHeadB: 7, pairPadT: 8, pairPadB: 10, sk: 10,
  chip: 24, chipGap: 6,
  oneRowT: 9, oneRowB: 10, noteGap: 1, note: 11.5, noteLH: 15,
  remarkPadY: 10, remark: 12.5, remarkLH: 18,
};

const minsFor = (r) => (r.rec ? r[r.rec] : null);
const perHour = (r) => { const m = minsFor(r); return m ? Math.round((60 / m) * 10) / 10 : null; };
const per100 = (r) => { const p = perHour(r); return p ? Math.round((100 / p) * 10) / 10 : null; };
const colorCount = (r) => (r.colors || []).reduce((t, c) => t + (COLORS[c]?.n || 1), 0);

const titleLinesFor = (text, baseW) =>
  Math.max(1, Math.min(3, Math.ceil(text.length / Math.max(14, Math.floor((baseW - CARD_PAD * 2) / 7.6)))));
const remarkLinesFor = (text, baseW) =>
  (text ? Math.min(4, Math.ceil(text.length / Math.max(20, Math.floor((baseW - CARD_PAD * 2 - 24) / 6.1)))) : 0);

/* Block heights in base pixels, so a grid can be laid out before drawing. */
const rowH = {
  specs1: M.cellPadY * 2 + M.kLH + M.vGap + M.vLH,
  pair: M.groupHeadT + M.kLH + M.groupHeadB + 1 + M.pairPadT + M.kLH + 2 + M.vLH + M.pairPadB,
  one: (withNote) => M.oneRowT + M.kLH + M.vGap + M.vLH + (withNote ? M.noteGap + M.noteLH : 0) + M.oneRowB,
  ink: M.oneRowT + M.kLH + M.chipGap + M.chip + M.oneRowB,
  tile: M.tilePadY * 2 + M.tileKLH + M.tileVGap + M.tileVLH + M.tileUGap + M.tileULH,
  out: M.tilePadY * 2 + M.tileKLH + M.tileVGap + M.tileVLH,
};

export function printCardHeight(record = {}, options = {}) {
  const r = record || {};
  const baseW = options.baseWidth || BASE_CARD_W;
  const note = String(options.layoutNote || "");
  const title = String(r.name || r.sku || "Untitled product").slice(0, 90);
  const remarks = String(r.remarks || "").slice(0, 300);
  const hasImg = typeof r.img === "string" && /^https?:\/\//.test(r.img);

  let h = CARD_PAD * 2;
  h += M.modeH + M.modeGap + M.brandLH + M.brandGap + titleLinesFor(title, baseW) * M.titleLH + M.subGap + M.subLH;
  h += BLOCK_GAP + M.stripH;
  if (hasImg) h += BLOCK_GAP + M.shot;
  h += BLOCK_GAP + rowH.tile;
  h += BLOCK_GAP + rowH.out;
  h += BLOCK_GAP + rowH.specs1 + 1 + Math.max(rowH.pair, rowH.specs1) + 1 + rowH.one(!!note) + 1 + rowH.ink;
  const rl = remarkLinesFor(remarks, baseW);
  if (rl) h += BLOCK_GAP + M.remarkPadY * 2 + rl * M.remarkLH;
  return px(h) + 2;
}

/* One card on its own page. */
export function buildPrintCardImage(record = {}, options = {}) {
  const width = px(BASE_CARD_W) + px(PAGE_PAD) * 2;
  const height = printCardHeight(record, options) + px(PAGE_PAD) * 2;
  return {
    element: (
      <div style={{ width, height, display: "flex", backgroundColor: C.page,
        padding: px(PAGE_PAD), fontFamily: "sans-serif" }}>
        {printCardNode(record, options)}
      </div>
    ),
    width,
    height,
  };
}

export const printCardWidth = () => px(BASE_CARD_W);

export function printCardNode(record = {}, options = {}) {
  const r = record || {};
  const note = String(options.layoutNote || "");
  const md = MODE_META[r.mode] || MODE_META.Cylinder;
  const sc = statusColor(r.status);
  const mc = methodColor(r.method);
  const bc = swatch(r.brand);
  const ph = perHour(r);
  const h100 = per100(r);
  const title = String(r.name || r.sku || "Untitled product").slice(0, 90);
  const remarks = String(r.remarks || "").slice(0, 300);
  const hasImg = typeof r.img === "string" && /^https?:\/\//.test(r.img);
  const remarkLines = remarkLinesFor(remarks, BASE_CARD_W);

  const label = (t, color = C.muted) => (
    <div style={{ display: "flex", fontSize: px(M.k), lineHeight: 1.2, letterSpacing: px(0.7),
      fontWeight: 600, color, textTransform: "uppercase" }}>{t}</div>
  );

  const chip = (text, fg, bg, key) => (
    <div key={key} style={{
      display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center",
      height: px(M.chip), paddingLeft: px(11), paddingRight: px(11), paddingBottom: px(1),
      borderRadius: 999, backgroundColor: bg, color: fg,
      fontSize: px(11.5), fontWeight: 600, lineHeight: 1, flexShrink: 0,
    }}>{text}</div>
  );

  // gap rather than a margin, and neither part allowed to shrink, so a long
  // number can never run under its unit in a narrow cell
  const value = (v, unit) => (
    <div style={{ display: "flex", alignItems: "flex-end", marginTop: px(M.vGap), gap: px(3) }}>
      <div style={{ display: "flex", flexShrink: 0, fontSize: px(M.v), lineHeight: 1.25, fontWeight: 600,
        color: v == null ? C.faint : C.text }}>
        {v == null ? "Not set" : String(v)}
      </div>
      {v != null && unit ? (
        <div style={{ display: "flex", flexShrink: 0, fontSize: px(M.unit), color: C.muted,
          marginBottom: px(1.5) }}>{unit}</div>
      ) : null}
    </div>
  );

  const cell = (k, v, unit, flex) => (
    <div style={{ display: "flex", flexDirection: "column", flex,
      paddingLeft: px(M.cellPadX), paddingRight: px(M.cellPadX),
      paddingTop: px(M.cellPadY), paddingBottom: px(M.cellPadY) }}>
      {label(k)}{value(v, unit)}
    </div>
  );

  const tile = (key, name) => {
    const on = r.rec === key;
    const v = r[key];
    return (
      <div key={key} style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        flex: 1, height: px(rowH.tile), borderRadius: px(12),
        ...(on ? { backgroundImage: ACCENT } : { backgroundColor: C.col, border: `1px solid ${C.border}` }),
        opacity: v == null && !on ? 0.45 : 1,
      }}>
        <div style={{ display: "flex", fontSize: px(M.tileK), lineHeight: 1.2, letterSpacing: px(0.7),
          fontWeight: 600, color: on ? "#FFFFFF" : C.muted }}>{name.toUpperCase()}</div>
        <div style={{ display: "flex", fontSize: px(M.tileV), lineHeight: 1.1, fontWeight: 600,
          marginTop: px(M.tileVGap), color: on ? "#FFFFFF" : C.text }}>{v == null ? "—" : String(v)}</div>
        <div style={{ display: "flex", fontSize: px(M.tileU), lineHeight: 1.1, marginTop: px(M.tileUGap),
          color: on ? "#FFFFFF" : C.muted }}>min / pc</div>
      </div>
    );
  };

  const out = (name, v) => (
    <div key={name} style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      flex: 1, height: px(rowH.out), borderRadius: px(12),
      backgroundColor: C.col, border: `1px solid ${C.border}`,
    }}>
      <div style={{ display: "flex", fontSize: px(M.tileK), lineHeight: 1.2, letterSpacing: px(0.7),
        fontWeight: 600, color: C.muted, textTransform: "uppercase" }}>{name}</div>
      <div style={{ display: "flex", fontSize: px(M.tileV), lineHeight: 1.1, fontWeight: 600,
        marginTop: px(M.tileVGap), color: C.text }}>{v}</div>
    </div>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column", width: px(BASE_CARD_W),
      backgroundColor: C.card, borderRadius: px(18), border: `1px solid ${C.border}`,
      padding: px(CARD_PAD),
    }}>
      {/* header */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start",
          height: px(M.modeH), paddingLeft: px(11), paddingRight: px(11), paddingBottom: px(1),
          borderRadius: 999, backgroundColor: md.s, color: md.c, marginBottom: px(M.modeGap),
          fontSize: px(11.5), fontWeight: 700, letterSpacing: px(0.6), lineHeight: 1,
        }}>{String(r.mode || "Cylinder").toUpperCase()}</div>

        <div style={{ display: "flex", fontSize: px(M.brand), lineHeight: 1.2, letterSpacing: px(0.7),
          fontWeight: 700, color: bc, marginBottom: px(M.brandGap) }}>
          {String(r.brand || "").toUpperCase()}
        </div>
        <div style={{ display: "flex", fontSize: px(M.title), lineHeight: 1.3, fontWeight: 600, color: C.text }}>
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: px(M.subGap), height: px(M.subLH) }}>
          {r.name && r.sku ? (
            <div style={{ display: "flex", fontSize: px(11.5), color: C.text2 }}>{r.sku}</div>
          ) : null}
          {r.variant ? (
            <div style={{ display: "flex", fontSize: px(M.sub), color: C.muted,
              marginLeft: r.name && r.sku ? px(7) : 0 }}>{r.variant}</div>
          ) : null}
        </div>
      </div>

      {/* design strip */}
      <div style={{
        display: "flex", alignItems: "center", height: px(M.stripH), marginTop: px(BLOCK_GAP),
        borderRadius: px(12), backgroundColor: C.col, paddingLeft: px(12), paddingRight: px(12),
      }}>
        <div style={{ display: "flex", fontSize: px(13.5), fontWeight: 600, color: C.text }}>
          {r.design || "Untitled design"}
        </div>
        <div style={{ display: "flex", height: px(5), width: px(5), borderRadius: 999,
          backgroundColor: C.faint, marginLeft: px(10), marginRight: px(10) }} />
        {chip(r.method || "", mc, tint(mc))}
        <div style={{ display: "flex", marginLeft: "auto" }}>{chip(r.status || "", sc, tint(sc))}</div>
      </div>

      {/* product image */}
      {hasImg ? (
        <div style={{ display: "flex", marginTop: px(BLOCK_GAP) }}>
          <img src={r.img} width={px(M.shot)} height={px(M.shot)}
            style={{ borderRadius: px(12), objectFit: "cover" }} />
        </div>
      ) : null}

      {/* speed tiles */}
      <div style={{ display: "flex", marginTop: px(BLOCK_GAP), gap: px(7) }}>
        {tile("slow", "Slow")}{tile("med", "Medium")}{tile("fast", "Fast")}
      </div>

      {/* derived output */}
      <div style={{ display: "flex", marginTop: px(BLOCK_GAP), gap: px(7) }}>
        {out("Per hour", ph == null ? "—" : `${ph} pcs`)}
        {out("Per 100 pcs", h100 == null ? "—" : `${h100} hrs`)}
      </div>

      {/* spec grid */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: px(BLOCK_GAP),
        borderRadius: px(12), border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", height: px(rowH.specs1) }}>
          {cell("Height", r.h, "mm", 1)}{cell("Width", r.w, "mm", 1)}
          {cell("Base", r.base, "mm", 1)}{cell("Capacity", r.ml, "ml", 1)}
        </div>

        <div style={{ display: "flex", height: px(Math.max(rowH.pair, rowH.specs1)),
          borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRight: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "center",
              paddingTop: px(M.groupHeadT), paddingBottom: px(M.groupHeadB),
              borderBottom: `1px solid ${C.border}` }}>{label("Print area")}</div>
            <div style={{ display: "flex", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center",
                paddingLeft: px(M.cellPadX), paddingRight: px(M.cellPadX) }}>
                <div style={{ display: "flex", fontSize: px(M.sk), lineHeight: 1.2, letterSpacing: px(0.7),
                  fontWeight: 600, color: C.faint, textTransform: "uppercase" }}>Width</div>
                {value(r.paw, "mm")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center",
                paddingLeft: px(M.cellPadX), paddingRight: px(M.cellPadX),
                borderLeft: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", fontSize: px(M.sk), lineHeight: 1.2, letterSpacing: px(0.7),
                  fontWeight: 600, color: C.faint, textTransform: "uppercase" }}>Height</div>
                {value(r.pah, "mm")}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center",
            paddingLeft: px(M.cellPadX), paddingRight: px(M.cellPadX) }}>
            {label("Colors")}
            <div style={{ display: "flex", alignItems: "center", marginTop: px(M.chipGap) }}>
              {(r.colors || []).length
                ? (r.colors || []).map((c, i) => {
                    const m = COLORS[c] || COLORS.Black;
                    return (
                      <div key={c} style={{ display: "flex", marginLeft: i ? px(M.chipGap) : 0 }}>
                        {chip(c, m.c, m.s)}
                      </div>
                    );
                  })
                : <div style={{ display: "flex", fontSize: px(M.v), fontWeight: 600, color: C.faint }}>Not set</div>}
              {(r.colors || []).length ? (
                <div style={{ display: "flex", fontSize: px(M.unit), color: C.muted, marginLeft: px(M.chipGap) }}>
                  {colorCount(r)} total
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{
          display: "flex", flexDirection: "column", height: px(rowH.one(!!note)),
          justifyContent: "center", borderTop: `1px solid ${C.border}`,
          paddingLeft: px(M.cellPadX), paddingRight: px(M.cellPadX),
        }}>
          {label("Print coverage")}
          <div style={{ display: "flex", fontSize: px(M.v), lineHeight: 1.25, fontWeight: 600,
            marginTop: px(M.vGap), color: r.layout ? C.text : C.faint }}>
            {r.layout || "Not set"}
          </div>
          {note ? (
            <div style={{ display: "flex", fontSize: px(M.note), lineHeight: 1.25, color: C.muted,
              marginTop: px(M.noteGap) }}>{note}</div>
          ) : null}
        </div>

        <div style={{
          display: "flex", flexDirection: "column", height: px(rowH.ink), justifyContent: "center",
          borderTop: `1px solid ${C.border}`, paddingLeft: px(M.cellPadX), paddingRight: px(M.cellPadX),
        }}>
          {label("Ink build")}
          <div style={{ display: "flex", alignItems: "center", marginTop: px(M.chipGap) }}>
            {(r.ink || []).length
              ? (r.ink || []).map((l, i) => {
                  const m = INK[l] || INK.CMYK;
                  return (
                    <div key={`${l}-${i}`} style={{ display: "flex", alignItems: "center",
                      marginLeft: i ? px(M.chipGap) : 0 }}>
                      {i > 0 ? (
                        <div style={{ display: "flex", fontSize: px(12), color: C.faint,
                          marginRight: px(M.chipGap) }}>+</div>
                      ) : null}
                      {chip(l, m.c, m.s)}
                    </div>
                  );
                })
              : <div style={{ display: "flex", fontSize: px(M.v), fontWeight: 600, color: C.faint }}>Not set</div>}
          </div>
        </div>
      </div>

      {/* remarks */}
      {remarkLines ? (
        <div style={{
          display: "flex", marginTop: px(BLOCK_GAP), backgroundColor: C.col,
          borderLeft: `${px(2)}px solid ${C.faint}`, borderRadius: px(6),
          paddingLeft: px(12), paddingRight: px(12),
          paddingTop: px(M.remarkPadY), paddingBottom: px(M.remarkPadY),
        }}>
          <div style={{ display: "flex", fontSize: px(M.remark), color: C.text2, lineHeight: 1.45 }}>
            {remarks}
          </div>
        </div>
      ) : null}
    </div>
  );
}
