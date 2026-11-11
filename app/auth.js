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
  const [departments, setDepartments] = useState([]);   // names only, for the sign-in screen
  const [sessionId, setSessionId] = useState(null);
  const [department, setDepartment] = useState(null);
  const [allowedPages, setAllowedPages] = useState(null);   // null until known
  const [accessLevel, setAccessLevel] = useState(null);     // admin | hod | member
  const [ready, setReady] = useState(false);
  const etagRef = useRef(null);
  const loadingMembersRef = useRef(false);
  // Ignore a session check started before a newer login/logout operation.
  const authEpochRef = useRef(0);

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
      if (Array.isArray(body.departments)) setDepartments(body.departments);
    } finally {
      loadingMembersRef.current = false;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const epoch = authEpochRef.current;
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (epoch !== authEpochRef.current) return null;
      if (!response.ok) {
        setSessionId(null);
        setDepartment(null);
        setAllowedPages(null);
        setAccessLevel(null);
        return null;
      }
      const body = await response.json();
      if (epoch !== authEpochRef.current) return null;
      setSessionId(body.member?.id || null);
      setDepartment(body.department || null);
      setAllowedPages(Array.isArray(body.allowedPages) ? body.allowedPages : null);
      setAccessLevel(body.accessLevel || null);
      return body.member || null;
    } catch {
      if (epoch === authEpochRef.current) {
        setSessionId(null);
        setDepartment(null);
        setAllowedPages(null);
        setAccessLevel(null);
      }
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
    // Invalidate a startup session request that might finish after sign-in.
    const epoch = ++authEpochRef.current;
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, pin }),
    });

    if (!response.ok) return { ok: false, message: await getError(response, "Unable to sign in.") };

    const body = await response.json();
    if (epoch !== authEpochRef.current) return { ok: false, message: "Sign-in was interrupted." };

    // The login response is the authoritative, freshly computed permissions
    // for this member. No second request or browser refresh is needed.
    setSessionId(body.member?.id || null);
    setDepartment(body.department || null);
    setAllowedPages(Array.isArray(body.allowedPages) ? body.allowedPages : null);
    setAccessLevel(body.accessLevel || null);
    await refreshMembers({ force: true });
    return { ok: true, member: body.member };
  };

  const logout = async () => {
    ++authEpochRef.current;
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    setSessionId(null);
    setDepartment(null);
    setAllowedPages(null);
    setAccessLevel(null);
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

  // Until the session is known, allowedPages is null and callers wait rather
  // than flashing a sidebar the member may not be entitled to.
  const canOpen = (pageId) => (allowedPages ? allowedPages.includes(pageId) : false);

  const value = {
    ready,
    members,
    departments,
    currentMember,
    department,
    accessLevel,
    // Only Management, Admin and HOD Admin may look at another department.
    // Matches the server: only the access level widens the data view.
    canSwitchDepartments: accessLevel === "admin",
    allowedPages,
    canOpen,
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
