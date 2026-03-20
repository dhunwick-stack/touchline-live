'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import TeamPageIntro from '@/components/TeamPageIntro';
import { useTeamAccessGuard } from '@/lib/useTeamAccessGuard';
import { supabase } from '@/lib/supabase';
import type { Match, Season, Team } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type GroupedMatches = {
  label: string;
  matches: MatchRow[];
};

// ---------------------------------------------------
// PAGE
// FILE: app/teams/[teamId]/schedule/page.tsx
// ---------------------------------------------------

export default function TeamSchedulePage() {
  // ---------------------------------------------------
  // ROUTE PARAMS
  // ---------------------------------------------------

  const params = useParams();
  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  // ---------------------------------------------------
  // SHARED TEAM ACCESS GUARD
  // ---------------------------------------------------

  const {
    authChecked,
    error: accessError,
    loading: accessLoading,
  } = useTeamAccessGuard({
    teamId,
    nextPath: `/teams/${teamId}/schedule`,
  });

  // ---------------------------------------------------
  // PAGE STATE
  // ---------------------------------------------------

  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);

  // ---------------------------------------------------
  // LOAD TEAM + MATCHES + SEASONS
  // ---------------------------------------------------

  async function loadData() {
    if (!teamId) return;

    setLoading(true);
    setMessage('');

    const [
      { data: teamData, error: teamError },
      { data: matchData, error: matchError },
      { data: seasonData, error: seasonError },
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
        .order('match_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('seasons').select('*').order('start_date', { ascending: false }),
    ]);

    if (teamError || matchError || seasonError) {
      setMessage(
        teamError?.message ||
          matchError?.message ||
          seasonError?.message ||
          'Failed to load team schedule.',
      );
      setLoading(false);
      return;
    }

    const loadedSeasons = (seasonData as Season[]) ?? [];

    setTeam((teamData as Team) ?? null);
    setMatches((matchData as MatchRow[]) ?? []);
    setSeasons(loadedSeasons);

    const activeSeason = loadedSeasons.find((season) => season.is_active);
    setSelectedSeasonId(activeSeason?.id || 'all');

    setLoading(false);
  }

  // ---------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId || !authChecked) return;
    loadData();
  }, [teamId, authChecked]);

  // ---------------------------------------------------
  // DELETE MATCH
  // ---------------------------------------------------

  async function handleDeleteMatch(match: MatchRow) {
    const opponentName =
      match.home_team?.name && match.away_team?.name
        ? `${match.home_team.name} vs ${match.away_team.name}`
        : 'this match';

    const confirmed = window.confirm(
      `Delete ${opponentName}? This will permanently remove the match record and may also remove related live data. This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingMatchId(match.id);
    setMessage('');

    const { error } = await supabase.from('matches').delete().eq('id', match.id);

    if (error) {
      setMessage(error.message || 'Failed to delete match.');
      setDeletingMatchId(null);
      return;
    }

    await loadData();
    setDeletingMatchId(null);
  }

  // ---------------------------------------------------
  // FILTERED MATCHES
  // ---------------------------------------------------

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const matchesSeason =
        selectedSeasonId === 'all' || match.season_id === selectedSeasonId;

      if (!matchesSeason) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        match.home_team?.name,
        match.away_team?.name,
        match.venue,
        match.status,
        match.status_note,
        match.home_team?.club_name,
        match.away_team?.club_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [matches, normalizedQuery, selectedSeasonId]);

  // ---------------------------------------------------
  // MATCH GROUPS
  // ---------------------------------------------------

  const scheduledMatches = useMemo(
    () =>
      filteredMatches.filter((match) =>
        ['not_started', 'scheduled', 'live', 'halftime'].includes(match.status),
      ),
    [filteredMatches],
  );

  const delayedMatches = useMemo(
    () => filteredMatches.filter((match) => ['postponed', 'cancelled'].includes(match.status)),
    [filteredMatches],
  );

  const nextUpcomingMatch = useMemo(() => {
    const now = Date.now();

    return (
      scheduledMatches
        .filter((match) => {
          if (!match.match_date) return false;

          return (
            ['not_started', 'scheduled'].includes(match.status) &&
            new Date(match.match_date).getTime() >= now
          );
        })
        .sort((a, b) => {
          const aTime = a.match_date
            ? new Date(a.match_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          const bTime = b.match_date
            ? new Date(b.match_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        })[0] ?? null
    );
  }, [scheduledMatches]);

  const groupedScheduledMatches = useMemo<GroupedMatches[]>(() => {
    const groups = new Map<string, MatchRow[]>();

    for (const match of scheduledMatches) {
      const label = match.match_date ? formatGroupDate(match.match_date) : 'Date TBD';

      if (!groups.has(label)) {
        groups.set(label, []);
      }

      groups.get(label)!.push(match);
    }

    return Array.from(groups.entries()).map(([label, grouped]) => ({
      label,
      matches: grouped.sort((a, b) => {
        const aTime = a.match_date
          ? new Date(a.match_date).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.match_date
          ? new Date(b.match_date).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
    }));
  }, [scheduledMatches]);

  // ---------------------------------------------------
  // LOADING / ERROR / EMPTY TEAM
  // ---------------------------------------------------

  if ((loading || accessLoading) && !team) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading team schedule...</main>;
  }

  if ((accessError || message) && !team) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
        {accessError || message}
      </main>
    );
  }

  if (!authChecked && !team) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading team schedule...</main>;
  }

  if (!team) {
    return <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">Team not found.</main>;
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <>
      {/* --------------------------------------------------- */}
      {/* PAGE INTRO */}
      {/* --------------------------------------------------- */}

      <TeamPageIntro
        eyebrow="Team Schedule"
        title="Upcoming Fixtures"
        description="Browse this team's schedule, live fixtures, and match updates by season."
        rightSlot={
          <div className="min-w-[220px]">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Season
            </label>

            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
            >
              <option value="all">All Seasons</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* --------------------------------------------------- */}
        {/* SEARCH BAR */}
        {/* --------------------------------------------------- */}

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
              placeholder="Search opponent, venue, or status"
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </section>

        {/* --------------------------------------------------- */}
        {/* ERROR MESSAGE */}
        {/* --------------------------------------------------- */}

        {message ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        {/* --------------------------------------------------- */}
        {/* NEXT MATCH */}
        {/* --------------------------------------------------- */}

        {!loading && nextUpcomingMatch ? (
          <section className="mb-8 rounded-3xl bg-slate-900 p-6 text-white shadow-sm ring-1 ring-slate-800">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Next Match
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  {nextUpcomingMatch.home_team?.name || 'Home Team'} vs{' '}
                  {nextUpcomingMatch.away_team?.name || 'Away Team'}
                </h2>
                <p className="mt-2 text-slate-300">
                  {nextUpcomingMatch.match_date
                    ? formatMatchDate(nextUpcomingMatch.match_date)
                    : 'Date TBD'}
                  {nextUpcomingMatch.venue ? ` • ${nextUpcomingMatch.venue}` : ''}
                </p>
              </div>

              <StatusBadge status={nextUpcomingMatch.status} />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
              {/* ------------------------------------------------- */}
              {/* HOME */}
              {/* ------------------------------------------------- */}

              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Home
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {nextUpcomingMatch.home_team?.logo_url ? (
                    <img
                      src={nextUpcomingMatch.home_team.logo_url}
                      alt={`${nextUpcomingMatch.home_team.name} logo`}
                      className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
                    />
                  ) : null}

                  <h3 className="truncate text-2xl font-black text-white">
                    {nextUpcomingMatch.home_team?.name || 'Home Team'}
                  </h3>
                </div>
              </div>

              {/* ------------------------------------------------- */}
              {/* CENTER */}
              {/* ------------------------------------------------- */}

              <div className="rounded-2xl bg-white/10 px-5 py-4 text-center ring-1 ring-white/10">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Upcoming
                </div>
                <div className="mt-1 text-lg font-bold text-white">vs</div>
              </div>

              {/* ------------------------------------------------- */}
              {/* AWAY */}
              {/* ------------------------------------------------- */}

              <div className="min-w-0 md:text-right">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Away
                </p>
                <div className="mt-2 flex items-center justify-end gap-3">
                  <h3 className="truncate text-2xl font-black text-white">
                    {nextUpcomingMatch.away_team?.name || 'Away Team'}
                  </h3>

                  {nextUpcomingMatch.away_team?.logo_url ? (
                    <img
                      src={nextUpcomingMatch.away_team.logo_url}
                      alt={`${nextUpcomingMatch.away_team.name} logo`}
                      className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            {/* ------------------------------------------------- */}
            {/* NEXT MATCH ACTIONS */}
            {/* ------------------------------------------------- */}

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex flex-wrap justify-end gap-3">
                <Link
                  href={`/live/${nextUpcomingMatch.id}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  Manage Match
                </Link>

                <Link
                  href={`/matches/${nextUpcomingMatch.id}/edit`}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
                >
                  Edit Match
                </Link>

                {nextUpcomingMatch.public_slug ? (
                  <Link
                    href={`/public/${nextUpcomingMatch.public_slug}`}
                    target="_blank"
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold hover:bg-emerald-600"
                    style={{ color: '#ffffff' }}
                  >
                    Public Scoreboard
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* --------------------------------------------------- */}
        {/* LOADING / EMPTY STATE */}
        {/* --------------------------------------------------- */}

        {loading ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            Loading schedule...
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">No matches found</h2>
            <p className="mt-2 text-slate-600">
              Try another search or season filter, or create a new match.
            </p>

            <Link
              href="/matches/new"
              className="mt-5 inline-flex rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
            >
              Create Match
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ------------------------------------------------- */}
            {/* UPCOMING / LIVE */}
            {/* ------------------------------------------------- */}

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Upcoming Schedule</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Matches grouped by date, including live and halftime fixtures.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                  {scheduledMatches.length}
                </span>
              </div>

              {groupedScheduledMatches.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming matches found.</p>
              ) : (
                <div className="space-y-8">
                  {groupedScheduledMatches.map((group) => (
                    <div key={group.label}>
                      <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                        <h3 className="text-lg font-bold text-slate-900">{group.label}</h3>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {group.matches.length}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {group.matches.map((match) => (
                          <ScheduleMatchCard
                            key={match.id}
                            match={match}
                            deleting={deletingMatchId === match.id}
                            onDelete={handleDeleteMatch}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ------------------------------------------------- */}
            {/* SCHEDULE CHANGES */}
            {/* ------------------------------------------------- */}

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Schedule Changes</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Postponed and cancelled fixtures.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                  {delayedMatches.length}
                </span>
              </div>

              {delayedMatches.length === 0 ? (
                <p className="text-sm text-slate-500">No schedule changes right now.</p>
              ) : (
                <div className="space-y-4">
                  {delayedMatches.map((match) => (
                    <ScheduleMatchCard
                      key={match.id}
                      match={match}
                      deleting={deletingMatchId === match.id}
                      onDelete={handleDeleteMatch}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------
// SCHEDULE MATCH CARD
// ---------------------------------------------------

function ScheduleMatchCard({
  match,
  deleting,
  onDelete,
}: {
  match: MatchRow;
  deleting: boolean;
  onDelete: (match: MatchRow) => void;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
      {/* ------------------------------------------------- */}
      {/* MATCH DETAILS */}
      {/* ------------------------------------------------- */}

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={match.status} />

          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
          </span>

          {match.venue ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {match.venue}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          {/* ------------------------------------------------- */}
          {/* HOME TEAM */}
          {/* ------------------------------------------------- */}

          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Home
            </p>

            <div className="mt-1 flex items-center gap-3">
              {match.home_team?.logo_url ? (
                <img
                  src={match.home_team.logo_url}
                  alt={`${match.home_team.name} logo`}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                />
              ) : null}

              <h3 className="truncate text-xl font-black text-slate-900">
                {match.home_team?.name || 'Home Team'}
              </h3>
            </div>
          </div>

          {/* ------------------------------------------------- */}
          {/* SCORE / VS */}
          {/* ------------------------------------------------- */}

          <div className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-white shadow-sm">
            {match.status === 'final' || match.status === 'live' || match.status === 'halftime' ? (
              <div className="text-3xl font-black">
                {match.home_score} - {match.away_score}
              </div>
            ) : (
              <div className="text-lg font-bold uppercase tracking-wide">vs</div>
            )}
          </div>

          {/* ------------------------------------------------- */}
          {/* AWAY TEAM */}
          {/* ------------------------------------------------- */}

          <div className="min-w-0 md:text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Away
            </p>

            <div className="mt-1 flex items-center justify-end gap-3">
              <h3 className="truncate text-xl font-black text-slate-900">
                {match.away_team?.name || 'Away Team'}
              </h3>

              {match.away_team?.logo_url ? (
                <img
                  src={match.away_team.logo_url}
                  alt={`${match.away_team.name} logo`}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                />
              ) : null}
            </div>
          </div>
        </div>

        {match.status_note ? (
          <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
            <span className="font-semibold text-slate-800">Note:</span> {match.status_note}
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------- */}
      {/* ACTIONS BELOW MATCH INFO */}
      {/* ------------------------------------------------- */}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href={`/live/${match.id}`}
            className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Manage Match
          </Link>

          <Link
            href={`/matches/${match.id}/edit`}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
          >
            Edit Match
          </Link>

          {match.public_slug ? (
            <Link
              href={`/public/${match.public_slug}`}
              target="_blank"
              className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
            >
              Public Scoreboard
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => onDelete(match)}
            disabled={deleting}
            className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete Match'}
          </button>
        </div>
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
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
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
      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
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
// DATE HELPERS
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

function formatGroupDate(value: string) {
  const date = new Date(value);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const matchDay = new Date(date);
  matchDay.setHours(0, 0, 0, 0);

  if (matchDay.getTime() === today.getTime()) {
    return 'Today';
  }

  if (matchDay.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  const diffDays = Math.floor((matchDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 6) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
