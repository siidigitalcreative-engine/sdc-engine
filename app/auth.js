"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const AuthCtx = createContext(null);
const POLL_MS = 3000;

async function getError(response, fallback) {
  try {
    const body = await response.json();
    return body?.error || fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }) {
  const [members, setMembers] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [ready, setReady] = useState(false);
  const etagRef = useRef(null);
  const loadingMembersRef = useRef(false);

  const refreshMembers = useCallback(async ({ force = false } = {}) => {
    if (loadingMembersRef.current) return;
    loadingMembersRef.current = true;
    try {
      const headers = {};
      if (!force && etagRef.current) headers["If-None-Match"] = etagRef.current;

      const response = await fetch("/api/members", {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (response.status === 304) return;
      if (!response.ok) throw new Error(await getError(response, "Unable to load team members."));

      const body = await response.json();
      const etag = response.headers.get("etag");
      if (etag) etagRef.current = etag;
      setMembers(Array.isArray(body.members) ? body.members : []);
    } finally {
      loadingMembersRef.current = false;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        setSessionId(null);
        return null;
      }
      const body = await response.json();
      setSessionId(body.member?.id || null);
      return body.member || null;
    } catch {
      setSessionId(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await Promise.all([refreshMembers({ force: true }), refreshSession()]);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [refreshMembers, refreshSession]);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") refreshMembers().catch(() => {});
    };
    const id = window.setInterval(poll, POLL_MS);
    const onFocus = () => refreshMembers({ force: true }).catch(() => {});
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refreshMembers]);

  const currentMember = useMemo(
    () => members.find((member) => member.id === sessionId) || null,
    [members, sessionId]
  );

  useEffect(() => {
    if (ready && sessionId && members.length && !currentMember) {
      refreshSession().catch(() => {});
    }
  }, [ready, sessionId, members, currentMember, refreshSession]);

  const applyServerMembers = (response, body) => {
    const etag = response.headers.get("etag");
    if (etag) etagRef.current = etag;
    if (Array.isArray(body.members)) setMembers(body.members);
  };

  const login = async (memberId, pin) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, pin }),
    });

    if (!response.ok) return { ok: false, message: await getError(response, "Unable to sign in.") };

    const body = await response.json();
    setSessionId(body.member?.id || null);
    await refreshMembers({ force: true });
    return { ok: true, member: body.member };
  };

  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    setSessionId(null);
  };

  const addMember = async (data) => {
    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await getError(response, "Unable to add member."));
    const body = await response.json();
    applyServerMembers(response, body);
    return body.member;
  };

  const updateMember = async (id, data) => {
    const response = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    });
    if (!response.ok) throw new Error(await getError(response, "Unable to update member."));
    const body = await response.json();
    applyServerMembers(response, body);
    return body.member;
  };

  const deleteMember = async (id) => {
    const response = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) throw new Error(await getError(response, "Unable to delete member."));
    const body = await response.json();
    applyServerMembers(response, body);
    return true;
  };

  const value = {
    ready,
    members,
    currentMember,
    login,
    logout,
    addMember,
    updateMember,
    deleteMember,
    refreshMembers,
    defaultPin: "1234",
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const value = useContext(AuthCtx);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
