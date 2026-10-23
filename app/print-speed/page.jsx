"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { upload as uploadToBlob } from "@vercel/blob/client";
import {
  Printer, Search, Plus, X, Pencil, Trash2, Image as ImageIcon,
  SlidersHorizontal, Layers, Folder, Gauge,
} from "lucide-react";

const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";

const MODES = ["Cylinder", "Flat"];
const MODE_META = {
  Cylinder: { c: "#F0784B", s: "#FCE7DD" },
  Flat: { c: "#3E8ED0", s: "#E3EEF9" },
};
const INK_LAYERS = {
  Primer:  { c: "#E0A93C", s: "#FAEFD6" },
  White:   { c: "#6A7382", s: "#E9ECF1" },
  CMYK:    { c: "#7C5CD8", s: "#EBE4FA" },
  Varnish: { c: "#3E8ED0", s: "#E3EEF9" },
};
const COLOR_CHOICES = {
  Black: { c: "#2B2630", s: "#E6E3EA", n: 1 },
  White: { c: "#6A7382", s: "#E9ECF1", n: 1 },
  CMYK:  { c: "#7C5CD8", s: "#EBE4FA", n: 4 },
};
const SWATCHES = ["#7C6FF0", "#3E8ED0", "#3FA37A", "#E0A93C", "#F0784B", "#E5536E", "#2E9B8F", "#8E8A96"];
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const swatchFor = (name) => SWATCHES[hash(String(name || "x")) % SWATCHES.length];

const STATUS_HINT = {
  "Not started": "#8E8A96", "Sample done": "#E0A93C", Approved: "#3FA37A",
  Printed: "#2E9B8F", "In production": "#3E8ED0", "On hold": "#E5536E",
};
const statusColor = (name) => STATUS_HINT[name] || swatchFor(name);
const methodColor = (name) => (name === "Direct Print" ? "#7C5CD8" : name === "Sticker Print" ? "#3FA37A" : swatchFor(name));
const tint = (hex) => `${hex}22`;

const GROUPS = {
  brand: (r) => r.brand,
  mode: (r) => r.mode,
  method: (r) => r.method,
  status: (r) => r.status,
  nothing: () => "All records",
};

const minsFor = (r) => (r.rec ? r[r.rec] : null);
const perHour = (r) => { const m = minsFor(r); return m ? Math.round((60 / m) * 10) / 10 : null; };
const per100 = (r) => { const p = perHour(r); return p ? Math.round((100 / p) * 10) / 10 : null; };
const colorCount = (r) => (r.colors || []).reduce((t, c) => t + (COLOR_CHOICES[c]?.n || 1), 0);
const inkText = (r) => (Array.isArray(r.ink) && r.ink.length ? r.ink.join(" + ") : null);

const blankRecord = (lists) => ({
  id: null, brand: lists.brands[0] || "", mode: "Cylinder", img: null,
  name: "", sku: "", variant: "", h: null, w: null, base: null, ml: null,
  design: "", layout: null, method: lists.methods[0] || "",
  paw: null, pah: null, colors: [], ink: [],
  slow: null, med: null, fast: null, rec: null,
  status: lists.statuses[0] || "", remarks: "",
});

