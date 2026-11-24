"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";

const TINT = { image: { fg: "#3E8ED0", bg: "#E3EEF9" }, video: { fg: "#7C5CD8", bg: "#EBE4FA" } };

export default function PublicLockerPage() {
  const params = useParams();
  const token = params?.token;

  const [locker, setLocker] = useState(null);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/locker/${encodeURIComponent(token)}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "That link is not available.");
      setLocker(body.locker);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => { if (token) load(); }, [token, load]);

  /* The board is shown exactly as it was arranged, scaled to fit whatever
     screen it is opened on, so a phone sees the same layout as the desk it
     was built on. */
  const bounds = useMemo(() => {
    const items = locker?.items || [];
    const width = items.reduce((w, i) => Math.max(w, i.x + i.w), 0) + 44;
    const height = items.reduce((h, i) => Math.max(h, i.y + i.h), 0) + 44;
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

  return (
    <main style={{ ...shell, alignItems: "flex-start", paddingTop: 28 }}>
      <div style={{ width: "100%", maxWidth: 1180 }}>
        <header style={{ marginBottom: 14 }}>
          {locker.brand ? (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)" }}>
              {locker.brand}
            </div>
          ) : null}
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "3px 0 0" }}>{locker.name}</h1>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "4px 0 0" }}>
            {media.length} file{media.length === 1 ? "" : "s"}
          </p>
        </header>

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
                return (
                  <div key={item.id}
                    onClick={() => !isNote && setLightbox(item)}
                    style={{
                      position: "absolute", left: item.x, top: item.y, width: item.w, height: item.h,
                      borderRadius: 12, overflow: "hidden", cursor: isNote ? "default" : "zoom-in",
                      background: isNote ? "#FBE9C6" : "var(--card)",
                      border: `1px solid ${isNote ? "#E8D3A6" : "var(--border)"}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,.18)",
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

                        {item.kind === "video" ? (
                          <video src={item.url} muted playsInline
                            style={{ width: "100%", height: item.h - 28, objectFit: "cover", background: "#000", display: "block" }} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.url} alt={item.name || locker.name}
                            style={{ width: "100%", height: item.h - 28, objectFit: "cover", display: "block" }} />
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
