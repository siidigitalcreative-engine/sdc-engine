import React from "react";

// Image counterpart of the existing campaign summary card in app/ads/page.jsx.
// Used unchanged by both Export PNG and Send to Lark.
const C = { bg: "#1D1C22", border: "#343039", tile: "#16151A", secondary: "#8E8996", text: "#F5F3F6", blue: "#7C9CF0", orange: "#F0784B" };
const STATUS = { Draft: "#8E8A96", Scheduled: "#E0A93C", Running: "#3FA37A", Paused: "#E5536E", Ended: "#6A6175", Completed: "#2E9B8F" };
const money = value => "PHP " + Math.round(Number(value) || 0).toLocaleString("en-PH");
const days = (start, end) => Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1 || 1);
const shortDate = iso => { const date = new Date(iso); return isNaN(date) ? "—" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
const label = value => String(value ?? "");
const shorten = (s, max = 65) => label(s).length > max ? label(s).slice(0, max - 1) + "…" : label(s);

function Pill({ name, color }) {
  return <div style={{ display: "flex", padding: "8px 13px", marginRight: 8, marginBottom: 8, background: `${color}22`, color, borderRadius: 30, fontSize: 20, fontWeight: 700 }}>{name}</div>;
}


export function buildAdsImage({ campaign = {}, brandName = "", preset = null, pillars = [] } = {}) {
  const rows = Array.isArray(campaign.rows) ? campaign.rows : [];
  const span = days(campaign.start, campaign.end);
  const allocated = rows.reduce((sum, row) => sum + (Number(row.budget) || 0), 0);
  const budgetType = campaign.budgetSource === "preset" ? preset?.type : campaign.budgetType;
  const amount = Number(campaign.budgetSource === "preset" ? preset?.amount : campaign.amount) || 0;
  const total = campaign.budgetSource === "pillars" ? allocated : budgetType === "daily" ? amount * span : amount;
  const scope = campaign.product ? "Product" : campaign.collection ? "Collection" : "Brand";
  const target = campaign.product || campaign.collection || brandName || "Whole brand";
  const uniquePillars = [...new Set(rows.map(row => row.pillar))].map(id => pillars.find(p => p.id === id)).filter(Boolean);
  const start = Date.parse(campaign.start), end = Date.parse(campaign.end), now = Date.now();
  const known = Number.isFinite(start) && Number.isFinite(end);
  const elapsed = known ? Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start))) : 0;
  const before = known && now < start, after = known && now > end;
  const daysLeft = known ? Math.ceil((end - now) / 86400000) : 0;
  const timing = !known ? "Dates not set" : before ? `Starts in ${Math.ceil((start - now) / 86400000)} days` : after ? `Finished${campaign.status === "Running" ? " — still marked Running" : ""}` : `${daysLeft} days left`;
  const statusColor = STATUS[campaign.status] || STATUS.Draft;
  const lines = Math.max(1, Math.ceil(uniquePillars.reduce((n, p) => n + p.name.length + 4, 0) / 33));
  const height = 790 + Math.max(0, lines - 1) * 52;

  const element = <div style={{ display: "flex", flexDirection: "column", width: 640, height, padding: 32, background: C.bg, border: `2px solid ${C.border}`, borderRadius: 30, color: C.text, fontFamily: "Inter" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 470 }}>
        <div style={{ display: "flex" }}><Pill name={scope} color={C.orange}/></div>
        <span style={{ color: C.secondary, fontSize: 19, fontWeight: 700, letterSpacing: 1, marginTop: 10 }}>{shorten(brandName || "NO BRAND SET", 35).toUpperCase()}</span>
        <span style={{ color: C.text, fontSize: 29, fontWeight: 750, marginTop: 4 }}>{shorten(campaign.name || "Untitled campaign", 36)}</span>
        <span style={{ color: C.secondary, fontSize: 23, marginTop: 3 }}>{shorten(target, 42)}</span>
      </div>
      <Pill name={campaign.status || "Draft"} color={statusColor}/>
    </div>

    <div style={{ display: "flex", flexWrap: "wrap", marginTop: 28, minHeight: 48 }}>
      {uniquePillars.length ? uniquePillars.map(p => <Pill key={p.id} name={p.name} color={p.color}/>) : <span style={{ fontSize: 21, color: C.secondary }}>No pillars added</span>}
    </div>

    <div style={{ display: "flex", gap: 16, marginTop: 17 }}>
      {[["TOTAL", total], ["DAILY", total / span]].map(([title, value]) => <div key={title} style={{ display: "flex", flexDirection: "column", flex: 1, padding: 24, background: C.tile, borderRadius: 26 }}><span style={{ color: C.secondary, fontSize: 20, fontWeight: 700 }}>{title}</span><span style={{ color: C.text, fontSize: 31, fontWeight: 800, marginTop: 5 }}>{money(value)}</span></div>)}
    </div>

    <div style={{ display: "flex", flexDirection: "column", marginTop: 22, padding: 24, background: C.tile, borderRadius: 26 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ color: C.secondary, fontSize: 24 }}>▦</span><span style={{ color: C.text, fontSize: 26, fontWeight: 700, marginLeft: 12 }}>{shortDate(campaign.start)}</span><span style={{ color: C.secondary, fontSize: 22, marginLeft: 16 }}>→</span><span style={{ color: C.text, fontSize: 26, fontWeight: 700, marginLeft: 16 }}>{shortDate(campaign.end)}</span><div style={{ display: "flex", flex: 1 }}/><Pill name={`${span} DAYS`} color={C.secondary}/></div>
      <div style={{ display: "flex", height: 12, background: "#27262C", borderRadius: 20, marginTop: 16, overflow: "hidden" }}><div style={{ width: `${Math.round(elapsed * 100)}%`, height: 12, background: after ? C.secondary : C.orange, borderRadius: 20 }}/></div>
      <span style={{ color: after && campaign.status === "Running" ? "#E0A93C" : C.secondary, fontSize: 20, marginTop: 11 }}>{timing}</span>
    </div>

    <div style={{ display: "flex", flexDirection: "column", marginTop: 25 }}><span style={{ color: "#C3BECA", fontSize: 22 }}>{shorten(`${label(campaign.platform)}${campaign.adAccount ? ` · ${campaign.adAccount}` : ""}`, 47)}</span>{campaign.landing && <span style={{ color: C.blue, fontSize: 21, marginTop: 10 }}>{shorten(label(campaign.landing).replace(/^https?:\/\//, ""), 48)}</span>}</div>
  </div>;
  return { element, width: 640, height };
}
