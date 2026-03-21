'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AppChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasSuperAccess, setHasSuperAccess] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadSessionState() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      const user = session?.user ?? null;
      setUserEmail(user?.email ?? null);

      if (!user) {
        setHasSuperAccess(false);
        setPendingRequestCount(0);
        return;
      }

      const { data: superAdmin } = await supabase
        .from('super_admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;

      const superAccess = !!superAdmin;
      setHasSuperAccess(superAccess);

      if (!superAccess) {
        setPendingRequestCount(0);
        return;
      }

      const { count } = await supabase
        .from('team_access_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (!active) return;
      setPendingRequestCount(count ?? 0);
    }

    loadSessionState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setUserEmail(user?.email ?? null);
      void loadSessionState();
    });

    const refreshInterval = window.setInterval(() => {
      void loadSessionState();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  const userLabel = userEmail?.split('@')[0] || 'there';

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link
            href="/"
            aria-label="Touchline Live home"
            className="flex h-8 w-[140px] shrink-0 items-center overflow-hidden md:h-9 md:w-[156px]"
          >
            <img
              src="/tll-logo.svg"
              alt="Touchline Live"
              className="h-full w-full object-contain object-left"
            />
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Home
            </Link>

            <Link
              href="/teams"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Teams
            </Link>

            {/*/ <Link href="/schedule"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Schedules
            </Link> */}

            <Link
              href="/matches"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Matches
            </Link>

            <Link
              href="/admin/org"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Organizations
            </Link>

            {hasSuperAccess && pendingRequestCount > 0 ? (
              <Link
                href="/admin/requests"
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                {pendingRequestCount} Pending
              </Link>
            ) : null}

            {userEmail ? (
              <div className="ml-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                <Link
                  href="/teams?mine=1"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                >
                  <span>{getGreeting()}, {userLabel}</span>
                  <span aria-hidden="true">→</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div>{children}</div>
    </>
  );
}