export default function PrintSpeedPage() {
  const [records, setRecords] = useState([]);
  const [lists, setLists] = useState({ brands: [], methods: [], statuses: [], layouts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);

  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("brand");

  const etagRef = useRef(null);

  const apply = useCallback(async (response, fallback) => {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || fallback);
    }
    const body = await response.json();
    const etag = response.headers.get("etag");
    if (etag) etagRef.current = etag;
    setRecords(Array.isArray(body.records) ? body.records : []);
    if (body.lists) setLists(body.lists);
    setError("");
    return body;
  }, []);

  const load = useCallback(async ({ force = false } = {}) => {
    try {
      const headers = {};
      if (!force && etagRef.current) headers["If-None-Match"] = etagRef.current;
      const response = await fetch("/api/print-speed", { headers, cache: "no-store" });
      if (response.status === 304) return;
      await apply(response, "Unable to load print speed records.");
    } catch (e) {
      setError(e.message || "Unable to load print speed records.");
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => { load({ force: true }); }, [load]);

  const layoutsFor = useCallback(
    (mode) => (lists.layouts || []).filter((l) => l.modes.includes(mode)),
    [lists.layouts]
  );
  const layoutNote = useCallback(
    (name) => (lists.layouts || []).find((l) => l.name === name)?.note || "",
    [lists.layouts]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (brandFilter !== "all" && r.brand !== brandFilter) return false;
      if (modeFilter !== "all" && r.mode !== modeFilter) return false;
      if (methodFilter !== "all" && r.method !== methodFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.sku, r.design, r.variant, r.method, r.layout, inkText(r)]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [records, query, brandFilter, modeFilter, methodFilter, statusFilter]);

  const lanes = useMemo(() => {
    const keyOf = GROUPS[groupBy] || GROUPS.brand;
    const map = new Map();
    filtered.forEach((r) => {
      const k = keyOf(r) || "Unassigned";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return [...map.entries()];
  }, [filtered, groupBy]);

  const stats = useMemo(() => {
    const rates = records.map(perHour).filter(Boolean);
    return {
      count: records.length,
      rate: rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10 : "—",
      brands: new Set(records.map((r) => r.brand)).size,
      timed: records.filter((r) => r.slow != null || r.med != null || r.fast != null).length,
    };
  }, [records]);

  const brandCounts = useMemo(() => {
    const counts = {};
    records.forEach((r) => { counts[r.brand] = (counts[r.brand] || 0) + 1; });
    return counts;
  }, [records]);

  // Light the tile straight away, then confirm with the server. If the save
  // fails the previous setting comes back and the reason is shown.
  const setSpeed = async (record, key) => {
    if (record[key] == null) return;
    const next = record.rec === key ? null : key;
    const previous = record.rec;

    setRecords((rows) => rows.map((r) => (r.id === record.id ? { ...r, rec: next } : r)));
    setError("");

    try {
      const response = await fetch("/api/print-speed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, data: { rec: next } }),
      });
      if (response.status === 401) throw new Error("Your session expired. Reload the page and sign in again.");
      await apply(response, "Unable to save the speed setting.");
    } catch (e) {
      console.error("print-speed set recommended", e);
      setRecords((rows) => rows.map((r) => (r.id === record.id ? { ...r, rec: previous } : r)));
      setError(e?.message || "Unable to save the speed setting.");
    }
  };

  const openCreate = () => setModal({ mode: "create", form: blankRecord(lists) });
  const openEdit = (r) => setModal({ mode: "edit", form: { ...r, colors: [...(r.colors || [])], ink: [...(r.ink || [])] } });

  // Returns an error string on failure so the sheet can show it in place;
  // returns null when the save went through.
  const saveModal = async (form) => {
    setSaving(true);
    setError("");
    const FIELDS = [
      "brand", "mode", "img", "name", "sku", "variant", "h", "w", "base", "ml",
      "design", "layout", "method", "paw", "pah", "colors", "ink",
      "slow", "med", "fast", "rec", "status", "remarks",
    ];
    const data = {};
    FIELDS.forEach((k) => { data[k] = form[k] ?? null; });
    data.colors = Array.isArray(form.colors) ? form.colors : [];
    data.ink = Array.isArray(form.ink) ? form.ink : [];

    try {
      const response = await fetch("/api/print-speed", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.id ? { id: form.id, data } : { data }),
      });
      if (response.status === 401) throw new Error("Your session expired. Reload the page and sign in again.");
      await apply(response, "Unable to save the record.");
      setModal(null);
      // Belt and braces: pull a fresh copy so a stale ETag can never leave the
      // board showing the pre-edit version.
      load({ force: true });
      return null;
    } catch (e) {
      console.error("print-speed save", e);
      const message = e?.message || "Unable to save the record.";
      setError(message);
      return message;
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (id) => {
    if (!window.confirm("Delete this record permanently?")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/print-speed", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await apply(response, "Unable to delete the record.");
      setModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const listAction = async (method, body, fallback) => {
    const response = await fetch("/api/print-speed/lists", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    await apply(response, fallback);
  };

  return (
    <main id="ps-root" className="flex-1 min-w-0 flex flex-col overflow-y-auto">
      <style>{PAGE_CSS}</style>

      <header className="flex items-center gap-3 px-4 sm:px-7 pt-6 pb-4 shrink-0 flex-wrap">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>Print Speed</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            How long one piece takes at each machine setting, per product and design
          </p>
          {error && <p className="text-xs mt-1" style={{ color: "#E5536E" }}>{error}</p>}
        </div>
        <div className="ps-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, SKU, design" />
        </div>
        <button onClick={openCreate} className="ps-btn primary">
          <Plus size={16} /> New record
        </button>
      </header>

      <div className="px-4 sm:px-7 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Stat icon={Printer} tint="#F26A3C" soft="#FCE3D6" label="Records" value={stats.count} note="product and design pairs" />
        <Stat icon={Gauge} tint="#3FA37A" soft="#DEF1E7" label="Avg output" value={stats.rate} note="pcs per hour, recommended" />
        <Stat icon={Folder} tint="#7C5CD8" soft="#EBE4FA" label="Brands" value={stats.brands} note="covered so far" />
        <Stat icon={Layers} tint="#3E8ED0" soft="#E3EEF9" label="Timed" value={stats.timed} note="have speed data" />
      </div>

      <div className="px-4 sm:px-7 pb-4 shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip on={brandFilter === "all"} onClick={() => setBrandFilter("all")} label="All brands" count={records.length} />
          {lists.brands.filter((b) => brandCounts[b]).map((b) => (
            <Chip key={b} on={brandFilter === b} onClick={() => setBrandFilter(b)} label={b} count={brandCounts[b]} dot={swatchFor(b)} />
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={modeFilter} onChange={setModeFilter} all="All modes" options={MODES} />
          <Select value={methodFilter} onChange={setMethodFilter} all="All methods" options={lists.methods} />
          <Select value={statusFilter} onChange={setStatusFilter} all="All statuses" options={lists.statuses} />
          <select className="ps-select" style={{ marginLeft: "auto" }} value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}>
            {Object.keys(GROUPS).map((g) => <option key={g} value={g}>Group by {g}</option>)}
          </select>
        </div>
      </div>

      <div className="px-4 sm:px-7 pb-8">
        {loading ? (
          <Empty text="Loading records…" />
        ) : !records.length ? (
          <Empty text="No print speed records yet. Add the first one with New record." />
        ) : !filtered.length ? (
          <Empty text="No records match these filters." />
        ) : (
          lanes.map(([name, items]) => (
            <section key={name} className="ps-lane">
              <div className="ps-lane-head">
                <h2>{name}</h2>
                <span className="n">{items.length}</span>
                {items.length > 3 && <span className="more">scroll sideways for {items.length - 3} more</span>}
              </div>
              <div className="ps-grid">
                {items.map((r) => (
                  <Card key={r.id} r={r} onEdit={() => openEdit(r)} onSpeed={(k) => setSpeed(r, k)} layoutNote={layoutNote} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {modal && (
        <EditSheet
          key={modal.form.id || "new"}
          initial={modal.form}
          lists={lists}
          layoutsFor={layoutsFor}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={saveModal}
          onDelete={modal.form.id ? () => removeRecord(modal.form.id) : null}
          onListAction={listAction}
        />
      )}
    </main>
  );
}

/* ---------------- card ---------------- */

function Card({ r, onEdit, onSpeed, layoutNote }) {
  const md = MODE_META[r.mode] || MODE_META.Cylinder;
  const sc = statusColor(r.status);
  const mc = methodColor(r.method);
  const bc = swatchFor(r.brand);
  const ph = perHour(r);
  const h100 = per100(r);

  const cell = (k, v, unit, span) => (
    <div className={`cell${span ? " span2" : ""}`} key={k}>
      <div className="k">{k}</div>
      <div className={`v${v == null ? " none" : ""}`}>{v == null ? "Not set" : <>{v}{unit && <span>{unit}</span>}</>}</div>
    </div>
  );

  const speed = (key, label) => (
    <button key={key} type="button" onClick={() => onSpeed(key)}
      className={`sp${r.rec === key ? " on" : ""}${r[key] == null ? " empty" : ""}`}>
      <div className="k">{label}</div>
      <div className="v">{r[key] == null ? "—" : r[key]}</div>
      <div className="u">min / pc</div>
    </button>
  );

  return (
    <article className="ps-rec">
      <div className="rec-top">
        <div className="t">
          <span className="mode" style={{ background: md.s, color: md.c }}>{r.mode}</span>
          <div className="brandline" style={{ color: bc }}>{r.brand}</div>
          <h3>{r.name || r.sku || "Untitled product"}</h3>
          <div className="sub">
            {r.name && r.sku && <code>{r.sku}</code>}
            {r.variant && <span>{r.variant}</span>}
          </div>
        </div>
        <button className="iconbtn" onClick={onEdit} title="Edit this record" aria-label="Edit this record">
          <Pencil size={14} />
        </button>
      </div>

      <div className="design">
        <span className="nm">{r.design}</span>
        <span className="dot" />
        <span className="pill" style={{ background: tint(mc), color: mc }}>{r.method}</span>
        <span className="pill" style={{ marginLeft: "auto", background: tint(sc), color: sc }}>{r.status}</span>
      </div>

      {r.img ? (
        <div className="shot"><img src={r.img} alt={r.design} /></div>
      ) : (
        <button className="shot empty" onClick={onEdit} title="Add an image">
          <ImageIcon size={22} /><span>Add image</span>
        </button>
      )}

      <div className="speeds">{speed("slow", "Slow")}{speed("med", "Medium")}{speed("fast", "Fast")}</div>

      <div className="out">
        <div><div className="k">Per hour</div><div className="v">{ph == null ? "—" : `${ph} pcs`}</div></div>
        <div><div className="k">Per 100 pcs</div><div className="v">{h100 == null ? "—" : `${h100} hrs`}</div></div>
      </div>

      <div className="specs">
        <div className="row">
          {cell("Height", r.h, "mm")}{cell("Width", r.w, "mm")}
          {cell("Base", r.base, "mm")}{cell("Capacity", r.ml, "ml")}
        </div>
        <div className="row">
          <div className="cell span2 group">
            <div className="k">Print area</div>
            <div className="pair">
              <div><div className="sk">Width</div>
                <div className={`v${r.paw == null ? " none" : ""}`}>{r.paw == null ? "Not set" : <>{r.paw}<span>mm</span></>}</div>
              </div>
              <div><div className="sk">Height</div>
                <div className={`v${r.pah == null ? " none" : ""}`}>{r.pah == null ? "Not set" : <>{r.pah}<span>mm</span></>}</div>
              </div>
            </div>
          </div>
          <div className="cell span2">
            <div className="k">Colors</div>
            {r.colors?.length ? (
              <div className="inkrow">
                {r.colors.map((c) => {
                  const m = COLOR_CHOICES[c] || COLOR_CHOICES.Black;
                  return <span key={c} className="layer" style={{ background: m.s, color: m.c }}>{c}</span>;
                })}
                <span className="cnt">{colorCount(r)} total</span>
              </div>
            ) : <div className="v none">Not set</div>}
          </div>
        </div>
        <div className="row one">
          <div className="cell">
            <div className="k">Print coverage</div>
            {r.layout ? (
              <div className="v wrap">{r.layout}<span className="lnote">{layoutNote(r.layout)}</span></div>
            ) : <div className="v none">Not set</div>}
          </div>
        </div>
        <div className="row one">
          <div className="cell">
            <div className="k">Ink build</div>
            {inkText(r) ? (
              <div className="inkrow">
                {r.ink.map((l, i) => {
                  const m = INK_LAYERS[l] || INK_LAYERS.CMYK;
                  return (
                    <React.Fragment key={`${l}-${i}`}>
                      {i > 0 && <span className="plus">+</span>}
                      <span className="layer" style={{ background: m.s, color: m.c }}>{l}</span>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : <div className="v none">Not set</div>}
          </div>
        </div>
      </div>

      {r.remarks && <div className="rem">{r.remarks}</div>}
    </article>
  );
}

/* ---------------- edit sheet ---------------- */

function EditSheet({ initial, lists, layoutsFor, saving, onClose, onSave, onDelete, onListAction }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [openList, setOpenList] = useState(null);
  const [listError, setListError] = useState("");
  const [imgError, setImgError] = useState("");
  const [saveError, setSaveError] = useState("");
  const fileRef = useRef(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const numOrNull = (v) => (v === "" ? null : Number(v));

  const coverage = layoutsFor(form.mode);
  useEffect(() => {
    if (form.layout && !coverage.some((l) => l.name === form.layout)) set({ layout: null });
  }, [form.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Centre-crop to a square, resize, then upload straight to Blob storage.
  const pickImage = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error("Could not read that file."));
        fr.readAsDataURL(file);
      });
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("That file is not an image."));
        im.src = dataUrl;
      });
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = 800; canvas.height = 800;
      canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 800, 800);
      const blob = await new Promise((res, rej) => {
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not process that image."))), "image/jpeg", 0.85);
      });

      // Same route and access mode as task attachments, served back through
      // the /api/attachments proxy that streams the private blob.
      const pathname = `sdc/print-speed/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const uploaded = await uploadToBlob(pathname, new File([blob], "photo.jpg", { type: "image/jpeg" }), {
        access: "private",
        handleUploadUrl: "/api/upload-token",
        contentType: "image/jpeg",
      });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      set({ img: `${origin}/api/attachments/${uploaded.pathname}` });
      setImgError("");
    } catch (e) {
      console.error("print-speed image upload", e);
      setImgError(e?.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runList = async (fn) => {
    setListError("");
    try { await fn(); } catch (e) { setListError(e.message || "That change was not saved."); }
  };

  const managed = (label, key, listName, options, wide) => (
    <div className={`f managed${wide ? " wide" : ""}`}>
      <label>{label}</label>
      <div className="row1">
        <select className="ps-select" value={form[key] ?? ""} onChange={(e) => set({ [key]: e.target.value || null })}>
          {key === "layout" && <option value="">Not set</option>}
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <button type="button" className={`gear${openList === listName ? " on" : ""}`}
          onClick={() => setOpenList(openList === listName ? null : listName)}
          title="Manage these options" aria-label="Manage these options">
          <SlidersHorizontal size={15} />
        </button>
      </div>
      {openList === listName && (
        <ListManager
          list={listName}
          options={options}
          mode={form.mode}
          error={listError}
          notes={listName === "layouts" ? Object.fromEntries(layoutsFor(form.mode).map((l) => [l.name, l.note || ""])) : null}
          onAdd={(name) => runList(() => onListAction("POST", { list: listName, name, mode: form.mode }, "Unable to add that option."))}
          onRename={(name, newName) => runList(() => onListAction("PATCH", { list: listName, name, newName }, "Unable to rename that option."))}
          onNote={(name, note) => runList(() => onListAction("PATCH", { list: listName, name, note }, "Unable to save that description."))}
          onRemove={(name) => runList(() => onListAction("DELETE", { list: listName, name }, "Unable to remove that option."))}
        />
      )}
    </div>
  );

  return (
    <div className="ps-scrim" onClick={(e) => { if (e.target.classList.contains("ps-scrim")) onClose(); }}>
      <div className="ps-sheet">
        <h2>{form.id ? "Edit record" : "New record"}</h2>
        <p className="cap">{[form.name || form.sku, form.design].filter(Boolean).join(" · ") || "Fill in what you know, the rest can wait"}</p>

        <div className="fgrid">
          {managed("Brand", "brand", "brands", lists.brands)}
          <div className="f">
            <label>Print mode</label>
            <select className="ps-select" value={form.mode} onChange={(e) => set({ mode: e.target.value })}>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          {managed("Status", "status", "statuses", lists.statuses)}
          <div className="f" />
          <div className="f wide"><label>Product name</label>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="f"><label>SKU</label>
            <input value={form.sku} onChange={(e) => set({ sku: e.target.value })} /></div>
          <div className="f"><label>Color / variant</label>
            <input value={form.variant} onChange={(e) => set({ variant: e.target.value })} /></div>

          <div className="seph">Image</div>
          <div className="f imgfield">
            <div className="prev">{form.img ? <img src={form.img} alt="" /> : "No image"}</div>
            <div className="side">
              <div className="btnrow">
                <button type="button" className="ps-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                  {busy ? "Uploading…" : form.img ? "Replace image" : "Choose image"}
                </button>
                <button type="button" className="ps-btn" disabled={busy || !form.img}
                  onClick={() => { set({ img: null }); setImgError(""); }}>Remove</button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => pickImage(e.target.files?.[0])} />
              {imgError
                ? <div className="hint" style={{ color: "#E5536E" }}>{imgError}</div>
                : <div className="hint">Cropped to a square from the centre and resized to 800 × 800.</div>}
            </div>
          </div>

          <div className="seph">Measurements</div>
          {[["Height (mm)", "h"], ["Dia. / width (mm)", "w"], ["Base dia. (mm)", "base"], ["Capacity (ml)", "ml"]].map(([l, k]) => (
            <div className="f" key={k}><label>{l}</label>
              <input type="number" value={form[k] ?? ""} onChange={(e) => set({ [k]: numOrNull(e.target.value) })} /></div>
          ))}

          <div className="seph">Print</div>
          <div className="f wide"><label>Print design</label>
            <input value={form.design} onChange={(e) => set({ design: e.target.value })} /></div>
          {managed("Print coverage", "layout", "layouts", coverage.map((l) => l.name), true)}
          {managed("Print method", "method", "methods", lists.methods)}
          <div className="f"><label>Print area W (mm)</label>
            <input type="number" value={form.paw ?? ""} onChange={(e) => set({ paw: numOrNull(e.target.value) })} /></div>
          <div className="f"><label>Print area H (mm)</label>
            <input type="number" value={form.pah ?? ""} onChange={(e) => set({ pah: numOrNull(e.target.value) })} /></div>
          <div className="f wide">
            <label>Colors</label>
            <div className="addrow">
              {Object.entries(COLOR_CHOICES).map(([c, m]) => {
                const on = form.colors.includes(c);
                return (
                  <button type="button" key={c} className="addbtn"
                    style={on ? { background: m.s, color: m.c, borderColor: "transparent" } : { background: "var(--card)", color: "var(--muted)" }}
                    onClick={() => set({ colors: on ? form.colors.filter((x) => x !== c) : [...form.colors, c] })}>
                    {on ? "✓ " : "+ "}{c}{m.n > 1 && <span style={{ opacity: 0.7 }}> ({m.n})</span>}
                  </button>
                );
              })}
              <span className="cnt" style={{ alignSelf: "center", marginLeft: 4 }}>{colorCount(form)} total</span>
            </div>
          </div>

          <div className="f wide inkbuild">
            <label>Ink build</label>
            <div className="seq">
              {form.ink.length ? form.ink.map((l, i) => {
                const m = INK_LAYERS[l] || INK_LAYERS.CMYK;
                return (
                  <React.Fragment key={`${l}-${i}`}>
                    {i > 0 && <span className="plus">+</span>}
                    <span className="layer" style={{ background: m.s, color: m.c }}
                      onClick={() => set({ ink: form.ink.filter((_, idx) => idx !== i) })}
                      title="Remove this layer">{l}<span className="x">×</span></span>
                  </React.Fragment>
                );
              }) : <span className="ph">Tap a layer below to build the sequence</span>}
            </div>
            <div className="addrow">
              {Object.entries(INK_LAYERS).map(([l, m]) => (
                <button type="button" key={l} className="addbtn"
                  style={{ background: m.s, color: m.c, borderColor: "transparent" }}
                  onClick={() => set({ ink: [...form.ink, l] })}>+ {l}</button>
              ))}
              <button type="button" className="addbtn ghost" onClick={() => set({ ink: form.ink.slice(0, -1) })}>Undo</button>
              <button type="button" className="addbtn ghost" onClick={() => set({ ink: [] })}>Clear</button>
            </div>
          </div>

          <div className="seph">Minutes per piece</div>
          {[["Slow", "slow"], ["Medium", "med"], ["Fast", "fast"]].map(([l, k]) => (
            <div className="f" key={k}><label>{l}</label>
              <input type="number" step="0.1" value={form[k] ?? ""} onChange={(e) => set({ [k]: numOrNull(e.target.value) })} /></div>
          ))}
          <div className="f"><label>Recommended</label>
            <select className="ps-select" value={form.rec ?? ""} onChange={(e) => set({ rec: e.target.value || null })}>
              <option value="">Not set</option>
              <option value="slow">Slow</option>
              <option value="med">Medium</option>
              <option value="fast">Fast</option>
            </select>
          </div>

          <div className="seph">Remarks</div>
          <div className="f wide">
            <textarea value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} />
          </div>
        </div>

        <div className="sheet-foot">
          <button type="button" className="ps-btn primary" disabled={saving || busy}
            onClick={async () => {
              setSaveError("");
              const failure = await onSave(form);
              if (failure) setSaveError(failure);
            }}>
            {saving ? "Saving…" : form.id ? "Save changes" : "Add record"}
          </button>
          <button type="button" className="ps-btn" onClick={onClose}>Cancel</button>
          {onDelete && (
            <span style={{ marginLeft: "auto" }}>
              <button type="button" className="ps-btn" style={{ color: "#E5536E" }} onClick={onDelete}>Delete</button>
            </span>
          )}
        </div>
        {saveError && <p className="savefail">{saveError}</p>}
      </div>
    </div>
  );
}

function ListManager({ options, mode, list, error, notes, onAdd, onRename, onNote, onRemove }) {
  const [draft, setDraft] = useState("");
  const commitOnEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } };

  return (
    <div className="mgr open">
      {options.map((name) => (
        <div className={`opt${notes ? " withnote" : ""}`} key={name}>
          <div className="fields">
            <input defaultValue={name} onKeyDown={commitOnEnter}
              onBlur={(e) => {
                const now = e.target.value.trim();
                if (!now || now === name) { e.target.value = name; return; }
                onRename(name, now);
              }} />
            {notes && (
              <input className="note" defaultValue={notes[name] || ""} placeholder="Short description"
                onKeyDown={commitOnEnter}
                onBlur={(e) => {
                  const now = e.target.value.trim();
                  if (now === (notes[name] || "")) return;
                  onNote(name, now);
                }} />
            )}
          </div>
          <button type="button" onClick={() => onRemove(name)} title="Remove">×</button>
        </div>
      ))}
      <div className="add">
        <input value={draft} placeholder={list === "layouts" ? `New ${mode.toLowerCase()} option` : "New option"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) { onAdd(draft.trim()); setDraft(""); } } }} />
        <button type="button" onClick={() => { if (draft.trim()) { onAdd(draft.trim()); setDraft(""); } }}>Add</button>
      </div>
      <div className="hintline">
        {error || (notes
          ? "The second line is the description shown on the card. Renaming updates every record using that option."
          : "Renaming updates every record using that option. An option in use cannot be removed.")}
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function Stat({ icon: Icon, tint: t, soft, label, value, note }) {
  return (
    <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: soft }}>
          <Icon size={16} style={{ color: t }} />
        </span>
        <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>{label}</span>
      </div>
      <div className="text-3xl font-semibold" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{note}</div>
    </div>
  );
}

function Chip({ on, onClick, label, count, dot }) {
  return (
    <button onClick={onClick} className={`ps-chip${on ? " on" : ""}`}>
      {dot && !on && <span style={{ height: 7, width: 7, borderRadius: 999, background: dot }} />}
      {label}<span className="n">{count}</span>
    </button>
  );
}

function Select({ value, onChange, all, options }) {
  return (
    <select className="ps-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">{all}</option>
      {(options || []).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Empty({ text }) {
  return (
    <div className="rounded-2xl py-16 text-center shadow-sm"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}>
      <Printer size={28} className="mx-auto mb-3" style={{ opacity: 0.5 }} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

/* ---------------- page styles ----------------
   Scoped under #ps-root so nothing leaks into the rest of the app. */

const CHEVRON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238C8398' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

const PAGE_CSS = `
#ps-root{--r-card:18px;--r-block:12px;--r-field:12px}

#ps-root .ps-btn{border:1px solid var(--border);background:var(--card);color:var(--text-2);
  border-radius:999px;padding:8px 14px;font-size:13px;font-weight:500;line-height:1.4;
  cursor:pointer;display:inline-flex;align-items:center;gap:7px}
#ps-root .ps-btn:hover{background:var(--dim);color:var(--text)}
#ps-root .ps-btn:disabled{opacity:.6;cursor:not-allowed}
#ps-root .ps-btn.primary{background:${ACCENT_GRAD};color:var(--on-accent);border:none;font-weight:600;
  box-shadow:0 2px 10px rgba(229,62,48,.25)}

#ps-root .ps-search{position:relative;display:flex;align-items:center}
#ps-root .ps-search svg{position:absolute;left:12px;color:var(--muted)}
#ps-root .ps-search input{background:var(--card);border:1px solid var(--border);color:var(--text);
  border-radius:999px;padding:8px 14px 8px 34px;font-size:13px;width:230px;line-height:1.4;outline:none}

#ps-root .ps-chip{border:1px solid var(--border);background:var(--card);color:var(--text-2);
  border-radius:999px;padding:8px 14px;font-size:13px;font-weight:500;line-height:1.4;
  cursor:pointer;display:inline-flex;align-items:center;gap:7px}
#ps-root .ps-chip:hover{background:var(--dim)}
#ps-root .ps-chip.on{background:${ACCENT_GRAD};color:var(--on-accent);border-color:transparent;font-weight:600}
#ps-root .ps-chip .n{font-size:11.5px;opacity:.72;font-weight:600}

#ps-root .ps-select{background-color:var(--card);border:1px solid var(--border);color:var(--text);
  border-radius:999px;padding:8px 36px 8px 14px;font-size:13px;line-height:1.4;outline:none;cursor:pointer;
  -webkit-appearance:none;-moz-appearance:none;appearance:none;
  background-image:${CHEVRON};background-repeat:no-repeat;background-position:right 14px center}

#ps-root .ps-lane{margin-bottom:22px}
#ps-root .ps-lane-head{display:flex;align-items:center;gap:9px;margin-bottom:9px;padding:0 2px}
#ps-root .ps-lane-head h2{margin:0;font-size:14px;font-weight:600;letter-spacing:-.01em;color:var(--text)}
#ps-root .ps-lane-head .n{border-radius:999px;padding:0 10px 1px;height:22px;font-size:11.5px;font-weight:600;
  background:var(--col);color:var(--text-2);display:inline-flex;align-items:center;justify-content:center;line-height:1}
#ps-root .ps-lane-head .more{margin-left:auto;font-size:11.5px;color:var(--faint)}

#ps-root .ps-grid{display:flex;gap:14px;overflow-x:auto;overflow-y:hidden;padding-bottom:10px;
  scroll-snap-type:x proximity;align-items:stretch;scrollbar-width:thin}
#ps-root .ps-grid > .ps-rec{flex:0 0 calc((100% - 28px) / 3);min-width:300px;scroll-snap-align:start}
#ps-root .ps-grid::-webkit-scrollbar{height:9px}
#ps-root .ps-grid::-webkit-scrollbar-track{background:var(--col);border-radius:999px}
#ps-root .ps-grid::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px}

#ps-root .ps-rec{background:var(--card);border:1px solid var(--border);border-radius:var(--r-card);padding:16px;
  display:flex;flex-direction:column;gap:13px;align-content:start}
#ps-root .ps-rec > *{flex:0 0 auto}
#ps-root .rec-top{display:flex;align-items:flex-start;gap:9px}
#ps-root .rec-top .t{min-width:0;flex:1}
#ps-root .rec-top .iconbtn{margin-left:auto}
#ps-root .ps-rec h3{margin:0;font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--text)}
#ps-root .brandline{font-size:10px;letter-spacing:.07em;text-transform:uppercase;font-weight:700;line-height:1.2;margin-bottom:3px}
#ps-root .sub{font-size:12px;color:var(--muted);margin-top:2px;display:flex;gap:7px;flex-wrap:wrap}
#ps-root .sub code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--text-2)}
#ps-root .mode{border-radius:999px;padding:0 11px 1px;height:24px;font-size:11.5px;font-weight:700;letter-spacing:.05em;
  text-transform:uppercase;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;
  width:fit-content;line-height:1;margin-bottom:8px}
#ps-root .pill{border-radius:999px;padding:0 11px 1px;height:24px;font-size:11.5px;font-weight:600;white-space:nowrap;
  display:inline-flex;align-items:center;justify-content:center;line-height:1}
#ps-root .iconbtn{height:30px;width:30px;flex:none;border-radius:999px;border:1px solid var(--border);
  background:var(--card);color:var(--text-2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
#ps-root .iconbtn:hover{background:var(--dim);color:var(--text)}

#ps-root .design{background:var(--col);border-radius:var(--r-block);padding:10px 12px;display:flex;
  align-items:center;gap:10px;flex-wrap:wrap}
#ps-root .design .nm{font-weight:600;font-size:13.5px;color:var(--text)}
#ps-root .dot{height:5px;width:5px;border-radius:999px;background:var(--faint);flex:none}

#ps-root .shot{position:relative;width:150px;max-width:100%;aspect-ratio:1/1;border-radius:var(--r-block);
  overflow:hidden;background:var(--col);border:1px solid var(--border);align-self:flex-start}
#ps-root .shot img{width:100%;height:100%;object-fit:cover;display:block}
#ps-root .shot.empty{border-style:dashed;color:var(--faint);cursor:pointer;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:6px;font-size:11.5px}
#ps-root .shot.empty:hover{background:var(--dim);color:var(--text-2)}

#ps-root .speeds{display:flex;gap:7px}
#ps-root .sp{flex:1;border:1px solid var(--border);background:var(--col);border-radius:var(--r-block);
  padding:9px 6px;text-align:center;cursor:pointer;color:var(--text-2);transition:transform .08s ease}
#ps-root .sp:hover{background:var(--dim)}
#ps-root .sp:active{transform:scale(.97)}
#ps-root .sp .k{font-size:10px;letter-spacing:.07em;text-transform:uppercase;font-weight:600;color:var(--muted);line-height:1.2}
#ps-root .sp .v{font-size:16px;font-weight:600;color:var(--text);margin-top:4px;line-height:.95}
#ps-root .sp .u{font-size:11.5px;color:var(--muted);font-weight:500;margin-top:2px;line-height:1}
#ps-root .sp.on{border-color:transparent;background:${ACCENT_GRAD};box-shadow:0 2px 10px rgba(229,62,48,.22)}
#ps-root .sp.on .k,#ps-root .sp.on .v,#ps-root .sp.on .u{color:var(--on-accent)}
#ps-root .sp.empty{opacity:.45;cursor:default}
#ps-root .sp.empty:hover{background:var(--col)}

#ps-root .out{display:flex;gap:7px}
#ps-root .out > div{flex:1;background:var(--col);border:1px solid var(--border);border-radius:var(--r-block);
  padding:9px 6px 10px;text-align:center}
#ps-root .out .k{font-size:10px;letter-spacing:.07em;text-transform:uppercase;font-weight:600;color:var(--muted);line-height:1.2}
#ps-root .out .v{font-size:16px;font-weight:600;color:var(--text);margin-top:4px;line-height:1.1}

#ps-root .specs{border:1px solid var(--border);border-radius:var(--r-block);overflow:hidden;align-self:flex-start;width:100%}
#ps-root .specs .row{display:grid;grid-template-columns:repeat(4,1fr);align-items:start}
#ps-root .specs .row + .row{border-top:1px solid var(--border)}
#ps-root .specs .row.one{grid-template-columns:1fr}
#ps-root .specs .row.one .cell{padding:9px 13px 10px}
#ps-root .specs .cell{padding:11px 13px;min-width:0;overflow:hidden}
#ps-root .specs .cell + .cell{border-left:1px solid var(--border)}
#ps-root .specs .cell.span2{grid-column:span 2}
#ps-root .specs .k{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:600;
  line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ps-root .specs .v{font-size:13.5px;font-weight:600;color:var(--text);margin-top:3px;line-height:1.25;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ps-root .specs .v.wrap{white-space:normal;overflow:visible}
#ps-root .specs .v span{font-size:11.5px;font-weight:500;color:var(--muted);margin-left:3px}
#ps-root .specs .v.none{color:var(--faint);font-weight:500}
#ps-root .specs .v span.lnote{display:block;font-size:11.5px;font-weight:500;color:var(--muted);
  margin:1px 0 0 0;line-height:1.25}
#ps-root .specs .cell.group{padding:0;display:flex;flex-direction:column}
#ps-root .specs .group > .k{padding:9px 13px 7px;border-bottom:1px solid var(--border);text-align:center}
#ps-root .specs .group .pair{display:grid;grid-template-columns:1fr 1fr;flex:1}
#ps-root .specs .group .pair > div{padding:8px 13px 10px;min-width:0}
#ps-root .specs .group .pair > div + div{border-left:1px solid var(--border)}
#ps-root .specs .group .sk{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);
  font-weight:600;line-height:1.2}

#ps-root .inkrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px}
#ps-root .layer{border-radius:999px;padding:0 11px 1px;height:24px;font-size:11.5px;font-weight:600;
  white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;line-height:1}
#ps-root .plus{color:var(--faint);font-size:12px;font-weight:600}
#ps-root .cnt{font-size:11.5px;color:var(--muted);font-weight:500}

#ps-root .rem{font-size:12.5px;color:var(--text-2);background:var(--col);border-left:2px solid var(--faint);
  border-radius:0 var(--r-block) var(--r-block) 0;padding:10px 12px;line-height:1.5}

