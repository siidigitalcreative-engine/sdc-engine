"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, GripVertical, ChevronDown, ChevronUp, Copy, Trash2, Save, Wallet, BookOpen, Pencil } from "lucide-react";

const PILLARS = [
  { id: "story", name: "Storytelling", color: "#F0A5B9", focus: "Emotional stories and everyday moments", seconds: 30 },
  { id: "showcase", name: "Product Showcase", color: "#8FC1FF", focus: "Features, benefits, demonstrations", seconds: 15 },
  { id: "hook", name: "7-Second Hook", color: "#FFA079", focus: "Quick reveal and attention-grabbing opening", seconds: 7 },
  { id: "value", name: "Consumables / Value-Driven", color: "#9FDEB8", focus: "Tips, how-to, FAQs, product care", seconds: 20 },
  { id: "journey", name: "Journey / Behind-the-Scenes", color: "#F6D28E", focus: "People, process, and progress", seconds: 30 },
  { id: "interactive", name: "Interactive Content", color: "#CBB1FA", focus: "Questions, polls, and choices", seconds: 15 },
  { id: "relatable", name: "Relatable Content", color: "#8CDDD6", focus: "Common situations, trends, and humor", seconds: 15 },
];
const DEFAULT_BUDGETS = Object.fromEntries(PILLARS.map(p => [p.id, 0]));
const OPT_OBJECTIVES = ["Brand Awareness", "Product Discovery", "Engagement", "Trust & Credibility", "Education & Consideration", "Conversion"];
const PANEL = { background: "var(--card)", border: "1px solid var(--border)" };
const INPUT = "w-full px-3 py-2 rounded-xl border text-sm outline-none";
const money = value => "₱" + Math.round(Number(value) || 0).toLocaleString("en-PH");
const daysBetween = (start, end) => Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1 || 1);
const blankConcept = pillar => ({ title: `${pillar.name} Concept`, summary: pillar.focus, hook: "", angle: "", voiceover: "", cta: "", duration: pillar.seconds, format: "TikTok / Reels", scenes: [] });
const freshCampaign = () => ({ id: crypto.randomUUID(), name: "New Ad Campaign", brandId: "", collection: "", product: "", objective: "Product Discovery", brief: "", platform: "TikTok Ads", adAccount: "", landing: "", budgetSource: "preset", presetId: "discovery", budgetType: "daily", amount: 1000, start: new Date().toISOString().slice(0, 10), end: new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10), status: "Draft", spent: 0, rows: [] });

function Field({ label, children }) { return <label className="block space-y-1"><span className="block text-xs font-medium" style={{ color: "var(--text-2)" }}>{label}</span>{children}</label>; }
function Box({ children, className = "" }) { return <div className={`rounded-2xl p-4 ${className}`} style={PANEL}>{children}</div>; }
function Pill({ children, color = "#A899B6" }) { return <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color, background: `${color}22` }}>{children}</span>; }
function IconButton({ children, onClick, danger = false }) { return <button type="button" onClick={onClick} className="rounded-lg px-2.5 py-1.5 text-xs font-medium flex gap-1 items-center" style={{ border: "1px solid var(--border)", color: danger ? "#E77A76" : "var(--text-2)" }}>{children}</button>; }

