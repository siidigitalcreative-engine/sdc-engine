import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { readMembersState } from "./member-store";

export const AUTH_COOKIE = "sdc_auth";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload, pinHash) {
  return createHmac("sha256", pinHash).update(payload).digest("base64url");
}

export function createAuthToken(member) {
  const payload = encode(JSON.stringify({
    memberId: member.id,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  }));
  return `${payload}.${signature(payload, member.pinHash)}`;
}

export async function getAuthenticatedMember(request) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;

  let data;
  try {
    data = JSON.parse(decode(payload));
  } catch {
    return null;
  }

  if (!data.memberId || !data.exp || Date.now() > Number(data.exp)) return null;

  const { state } = await readMembersState();
  const member = state.members.find((item) => item.id === data.memberId);
  if (!member) return null;

  const expected = signature(payload, member.pinHash);
  const a = Buffer.from(expected);
  const b = Buffer.from(suppliedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return member;
}

export function setAuthCookie(response, token) {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearAuthCookie(response) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