#ps-root .ps-scrim{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;
  justify-content:center;padding:20px;z-index:60}
#ps-root .ps-sheet{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);
  width:100%;max-width:580px;max-height:86vh;overflow-y:auto;padding:20px}
#ps-root .ps-sheet h2{margin:0 0 2px;font-size:17px;font-weight:600;color:var(--text)}
#ps-root .ps-sheet .cap{color:var(--muted);font-size:12.5px;margin:0 0 16px}
#ps-root .fgrid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
#ps-root .fgrid .wide{grid-column:span 2}
#ps-root .f label{display:block;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
  font-weight:600;line-height:1.2;margin-bottom:5px}
#ps-root .f input,#ps-root .f textarea,#ps-root .f .ps-select{width:100%;background-color:var(--col);
  border:1px solid var(--border);color:var(--text);border-radius:var(--r-field);padding:9px 11px;font-size:13px;outline:none}
#ps-root .f .ps-select{padding-right:36px;background-position:right 13px center}
#ps-root .f input:focus,#ps-root .f textarea:focus,#ps-root .f .ps-select:focus{border-color:#F0784B}
#ps-root .f textarea{resize:vertical;min-height:62px;line-height:1.5}
#ps-root .seph{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);font-weight:600;
  line-height:1.2;margin:16px 0 9px;grid-column:span 2}
