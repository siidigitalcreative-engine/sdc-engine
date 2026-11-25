"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Globe2, Copy, ExternalLink, ArrowLeft, Tag, Send, Image as ImageIcon } from "lucide-react";
import PageAccess from "../../PageAccess";
import DepartmentView from "../../DepartmentView";
import { useAuth } from "../../auth";
import { useLarkSend } from "../../LarkSend";

const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const cell = { borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" };
const head = {
  ...cell, background: "var(--card)", fontSize: 10, letterSpacing: ".07em", textTransform: "uppercase",
  fontWeight: 700, color: "var(--muted)", padding: "9px 12px", textAlign: "left", whiteSpace: "nowrap",
};
const field = {
  width: "100%", background: "transparent", border: "none", outline: "none",
  color: "var(--text)", fontSize: 13, fontFamily: "inherit", padding: "7px 12px",
};

function PricingInner() {
  const { department } = useAuth();
  const { openLarkSend, larkPicker } = useLarkSend();
  const [sheets, setSheets] = useState([]);
  const [currentId, setCurrentId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const writeSeq = useRef(0);

  const [deptView, setDeptView] = useState("");
  useEffect(() => {
    if (!deptView && department?.id) setDeptView(department.id);
  }, [department, deptView]);

  const url = useCallback(
    () => `/api/pricing${deptView && deptView !== "all" ? `?department=${encodeURIComponent(deptView)}` : ""}`,
    [deptView]
  );

  const load = useCallback(async () => {
    if (!deptView) return;
    try {
      const res = await fetch(url(), { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load the price lists.");
      setSheets(body.sheets || []);
      setCurrentId((id) => (body.sheets?.some((s) => s.id === id) ? id : body.sheets?.[0]?.id || ""));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [url, deptView]);

  useEffect(() => { load(); }, [load]);

  /* Writes answer with the whole list for this department. Only the newest
     may apply its response, so a slower earlier save cannot undo a later one. */
  const send = async (method, payload) => {
    const seq = (writeSeq.current += 1);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url(), {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "That did not save.");
      if (seq === writeSeq.current && Array.isArray(body.sheets)) setSheets(body.sheets);
      return body;
    } catch (e) {
      if (seq === writeSeq.current) { setError(e.message); await load(); }
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sheet = sheets.find((s) => s.id === currentId) || null;
  const saveRows = (rows) => sheet && send("PATCH", { id: sheet.id, patch: { rows } });

  const addRow = () => sheet && saveRows([...sheet.rows, {
    brand: "", product: "",
    tiers: [{ pieces: "1-10pcs", price: "" }, { pieces: "11-100pcs", price: "" }, { pieces: "101pcs-above", price: "" }],
  }]);

  const patchRow = (rowId, fields) =>
    sheet && saveRows(sheet.rows.map((r) => (r.id === rowId ? { ...r, ...fields } : r)));

  const patchTier = (rowId, tierId, fields) => sheet && saveRows(sheet.rows.map((r) => (r.id !== rowId ? r : {
    ...r, tiers: r.tiers.map((t) => (t.id === tierId ? { ...t, ...fields } : t)),
  })));

  const addTier = (rowId) => sheet && saveRows(sheet.rows.map((r) => (r.id !== rowId ? r : {
    ...r, tiers: [...r.tiers, { pieces: "", price: "" }],
  })));

  const removeTier = (rowId, tierId) => sheet && saveRows(sheet.rows.map((r) => (r.id !== rowId ? r : {
    ...r, tiers: r.tiers.length > 1 ? r.tiers.filter((t) => t.id !== tierId) : r.tiers,
  })));

  const removeRow = (rowId) => sheet && saveRows(sheet.rows.filter((r) => r.id !== rowId));

  const newSheet = async () => {
    const body = await send("POST", { sheet: { name: "Untitled price list", rows: [] } });
    if (body?.sheets?.[0]) setCurrentId(body.sheets[0].id);
  };

  /* The whole table as one picture, saved or sent to a Lark group. */
  const exportPayload = () => ({
    sheet: {
      name: sheet?.name || "Price list",
      note: sheet?.note || "",
      rows: (sheet?.rows || []).map((r) => ({
        id: r.id, brand: r.brand, product: r.product,
        tiers: (r.tiers || []).map((t) => ({ id: t.id, pieces: t.pieces, price: t.price })),
      })),
    },
    stamp: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  });

  const exportPng = async () => {
    if (!sheet?.rows?.length) { setError("Nothing priced yet to export."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pricing-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportPayload()),
      });
      if (!res.ok) throw new Error("Unable to render that price list.");
      const link = document.createElement("a");
      const url = URL.createObjectURL(await res.blob());
      link.href = url;
      link.download = `${(sheet.name || "pricing").replace(/[^a-zA-Z0-9 ._-]+/g, "-").trim()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendToLark = () => {
    if (!sheet?.rows?.length) { setError("Nothing priced yet to send."); return; }
    openLarkSend("/api/lark/pricing-image", exportPayload(), { label: sheet.name || "this price list" });
  };

  const copyLink = async () => {
    if (!sheet?.share?.enabled) { setError("Turn sharing on first."); return; }
    const link = `${window.location.origin}/public/pricing/${sheet.share.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied.");
      setTimeout(() => setNote(""), 1600);
    } catch {
      setError(link);          // clipboard blocked: show it to copy by hand
    }
  };

  return (
    <main className="flex-1 min-w-0 min-h-0 flex flex-col">
      <header className="px-4 sm:px-7 pt-5 sm:pt-6 pb-4 shrink-0 flex items-start gap-3 flex-wrap">
        <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: ACCENT, color: "var(--on-accent)" }}><Tag size={18} /></span>
        <div className="mr-auto min-w-0">
          <Link href="/print" className="text-xs inline-flex items-center gap-1" style={{ color: "var(--muted)" }}>
            <ArrowLeft size={12} /> Print Hub
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Pricing</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Price per brand and product, by quantity, with a read-only link to share.
          </p>
        </div>
        <DepartmentView value={deptView} onChange={setDeptView} />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 pb-8">
        <div className="flex gap-4 items-start flex-col lg:flex-row">
          {/* the price lists in this department */}
          <aside className="w-full lg:w-60 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Price lists</span>
              <button onClick={newSheet} disabled={busy}
                className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
                style={{ background: ACCENT, color: "var(--on-accent)" }}>
                <Plus size={13} /> New
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {sheets.map((s) => {
                const on = s.id === currentId;
                return (
                  <button key={s.id} onClick={() => setCurrentId(s.id)}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left"
                    style={{ background: on ? "var(--col)" : "transparent", border: `1px solid ${on ? "var(--border)" : "transparent"}` }}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold truncate" style={{ color: "var(--text)" }}>{s.name}</span>
                      <span className="block text-[10.5px]" style={{ color: "var(--muted)" }}>
                        {s.rows.length} product{s.rows.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    {s.share?.enabled && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#3FA37A" }} />}
                  </button>
                );
              })}
              {!sheets.length && (
                <p className="text-xs px-1 py-2" style={{ color: "var(--muted)" }}>
                  No price lists yet. Create one.
                </p>
              )}
            </div>
          </aside>

          {/* the table */}
          <section className="flex-1 min-w-0 w-full">
            {!sheet ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--muted)" }}>Pick a price list, or create one.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="mr-auto min-w-0">
                    <input defaultValue={sheet.name} key={`${sheet.id}-name`}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== sheet.name) {
                          send("PATCH", { id: sheet.id, patch: { name: e.target.value } });
                        }
                      }}
                      className="bg-transparent outline-none text-lg font-semibold w-full"
                      style={{ color: "var(--text)" }} />
                    <input defaultValue={sheet.note} key={`${sheet.id}-note`} placeholder="Note shown on the shared page"
                      onBlur={(e) => { if (e.target.value !== sheet.note) send("PATCH", { id: sheet.id, patch: { note: e.target.value } }); }}
                      className="bg-transparent outline-none text-xs w-full"
                      style={{ color: "var(--muted)" }} />
                  </div>

                  <button onClick={addRow} disabled={busy}
                    className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
                    style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                    <Plus size={14} /> Add product
                  </button>
                  <button onClick={exportPng} disabled={busy}
                    className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
                    style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                    <ImageIcon size={14} /> Export PNG
                  </button>
                  <button onClick={sendToLark} disabled={busy}
                    className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
                    style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                    <Send size={14} /> Send to Lark
                  </button>
                  <button onClick={() => send("PATCH", { id: sheet.id, patch: { share: { ...sheet.share, enabled: !sheet.share?.enabled } } })}
                    disabled={busy}
                    className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
                    style={sheet.share?.enabled
                      ? { background: "#DEF1E7", color: "#2E8B63", border: "1px solid transparent" }
                      : { background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                    <Globe2 size={14} /> {sheet.share?.enabled ? "Shared" : "Share"}
                  </button>
                  {sheet.share?.enabled && (
                    <>
                      <button onClick={copyLink} title="Copy the link"
                        className="tp-ib rounded-full p-2" style={{ color: "var(--muted)" }}><Copy size={14} /></button>
                      <a href={`/public/pricing/${sheet.share.token}`} target="_blank" rel="noreferrer" title="Open the shared page"
                        className="tp-ib rounded-full p-2" style={{ color: "var(--muted)" }}><ExternalLink size={14} /></a>
                    </>
                  )}
                  <button onClick={() => send("DELETE", { id: sheet.id })} disabled={busy} title="Delete this price list"
                    className="tp-ib rounded-full p-2" style={{ color: "#E5536E" }}><Trash2 size={14} /></button>
                </div>

                {error && <p className="text-xs mb-2" style={{ color: "#E5536E" }}>{error}</p>}
                {note && <p className="text-xs mb-2" style={{ color: "#3FA37A" }}>{note}</p>}

                <div className="rounded-2xl overflow-x-auto" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 680 }}>
                    <thead>
                      <tr>
                        <th style={{ ...head, minWidth: 150 }}>Brand</th>
                        <th style={{ ...head, minWidth: 180 }}>Product</th>
                        <th style={{ ...head, minWidth: 150 }}>Pieces</th>
                        <th style={{ ...head, minWidth: 120 }}>Price</th>
                        <th style={{ ...head, width: 44 }} />
                      </tr>
                    </thead>

                    <tbody>
                      {sheet.rows.map((row) => row.tiers.map((tier, index) => (
                        <tr key={tier.id}>
                          {/* brand and product span the product's tiers, as on paper */}
                          {index === 0 && (
                            <>
                              <td rowSpan={row.tiers.length} style={{ ...cell, verticalAlign: "top", padding: 0 }}>
                                <input defaultValue={row.brand} key={`${row.id}-brand`} placeholder="Brand"
                                  onBlur={(e) => { if (e.target.value !== row.brand) patchRow(row.id, { brand: e.target.value }); }}
                                  style={{ ...field, fontWeight: 600 }} />
                              </td>
                              <td rowSpan={row.tiers.length} style={{ ...cell, verticalAlign: "top", padding: 0 }}>
                                <input defaultValue={row.product} key={`${row.id}-product`} placeholder="Product"
                                  onBlur={(e) => { if (e.target.value !== row.product) patchRow(row.id, { product: e.target.value }); }}
                                  style={field} />
                              </td>
                            </>
                          )}

                          <td style={{ ...cell, padding: 0 }}>
                            <input defaultValue={tier.pieces} key={`${tier.id}-pieces`} placeholder="1-10pcs"
                              onBlur={(e) => { if (e.target.value !== tier.pieces) patchTier(row.id, tier.id, { pieces: e.target.value }); }}
                              style={field} />
                          </td>
                          <td style={{ ...cell, padding: 0 }}>
                            <input defaultValue={tier.price} key={`${tier.id}-price`} placeholder="₱0"
                              onBlur={(e) => { if (e.target.value !== tier.price) patchTier(row.id, tier.id, { price: e.target.value }); }}
                              style={field} />
                          </td>

                          <td style={{ ...cell, padding: "0 6px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <button onClick={() => removeTier(row.id, tier.id)} title="Remove this tier"
                              style={{ color: "var(--faint)", padding: 4 }}>
                              <Trash2 size={12} />
                            </button>
                            {index === row.tiers.length - 1 && (
                              <button onClick={() => addTier(row.id)} title="Add a tier"
                                style={{ color: "var(--faint)", padding: 4 }}>
                                <Plus size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      )))}

                      {!sheet.rows.length && (
                        <tr>
                          <td colSpan={5} style={{ padding: 26, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                            No products yet. Add one to start pricing.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {sheet.rows.length > 0 && (
                  <div className="flex items-center gap-3 mt-3">
                    <button onClick={addRow} disabled={busy}
                      className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                      <Plus size={13} /> Add product
                    </button>
                    <button onClick={() => removeRow(sheet.rows[sheet.rows.length - 1].id)} disabled={busy}
                      className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
                      <Trash2 size={12} /> Remove the last product
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {larkPicker}
    </main>
  );
}

export default function PricingPage() {
  return (
    <PageAccess page="print">
      <PricingInner />
    </PageAccess>
  );
}
