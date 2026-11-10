import 'server-only';
import { cookies } from 'next/headers';

export type SessionPayload = {
  memberId: string;
  departmentId: string;
  role: string;
};

const COOKIE = 'sdc_session';

// Point this at your existing session helper if you already have one.
// Sign the payload before shipping to production.
export async function createSession(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