#ps-root .sheet-foot{display:flex;gap:9px;margin-top:18px;align-items:center;flex-wrap:wrap}
#ps-root .savefail{margin:10px 0 0;font-size:12.5px;color:#E5536E;line-height:1.45}

#ps-root .managed{position:relative}
#ps-root .managed .row1{display:flex;gap:6px;align-items:center}
#ps-root .managed .row1 .ps-select{flex:1;min-width:0}
#ps-root .gear{height:34px;width:34px;flex:none;border-radius:var(--r-field);border:1px solid var(--border);
  background:var(--col);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
#ps-root .gear:hover{background:var(--dim);color:var(--text)}
#ps-root .gear.on{background:${ACCENT_GRAD};color:var(--on-accent);border-color:transparent}
#ps-root .mgr{margin-top:7px;border:1px solid var(--border);border-radius:var(--r-field);background:var(--col);padding:8px}
#ps-root .mgr .opt{display:flex;gap:6px;align-items:center;margin-bottom:6px}
#ps-root .mgr .opt.withnote{align-items:flex-start}
#ps-root .mgr .opt .fields{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
#ps-root .mgr .opt .note{font-size:12px;color:var(--text-2)}
#ps-root .mgr .opt input{width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);
  border-radius:9px;padding:6px 9px;font-size:12.5px;outline:none}
