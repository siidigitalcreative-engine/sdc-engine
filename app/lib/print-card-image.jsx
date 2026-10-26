/* Renders one Print Hub record card as a PNG, matching the on-screen card.
   Satori (next/og) has no CSS grid, so every row here is flex, and any element
   with more than one child carries an explicit display:flex. */

const C = {
  page: "#17141A",
  card: "#231E27",
  col: "#1F1A23",
  border: "#332C3A",
  text: "#F2EEF5",
  text2: "#BDB3C7",
  muted: "#8C8398",
  faint: "#6A6175",
};
const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";

const MODE_META = {
  Cylinder: { c: "#F0784B", s: "#FCE7DD" },
  Flat: { c: "#3E8ED0", s: "#E3EEF9" },
};
const INK = {
  Primer: { c: "#E0A93C", s: "#FAEFD6" },
  White: { c: "#6A7382", s: "#E9ECF1" },
  CMYK: { c: "#7C5CD8", s: "#EBE4FA" },
  Varnish: { c: "#3E8ED0", s: "#E3EEF9" },
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
const swatch = (name) => SWATCHES[hash(String(name || "x")) % SWATCHES.length];
const statusColor = (n) => STATUS[n] || swatch(n);
const methodColor = (n) => (n === "Direct Print" ? "#7C5CD8" : n === "Sticker Print" ? "#3FA37A" : swatch(n));
const tint = (hex) => `${hex}22`;

const W = 680;
const PAD = 26;
const INNER = W - PAD * 2;
const CARD_PAD = 20;
const IMG = 200;

const minsFor = (r) => (r.rec ? r[r.rec] : null);
const perHour = (r) => { const m = minsFor(r); return m ? Math.round((60 / m) * 10) / 10 : null; };
const per100 = (r) => { const p = perHour(r); return p ? Math.round((100 / p) * 10) / 10 : null; };
const colorCount = (r) => (r.colors || []).reduce((t, c) => t + (COLORS[c]?.n || 1), 0);

// Roughly how many characters fit on a line at the sizes used below, so the
// same card can be drawn at any column width.
const titleLinesFor = (text, width) =>
  Math.max(1, Math.min(3, Math.ceil(text.length / Math.max(14, Math.floor((width - CARD_PAD * 2) / 11.5)))));
const remarkLinesFor = (text, width) =>
  (text ? Math.min(4, Math.ceil(text.length / Math.max(20, Math.floor((width - CARD_PAD * 2 - 24) / 6.6)))) : 0);

// Height of one card at a given width, so a grid can be laid out before drawing.
export function printCardHeight(record = {}, options = {}) {
  const r = record || {};
  const width = options.width || INNER;
  const note = String(options.layoutNote || "");
  const title = String(r.name || r.sku || "Untitled product").slice(0, 90);
  const remarks = String(r.remarks || "").slice(0, 300);
  const hasImg = typeof r.img === "string" && /^https?:\/\//.test(r.img);

  let h = CARD_PAD * 2 + 3;
  h += 26 + 8 + 15 + 3 + titleLinesFor(title, width) * 27 + 4 + 18;
  h += 13 + 48;
  if (hasImg) h += 13 + IMG;
  h += 13 + 78;
  h += 9 + 66;
  h += 13 + 68 + 78 + (note ? 66 : 48) + 60;
  const rl = remarkLinesFor(remarks, width);
  if (rl) h += 13 + 18 + rl * 20;
  return h + 10;
}

// One card on its own page.
export function buildPrintCardImage(record = {}, options = {}) {
  const height = PAD * 2 + printCardHeight(record, { ...options, width: INNER });
  return {
    element: (
      <div style={{ width: W, height, display: "flex", backgroundColor: C.page,
        padding: PAD, fontFamily: "sans-serif" }}>
        {printCardNode(record, { ...options, width: INNER })}
      </div>
    ),
    width: W,
    height,
  };
}

export function printCardNode(record = {}, options = {}) {
  const r = record || {};
  const width = options.width || INNER;
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

  const remarkLines = remarkLinesFor(remarks, width);

  const label = (t, color = C.muted) => (
    <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.1, fontWeight: 700, color, textTransform: "uppercase" }}>{t}</div>
  );

  const chip = (text, fg, bg, key) => (
    <div key={key} style={{
      display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start",
      height: 26, paddingLeft: 12, paddingRight: 12, borderRadius: 999, flexShrink: 0,
      backgroundColor: bg, color: fg, fontSize: 13, fontWeight: 700,
    }}>{text}</div>
  );

  const specCell = (k, value, unit, flex) => (
    <div style={{ display: "flex", flexDirection: "column", flex, paddingLeft: 14, paddingRight: 14, paddingTop: 12 }}>
      {label(k)}
      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 5 }}>
        <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: value == null ? C.faint : C.text }}>
          {value == null ? "Not set" : String(value)}
        </div>
        {value != null && unit ? (
          <div style={{ display: "flex", fontSize: 12, color: C.muted, marginLeft: 4, marginBottom: 1 }}>{unit}</div>
        ) : null}
      </div>
    </div>
  );

  const speedTile = (key, name) => {
    const on = r.rec === key;
    const v = r[key];
    return (
      <div key={key} style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        flex: 1, height: 78, borderRadius: 12,
        ...(on ? { backgroundImage: ACCENT } : { backgroundColor: C.col, border: `1px solid ${C.border}` }),
        opacity: v == null && !on ? 0.45 : 1,
      }}>
        <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.1, fontWeight: 700, color: on ? "#FFFFFF" : C.muted }}>
          {name.toUpperCase()}
        </div>
        <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: on ? "#FFFFFF" : C.text, marginTop: 5 }}>
          {v == null ? "—" : String(v)}
        </div>
        <div style={{ display: "flex", fontSize: 12, color: on ? "#FFFFFF" : C.muted, marginTop: 2 }}>min / pc</div>
      </div>
    );
  };

  const outTile = (name, value) => (
    <div key={name} style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      flex: 1, height: 66, borderRadius: 12, backgroundColor: C.col, border: `1px solid ${C.border}`,
    }}>
      {label(name)}
      <div style={{ display: "flex", fontSize: 19, fontWeight: 700, color: C.text, marginTop: 5 }}>{value}</div>
    </div>
  );

  return (
      <div style={{
        display: "flex", flexDirection: "column", width,
        backgroundColor: C.card, borderRadius: 18, border: `1px solid ${C.border}`,
        padding: CARD_PAD,
      }}>
        {/* header */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {chip(String(r.mode || "Cylinder").toUpperCase(), md.c, md.s)}
          <div style={{ display: "flex", fontSize: 12, letterSpacing: 1.2, fontWeight: 800, color: bc, marginTop: 8 }}>
            {String(r.brand || "").toUpperCase()}
          </div>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: C.text, marginTop: 3, lineHeight: 1.2 }}>
            {title}
          </div>
          <div style={{ display: "flex", marginTop: 4 }}>
            {r.name && r.sku ? (
              <div style={{ display: "flex", fontSize: 13, color: C.text2 }}>{r.sku}</div>
            ) : null}
            {r.variant ? (
              <div style={{ display: "flex", fontSize: 13, color: C.muted, marginLeft: r.name && r.sku ? 10 : 0 }}>{r.variant}</div>
            ) : null}
          </div>
        </div>

        {/* design strip */}
        <div style={{
          display: "flex", alignItems: "center", height: 48, marginTop: 13,
          borderRadius: 12, backgroundColor: C.col, paddingLeft: 14, paddingRight: 14,
        }}>
          <div style={{ display: "flex", fontSize: 15, fontWeight: 700, color: C.text }}>{r.design || "Untitled design"}</div>
          <div style={{ display: "flex", marginLeft: 12 }}>{chip(r.method || "", mc, tint(mc))}</div>
          <div style={{ display: "flex", marginLeft: "auto" }}>{chip(r.status || "", sc, tint(sc))}</div>
        </div>

        {/* product image */}
        {hasImg ? (
          <div style={{ display: "flex", marginTop: 13 }}>
            <img src={r.img} width={IMG} height={IMG} style={{ borderRadius: 12, objectFit: "cover" }} />
          </div>
        ) : null}

        {/* speed tiles */}
        <div style={{ display: "flex", marginTop: 13, gap: 9 }}>
          {speedTile("slow", "Slow")}{speedTile("med", "Medium")}{speedTile("fast", "Fast")}
        </div>

        {/* derived output */}
        <div style={{ display: "flex", marginTop: 9, gap: 9 }}>
          {outTile("Per hour", ph == null ? "—" : `${ph} pcs`)}
          {outTile("Per 100 pcs", h100 == null ? "—" : `${h100} hrs`)}
        </div>

        {/* spec grid */}
        <div style={{
          display: "flex", flexDirection: "column", marginTop: 13,
          borderRadius: 12, border: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", height: 68 }}>
            {specCell("Height", r.h, "mm", 1)}
            {specCell("Width", r.w, "mm", 1)}
            {specCell("Base", r.base, "mm", 1)}
            {specCell("Capacity", r.ml, "ml", 1)}
          </div>

          <div style={{ display: "flex", height: 78, borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRight: `1px solid ${C.border}` }}>
              <div style={{
                display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 8,
                borderBottom: `1px solid ${C.border}`,
              }}>{label("Print area")}</div>
              <div style={{ display: "flex", flex: 1 }}>
                {specCell("Width", r.paw, "mm", 1)}
                {specCell("Height", r.pah, "mm", 1)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingLeft: 14, paddingRight: 14, paddingTop: 12 }}>
              {label("Colors")}
              <div style={{ display: "flex", alignItems: "center", marginTop: 6, gap: 6 }}>
                {(r.colors || []).length
                  ? (r.colors || []).map((c) => {
                      const m = COLORS[c] || COLORS.Black;
                      return chip(c, m.c, m.s, c);
                    })
                  : <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: C.faint }}>Not set</div>}
                {(r.colors || []).length
                  ? <div style={{ display: "flex", fontSize: 12, color: C.muted }}>{colorCount(r)} total</div>
                  : null}
              </div>
            </div>
          </div>

          <div style={{
            display: "flex", flexDirection: "column", height: note ? 66 : 48,
            borderTop: `1px solid ${C.border}`, paddingLeft: 14, paddingRight: 14, paddingTop: 11,
          }}>
            {label("Print coverage")}
            <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: r.layout ? C.text : C.faint, marginTop: 4 }}>
              {r.layout || "Not set"}
            </div>
            {note ? (
              <div style={{ display: "flex", fontSize: 13, color: C.muted, marginTop: 1 }}>{note}</div>
            ) : null}
          </div>

          <div style={{
            display: "flex", flexDirection: "column", height: 60,
            borderTop: `1px solid ${C.border}`, paddingLeft: 14, paddingRight: 14, paddingTop: 11,
          }}>
            {label("Ink build")}
            <div style={{ display: "flex", alignItems: "center", marginTop: 6, gap: 6 }}>
              {(r.ink || []).length
                ? (r.ink || []).map((l, i) => {
                    const m = INK[l] || INK.CMYK;
                    return (
                      <div key={`${l}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {i > 0 ? <div style={{ display: "flex", fontSize: 13, color: C.faint }}>+</div> : null}
                        {chip(l, m.c, m.s)}
                      </div>
                    );
                  })
                : <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: C.faint }}>Not set</div>}
            </div>
          </div>
        </div>

        {/* remarks */}
        {remarkLines ? (
          <div style={{
            display: "flex", marginTop: 13, backgroundColor: C.col,
            borderLeft: `3px solid ${C.faint}`, borderRadius: 6,
            paddingLeft: 12, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
          }}>
            <div style={{ display: "flex", fontSize: 13, color: C.text2, lineHeight: 1.45 }}>{remarks}</div>
          </div>
        ) : null}
      </div>
  );
}
