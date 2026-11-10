import { getDepartments, getMembers } from '@/lib/auth/data';
import SignInFlow from '@/components/auth/sign-in-flow';

export const metadata = { title: 'Sign in | SDC Engine' };

export default async function SignInPage() {
  const [departments, members] = await Promise.all([getDepartments(), getMembers()]);
  const selectable = departments.filter((d) => d.memberCount > 0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-neutral-950">
      <SignInFlow departments={selectable} members={members} />
    </main>
  );
}