#ps-root .mgr .opt button{height:28px;width:28px;flex:none;border-radius:9px;border:1px solid var(--border);
  background:var(--card);color:var(--muted);cursor:pointer;font-size:13px;line-height:1}
#ps-root .mgr .opt button:hover{color:#E5536E;border-color:#E5536E55}
#ps-root .mgr .add{display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)}
#ps-root .mgr .add input{flex:1;min-width:0;background:var(--card);border:1px solid var(--border);color:var(--text);
  border-radius:9px;padding:6px 9px;font-size:12.5px;outline:none}
#ps-root .mgr .add button{border-radius:9px;border:none;background:${ACCENT_GRAD};color:var(--on-accent);
  padding:0 13px;font-size:12.5px;font-weight:600;cursor:pointer}
#ps-root .mgr .hintline{font-size:11px;color:var(--faint);margin-top:7px;line-height:1.4}

#ps-root .addrow{display:flex;gap:7px;flex-wrap:wrap}
#ps-root .addbtn{border:1px solid var(--border);background:var(--card);border-radius:999px;padding:7px 13px;
  font-size:12.5px;font-weight:600;cursor:pointer;line-height:1.3}
#ps-root .addbtn.ghost{color:var(--muted);font-weight:500}
#ps-root .inkbuild .seq{min-height:42px;background:var(--col);border:1px solid var(--border);
  border-radius:var(--r-field);padding:8px 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
