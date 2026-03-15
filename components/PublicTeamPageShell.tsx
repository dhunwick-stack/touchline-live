'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PublicTeamHero from '@/components/PublicTeamHero';
import PublicTeamNav from '@/components/PublicTeamNav';
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
      label: 'Admin Page',
      variant: 'admin' as const,
      icon: 'lock' as const,
    },
  ];

  // ---------------------------------------------------
  // ADMIN LOGIN HELPERS
  // ---------------------------------------------------

  function openAdminLogin() {
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
    const expected = (team.admin_code || '').trim();

    if (!expected) {
      setAdminError('No admin code is set for this team.');
      setCheckingAdminCode(false);
      return;
    }

    if (!entered) {
      setAdminError('Enter the admin code.');
      setCheckingAdminCode(false);
      return;
    }

    if (entered !== expected) {
      setAdminError('Incorrect team code.');
      setCheckingAdminCode(false);
      return;
    }

    localStorage.setItem('teamId', team.id);

    setCheckingAdminCode(false);
    setShowAdminLogin(false);
    setAdminCode('');
    router.push(`/teams/${team.id}`);
  }

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