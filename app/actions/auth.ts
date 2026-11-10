'use server';

import { redirect } from 'next/navigation';
import { getMemberById, verifyPin } from '@/lib/auth/data';
import { checkAttempts, recordFailure, clearAttempts } from '@/lib/auth/rate-limit';
import { createSession } from '@/lib/auth/session';

export type SignInResult = { ok: false; error: string };

export async function signInAction(input: {
  departmentId: string;
  memberId: string;
  pin: string;
}): Promise<SignInResult | void> {
  const { departmentId, memberId, pin } = input;

  const member = await getMemberById(memberId);
  if (!member || member.departmentId !== departmentId) {
    return { ok: false, error: 'That member is not in the selected department.' };
  }

  const gate = checkAttempts(memberId);
  if (!gate.allowed) {
    return { ok: false, error: 'Too many attempts. Try again in a few minutes.' };
  }

  if (!/^\d{4,6}$/.test(pin)) {
    recordFailure(memberId);
    return { ok: false, error: 'Enter a 4 to 6 digit PIN.' };
  }

  const valid = await verifyPin(memberId, pin);
  if (!valid) {
    recordFailure(memberId);
    const left = checkAttempts(memberId).remaining;
    return {
      ok: false,
      error: left > 0 ? `Incorrect PIN. ${left} attempts left.` : 'Incorrect PIN.',
    };
  }

  clearAttempts(memberId);

  // Department id travels on the session so server-side page access can read it.
  await createSession({
    memberId: member.id,
    departmentId: member.departmentId,
    role: member.role,
  });

  redirect('/dashboard');
}