#ps-root .inkbuild .seq .ph{color:var(--faint);font-size:12.5px}
#ps-root .inkbuild .seq .layer{gap:6px;cursor:pointer;padding:0 10px 1px}
#ps-root .inkbuild .seq .layer .x{opacity:.6;font-weight:700}
#ps-root .inkbuild .seq .layer:hover .x{opacity:1}

#ps-root .imgfield{display:flex;gap:12px;align-items:flex-start}
#ps-root .imgfield .prev{width:104px;height:104px;flex:none;border-radius:var(--r-block);overflow:hidden;
  background:var(--col);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;
  color:var(--faint);font-size:11px}
#ps-root .imgfield .prev img{width:100%;height:100%;object-fit:cover;display:block}
#ps-root .imgfield .side{flex:1;min-width:0}
#ps-root .imgfield .btnrow{display:flex;gap:8px;flex-wrap:wrap}
#ps-root .imgfield .hint{font-size:11.5px;color:var(--muted);margin-top:7px;line-height:1.45}

@media (max-width:980px){#ps-root .ps-grid > .ps-rec{flex:0 0 calc((100% - 14px) / 2)}}
@media (max-width:760px){
  #ps-root .ps-grid > .ps-rec{flex:0 0 86%;min-width:0}
  #ps-root .ps-search input{width:100%}
  #ps-root .fgrid{grid-template-columns:1fr}
  #ps-root .fgrid .wide,#ps-root .seph{grid-column:span 1}
}
`;
