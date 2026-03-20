'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasValidAdminSession, clearAdminSession } from '@/lib/admin-session';
import { supabase } from '@/lib/supabase';

const adminSections = [
  {
    title: 'Organizations',
    description: 'Manage clubs, schools, branding, and organization structure.',
    href: '/admin/org',
  },
  {
    title: 'Teams',
    description: 'Manage teams, rosters, colors, and team-level details.',
    href: '/teams',
  },
  {
    title: 'Public Organizations',
    description: 'Jump to the public organization directory.',
    href: '/public/org',
  },
  {
    title: 'Public Teams',
    description: 'Jump to the main team list and login entry point.',
    href: '/teams',
  },
  {
    title: 'Access Requests',
    description: 'Review signup requests and grant team access approvals.',
    href: '/admin/requests',
  },
];

export default function AdminHomePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    const isValid = hasValidAdminSession();

    if (!isValid) {
      clearAdminSession();
      router.replace('/admin/admin-login?next=/admin');
      return;
    }

    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;

    async function loadPendingRequestCount() {
      const { count, error } = await supabase
        .from('team_access_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) return;
      setPendingRequestCount(count ?? 0);
    }

    loadPendingRequestCount();
  }, [authChecked]);

  if (!authChecked) {
    return <main className="mx-auto max-w-6xl px-6 py-10">Loading admin...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Admin Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Central place for managing organizations, teams, and public-facing content.
        </p>
      </div>

      {pendingRequestCount > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {pendingRequestCount} pending access request
          {pendingRequestCount === 1 ? '' : 's'} need review.
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* ADMIN GRID */}
      {/* --------------------------------------------------- */}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {adminSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:bg-slate-50"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
              {section.href === '/admin/requests' && pendingRequestCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                  {pendingRequestCount} pending
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-600">{section.description}</p>

            <div className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Open
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
