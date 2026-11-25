/* Renders a price list as a PNG.

   Satori has no table element, so each product is a row of flex boxes: brand,
   product, then a column holding that product's tiers. The tier column is
   what makes brand and product appear to span their bands. */

const C = {
  page: "#17141A", card: "#231E27", col: "#1F1A23", border: "#332C3A",
  text: "#F2EEF5", text2: "#BDB3C7", muted: "#8C8398", faint: "#6A6175",
};

const PAD = 34;
const COL = { brand: 190, product: 260, pieces: 180, price: 150 };
const TABLE_W = COL.brand + COL.product + COL.pieces + COL.price;
const HEAD_ROW = 34;
const TIER_ROW = 38;

// One line, cut to the column it sits in, since satori has no text-overflow.
function fit(text, width, size) {
  const value = String(text ?? "");
  const budget = Math.floor(Math.max(0, width - 24) / (size * 0.54));
  if (value.length <= budget) return value;
  return budget > 1 ? `${value.slice(0, budget - 1)}…` : "";
}

export function buildPricingImage(payload = {}) {
  const sheet = payload.sheet || {};
  const rows = (Array.isArray(sheet.rows) ? sheet.rows : [])
    .map((row) => ({ ...row, tiers: Array.isArray(row.tiers) && row.tiers.length ? row.tiers : [{ pieces: "", price: "" }] }));

  const noteLines = sheet.note ? Math.min(2, Math.ceil(String(sheet.note).length / 78)) : 0;
  const headH = 34 + 6 + (noteLines ? noteLines * 20 + 6 : 0) + 18;      // name, note, date
  const tableH = HEAD_ROW + rows.reduce((h, row) => h + row.tiers.length * TIER_ROW, 0);

  const width = TABLE_W + PAD * 2;
  const height = headH + tableH + PAD * 3;

  const cellText = { display: "flex", alignItems: "center", height: "100%" };

  const element = (
    <div style={{
      width, height, display: "flex", flexDirection: "column",
      background: C.page, color: C.text, fontFamily: "Inter, InterExt",
    }}>
      {/* the heading */}
      <div style={{ display: "flex", flexDirection: "column", padding: `${PAD}px ${PAD}px 0` }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>{sheet.name || "Price list"}</div>
        {sheet.note ? (
          <div style={{ display: "flex", fontSize: 14, color: C.text2, marginTop: 6, lineHeight: 1.4 }}>
            {String(sheet.note).slice(0, 156)}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 13, color: C.faint, marginTop: 6 }}>
          {payload.stamp ? `Updated ${payload.stamp}` : ""}
        </div>
      </div>

      {/* the table */}
      <div style={{
        display: "flex", flexDirection: "column", margin: `${PAD}px ${PAD}px ${PAD}px`,
        width: TABLE_W, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden",
        background: C.card,
      }}>
        <div style={{ display: "flex", height: HEAD_ROW, background: C.card, borderBottom: `1px solid ${C.border}` }}>
          {[["Brand", COL.brand], ["Product", COL.product], ["Pieces", COL.pieces], ["Price", COL.price]].map(([label, w], i) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", width: w, padding: "0 12px",
              fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: C.muted,
              borderRight: i < 3 ? `1px solid ${C.border}` : "none",
            }}>{label}</div>
          ))}
        </div>

        {rows.map((row, rowIndex) => {
          const blockH = row.tiers.length * TIER_ROW;
          const lastBlock = rowIndex === rows.length - 1;

          return (
            <div key={row.id || rowIndex} style={{
              display: "flex", height: blockH,
              borderBottom: lastBlock ? "none" : `1px solid ${C.border}`,
            }}>
              <div style={{
                display: "flex", width: COL.brand, padding: "0 12px", borderRight: `1px solid ${C.border}`,
                fontSize: 13.5, fontWeight: 600, alignItems: "flex-start", paddingTop: 11,
              }}>{fit(row.brand, COL.brand, 13.5)}</div>

              <div style={{
                display: "flex", width: COL.product, padding: "0 12px", borderRight: `1px solid ${C.border}`,
                fontSize: 13.5, alignItems: "flex-start", paddingTop: 11, color: C.text,
              }}>{fit(row.product, COL.product, 13.5)}</div>

              {/* the tiers, one line each, which is what the two cells span */}
              <div style={{ display: "flex", flexDirection: "column", width: COL.pieces + COL.price }}>
                {row.tiers.map((tier, tierIndex) => (
                  <div key={tier.id || tierIndex} style={{
                    display: "flex", height: TIER_ROW,
                    borderBottom: tierIndex === row.tiers.length - 1 ? "none" : `1px solid ${C.border}`,
                  }}>
                    <div style={{
                      ...cellText, width: COL.pieces, padding: "0 12px", fontSize: 13,
                      color: C.text2, borderRight: `1px solid ${C.border}`,
                    }}>{fit(tier.pieces, COL.pieces, 13)}</div>
                    <div style={{
                      ...cellText, width: COL.price, padding: "0 12px", fontSize: 13.5, fontWeight: 600,
                    }}>{fit(tier.price, COL.price, 13.5)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {!rows.length && (
          <div style={{ display: "flex", height: 60, alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>
            Nothing priced yet.
          </div>
        )}
      </div>
    </div>
  );

  return { element, width, height };
}
