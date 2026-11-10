'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Lock, Sparkles, Users } from 'lucide-react';
import { signInAction } from '@/app/actions/auth';
import type { Department, Member } from '@/lib/auth/types';

const LAST_DEPT_KEY = 'sdc:lastDepartmentId';

type Props = { departments: Department[]; members: Member[] };

export default function SignInFlow({ departments, members }: Props) {
  const onlyOne = departments.length === 1;

  const [departmentId, setDepartmentId] = useState<string | null>(
    onlyOne ? departments[0].id : null,
  );
  const [memberId, setMemberId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onlyOne) return;
    const saved = window.localStorage.getItem(LAST_DEPT_KEY);
    if (saved && departments.some((d) => d.id === saved)) setDepartmentId(saved);
  }, [departments, onlyOne]);

  const department = useMemo(
    () => departments.find((d) => d.id === departmentId) ?? null,
    [departments, departmentId],
  );

  const deptMembers = useMemo(
    () => members.filter((m) => m.departmentId === departmentId),
    [members, departmentId],
  );

  const member = useMemo(
    () => deptMembers.find((m) => m.id === memberId) ?? null,
    [deptMembers, memberId],
  );

  function pickDepartment(id: string) {
    setDepartmentId(id);
    setMemberId(null);
    setPin('');
    setError(null);
    window.localStorage.setItem(LAST_DEPT_KEY, id);
  }

  function backToDepartments() {
    setDepartmentId(null);
    setMemberId(null);
    setPin('');
    setError(null);
  }

  function pickMember(id: string) {
    setMemberId(id);
    setPin('');
    setError(null);
    requestAnimationFrame(() => pinRef.current?.focus());
  }

  function submit() {
    if (!departmentId || !memberId || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await signInAction({ departmentId, memberId, pin });
      if (res && res.ok === false) {
        setError(res.error);
        setPin('');
        pinRef.current?.focus();
      }
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFAA62] to-[#E53E30] shadow-sm">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Welcome to SDC</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
          {department
            ? 'Sign in to your creative team workspace'
            : 'Select your department to continue'}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {!department ? (
          <section>
            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-neutral-200">
              Department
            </p>
            <div className="grid grid-cols-2 gap-3">
              {departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => pickDepartment(d.id)}
                  className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#E53E30]/40 hover:bg-orange-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E53E30]/40 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#FFAA62] to-[#E53E30] text-[11px] font-semibold tracking-wide text-white">
                    {d.shortName}
                  </span>
                  <span className="text-sm font-medium leading-tight text-slate-900 dark:text-white">
                    {d.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400">
                    <Users className="h-3 w-3" />
                    {d.memberCount} {d.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section>
            {!onlyOne && (
              <button
                type="button"
                onClick={backToDepartments}
                className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-[#E53E30] dark:text-neutral-400"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {department.name}
                <span className="text-slate-400 dark:text-neutral-500">· change</span>
              </button>
            )}

            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-neutral-200">
              Team member
            </p>
            <div className="flex flex-wrap gap-2">
              {deptMembers.map((m) => {
                const active = m.id === memberId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickMember(m.id)}
                    className={`flex w-[62px] flex-col items-center gap-1.5 rounded-xl p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E53E30]/40 ${
                      active
                        ? 'bg-slate-100 ring-1 ring-slate-200 dark:bg-neutral-800 dark:ring-neutral-700'
                        : 'hover:bg-slate-50 dark:hover:bg-neutral-800/60'
                    }`}
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: m.avatarColor }}
                    >
                      {m.initials}
                    </span>
                    <span className="w-full truncate text-center text-[11px] text-slate-600 dark:text-neutral-300">
                      {m.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {member && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-100 p-3 dark:bg-neutral-800">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: member.avatarColor }}
                >
                  {member.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {member.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">
                    {member.role}
                  </span>
                </span>
              </div>
            )}

            <label
              htmlFor="pin"
              className="mt-5 block text-sm font-medium text-slate-700 dark:text-neutral-200"
            >
              PIN
            </label>
            <div className="relative mt-2">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="pin"
                ref={pinRef}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                disabled={!member || pending}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder={member ? 'Enter your PIN' : 'Select a member first'}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#E53E30]/40 focus:outline-none focus:ring-2 focus:ring-[#E53E30]/20 disabled:bg-slate-50 disabled:text-slate-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:disabled:bg-neutral-800"
              />
            </div>

            {error && (
              <p role="alert" className="mt-2 text-xs font-medium text-[#E53E30]">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!member || pin.length < 4 || pending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFAA62] to-[#E53E30] py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Signing in...' : 'Sign in'}
              {!pending && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="mt-4 text-center text-xs leading-relaxed text-slate-500 dark:text-neutral-400">
              Starter accounts use PIN{' '}
              <span className="font-semibold text-slate-700 dark:text-neutral-200">1234</span>. You
              can change each member&apos;s PIN from Team Members.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
