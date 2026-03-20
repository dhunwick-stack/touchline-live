'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AdminAccessPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const next = searchParams.get('next') || '/admin';
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      setUserEmail(session.user.email || '');

      const { data: superAdmin } = await supabase
        .from('super_admin_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (superAdmin) {
        router.replace(next);
        return;
      }

      setChecking(false);
    }

    checkAccess();
  }, [next, router]);

  if (checking) {
    return <main className="mx-auto max-w-md px-6 py-12">Checking admin access...</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Super Admin Access
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          {userEmail || 'This account'} is signed in, but it is not currently listed as a super
          admin.
        </p>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ask an existing super admin to add your Supabase user id to the <code>super_admin_users</code>{' '}
          table.
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            Return Home
          </Link>
          <Link
            href="/teams"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Go to Teams
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-12">Loading login...</main>}>
      <AdminAccessPageInner />
    </Suspense>
  );
}