export default function AdsPage() {
  const [data, setData] = useState({ brands: [], campaigns: [], presets: [], pillarBudgets: DEFAULT_BUDGETS });
  const [tab, setTab] = useState("campaigns");
  const [draft, setDraft] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [pillarValues, setPillarValues] = useState(DEFAULT_BUDGETS);
  const [presetValues, setPresetValues] = useState([]);

  const reload = async () => {
    const response = await fetch("/api/ads", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result); setPillarValues(result.pillarBudgets || DEFAULT_BUDGETS); setPresetValues(result.presets || []);
    return result;
  };
  useEffect(() => { reload().catch(e => setMessage(e.message)); }, []);
  const brand = data.brands.find(x => x.id === draft?.brandId);
  const collection = brand?.collections?.find(x => x.name === draft?.collection);
  const preset = data.presets.find(x => x.id === draft?.presetId);
  const duration = draft ? daysBetween(draft.start, draft.end) : 1;
  const pillarTotal = (draft?.rows || []).reduce((s, r) => s + (Number(r.budget) || 0), 0);
  const budgetType = draft?.budgetSource === "preset" ? preset?.type : draft?.budgetType;
  const budgetAmount = draft?.budgetSource === "preset" ? preset?.amount : draft?.amount;
  const total = draft?.budgetSource === "pillars" ? pillarTotal : (budgetType === "daily" ? (Number(budgetAmount) || 0) * duration : (Number(budgetAmount) || 0));
  const metrics = useMemo(() => ({ campaigns: data.campaigns.length, running: data.campaigns.filter(x => x.status === "Running").length, planned: data.campaigns.reduce((sum, x) => {
    const p = data.presets.find(v => v.id === x.presetId);
    const amount = x.budgetSource === "pillars" ? (x.rows || []).reduce((s, r) => s + (Number(r.budget) || 0), 0) : Number(x.budgetSource === "preset" ? p?.amount : x.amount) || 0;
    const type = x.budgetSource === "preset" ? p?.type : x.budgetType;
    return sum + (x.budgetSource !== "pillars" && type === "daily" ? amount * daysBetween(x.start, x.end) : amount);
  }, 0), spent: data.campaigns.reduce((s, x) => s + (Number(x.spent) || 0), 0) }), [data]);
  const update = patch => setDraft(v => ({ ...v, ...patch }));
  const updateRow = (id, patch) => update({ rows: draft.rows.map(r => r.id === id ? { ...r, ...patch } : r) });
  const newAd = () => { const item = freshCampaign(); item.brandId = data.brands[0]?.id || ""; item.presetId = data.presets[0]?.id || ""; setDraft(item); setActiveId(item.id); setTab("campaigns"); setMessage(""); };
  const choose = item => { setDraft(structuredClone(item)); setActiveId(item.id); setMessage(""); };
  const addPillar = id => { if (!draft) return; update({ rows: [...draft.rows, { id: crypto.randomUUID(), pillar: id, budget: Number(data.pillarBudgets[id] || 0), prompt: "", open: true, concept: blankConcept(PILLARS.find(p => p.id === id)) }] }); };
  const duplicateRow = row => update({ rows: [...draft.rows, { ...structuredClone(row), id: crypto.randomUUID(), open: true }] });
  const saveAction = async (action, payload, success) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result); setPillarValues(result.pillarBudgets); setPresetValues(result.presets);
      setMessage(success || "Saved.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const reorder = (source, target) => {
    if (!source || !target || source === target) return;
    const copy = [...draft.rows]; const from = copy.findIndex(x => x.id === source); const to = copy.findIndex(x => x.id === target);
    if (from < 0 || to < 0) return;
    copy.splice(to, 0, ...copy.splice(from, 1)); update({ rows: copy });
  };
  const dropped = (event, target) => {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
      if (payload.type === "pillar") addPillar(payload.id);
      if (payload.type === "row") reorder(payload.id, target);
    } catch { /* Ignore non-app drags. */ }
  };

  return <main className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 space-y-4" style={{ color: "var(--text)" }}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Ads</h1><p className="text-sm" style={{ color: "var(--muted)" }}>Plan campaigns, build creative concepts, and manage budgets.</p></div><button onClick={newAd} className="text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex gap-2 items-center" style={{ background: "linear-gradient(135deg,#FFAA62,#E53E30)" }}><Plus size={16}/> New Ad</button></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[["Campaigns", metrics.campaigns], ["Running", metrics.running], ["Planned", money(metrics.planned)], ["Spent", money(metrics.spent)]].map(([key, val]) => <Box key={key}><p className="text-xs" style={{ color: "var(--muted)" }}>{key}</p><strong className="text-xl">{val}</strong></Box>)}</div>
    <div className="flex gap-5 border-b overflow-auto" style={{ borderColor: "var(--border)" }}>{[["campaigns", "Campaigns"], ["pillars", "Pillar Budgets"], ["presets", "Standard Ad Budgets"]].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className="pb-3 text-sm whitespace-nowrap font-semibold" style={{ color: tab === id ? "var(--text)" : "var(--muted)", borderBottom: tab === id ? "3px solid #F26D52" : "3px solid transparent" }}>{label}</button>)}</div>
    {tab === "campaigns" && <>
      <div className="flex flex-wrap gap-2 items-center"><span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>CAMPAIGN</span>{data.campaigns.map(c => <button key={c.id} onClick={() => choose(c)} className="px-3 py-1.5 rounded-full text-xs" style={{ border: "1px solid var(--border)", background: activeId === c.id ? "var(--hover)" : "transparent" }}>{c.name}</button>)}{data.campaigns.length === 0 && <span className="text-xs" style={{ color: "var(--muted)" }}>Create your first campaign to get started.</span>}</div>
      {draft ? <div className="grid xl:grid-cols-[minmax(0,1.03fr)_minmax(0,.78fr)_minmax(0,1.38fr)] gap-3 items-start">
        <Box className="space-y-4"><h2 className="font-semibold flex gap-2 items-center"><Pencil size={16}/> Campaign Setup</h2>
          <Field label="Campaign Name"><input className={INPUT} style={PANEL} value={draft.name} onChange={e => update({ name: e.target.value })}/></Field>
          <Field label="Brand"><select className={INPUT} style={PANEL} value={draft.brandId} onChange={e => update({ brandId: e.target.value, collection: "", product: "" })}><option value="">Select Brand</option>{data.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Collection / Category"><select className={INPUT} style={PANEL} value={draft.collection} onChange={e => update({ collection: e.target.value, product: "" })}><option value="">Entire Brand</option>{(brand?.collections || []).filter(c => c.name.trim()).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></Field>
          <Field label="Product"><select className={INPUT} style={PANEL} value={draft.product} onChange={e => update({ product: e.target.value })}><option value="">All Products</option>{(collection?.products || []).filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
          <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(30,143,82,.12)", border: "1px solid rgba(57,170,104,.4)" }}><div className="flex gap-2 items-center text-sm font-semibold" style={{ color: "#45AD78" }}><BookOpen size={16}/> Brand Knowledge {brand ? "Available" : "Not Set"}</div><p className="text-xs" style={{ color: "var(--text-2)" }}>{brand ? `${brand.name}: brand voice, audience, guidelines and product information are available on the Brand Information page.` : "Add a profile on the Brand Information page, then select it here."}</p></div>
          <Field label="Campaign Objective"><select className={INPUT} style={PANEL} value={draft.objective} onChange={e => update({ objective: e.target.value })}>{OPT_OBJECTIVES.map(o => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Creative Instructions (optional)"><textarea className={INPUT + " resize-y"} rows={5} style={PANEL} value={draft.brief} onChange={e => update({ brief: e.target.value })} placeholder="Audience, tone, feel, message, visual direction..."/></Field>
          <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}><h3 className="font-semibold flex gap-2 items-center"><Wallet size={16}/> Budget & Distribution</h3>
            <Field label="Budget Source"><select className={INPUT} style={PANEL} value={draft.budgetSource} onChange={e => update({ budgetSource: e.target.value })}><option value="preset">Standard Ad Budget</option><option value="pillars">Pillar Allocations</option><option value="custom">Custom Budget</option></select></Field>
            {draft.budgetSource === "preset" && <Field label="Budget Preset"><select className={INPUT} style={PANEL} value={draft.presetId} onChange={e => update({ presetId: e.target.value })}>{data.presets.map(p => <option key={p.id} value={p.id}>{p.name} — {money(p.amount)} {p.type === "daily" ? "/ day" : "lifetime"}</option>)}</select></Field>}
            {draft.budgetSource === "custom" && <><Field label="Budget Type"><select className={INPUT} style={PANEL} value={draft.budgetType} onChange={e => update({ budgetType: e.target.value })}><option value="daily">Daily Budget</option><option value="lifetime">Lifetime Campaign Budget</option></select></Field><Field label="Amount (₱)"><input type="number" min="0" className={INPUT} style={PANEL} value={draft.amount} onChange={e => update({ amount: e.target.value })}/></Field></>}
            <div className="grid grid-cols-2 gap-2"><Field label="Start Date"><input type="date" className={INPUT} style={PANEL} value={draft.start} onChange={e => update({ start: e.target.value })}/></Field><Field label="End Date"><input type="date" min={draft.start} className={INPUT} style={PANEL} value={draft.end} onChange={e => update({ end: e.target.value })}/></Field></div>
            <div className="grid grid-cols-2 gap-2"><div className="p-3 rounded-xl" style={{ background: "var(--col)" }}><p className="text-[10px]" style={{ color: "var(--muted)" }}>CAMPAIGN TOTAL</p><strong className="text-lg">{money(total)}</strong></div><div className="p-3 rounded-xl" style={{ background: "var(--col)" }}><p className="text-[10px]" style={{ color: "var(--muted)" }}>AVERAGE DAILY</p><strong className="text-lg">{money(total / duration)}</strong></div></div>
            <Field label="Advertising Platform"><select className={INPUT} style={PANEL} value={draft.platform} onChange={e => update({ platform: e.target.value })}>{["TikTok Ads", "Meta Ads", "Google Ads", "Shopee Ads", "Lazada Sponsored Solutions"].map(v => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Ad Account"><input className={INPUT} style={PANEL} value={draft.adAccount} onChange={e => update({ adAccount: e.target.value })}/></Field>
            <Field label="Landing Page URL"><input className={INPUT} style={PANEL} value={draft.landing} onChange={e => update({ landing: e.target.value })}/></Field>
            <Field label="Campaign Status"><select className={INPUT} style={PANEL} value={draft.status} onChange={e => update({ status: e.target.value })}>{["Draft", "Scheduled", "Running", "Paused", "Completed"].map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Actual Spend (₱) — manual"><input type="number" min="0" className={INPUT} style={PANEL} value={draft.spent} onChange={e => update({ spent: e.target.value })}/></Field>
            <div className="text-xs space-y-1" style={{ color: "var(--text-2)" }}><div className="flex justify-between"><span>Spent {money(draft.spent)}</span><span>Remaining {money(Math.max(0, total - Number(draft.spent || 0)))}</span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--col)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, total ? 100 * Number(draft.spent || 0) / total : 0)}%`, background: "#EF7E66" }}/></div></div>
          </div>
          <div className="flex gap-2"><button onClick={() => saveAction("saveCampaign", draft, "Campaign saved.")} disabled={busy || !draft.name.trim()} className="flex-1 px-3 py-2.5 rounded-xl text-white text-sm font-semibold flex gap-2 justify-center items-center" style={{ background: "#E75D48" }}><Save size={16}/> Save Campaign</button><IconButton danger onClick={() => { if (confirm("Delete this campaign?")) { saveAction("deleteCampaign", { id: draft.id }, "Campaign deleted."); setDraft(null); setActiveId(null); } }}><Trash2 size={15}/></IconButton></div>
        </Box>
        <Box className="space-y-3"><div className="flex justify-between items-center gap-2"><h2 className="font-semibold text-sm">Content Pillar Library</h2><button aria-label="Toggle pillar library" onClick={() => setLibraryOpen(!libraryOpen)}>{libraryOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button></div><p className="text-xs" style={{ color: "var(--muted)" }}>Drag pillars into the Creative Board, or click to add.</p>
          {libraryOpen && PILLARS.map(p => <button key={p.id} draggable onDragStart={e => e.dataTransfer.setData("text/plain", JSON.stringify({ type: "pillar", id: p.id }))} onClick={() => addPillar(p.id)} className="w-full text-left rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing" style={{ background: "var(--col)", border: "1px solid var(--border)" }}><div className="flex gap-2 items-center"><GripVertical size={15} style={{ color: "var(--muted)" }}/><Pill color={p.color}>{p.name}</Pill><Plus size={14} className="ml-auto"/></div><p className="text-xs pl-6" style={{ color: "var(--text-2)" }}>{p.focus}</p></button>)}
        </Box>
        <Box className="space-y-3"><div className="flex justify-between gap-2 items-center"><h2 className="font-semibold text-sm">Campaign Creative Board</h2><Pill>{draft.status}</Pill></div>
          <div className="grid grid-cols-2 gap-2">{[["Budget", money(total)], ["Daily Estimate", money(total / duration)], ["Duration", `${duration} days`], ["Platform", draft.platform]].map(([a, b]) => <div key={a} className="p-2 rounded-xl" style={{ background: "var(--col)" }}><p className="text-[10px]" style={{ color: "var(--muted)" }}>{a}</p><strong className="text-xs break-words">{b}</strong></div>)}</div>
          <div className="text-xs flex items-center justify-between" style={{ color: "var(--muted)" }}><span>Pillar Allocation: {money(pillarTotal)}</span><span>{total ? Math.round(pillarTotal / total * 100) : 0}% of budget</span></div>
          {draft.rows.map(r => { const pillar = PILLARS.find(p => p.id === r.pillar); const c = r.concept || blankConcept(pillar); return <div key={r.id} onDragOver={e => e.preventDefault()} onDrop={e => dropped(e, r.id)} className="rounded-xl p-3 space-y-3" style={{ background: "var(--col)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center"><div className="flex gap-2 items-center"><GripVertical size={16} draggable onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData("text/plain", JSON.stringify({ type: "row", id: r.id })); }} className="cursor-grab"/><Pill color={pillar.color}>{pillar.name}</Pill></div><button onClick={() => updateRow(r.id, { open: !r.open })} aria-label="Expand or collapse">{r.open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button></div>
            <button className="text-left w-full" onClick={() => updateRow(r.id, { open: !r.open })}><h3 className="font-semibold text-sm">{c?.title || `${pillar.name} Concept`}</h3><p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{c?.summary || pillar.focus}</p><div className="mt-2 flex gap-1 flex-wrap"><Pill>{c?.duration || pillar.seconds}s Video</Pill><Pill>{c?.format || "TikTok / Reels"}</Pill><Pill>{money(r.budget)}</Pill></div></button>
            <div className="flex gap-2 flex-wrap"><IconButton onClick={() => updateRow(r.id, { open: !r.open })}><Pencil size={14}/> Edit</IconButton><IconButton onClick={() => duplicateRow(r)}><Copy size={14}/> Duplicate</IconButton><IconButton danger onClick={() => update({ rows: draft.rows.filter(x => x.id !== r.id) })}><Trash2 size={14}/></IconButton></div>
            {r.open && <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
              <Field label="Pillar Budget Allocation (₱)"><input type="number" min="0" value={r.budget} onChange={e => updateRow(r.id, { budget: e.target.value })} className={INPUT} style={PANEL}/></Field>
              <Field label="Creative Direction Notes (optional)"><textarea rows={3} value={r.prompt || ""} onChange={e => updateRow(r.id, { prompt: e.target.value })} className={INPUT + " resize-y"} style={PANEL} placeholder="Audience, tone, mood, key angle, camera style..."/></Field>
              <Field label="Content Title"><input className={INPUT} style={PANEL} value={c.title || ""} onChange={e => updateRow(r.id, { concept: { ...c, title: e.target.value } })}/></Field>
              <Field label="Content Summary"><textarea className={INPUT} style={PANEL} rows={2} value={c.summary || ""} onChange={e => updateRow(r.id, { concept: { ...c, summary: e.target.value } })}/></Field>
              <div className="grid grid-cols-2 gap-2"><Field label="Video Duration (seconds)"><input type="number" min="1" className={INPUT} style={PANEL} value={c.duration || ""} onChange={e => updateRow(r.id, { concept: { ...c, duration: e.target.value } })}/></Field><Field label="Format / Platform"><input className={INPUT} style={PANEL} value={c.format || ""} onChange={e => updateRow(r.id, { concept: { ...c, format: e.target.value } })}/></Field></div>
              {[["Creative Angle", "angle"], ["Opening Hook", "hook"], ["Script / Voiceover", "voiceover"], ["CTA", "cta"]].map(([label, key]) => <Field key={key} label={label}><textarea className={INPUT} style={PANEL} rows={2} value={c[key] || ""} onChange={e => updateRow(r.id, { concept: { ...c, [key]: e.target.value } })}/></Field>)}
              <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Video Guide / Scene-by-Scene Outline</h4><IconButton onClick={() => updateRow(r.id, { concept: { ...c, scenes: [...(c.scenes || []), { start: "", end: "", label: "", visual: "", camera: "" }] } })}><Plus size={14}/> Add Scene</IconButton></div>
              {(c.scenes || []).length === 0 && <p className="text-xs" style={{ color: "var(--muted)" }}>No scenes yet. Add scenes to create your video outline.</p>}
              <div className="space-y-2">{(c.scenes || []).map((s, i) => <div key={i} className="p-2.5 rounded-xl text-xs space-y-2" style={PANEL}><div className="flex items-center justify-between"><span className="font-semibold">Scene {i + 1}</span><IconButton danger onClick={() => updateRow(r.id, { concept: { ...c, scenes: c.scenes.filter((_, j) => j !== i) } })}><Trash2 size={14}/></IconButton></div><div className="grid grid-cols-2 gap-2"><Field label="Start (sec)"><input className={INPUT} style={PANEL} value={s.start || ""} onChange={e => updateRow(r.id, { concept: { ...c, scenes: c.scenes.map((scene, j) => i === j ? { ...scene, start: e.target.value } : scene) } })}/></Field><Field label="End (sec)"><input className={INPUT} style={PANEL} value={s.end || ""} onChange={e => updateRow(r.id, { concept: { ...c, scenes: c.scenes.map((scene, j) => i === j ? { ...scene, end: e.target.value } : scene) } })}/></Field></div><Field label="Scene Label"><input className={INPUT} style={PANEL} value={s.label || ""} onChange={e => updateRow(r.id, { concept: { ...c, scenes: c.scenes.map((scene, j) => i === j ? { ...scene, label: e.target.value } : scene) } })}/></Field><Field label="Visual / Action"><textarea aria-label={`Scene ${i + 1} visual`} className={INPUT} style={PANEL} rows={2} value={s.visual || ""} onChange={e => updateRow(r.id, { concept: { ...c, scenes: c.scenes.map((scene, j) => i === j ? { ...scene, visual: e.target.value } : scene) } })}/></Field><Field label="Camera / Transition"><input aria-label={`Scene ${i + 1} camera direction`} className={INPUT} style={PANEL} value={s.camera || ""} onChange={e => updateRow(r.id, { concept: { ...c, scenes: c.scenes.map((scene, j) => i === j ? { ...scene, camera: e.target.value } : scene) } })}/></Field></div>)}</div>
            </div>}
          </div>; })}
          <div className="rounded-xl p-6 text-center text-sm" style={{ border: "1px dashed var(--muted)", color: "var(--muted)" }} onDragOver={e => e.preventDefault()} onDrop={e => dropped(e)}><Plus size={20} className="mx-auto mb-2"/> Drag another content pillar here</div>
        </Box>
      </div> : <Box className="text-sm" ><span style={{ color: "var(--muted)" }}>Select a campaign above or click New Ad.</span></Box>}
    </>}
    {tab === "pillars" && <Box className="space-y-4 max-w-3xl"><h2 className="text-lg font-semibold">Content Pillar Budget Settings</h2><p className="text-sm" style={{ color: "var(--muted)" }}>Default allocation per new content row. Campaign-specific changes do not change these defaults.</p>{PILLARS.map(p => <div className="flex gap-2 items-center justify-between" key={p.id}><Pill color={p.color}>{p.name}</Pill><input aria-label={`${p.name} default budget`} type="number" min="0" className={INPUT + " max-w-36"} style={PANEL} value={pillarValues[p.id] ?? 0} onChange={e => setPillarValues(v => ({ ...v, [p.id]: e.target.value }))}/></div>)}<button onClick={() => saveAction("savePillarBudgets", pillarValues, "Pillar budgets saved.")} disabled={busy} className="rounded-xl px-4 py-2 text-white text-sm" style={{ background: "#E7614C" }}><Save size={15} className="inline mr-2"/> Save Defaults</button></Box>}
    {tab === "presets" && <Box className="space-y-4 max-w-3xl"><h2 className="text-lg font-semibold">Standard Ad Budget Settings</h2><p className="text-sm" style={{ color: "var(--muted)" }}>Reusable budgets, separate from content pillar allocation. Set either a Daily Budget or a Lifetime Campaign Budget.</p>{presetValues.map(p => <div key={p.id} className="grid sm:grid-cols-[1fr_130px_140px_auto] gap-2 items-end rounded-xl p-3" style={{ background: "var(--col)" }}><Field label="Preset Name"><input className={INPUT} style={PANEL} value={p.name} onChange={e => setPresetValues(a => a.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}/></Field><Field label="Budget Type"><select className={INPUT} style={PANEL} value={p.type} onChange={e => setPresetValues(a => a.map(x => x.id === p.id ? { ...x, type: e.target.value } : x))}><option value="daily">Daily</option><option value="lifetime">Lifetime</option></select></Field><Field label="Amount (₱)"><input type="number" min="0" className={INPUT} style={PANEL} value={p.amount} onChange={e => setPresetValues(a => a.map(x => x.id === p.id ? { ...x, amount: e.target.value } : x))}/></Field><IconButton danger onClick={() => setPresetValues(a => a.filter(x => x.id !== p.id))}><Trash2 size={16}/></IconButton></div>)}<div className="flex flex-wrap gap-2"><IconButton onClick={() => setPresetValues(a => [...a, { id: crypto.randomUUID(), name: "New Preset", type: "daily", amount: 1000 }])}><Plus size={15}/> Add Preset</IconButton><button disabled={busy} onClick={() => saveAction("savePresets", presetValues.map(p => ({ ...p, amount: Math.max(0, Number(p.amount) || 0) })), "Standard Ad Budgets saved.")} className="rounded-xl px-4 py-2 text-white text-sm flex gap-2 items-center" style={{ background: "#E7614C" }}><Save size={15}/> Save Presets</button></div></Box>}
    {message && <div role="status" className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--col)", color: "var(--text-2)" }}>{message}</div>}
  </main>;
