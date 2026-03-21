'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Match, Team } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

// ---------------------------------------------------
// PAGE
// FILE: app/matches/page.tsx
// ---------------------------------------------------

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [managedTeamIds, setManagedTeamIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [nowMs, setNowMs] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------
  // LOAD MATCHES
  // ---------------------------------------------------

  async function loadMatches() {
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:home_team_id (*),
        away_team:away_team_id (*)
      `)
      .order('match_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(`Load error: ${error.message}`);
      setLoading(false);
      return;
    }

    setMatches((data as MatchRow[]) ?? []);
    setLoading(false);
  }

  async function handleDeleteMatch(match: MatchRow) {
    if (!canManageMatch(match, isSuperAdmin, managedTeamIds)) {
      setMessage('You do not have permission to delete this match.');
      return;
    }

    const confirmed = window.confirm(
      `Delete match "${match.home_team?.name || 'Home Team'} vs ${match.away_team?.name || 'Away Team'}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setMessage('');

    const { error } = await supabase.from('matches').delete().eq('id', match.id);

    if (error) {
      setMessage(error.message || 'Failed to delete match.');
      return;
    }

    await loadMatches();
  }

  // ---------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMatches();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      if (!user) {
        if (!cancelled) {
          setCurrentUser(null);
          setIsSuperAdmin(false);
          setManagedTeamIds([]);
        }
        return;
      }

      const [{ data: superAdminData }, { data: teamUserData }] = await Promise.all([
        supabase
          .from('super_admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('team_users')
          .select('team_id')
          .eq('user_id', user.id),
      ]);

      if (!cancelled) {
        setCurrentUser(user);
        setIsSuperAdmin(Boolean(superAdminData));
        setManagedTeamIds((teamUserData ?? []).map((row) => row.team_id).filter(Boolean));
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (!user) {
        setIsSuperAdmin(false);
        setManagedTeamIds([]);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ---------------------------------------------------
  // REALTIME REFRESH
  // ---------------------------------------------------

  useEffect(() => {
    const channel = supabase
      .channel('matches-page-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        async () => {
          await loadMatches();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
        },
        async () => {
          await loadMatches();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---------------------------------------------------
  // LIVE CLOCK TICKER
  // Keeps live cards feeling current between DB updates.
  // ---------------------------------------------------

  useEffect(() => {
    const hasRunningLiveMatch = matches.some(
      (match) => match.status === 'live' && match.clock_running,
    );

    if (!hasRunningLiveMatch) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [matches]);

  // ---------------------------------------------------
  // DERIVED MATCH GROUPS
  // ---------------------------------------------------

  const liveMatches = useMemo(
    () =>
      matches
        .filter((match) => matchMatchesSearch(match, searchQuery))
        .filter((match) => match.status === 'live' || match.status === 'halftime')
        .sort((a, b) => {
          const aTime = a.match_date ? new Date(a.match_date).getTime() : 0;
          const bTime = b.match_date ? new Date(b.match_date).getTime() : 0;
          return bTime - aTime;
        }),
    [matches, searchQuery],
  );

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((match) => matchMatchesSearch(match, searchQuery))
        .filter((match) => ['not_started', 'scheduled'].includes(match.status))
        .sort((a, b) => {
          const aTime = a.match_date ? new Date(a.match_date).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.match_date ? new Date(b.match_date).getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        }),
    [matches, searchQuery],
  );

  const recentResults = useMemo(
    () =>
      matches
        .filter((match) => matchMatchesSearch(match, searchQuery))
        .filter((match) => match.status === 'final')
        .filter((match) => {
          if (!match.match_date) return true;
          return !isSameLocalDay(new Date(match.match_date), new Date(nowMs));
        })
        .sort((a, b) => {
          const aTime = a.match_date ? new Date(a.match_date).getTime() : 0;
          const bTime = b.match_date ? new Date(b.match_date).getTime() : 0;
          return bTime - aTime;
        }),
    [matches, nowMs, searchQuery],
  );

  const completedTodayMatches = useMemo(
    () =>
      matches
        .filter((match) => matchMatchesSearch(match, searchQuery))
        .filter((match) => match.status === 'final')
        .filter((match) => {
          if (!match.match_date) return false;
          return isSameLocalDay(new Date(match.match_date), new Date(nowMs));
        })
        .sort((a, b) => {
          const aTime = a.match_date ? new Date(a.match_date).getTime() : 0;
          const bTime = b.match_date ? new Date(b.match_date).getTime() : 0;
          return bTime - aTime;
        }),
    [matches, nowMs, searchQuery],
  );

  const filteredMatchCount =
    liveMatches.length +
    completedTodayMatches.length +
    upcomingMatches.length +
    recentResults.length;

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="text-3xl font-black tracking-tight">Matches</h1>
          <p className="mt-2 text-slate-600">
            Review live, scheduled, and completed matches.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {currentUser ? (
            <Link
              href="/matches/new"
              className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
            >
              New Match
            </Link>
          ) : null}

          <Link
            href="/teams"
            className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 ring-1 ring-slate-200"
          >
            Teams
          </Link>
        </div>
      </div>

      {message ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {message}
        </div>
      ) : null}

      <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search
        </label>

        <div className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 ring-1 ring-slate-200">
          <svg
            className="h-4 w-4 shrink-0 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team, venue, status, or tracking mode"
            className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          Loading matches...
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">No matches yet</h2>
          <p className="mt-2 text-slate-600">
            Create your first match to start scoring live.
          </p>

          <Link
            href="/matches/new"
            className="mt-5 inline-flex rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            Create Match
          </Link>
        </div>
      ) : filteredMatchCount === 0 ? (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">No matches found</h2>
          <p className="mt-2 text-slate-600">
            Try a different team, venue, status, or tracking-mode search.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <MatchSection
            title="Live Now"
            subtitle="Matches currently in progress or at halftime."
            count={liveMatches.length}
            emptyText="No live matches right now."
            matches={liveMatches}
            highlight={liveMatches.length > 0}
            nowMs={nowMs}
            showAdminActions={Boolean(currentUser)}
            isSuperAdmin={isSuperAdmin}
            managedTeamIds={managedTeamIds}
            onDeleteMatch={handleDeleteMatch}
          />

          <MatchSection
            title="Completed Today"
            subtitle="Final results from today that should stay near the top."
            count={completedTodayMatches.length}
            emptyText="No matches have gone final yet today."
            matches={completedTodayMatches}
            completedToday
            nowMs={nowMs}
            showAdminActions={Boolean(currentUser)}
            isSuperAdmin={isSuperAdmin}
            managedTeamIds={managedTeamIds}
            onDeleteMatch={handleDeleteMatch}
          />

          <MatchSection
            title="Upcoming"
            subtitle="Scheduled matches coming up next."
            count={upcomingMatches.length}
            emptyText="No upcoming matches scheduled."
            matches={upcomingMatches}
            nowMs={nowMs}
            showAdminActions={Boolean(currentUser)}
            isSuperAdmin={isSuperAdmin}
            managedTeamIds={managedTeamIds}
            onDeleteMatch={handleDeleteMatch}
          />

          <MatchSection
            title="Recent Results"
            subtitle="Completed matches and final scores."
            count={recentResults.length}
            emptyText="No completed matches yet."
            matches={recentResults}
            nowMs={nowMs}
            showAdminActions={Boolean(currentUser)}
            isSuperAdmin={isSuperAdmin}
            managedTeamIds={managedTeamIds}
            onDeleteMatch={handleDeleteMatch}
          />
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------
// MATCH SECTION
// ---------------------------------------------------

function MatchSection({
  title,
  subtitle,
  count,
  emptyText,
  matches,
  highlight = false,
  completedToday = false,
  nowMs,
  showAdminActions,
  isSuperAdmin,
  managedTeamIds,
  onDeleteMatch,
}: {
  title: string;
  subtitle: string;
  count: number;
  emptyText: string;
  matches: MatchRow[];
  highlight?: boolean;
  completedToday?: boolean;
  nowMs: number;
  showAdminActions: boolean;
  isSuperAdmin: boolean;
  managedTeamIds: string[];
  onDeleteMatch: (match: MatchRow) => void | Promise<void>;
}) {
  return (
    <section
      className={`rounded-3xl p-6 shadow-sm ring-1 ${
        highlight ? 'bg-red-50/70 ring-red-200' : 'bg-white ring-slate-200'
      }`}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className={`flex items-center gap-2 text-2xl font-bold ${
              highlight ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {highlight ? (
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
              </span>
            ) : null}
            {title}
          </h2>

          <p className={`mt-1 text-sm ${highlight ? 'text-red-700/80' : 'text-slate-500'}`}>
            {subtitle}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            highlight
              ? 'bg-white text-red-700 ring-1 ring-red-200'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {count}
        </span>
      </div>

      {matches.length === 0 ? (
        <p className={`text-sm ${highlight ? 'text-red-700/70' : 'text-slate-500'}`}>
          {emptyText}
        </p>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              highlight={highlight}
              completedToday={completedToday}
              nowMs={nowMs}
              showAdminActions={showAdminActions}
              isSuperAdmin={isSuperAdmin}
              managedTeamIds={managedTeamIds}
              onDeleteMatch={onDeleteMatch}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------
// MATCH CARD
// ---------------------------------------------------

function MatchCard({
  match,
  highlight = false,
  completedToday = false,
  nowMs,
  showAdminActions,
  isSuperAdmin,
  managedTeamIds,
  onDeleteMatch,
}: {
  match: MatchRow;
  highlight?: boolean;
  completedToday?: boolean;
  nowMs: number;
  showAdminActions: boolean;
  isSuperAdmin: boolean;
  managedTeamIds: string[];
  onDeleteMatch: (match: MatchRow) => void | Promise<void>;
}) {
  // ---------------------------------------------------
  // LIVE CLOCK LABEL
  // ---------------------------------------------------

  const liveClockText = getLiveClockText(match, nowMs);
  const homeWon = match.status === 'final' && match.home_score > match.away_score;
  const awayWon = match.status === 'final' && match.away_score > match.home_score;
  const publicAction = getPublicAction(match, nowMs);
  const canManage = showAdminActions && canManageMatch(match, isSuperAdmin, managedTeamIds);
  const winningTeam = homeWon ? match.home_team : awayWon ? match.away_team : null;
  const completedTodayStyle =
    completedToday && match.status === 'final'
      ? getCompletedTodayCardStyle(winningTeam?.primary_color, winningTeam?.secondary_color)
      : null;

  return (
    <div
      className={`flex h-full flex-col rounded-3xl p-6 ring-1 ${
        completedTodayStyle
          ? 'border-l-4 border-transparent'
          : highlight
          ? 'border-l-4 border-red-500 bg-white ring-red-100'
          : 'bg-slate-50 ring-slate-200'
      }`}
      style={completedTodayStyle ?? undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={match.status} />

          {match.match_date ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {formatMatchDate(match.match_date)}
            </span>
          ) : (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              Date TBD
            </span>
          )}

          {liveClockText ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              {liveClockText}
            </span>
          ) : null}

          {match.venue ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {match.venue}
            </span>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Home</p>

            <div className="mt-1 flex items-center gap-3">
              {match.home_team?.logo_url ? (
                <Link href={`/teams/${match.home_team_id}`} className="shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-slate-200">
                    <img
                      src={match.home_team.logo_url}
                      alt={`${match.home_team.name} logo`}
                      className="h-full w-full object-contain transition hover:opacity-80"
                    />
                  </div>
                </Link>
              ) : null}

              <Link
                href={`/teams/${match.home_team_id}`}
                className="text-xl font-black transition hover:opacity-80 hover:underline md:text-2xl"
              >
                {match.home_team?.name || 'Home Team'}
              </Link>

              {homeWon ? (
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-100 px-2 text-sm font-bold text-emerald-700">
                  W
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-white shadow-sm">
            <div className="text-2xl font-black md:text-3xl">
              {match.home_score} - {match.away_score}
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Away</p>

            <div className="mt-1 flex items-center gap-3">
              {match.away_team?.logo_url ? (
                <Link href={`/teams/${match.away_team_id}`} className="shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-slate-200">
                    <img
                      src={match.away_team.logo_url}
                      alt={`${match.away_team.name} logo`}
                      className="h-full w-full object-contain transition hover:opacity-80"
                    />
                  </div>
                </Link>
              ) : null}

              <Link
                href={`/teams/${match.away_team_id}`}
                className="text-xl font-black transition hover:opacity-80 hover:underline md:text-2xl"
              >
                {match.away_team?.name || 'Away Team'}
              </Link>

              {awayWon ? (
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-100 px-2 text-sm font-bold text-emerald-700">
                  W
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
            Home: {prettyTrackingMode(match.home_tracking_mode)}
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
            Away: {prettyTrackingMode(match.away_tracking_mode)}
          </span>
        </div>

        {(canManage || match.public_slug) ? (
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="flex flex-wrap gap-3 md:flex-nowrap">
              {canManage ? (
                <>
                  <Link
                    href={`/matches/${match.id}/edit`}
                    className="flex-1 rounded-2xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                  >
                    Edit
                  </Link>

                  <Link
                    href={`/live/${match.id}`}
                    className="flex-1 rounded-2xl bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    Manage Match
                  </Link>

                  <button
                    type="button"
                    onClick={() => void onDeleteMatch(match)}
                    className="flex-1 rounded-2xl bg-rose-50 px-4 py-2.5 text-center text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                  >
                    Delete Match
                  </button>
                </>
              ) : null}

              {match.public_slug ? (
                publicAction.disabled ? (
                  <span className="flex-1 rounded-2xl bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-400 ring-1 ring-slate-200">
                    {publicAction.label}
                  </span>
                ) : (
                  <Link
                    href={`/public/${match.public_slug}`}
                    target="_blank"
                    className="flex-1 rounded-2xl bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
                  >
                    {publicAction.label}
                  </Link>
                )
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------
// STATUS BADGE
// ---------------------------------------------------

function StatusBadge({ status }: { status: Match['status'] }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-400/20">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Live
      </span>
    );
  }

  if (status === 'halftime') {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
        Halftime
      </span>
    );
  }

  if (status === 'final') {
    return (
      <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
        Final
      </span>
    );
  }

  if (status === 'postponed') {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
        Postponed
      </span>
    );
  }

  if (status === 'cancelled') {
    return (
      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">
        Cancelled
      </span>
    );
  }

  return (
    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
      Scheduled
    </span>
  );
}

// ---------------------------------------------------
// TRACKING MODE LABEL
// ---------------------------------------------------

function prettyTrackingMode(mode: Match['home_tracking_mode']) {
  if (mode === 'full') return 'Full';
  if (mode === 'basic') return 'Basic';
  if (mode === 'lineups') return 'Lineups';
  return mode;
}

// ---------------------------------------------------
// LIVE CLOCK LABEL HELPER
// ---------------------------------------------------

function getLiveClockText(match: MatchRow, nowMs: number) {
  if (match.status !== 'live' && match.status !== 'halftime') {
    return null;
  }

  if (match.status === 'halftime') {
    return 'Halftime';
  }

  const baseSeconds = match.elapsed_seconds || 0;

  if (match.clock_running && match.period_started_at) {
    const startedMs = new Date(match.period_started_at).getTime();
    const runningSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
    const totalSeconds = baseSeconds + runningSeconds;
    const minute = Math.floor(totalSeconds / 60);

    return `${minute}' Live`;
  }

  const pausedMinute = Math.floor(baseSeconds / 60);
  return `${pausedMinute}' Paused`;
}

function getPublicAction(match: MatchRow, nowMs: number) {
  if (match.status === 'final') {
    return { label: 'View Recap', disabled: false };
  }

  if (match.status === 'live' || match.status === 'halftime') {
    return { label: 'Follow Live', disabled: false };
  }

  const kickoffMs = match.match_date ? new Date(match.match_date).getTime() : null;
  const isEnabledOnGameDay =
    kickoffMs !== null && nowMs >= getStartOfLocalDayMs(new Date(kickoffMs));

  return {
    label: 'Follow Live',
    disabled: !isEnabledOnGameDay,
  };
}

// ---------------------------------------------------
// DATE FORMATTER
// ---------------------------------------------------

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function getStartOfLocalDayMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getCompletedTodayCardStyle(
  primaryColor?: string | null,
  secondaryColor?: string | null,
) {
  if (!primaryColor && !secondaryColor) {
    return {
      background:
        'linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(254,242,242,1) 100%)',
      borderLeftColor: '#dc2626',
      boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.18)',
    };
  }

  const primary = primaryColor || secondaryColor || '#0f172a';
  const secondary = secondaryColor || primaryColor || '#1d4ed8';

  return {
    background: `linear-gradient(135deg, ${primary}14 0%, rgba(255,255,255,0.98) 30%, ${secondary}18 100%)`,
    borderLeftColor: primary,
    boxShadow: `inset 0 0 0 1px ${primary}22`,
  };
}

function matchMatchesSearch(match: MatchRow, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  const haystack = [
    match.home_team?.name,
    match.away_team?.name,
    match.home_team?.club_name,
    match.away_team?.club_name,
    match.venue,
    match.status,
    prettyTrackingMode(match.home_tracking_mode),
    prettyTrackingMode(match.away_tracking_mode),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function canManageMatch(
  match: MatchRow,
  isSuperAdmin: boolean,
  managedTeamIds: string[],
) {
  if (isSuperAdmin) return true;

  return [match.home_team_id, match.away_team_id].some(
    (teamId) => teamId && managedTeamIds.includes(teamId),
  );
}
