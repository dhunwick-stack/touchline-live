'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Match, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export default function TeamLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-10">
          Loading team page...
        </main>
      }
    >
      <TeamLoginPageInner />
    </Suspense>
  );
}

function TeamLoginPageInner() {
  // ---------------------------------------------------
  // ROUTER / SEARCH PARAMS
  // ---------------------------------------------------

  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId') || '';
  const mode = searchParams.get('mode') || '';

  // ---------------------------------------------------
  // PAGE STATE
  // ---------------------------------------------------

  const [team, setTeam] = useState<Team | null>(null);
  const [liveMatch, setLiveMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ---------------------------------------------------
  // ADMIN LOGIN STATE
  // ---------------------------------------------------

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminError, setAdminError] = useState('');
  const [checkingAdminCode, setCheckingAdminCode] = useState(false);
  const [adminTarget, setAdminTarget] = useState<'overview' | 'live'>('overview');

  // ---------------------------------------------------
  // LOAD TEAM / LIVE MATCH
  // ---------------------------------------------------

  useEffect(() => {
    async function loadPage() {
      if (!teamId) {
        setError('No team id was found in the URL.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const [
        { data: teamData, error: teamError },
        { data: liveMatchData, error: liveMatchError },
      ] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('matches')
          .select(`
            *,
            home_team:home_team_id (*),
            away_team:away_team_id (*)
          `)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .in('status', ['live', 'halftime'])
          .order('match_date', { ascending: true, nullsFirst: false })
          .limit(1),
      ]);

      if (teamError || liveMatchError) {
        setError(
          teamError?.message ||
            liveMatchError?.message ||
            'Failed to load team access page.',
        );
        setLoading(false);
        return;
      }

      setTeam((teamData as Team) ?? null);
      setLiveMatch(((liveMatchData as MatchRow[]) ?? [])[0] || null);
      setLoading(false);
    }

    loadPage();
  }, [teamId]);

  // ---------------------------------------------------
  // AUTO OPEN ADMIN LOGIN FROM TEAMS PAGE
  // ---------------------------------------------------

  useEffect(() => {
    if (!loading && team && teamId && mode === 'admin') {
      setAdminTarget('overview');
      setAdminCode('');
      setAdminError('');
      setShowAdminLogin(true);
    }
  }, [loading, team, teamId, mode]);

  // ---------------------------------------------------
  // ADMIN LOGIN ACTIONS
  // ---------------------------------------------------

  function beginAdminLogin(target: 'overview' | 'live') {
    setAdminTarget(target);
    setAdminCode('');
    setAdminError('');
    setShowAdminLogin(true);
  }

  async function handleAdminLogin() {
    if (!team) return;

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

    if (adminTarget === 'live' && liveMatch) {
      router.push(`/live/${liveMatch.id}`);
      return;
    }

    router.push(`/teams/${team.id}`);
  }

  // ---------------------------------------------------
  // LOADING / ERROR
  // ---------------------------------------------------

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        Loading team page...
      </main>
    );
  }

  if (error || !team) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Team unavailable
          </h1>
          <p className="mt-3 text-slate-600">
            {error || 'This team could not be loaded.'}
          </p>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------
  // TEAM HEADER STYLING
  // ---------------------------------------------------

  const teamGradient = {
    background: `linear-gradient(135deg, ${team.primary_color || '#0f172a'}, ${team.secondary_color || '#1e293b'})`,
  };

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 pt-0 pb-10">
        <section
          className="relative left-1/2 right-1/2 -mx-[50vw] mb-8 w-screen overflow-hidden text-white"
          style={teamGradient}
        >
          <div className="absolute inset-0 bg-black/20" />

          <div className="relative mx-auto max-w-6xl px-6 py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={`${team.name} logo`}
                    className="h-20 w-20 rounded-3xl object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-xs font-bold text-white/70 ring-1 ring-white/15">
                    LOGO
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                    Team Access
                  </p>
                  <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                    {team.name}
                  </h1>
                  <p className="mt-2 text-sm text-white/80">
                    Choose your admin or public route for this team.
                  </p>
                </div>
              </div>

              {liveMatch ? (
                <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-300/25">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                  Live match active now
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 self-start rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/15">
                  No live match right now
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-slate-200/30 blur-3xl" />

            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Team Administration
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                Admin Overview
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Manage roster, schedule, results, team settings, and match operations.
              </p>

              {liveMatch ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Live match available
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => beginAdminLogin('overview')}
                  className="inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                >
                  Open Admin Overview
                </button>

                {liveMatch ? (
                  <button
                    type="button"
                    onClick={() => beginAdminLogin('live')}
                    className="inline-flex rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    Administer Live Game
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-200/35 blur-3xl" />

            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Public Team View
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                Public Overview
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                View the public team page, schedule, results, and leaders.
              </p>

              {liveMatch ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Live match available
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/public/team/${team.id}`}
                  className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
                >
                  View Public Team Page
                </Link>

                {liveMatch?.public_slug ? (
                  <Link
                    href={`/public/${liveMatch.public_slug}`}
                    className="inline-flex rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    Follow Live Game
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>

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
              Enter the admin code to access the{' '}
              {adminTarget === 'live' ? 'live admin page' : 'admin overview'}.
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
                onClick={() => {
                  setShowAdminLogin(false);
                  setAdminCode('');
                  setAdminError('');
                }}
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