'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PublicTeamHero from '@/components/PublicTeamHero';
import PublicTeamNav from '@/components/PublicTeamNav';
import { supabase } from '@/lib/supabase';
import type { Team } from '@/lib/types';

type PublicTeamPageShellProps = {
  team: Team;
  teamId: string;
  children: ReactNode;
};

export default function PublicTeamPageShell({
  team,
  teamId,
  children,
}: PublicTeamPageShellProps) {
  // ---------------------------------------------------
  // ROUTER / ADMIN LOGIN STATE
  // ---------------------------------------------------

  const router = useRouter();

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminError, setAdminError] = useState('');
  const [checkingAdminCode, setCheckingAdminCode] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  async function checkDirectAdminAccess(currentTeamId: string) {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      return { hasAccess: false, error: sessionError.message || 'Failed to check sign-in status.' };
    }

    const user = session?.user;

    if (!user) {
      return { hasAccess: false, error: '' };
    }

    const { data: superAdmin, error: superAdminError } = await supabase
      .from('super_admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (superAdminError) {
      return {
        hasAccess: false,
        error: superAdminError.message || 'Failed to verify super admin access.',
      };
    }

    if (superAdmin) {
      return { hasAccess: true, error: '' };
    }

    const { data: membership, error: membershipError } = await supabase
      .from('team_users')
      .select('id')
      .eq('team_id', currentTeamId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError) {
      return {
        hasAccess: false,
        error: membershipError.message || 'Failed to verify team access.',
      };
    }

    return { hasAccess: !!membership, error: '' };
  }

  // ---------------------------------------------------
  // ADMIN SESSION HELPERS
  // ---------------------------------------------------

  function getAdminSession() {
    try {
      const raw = localStorage.getItem('teamAdminSession');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function hasValidAdminSession(currentTeamId: string) {
    try {
      const raw = localStorage.getItem('teamAdminSession');
      if (!raw) return false;

      const session = JSON.parse(raw);

      return session.teamId === currentTeamId && session.expires > Date.now();
    } catch {
      return false;
    }
  }

  function setAdminSession(currentTeamId: string) {
    const session = {
      teamId: currentTeamId,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    localStorage.setItem('teamAdminSession', JSON.stringify(session));
  }

  // ---------------------------------------------------
// ADMIN SESSION CHECK
// ---------------------------------------------------

useEffect(() => {
  async function syncAdminAccess() {
    const isValid = hasValidAdminSession(team.id);

    if (isValid) {
      localStorage.setItem('teamId', team.id);
      setHasAdminAccess(true);
      return;
    }

    localStorage.removeItem('teamAdminSession');
    localStorage.removeItem('teamId');

    const { hasAccess } = await checkDirectAdminAccess(team.id);
    setHasAdminAccess(hasAccess);
  }

  syncAdminAccess();
}, [team.id]);

  // ---------------------------------------------------
  // ADMIN LOGIN HELPERS
  // ---------------------------------------------------

 async function openAdminLogin() {
  const session = getAdminSession();

  if (session && session.teamId === team.id && session.expires > Date.now()) {
    localStorage.setItem('teamId', team.id);
    setHasAdminAccess(true);
    router.push(`/teams/${team.id}`);
    return;
  }

  const { hasAccess, error } = await checkDirectAdminAccess(team.id);

  if (hasAccess) {
    localStorage.setItem('teamId', team.id);
    setHasAdminAccess(true);
    router.push(`/teams/${team.id}`);
    return;
  }

  if (error) {
    setAdminError(error);
    setCheckingAdminCode(false);
    setShowAdminLogin(true);
    return;
  }

  setAdminCode('');
  setAdminError('');
  setCheckingAdminCode(false);
  setShowAdminLogin(true);
}

  function closeAdminLogin() {
    setShowAdminLogin(false);
    setAdminCode('');
    setAdminError('');
    setCheckingAdminCode(false);
  }

  async function handleAdminLogin() {
    setCheckingAdminCode(true);
    setAdminError('');

    const entered = adminCode.trim();

    if (!entered) {
      setAdminError('Enter the admin code.');
      setCheckingAdminCode(false);
      return;
    }

    const { data: success, error } = await supabase.rpc('verify_team_admin_code', {
      target_team_id: team.id,
      entered_code: entered,
    });

    if (error) {
      setAdminError(error.message || 'Failed to verify team code.');
      setCheckingAdminCode(false);
      return;
    }

    if (!success) {
      setAdminError('Incorrect team code.');
      setCheckingAdminCode(false);
      return;
    }

    // ---------------------------------------------------
    // SAVE ADMIN SESSION
    // ---------------------------------------------------

    localStorage.setItem('teamId', team.id);
    localStorage.removeItem('teamAdminSession');
    setAdminSession(team.id);
    setHasAdminAccess(true);

    setCheckingAdminCode(false);
    setShowAdminLogin(false);
    setAdminCode('');
    router.push(`/teams/${team.id}`);
  }

  // ---------------------------------------------------
  // STANDARD PUBLIC TEAM BANNER ACTIONS
  // ---------------------------------------------------

  const bannerActions = [
    {
      type: 'link' as const,
      href: `/public/team/${team.id}`,
      label: 'Team Page',
      variant: 'glass' as const,
    },
    {
      type: 'link' as const,
      href: `/public/team/${team.id}/schedule`,
      label: 'Schedule',
      variant: 'glass' as const,
    },
    {
      type: 'button' as const,
      onClick: openAdminLogin,
      label: hasAdminAccess ? 'Admin Dashboard' : 'Admin Page',
      variant: 'admin' as const,
      icon: 'lock' as const,
    },
  ];

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <>
      <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">
        {/* --------------------------------------------------- */}
        {/* PUBLIC TEAM HERO */}
        {/* --------------------------------------------------- */}

        <PublicTeamHero
          team={team}
          eyebrow="Public Team Page"
          description={team.club_name || 'Team overview, schedules, results, and match recaps.'}
          actions={bannerActions}
        />

        {/* --------------------------------------------------- */}
        {/* PUBLIC TEAM NAV */}
        {/* --------------------------------------------------- */}

        <PublicTeamNav teamId={teamId} />

        {/* --------------------------------------------------- */}
        {/* PAGE CONTENT */}
        {/* --------------------------------------------------- */}

        {children}
      </main>

      {/* --------------------------------------------------- */}
      {/* ADMIN LOGIN MODAL */}
      {/* --------------------------------------------------- */}

      {showAdminLogin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Team Admin Login
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
              Enter Team Code
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Enter the admin code to access the admin page for {team.name}.
            </p>

            <div className="mt-5">
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                placeholder="Team admin code"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                autoFocus
              />
            </div>

            {adminError ? (
              <p className="mt-3 text-sm font-medium text-red-600">{adminError}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAdminLogin}
                disabled={checkingAdminCode}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {checkingAdminCode ? 'Checking…' : 'Continue'}
              </button>

              <button
                type="button"
                onClick={closeAdminLogin}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
