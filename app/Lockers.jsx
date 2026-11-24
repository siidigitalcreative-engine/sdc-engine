"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload as uploadToBlob } from "@vercel/blob/client";
import {
  Plus, Trash2, X, Globe2, Copy, ExternalLink, Image as ImageIcon, Film, StickyNote, Lock,
  Maximize2, Download,
} from "lucide-react";
import { useAuth } from "./auth";

const ACCENT = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";
const TINT = { image: { fg: "#3E8ED0", bg: "#E3EEF9" }, video: { fg: "#7C5CD8", bg: "#EBE4FA" } };

const GRID = 11;                          // cards settle on a light grid
const snap = (n) => Math.round(n / GRID) * GRID;

export default function Lockers({ deptView }) {
  const { department } = useAuth();
  const [lockers, setLockers] = useState([]);
  const [currentId, setCurrentId] = useState("");
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const dragRef = useRef(null);
  const writeSeq = useRef(0);
  const fileRef = useRef(null);
  // in state, not a ref: the file input's accepted types have to re-render
  const [pendingKind, setPendingKind] = useState("image");

  const scope = deptView || department?.id || "";
  const url = useCallback(
    () => `/api/lockers${scope && scope !== "all" ? `?department=${encodeURIComponent(scope)}` : ""}`,
    [scope]
  );

  const load = useCallback(async () => {
    if (!scope) return;
    try {
      const res = await fetch(url(), { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Unable to load the lockers.");
      setLockers(body.lockers || []);
      setCurrentId((id) => (body.lockers?.some((l) => l.id === id) ? id : body.lockers?.[0]?.id || ""));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [url, scope]);

  useEffect(() => { load(); }, [load]);

  /* Writes answer with the whole list. Only the newest may apply its
     response, so a slower earlier save cannot undo a later change. */
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
      if (seq === writeSeq.current && Array.isArray(body.lockers)) setLockers(body.lockers);
      return body;
    } catch (e) {
      if (seq === writeSeq.current) { setError(e.message); await load(); }
      return null;
    } finally {
      setBusy(false);
    }
  };

  const locker = lockers.find((l) => l.id === currentId) || null;
  const saveItems = (items) => locker && send("PATCH", { id: locker.id, patch: { items } });

  /* ---- adding things ---- */

  const freeSpot = (items) => {
    const bottom = items.reduce((low, i) => Math.max(low, i.y + i.h), 0);
    return { x: 44, y: bottom ? bottom + 22 : 44 };
  };

  const chooseFile = (kind) => {
    setPendingKind(kind);
    setPicker(false);
    // let the input re-render with the right accept before opening it
    setTimeout(() => fileRef.current?.click(), 0);
  };

  /* The file goes straight to Blob storage, so a large video never passes
     through the server's request body. The store is private, like task
     attachments, and the file is read back through /api/attachments, which
     also answers Range requests so video actually plays. */
  const onFile = async (file) => {
    if (!file || !locker) return;
    setUploading(true);
    setError("");
    try {
      const kind = file.type.startsWith("video") ? "video" : "image";
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-60);
      const uploaded = await uploadToBlob(`sdc/lockers/${locker.id}-${Date.now().toString(36)}-${safe}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload-token",
        multipart: true,
        contentType: file.type || undefined,
      });

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const at = freeSpot(locker.items);
      await saveItems([...locker.items, {
        id: `it-${Date.now().toString(36)}`,
        kind, url: `${origin}/api/attachments/${uploaded.pathname}`, name: file.name,
        x: at.x, y: at.y, w: 230, h: kind === "video" ? 170 : 230,
      }]);
    } catch (e) {
      const tooBig = file.size > 50 * 1024 * 1024;
      setError(tooBig
        ? `${file.name} is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is 50 MB.`
        : (e.message || "That file did not upload."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addNote = () => {
    if (!locker) return;
    const at = freeSpot(locker.items);
    saveItems([...locker.items, {
      id: `nt-${Date.now().toString(36)}`, kind: "note", name: "Note",
      text: "Hook:\nCTA:", x: at.x, y: at.y, w: 253, h: 150,
    }]);
  };

  const removeItem = (id) => locker && saveItems(locker.items.filter((i) => i.id !== id));
  const patchItem = (id, fields) =>
    locker && saveItems(locker.items.map((i) => (i.id === id ? { ...i, ...fields } : i)));

  /* ---- dragging and resizing: pointer events, so touch behaves the same ---- */

  const begin = (event, item, mode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected(item.id);
    dragRef.current = {
      id: item.id, mode,
      startX: event.clientX, startY: event.clientY,
      ox: item.x, oy: item.y, ow: item.w, oh: item.h,
      live: null,
    };
  };

  useEffect(() => {
    const move = (event) => {
      const drag = dragRef.current;
      if (!drag || !locker) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      drag.live = drag.mode === "move"
        ? { x: Math.max(0, snap(drag.ox + dx)), y: Math.max(0, snap(drag.oy + dy)) }
        : { w: Math.max(120, snap(drag.ow + dx)), h: Math.max(90, snap(drag.oh + dy)) };

      // move it on screen now; the save happens once, on release
      setLockers((list) => list.map((l) => (l.id !== locker.id ? l : {
        ...l, items: l.items.map((i) => (i.id === drag.id ? { ...i, ...drag.live } : i)),
      })));
    };

    const end = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag?.live && locker) {
        const items = locker.items.map((i) => (i.id === drag.id ? { ...i, ...drag.live } : i));
        saveItems(items);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- sharing ---- */

  const copyLink = async () => {
    if (!locker?.share?.enabled) { setError("Turn sharing on first."); return; }
    const link = `${window.location.origin}/public/locker/${locker.share.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied.");
      setTimeout(() => setNote(""), 1600);
    } catch {
      setError(link);           // clipboard blocked: show it to copy by hand
    }
  };

  const newLocker = async () => {
    const body = await send("POST", { locker: { name: "Untitled locker", items: [] } });
    if (body?.lockers?.[0]) setCurrentId(body.lockers[0].id);
  };

  return (
    <div className="flex gap-4 items-start flex-col lg:flex-row">
      <input ref={fileRef} type="file" className="hidden"
        accept={pendingKind === "video" ? "video/*" : "image/*"}
        onChange={(e) => onFile(e.target.files?.[0])} />

      {/* the lockers in this department */}
      <aside className="w-full lg:w-64 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Lockers</span>
          <button onClick={newLocker} disabled={busy}
            className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
            style={{ background: ACCENT, color: ON_ACCENT }}>
            <Plus size={13} /> New
          </button>
        </div>

        <div className="flex flex-col gap-1 lg:max-h-[70vh] overflow-y-auto">
          {lockers.map((l) => {
            const media = l.items.filter((i) => i.kind !== "note").length;
            const on = l.id === currentId;
            return (
              <button key={l.id} onClick={() => { setCurrentId(l.id); setSelected(""); }}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left"
                style={{ background: on ? "var(--col)" : "transparent", border: `1px solid ${on ? "var(--border)" : "transparent"}` }}>
                <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--dim)", color: "var(--muted)" }}><Lock size={13} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold truncate" style={{ color: "var(--text)" }}>{l.name}</span>
                  <span className="block text-[10.5px]" style={{ color: "var(--muted)" }}>
                    {media} file{media === 1 ? "" : "s"}
                  </span>
                </span>
                {l.share?.enabled && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "#3FA37A" }} />}
              </button>
            );
          })}
          {!lockers.length && (
            <p className="text-xs px-1 py-2" style={{ color: "var(--muted)" }}>
              No lockers yet. Create one for an ad.
            </p>
          )}
        </div>
      </aside>

      {/* the board */}
      <section className="flex-1 min-w-0 w-full">
        {!locker ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Pick a locker, or create one.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="mr-auto min-w-0">
                <input defaultValue={locker.name} key={`${locker.id}-name`}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== locker.name) {
                      send("PATCH", { id: locker.id, patch: { name: e.target.value } });
                    }
                  }}
                  className="bg-transparent outline-none text-lg font-semibold w-full"
                  style={{ color: "var(--text)" }} />
                <input defaultValue={locker.brand} key={`${locker.id}-brand`} placeholder="Brand"
                  onBlur={(e) => { if (e.target.value !== locker.brand) send("PATCH", { id: locker.id, patch: { brand: e.target.value } }); }}
                  className="bg-transparent outline-none text-xs w-full"
                  style={{ color: "var(--muted)" }} />
              </div>

              <button onClick={() => setPicker(true)} disabled={busy || uploading}
                className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
                style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                <Plus size={14} /> {uploading ? "Uploading…" : "Add media"}
              </button>
              <button onClick={addNote} disabled={busy}
                className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
                style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                <StickyNote size={14} /> Note
              </button>
              <button onClick={() => send("PATCH", { id: locker.id, patch: { share: { ...locker.share, enabled: !locker.share?.enabled } } })}
                disabled={busy}
                className="tp-ib rounded-full px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5"
                style={locker.share?.enabled
                  ? { background: "#DEF1E7", color: "#2E8B63", border: "1px solid transparent" }
                  : { background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                <Globe2 size={14} /> {locker.share?.enabled ? "Shared" : "Share"}
              </button>
              {locker.share?.enabled && (
                <>
                  <button onClick={copyLink} title="Copy the link"
                    className="tp-ib rounded-full p-2" style={{ color: "var(--muted)" }}><Copy size={14} /></button>
                  <a href={`/public/locker/${locker.share.token}`} target="_blank" rel="noreferrer" title="Open the board"
                    className="tp-ib rounded-full p-2" style={{ color: "var(--muted)" }}><ExternalLink size={14} /></a>
                </>
              )}
              <button onClick={() => send("DELETE", { id: locker.id })} disabled={busy} title="Delete this locker"
                className="tp-ib rounded-full p-2" style={{ color: "#E5536E" }}><Trash2 size={14} /></button>
            </div>

            {error && <p className="text-xs mb-2" style={{ color: "#E5536E" }}>{error}</p>}
            {note && <p className="text-xs mb-2" style={{ color: "#3FA37A" }}>{note}</p>}

            <div className="rounded-2xl overflow-auto"
              style={{
                border: "1px solid var(--border)", background: "var(--card)", height: "66vh",
                backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
                backgroundSize: "22px 22px", backgroundPosition: "-1px -1px",
              }}
              onPointerDown={() => setSelected("")}>
              <div style={{ position: "relative", width: 1600, height: 1100 }}>
                {!locker.items.length && (
                  <p className="text-sm" style={{ position: "absolute", left: 20, top: 18, color: "var(--faint)" }}>
                    Empty locker. Use Add media for images and videos, and Note for the copy.
                  </p>
                )}

                {locker.items.map((item) => (
                  <LockerCard key={item.id} item={item} selected={selected === item.id}
                    onGrab={(e) => begin(e, item, "move")}
                    onResize={(e) => begin(e, item, "size")}
                    onRemove={() => removeItem(item.id)}
                    onText={(text) => patchItem(item.id, { text })}
                    onRename={(name) => patchItem(item.id, { name })}
                    onPreview={() => setPreview(item)} />
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* one file, full size */}
      {preview && (
        <div role="presentation" onClick={() => setPreview(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,8,12,.86)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "100%", maxHeight: "92vh", textAlign: "center" }}>
            {preview.kind === "video" ? (
              <video src={preview.url} controls autoPlay playsInline
                style={{ maxWidth: "100%", maxHeight: "84vh", borderRadius: 12 }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.name || ""}
                style={{ maxWidth: "100%", maxHeight: "84vh", borderRadius: 12, objectFit: "contain" }} />
            )}
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="text-xs" style={{ color: "var(--text-2)" }}>{preview.name}</span>
              <a href={preview.url} download={preview.name || "file"}
                className="rounded-full px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
                style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>
                <Download size={13} /> Download
              </a>
              <button onClick={() => setPreview(null)}
                className="rounded-full px-3 py-1.5 text-xs"
                style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* what are you adding */}
      {picker && (
        <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setPicker(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,8,12,.72)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="rounded-2xl p-4 w-full max-w-sm"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>Add to the locker</h3>
            <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>Pick what you are putting in this locker.</p>

            {[
              { kind: "image", Icon: ImageIcon, title: "Image", note: "JPG, PNG or WebP" },
              { kind: "video", Icon: Film, title: "Video", note: "MP4 or MOV" },
            ].map(({ kind, Icon, title, note: hint }) => (
              <button key={kind} onClick={() => chooseFile(kind)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 mb-2 text-left"
                style={{ background: "var(--col)", border: "1px solid var(--border)" }}>
                <Icon size={17} style={{ color: "var(--muted)" }} />
                <span>
                  <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</span>
                  <span className="block text-[11px]" style={{ color: "var(--muted)" }}>{hint}</span>
                </span>
              </button>
            ))}

            <button onClick={() => setPicker(false)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LockerCard({ item, selected, onGrab, onResize, onRemove, onText, onRename, onPreview }) {
  const tint = TINT[item.kind] || TINT.image;
  const isNote = item.kind === "note";

  return (
    <div onPointerDown={onGrab}
      style={{
        position: "absolute", left: item.x, top: item.y, width: item.w, height: item.h,
        borderRadius: 12, overflow: "hidden", cursor: "grab",
        background: isNote ? "#FBE9C6" : "var(--card)",
        border: `1px solid ${selected ? "#F0784B" : isNote ? "#E8D3A6" : "var(--border)"}`,
        boxShadow: selected ? "0 6px 20px rgba(0,0,0,.3)" : "0 1px 3px rgba(0,0,0,.18)",
      }}>
      {/* double-clicking the picture opens it too */}
      {isNote ? (
        <textarea defaultValue={item.text}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => { if (e.target.value !== item.text) onText(e.target.value); }}
          style={{
            width: "100%", height: "100%", resize: "none", border: "none", outline: "none",
            background: "transparent", color: "#4A3A16", padding: "10px 11px", fontSize: 12.5, lineHeight: 1.5,
            fontFamily: "inherit",
          }} />
      ) : (
        <>
          <span style={{
            position: "absolute", top: 6, left: 6, zIndex: 2, borderRadius: 999, padding: "2px 7px",
            fontSize: 9.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase",
            background: tint.bg, color: tint.fg,
          }}>{item.kind}</span>

          {item.kind === "video" ? (
            <video src={item.url} muted playsInline onDoubleClick={onPreview}
              style={{ width: "100%", height: item.h - 28, objectFit: "cover", background: "#000", display: "block" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.name || "Locker media"} onDoubleClick={onPreview}
              style={{ width: "100%", height: item.h - 28, objectFit: "cover", display: "block" }} />
          )}
          {/* the file name is editable in place: the uploaded name is rarely
              what anyone wants to read on a board */}
          <input defaultValue={item.name} key={item.name}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== item.name) onRename(v); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            title="Rename"
            style={{
              width: "100%", padding: "6px 9px", fontSize: 11.5, color: "var(--text-2)",
              borderTop: "1px solid var(--border)", border: "none", borderTopWidth: 1, borderTopStyle: "solid",
              borderTopColor: "var(--border)", background: "transparent", outline: "none", fontFamily: "inherit",
            }} />
        </>
      )}

      <div className="lk-tools" style={{ position: "absolute", top: 5, right: 5, display: "flex", gap: 4 }}>
        {!isNote && (
          <>
            <button onClick={(e) => { e.stopPropagation(); onPreview(); }}
              onPointerDown={(e) => e.stopPropagation()} title="Preview" style={toolBtn}>
              <Maximize2 size={10} />
            </button>
            <a href={item.url} download={item.name || "file"} onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()} title="Download" style={toolBtn}>
              <Download size={10} />
            </a>
          </>
        )}
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onPointerDown={(e) => e.stopPropagation()} title="Remove" style={toolBtn}>
          <X size={10} />
        </button>
      </div>

      <span onPointerDown={onResize} title="Resize"
        style={{
          position: "absolute", right: 0, bottom: 0, height: 14, width: 14, cursor: "nwse-resize",
          background: "linear-gradient(135deg, transparent 50%, var(--border) 50%)",
        }} />
    </div>
  );
}


const toolBtn = {
  height: 19,
  width: 19,
  borderRadius: 999,
  border: "none",
  background: "rgba(0,0,0,.5)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
