"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const cell = { borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)", padding: "9px 14px", fontSize: 13.5 };
const head = {
  ...cell, background: "var(--card)", fontSize: 10, letterSpacing: ".07em", textTransform: "uppercase",
  fontWeight: 700, color: "var(--muted)", textAlign: "left", whiteSpace: "nowrap",
};

export default function PublicPricingPage() {
  const params = useParams();
  const token = params?.token;

  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/pricing/${encodeURIComponent(token)}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "That link is not available.");
      setSheet(body.sheet);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  if (error) {
    return (
      <main style={shell}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 36, textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
            The link may have been turned off, or the price list removed.
          </p>
        </div>
      </main>
    );
  }

  if (!sheet) {
    return <main style={shell}><p style={{ fontSize: 13, color: "var(--muted)" }}>Loading…</p></main>;
  }

  const updated = sheet.updatedAt
    ? new Date(sheet.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <main style={{ ...shell, alignItems: "flex-start", paddingTop: 30 }}>
      <div style={{ width: "100%", maxWidth: 760 }}>
        <header style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{sheet.name}</h1>
          {sheet.note ? (
            <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{sheet.note}</p>
          ) : null}
          {updated ? (
            <p style={{ fontSize: 12, color: "var(--faint)", margin: "6px 0 0" }}>Updated {updated}</p>
          ) : null}
        </header>

        <div style={{ border: "1px solid var(--border)", borderRadius: 16, overflowX: "auto", background: "var(--card)" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={head}>Brand</th>
                <th style={head}>Product</th>
                <th style={head}>Pieces</th>
                <th style={{ ...head, borderRight: "none" }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {(sheet.rows || []).map((row) => (row.tiers || []).map((tier, index) => (
                <tr key={tier.id}>
                  {index === 0 && (
                    <>
                      <td rowSpan={row.tiers.length} style={{ ...cell, verticalAlign: "top", fontWeight: 600 }}>{row.brand}</td>
                      <td rowSpan={row.tiers.length} style={{ ...cell, verticalAlign: "top" }}>{row.product}</td>
                    </>
                  )}
                  <td style={{ ...cell, color: "var(--text-2)" }}>{tier.pieces}</td>
                  <td style={{ ...cell, borderRight: "none", fontWeight: 600 }}>{tier.price}</td>
                </tr>
              )))}

              {!(sheet.rows || []).length && (
                <tr>
                  <td colSpan={4} style={{ padding: 26, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    Nothing priced yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 11, color: "var(--faint)", textAlign: "center", margin: "16px 0 28px" }}>
          Shared from SDC Engine. Prices are subject to change.
        </p>
      </div>
    </main>
  );
}

const shell = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "var(--page)",
  color: "var(--text)",
};
