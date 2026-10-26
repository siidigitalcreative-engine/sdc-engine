"use client";

import React, { useCallback, useEffect, useState } from "react";

const ACCENT_GRAD = "linear-gradient(135deg,#FFAA62 0%,#E53E30 100%)";
const ON_ACCENT = "var(--on-accent)";

/* Every "Send to Lark" button in the app goes through this hook, so a send is
   always aimed at a chosen group chat rather than whatever the environment
   happens to hold.

   const { openLarkSend, larkPicker } = useLarkSend();
   ...
   <button onClick={() => openLarkSend("/api/lark/task-image", payload, { label: "this task" })}>
   ...
   {larkPicker}
*/
export function useLarkSend({ onSent } = {}) {
  const [request, setRequest] = useState(null);   // { endpoint, payload, label, kind }
  const [targets, setTargets] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadTargets = useCallback(async (kind = "tasks") => {
    try {
      const res = await fetch(`/api/lark-targets?kind=${encodeURIComponent(kind)}`, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      setTargets(Array.isArray(body.targets) ? body.targets : []);
    } catch {
      /* the environment group still works even if the list cannot be read */
    }
  }, []);

  const openLarkSend = useCallback((endpoint, payload, { label = "this", kind = "tasks" } = {}) => {
    setError("");
    setRequest({ endpoint, payload, label, kind });
    loadTargets(kind);
  }, [loadTargets]);

  const send = useCallback(async (target) => {
    if (!request) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(request.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request.payload, target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to send to Lark.");
      setRequest(null);
      if (onSent) onSent("Sent to Lark ✓");
    } catch (e) {
      setError(e.message || "Unable to send to Lark.");
    } finally {
      setSending(false);
    }
  }, [request, onSent]);

  const larkPicker = request ? (
    <LarkPicker
      targets={targets}
      kind={request.kind}
      label={request.label}
      sending={sending}
      error={error}
      onError={setError}
      onClose={() => !sending && setRequest(null)}
      onSend={send}
      onRefresh={() => loadTargets(request.kind)}
    />
  ) : null;

  return { openLarkSend, larkPicker, larkSending: sending };
}

export function LarkPicker({ targets, kind, label, sending, error, onError, onClose, onSend, onRefresh }) {
  const preferred = targets.find((t) => t.isDefault) || targets[0];
  const [choice, setChoice] = useState(preferred?.id || "default");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [hook, setHook] = useState("");
  const [editName, setEditName] = useState("");
  const [editHook, setEditHook] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!targets.some((t) => t.id === choice)) {
      setChoice((targets.find((t) => t.isDefault) || targets[0])?.id || "default");
    }
  }, [targets]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (method, body) => {
    setBusy(true);
    if (onError) onError("");
    try {
      const res = await fetch("/api/lark-targets", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That did not save.");
      setName(""); setHook("");
      await onRefresh();
      return true;
    } catch (e) {
      if (onError) onError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const field = {
    background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)",
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,.6)" }}>
      <div className="w-full max-w-md rounded-2xl p-5 shadow-xl max-h-[86vh] overflow-y-auto"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Send to Lark</h2>
        <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--muted)" }}>
          Choose the group chat that gets {label}.
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {targets.length ? targets.map((t) => {
            const on = choice === t.id;
            return (
              <div key={t.id} className="rounded-xl px-3 py-2.5"
                style={{
                  background: on ? "var(--dim)" : "var(--col)",
                  border: `1px solid ${on ? "#F0784B" : "var(--border)"}`,
                }}>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="radio" name="lark-target" checked={on}
                    onChange={() => setChoice(t.id)} style={{ accentColor: "#F0784B" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.name}</span>
                  {t.isDefault && (
                    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5"
                      style={{ background: "#FCE3D6", color: "#F26A3C" }}>Default</span>
                  )}
                  <span className="text-xs ml-auto" style={{ color: "var(--faint)" }}>{t.host || t.hint}</span>
                </label>

                {!t.builtIn && (
                  <div className="flex items-center gap-3 mt-1.5 pl-6">
                    {!t.isDefault && (
                      <button type="button" disabled={busy}
                        onClick={() => act("PATCH", { id: t.id, defaultFor: [...new Set([...(t.defaultFor || []), kind])] })}
                        className="text-xs" style={{ color: "var(--text-2)" }}>Make default</button>
                    )}
                    <button type="button" disabled={busy}
                      onClick={() => { setEditing(editing === t.id ? null : t.id); setEditName(t.name); setEditHook(""); }}
                      className="text-xs" style={{ color: "var(--text-2)" }}>
                      {editing === t.id ? "Close" : "Edit"}
                    </button>
                    <button type="button" disabled={busy}
                      onClick={() => { if (window.confirm(`Remove ${t.name}?`)) act("DELETE", { id: t.id }); }}
                      className="text-xs ml-auto" style={{ color: "#E5536E" }}>Remove</button>
                  </div>
                )}

                {!t.lark && (
                  <p className="text-xs mt-1.5 pl-6" style={{ color: "#E0A93C" }}>
                    Not a Lark bot URL. Image posts will only work with a Lark custom bot.
                  </p>
                )}

                {editing === t.id && (
                  <div className="flex flex-col gap-2 mt-2 pl-6">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name"
                      className="rounded-lg px-2.5 py-2 text-sm outline-none" style={field} />
                    <input value={editHook} onChange={(e) => setEditHook(e.target.value)}
                      placeholder="New webhook URL, leave blank to keep the current one"
                      className="rounded-lg px-2.5 py-2 text-sm outline-none" style={field} />
                    <button type="button" disabled={busy}
                      onClick={async () => { if (await act("PATCH", { id: t.id, name: editName, webhook: editHook })) setEditing(null); }}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold self-start"
                      style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>Save</button>
                  </div>
                )}
              </div>
            );
          }) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No destinations yet. Add one below.
            </p>
          )}
        </div>

        <button type="button" onClick={() => setAdding((v) => !v)}
          className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
          {adding ? "Hide" : "Add a group chat"}
        </button>

        {adding && (
          <div className="mt-2.5 rounded-xl p-3 flex flex-col gap-2"
            style={{ background: "var(--col)", border: "1px solid var(--border)" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Production Floor"
              className="rounded-lg px-2.5 py-2 text-sm outline-none" style={field} />
            <input value={hook} onChange={(e) => setHook(e.target.value)}
              placeholder="https://open.larksuite.com/open-apis/bot/v2/hook/…"
              className="rounded-lg px-2.5 py-2 text-sm outline-none" style={field} />
            <button type="button" disabled={busy || !name.trim() || !hook.trim()}
              onClick={async () => { if (await act("POST", { name, webhook: hook })) setAdding(false); }}
              className="rounded-full px-3 py-2 text-sm font-semibold self-start disabled:opacity-50"
              style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
              {busy ? "Saving…" : "Add destination"}
            </button>
            <p className="text-xs" style={{ color: "var(--faint)" }}>
              In Lark: group settings, Bots, Add Bot, Custom Bot, then copy its webhook address.
              Any https webhook is accepted, so new groups can be added here at any time.
            </p>
          </div>
        )}

        {error && <p className="text-xs mt-2.5" style={{ color: "#E5536E" }}>{error}</p>}

        <div className="flex gap-2 mt-4">
          <button type="button" disabled={sending || !targets.length} onClick={() => onSend(choice)}
            className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: ACCENT_GRAD, color: ON_ACCENT }}>
            {sending ? "Sending…" : "Send"}
          </button>
          <button type="button" onClick={onClose}
            className="tp-ib rounded-full px-4 py-2 text-sm font-medium"
            style={{ background: "var(--card)", color: "var(--text-2)", border: "1px solid var(--border)" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
