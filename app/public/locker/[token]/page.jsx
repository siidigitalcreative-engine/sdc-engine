"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Check } from "lucide-react";
import { downloadLockerFiles } from "../../../lib/locker-download";

const TINT = { image: { fg: "#3E8ED0", bg: "#E3EEF9" }, video: { fg: "#7C5CD8", bg: "#EBE4FA" } };

export default function PublicLockerPage() {
  const params = useParams();
  const token = params?.token;

  const [locker, setLocker] = useState(null);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [selecting, setSelecting] = useState(false);   // pick several files to download together
  const [picks, setPicks] = useState([]);
  const [dl, setDl] = useState(null);                  // { done, total } while a download is being prepared
  const [dlError, setDlError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/locker/${encodeURIComponent(token)}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "That link is not available.");
      setLocker(body.locker);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  /* Re-read when the tab comes back into view, and every 30 seconds while it
     is visible. Without this a link left open kept showing whatever it had
     when it was first opened, long after the page behind it changed. */
  useEffect(() => {
    if (!token) return undefined;
    load();

    const again = () => { if (document.visibilityState === "visible") load(); };
    const timer = setInterval(again, 5000);          // close enough to live
    window.addEventListener("focus", again);
    window.addEventListener("pageshow", again);      // also when restored from the back/forward cache
    document.addEventListener("visibilitychange", again);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", again);
      window.removeEventListener("pageshow", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [token, load]);

  /* The board is shown exactly as it was arranged, scaled to fit whatever
     screen it is opened on, so a phone sees the same layout as the desk it
     was built on. */
  const bounds = useMemo(() => {
    const items = locker?.items || [];
    const drawnHeight = (i) => {
      const ratio = i.kind === "note" ? 0 : Number(i.ratio) || 0;
      return ratio ? Math.round(i.w / ratio) + 28 : i.h;
    };
    const width = items.reduce((w, i) => Math.max(w, i.x + i.w), 0) + 44;
    const height = items.reduce((h, i) => Math.max(h, i.y + drawnHeight(i)), 0) + 44;
    return { width: Math.max(480, width), height: Math.max(320, height) };
  }, [locker]);

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const available = Math.min(window.innerWidth - 32, 1180);
      setScale(Math.min(1, available / bounds.width));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [bounds.width]);

  if (error) {
    return (
      <main style={shell}>
        <div style={{ ...card, padding: 36, textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
            The link may have been turned off, or the locker removed.
          </p>
        </div>
      </main>
    );
  }

  if (!locker) {
    return <main style={shell}><p style={{ fontSize: 13, color: "var(--muted)" }}>Loading…</p></main>;
  }

  const media = locker.items.filter((i) => i.kind !== "note");
  const chosen = media.filter((i) => picks.includes(i.id));
  const allChosen = media.length > 0 && chosen.length === media.length;
  const togglePick = (id) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const download = async (items) => {
    if (!items.length || dl) return;
    setDlError("");
    setDl({ done: 0, total: items.length });
    try {
      const { skipped } = await downloadLockerFiles(items, {
        zipName: locker.name,
        onProgress: (done, total) => setDl({ done, total }),
      });
      if (skipped.length) setDlError(`${skipped.length} file${skipped.length === 1 ? "" : "s"} could not be added: ${skipped.join(", ")}`);
    } catch (e) {
      setDlError(e.message || "The download did not work.");
    } finally {
      setDl(null);
    }
  };

  return (
    <main style={{ ...shell, alignItems: "flex-start", paddingTop: 28 }}>
      <div style={{ width: "100%", maxWidth: 1180 }}>
        <header style={{ marginBottom: 14, display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
          {locker.brand ? (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)" }}>
              {locker.brand}
            </div>
          ) : null}
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "3px 0 0" }}>{locker.name}</h1>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 0" }}>
            {media.length} file{media.length === 1 ? "" : "s"}
          </p>
          </div>

          {media.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {selecting ? (
                <>
                  <button type="button" onClick={() => setPicks(allChosen ? [] : media.map((i) => i.id))} style={pill}>
                    {allChosen ? "Clear" : "Select all"}
                  </button>
                  <button type="button" disabled={!chosen.length || !!dl} onClick={() => download(chosen)}
                    style={{ ...pillAccent, opacity: !chosen.length || dl ? 0.55 : 1 }}>
                    <Download size={14} />
                    {dl ? `Preparing ${dl.done} of ${dl.total}…` : `Download selected (${chosen.length})`}
                  </button>
                  <button type="button" onClick={() => { setSelecting(false); setPicks([]); }} style={pill}>Done</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setSelecting(true)} style={pill}>Select files</button>
                  <button type="button" disabled={!!dl} onClick={() => download(media)}
                    style={{ ...pillAccent, opacity: dl ? 0.55 : 1 }}>
                    <Download size={14} />
                    {dl ? `Preparing ${dl.done} of ${dl.total}…` : `Download all (${media.length})`}
                  </button>
                </>
              )}
            </div>
          )}
        </header>
        {dlError && <p style={{ fontSize: 12.5, color: "#E5536E", margin: "-6px 0 12px" }}>{dlError}</p>}

        <div style={{
          border: "1px solid var(--border)", borderRadius: 18, background: "var(--card)", overflow: "hidden",
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}>
          <div style={{ width: bounds.width * scale, height: bounds.height * scale, position: "relative" }}>
            <div style={{
              position: "absolute", top: 0, left: 0, width: bounds.width, height: bounds.height,
              transform: `scale(${scale})`, transformOrigin: "top left",
            }}>
              {locker.items.map((item) => {
                const isNote = item.kind === "note";
                const tint = TINT[item.kind] || TINT.image;
                // drawn at the file's own proportions, so it fills its frame
                const ratio = isNote ? 0 : Number(item.ratio) || 0;
                const height = ratio ? Math.round(item.w / ratio) + 28 : item.h;
                const picked = picks.includes(item.id);
                return (
                  <div key={item.id}
                    onClick={() => { if (!isNote) { if (selecting) togglePick(item.id); else setLightbox(item); } }}
                    style={{
                      position: "absolute", left: item.x, top: item.y, width: item.w, height,
                      borderRadius: 12, overflow: "hidden", cursor: isNote ? "default" : selecting ? "pointer" : "zoom-in",
                      background: isNote ? "#FBE9C6" : "var(--card)",
                      border: `1px solid ${picked ? "#F0784B" : isNote ? "#E8D3A6" : "var(--border)"}`,
                      boxShadow: picked ? "0 0 0 2px #F0784B" : "0 1px 3px rgba(0,0,0,.18)",
                    }}>
                    {isNote ? (
                      <div style={{ padding: "10px 11px", fontSize: 12.5, lineHeight: 1.5, color: "#4A3A16", whiteSpace: "pre-wrap" }}>
                        {item.text}
                      </div>
                    ) : (
                      <>
                        <span style={{
                          position: "absolute", top: 6, left: 6, zIndex: 2, borderRadius: 999, padding: "2px 7px",
                          fontSize: 9.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase",
                          background: tint.bg, color: tint.fg,
                        }}>{item.kind}</span>

                        {selecting && (
                          <span style={{
                            position: "absolute", top: 6, right: 6, zIndex: 3, height: 22, width: 22, borderRadius: 999,
                            display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
                            background: picked ? "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)" : "rgba(0,0,0,.45)",
                            border: picked ? "none" : "2px solid rgba(255,255,255,.85)", color: "#fff",
                          }}>{picked ? <Check size={13} strokeWidth={3} /> : null}</span>
                        )}

                        {item.kind === "video" ? (
                          <video src={item.url} muted playsInline
                            style={{ width: "100%", height: height - 28, objectFit: "cover", background: "#000", display: "block" }} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.url} alt={item.name || locker.name}
                            style={{ width: "100%", height: height - 28, objectFit: "cover", display: "block" }} />
                        )}
                        <div style={{
                          padding: "6px 9px", fontSize: 11.5, color: "var(--text-2)", borderTop: "1px solid var(--border)",
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.name}
                          </span>
                          {/* a visitor can take the file, not just look at it */}
                          <a href={item.url} download={item.name || "file"} title="Download"
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginLeft: "auto", color: "var(--muted)", display: "flex" }}>
                            <Download size={12} />
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 11, color: "var(--faint)", textAlign: "center", margin: "16px 0 28px" }}>
          Shared from SDC Engine. Anyone with this link can view it.
        </p>
      </div>

      {/* a file at full size */}
      {lightbox && (
        <div role="presentation" onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 100, background: "rgba(10,8,12,.86)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out",
          }}>
          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", maxWidth: "100%" }}>
            {lightbox.kind === "video" ? (
              <video src={lightbox.url} controls autoPlay playsInline
                style={{ maxWidth: "100%", maxHeight: "84vh", borderRadius: 12 }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.name || ""}
                style={{ maxWidth: "100%", maxHeight: "84vh", borderRadius: 12, objectFit: "contain" }} />
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>{lightbox.name}</span>
              <a href={lightbox.url} download={lightbox.name || "file"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
                  background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)",
                  borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600,
                }}>
                <Download size={13} /> Download
              </a>
              <button onClick={() => setLightbox(null)}
                style={{
                  background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)",
                  borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}>Close</button>
            </div>
          </div>
        </div>
      )}
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

const card = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 18,
};

const pill = {
  background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-2)",
  borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", gap: 6,
};

const pillAccent = {
  ...pill, border: "none", background: "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)", color: "var(--on-accent, #fff)",
};
