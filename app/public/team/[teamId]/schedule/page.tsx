'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicTeamPageShell from '@/components/PublicTeamPageShell';
import { supabase } from '@/lib/supabase';
import type { Match, Season, Team } from '@/lib/types';
import {
  PUBLIC_MATCH_TEAM_RELATION_SELECT,
  PUBLIC_TEAM_WITH_ORGANIZATION_SELECT,
} from '@/lib/team-selects';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type GroupedMatches = {
  label: string;
  matches: MatchRow[];
};

export default function PublicTeamSchedulePage() {
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
  // PAGE STATE
  // ---------------------------------------------------

  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // ---------------------------------------------------
  // LOAD TEAM + MATCHES + SEASONS
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId) return;

    async function loadData() {
      setLoading(true);
      setMessage('');

      const [
        { data: teamData, error: teamError },
        { data: matchData, error: matchError },
        { data: seasonData, error: seasonError },
      ] = await Promise.all([
        supabase
          .from('teams')
          .select(PUBLIC_TEAM_WITH_ORGANIZATION_SELECT)
          .eq('id', teamId)
          .single(),
        supabase
          .from('matches')
          .select(`
            *,
            ${PUBLIC_MATCH_TEAM_RELATION_SELECT}
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
      const activeSeason = loadedSeasons.find((season) => season.is_active);

      setTeam(teamData as unknown as Team);
      setMatches((matchData as MatchRow[]) ?? []);
      setSeasons(loadedSeasons);
      setSelectedSeasonId(activeSeason?.id || 'all');
      setLoading(false);
    }

    loadData();
  }, [teamId]);

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

      const opponentName =
        match.home_team_id === teamId
          ? match.away_team?.name || ''
          : match.home_team?.name || '';

      const haystack = [
        match.home_team?.name,
        match.away_team?.name,
        opponentName,
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
  }, [matches, normalizedQuery, selectedSeasonId, teamId]);

  // ---------------------------------------------------
  // MATCH BUCKETS
  // ---------------------------------------------------

  const upcomingMatches = useMemo(
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

  const completedMatches = useMemo(
    () =>
      filteredMatches
        .filter((match) => match.status === 'final')
        .sort((a, b) => {
          const aTime = a.match_date ? new Date(a.match_date).getTime() : 0;
          const bTime = b.match_date ? new Date(b.match_date).getTime() : 0;
          return bTime - aTime;
        }),
    [filteredMatches],
  );

  // ---------------------------------------------------
  // FEATURED MATCH
  // ---------------------------------------------------

  const nextUpcomingMatch = useMemo(() => {
    const now = Date.now();

    return upcomingMatches
      .filter((match) => {
        if (!match.match_date) return false;

        return (
          ['not_started', 'scheduled'].includes(match.status) &&
          new Date(match.match_date).getTime() >= now
        );
      })
      .sort((a, b) => {
        const aTime = a.match_date ? new Date(a.match_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.match_date ? new Date(b.match_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })[0] ?? null;
  }, [upcomingMatches]);

  const featuredMatch = useMemo(() => {
    const liveOrHalftime = upcomingMatches.find(
      (match) => match.status === 'live' || match.status === 'halftime',
    );

    return liveOrHalftime || nextUpcomingMatch;
  }, [upcomingMatches, nextUpcomingMatch]);

  const isFeaturedMatchLive =
    featuredMatch?.status === 'live' || featuredMatch?.status === 'halftime';

  const upcomingMatchesExcludingHero = useMemo(() => {
    if (!featuredMatch) return upcomingMatches;
    return upcomingMatches.filter((match) => match.id !== featuredMatch.id);
  }, [upcomingMatches, featuredMatch]);

  // ---------------------------------------------------
  // GROUP UPCOMING BY DATE
  // ---------------------------------------------------

  const groupedUpcomingMatches = useMemo<GroupedMatches[]>(() => {
    const groups = new Map<string, MatchRow[]>();

    for (const match of upcomingMatchesExcludingHero) {
      const label = match.match_date ? formatGroupDate(match.match_date) : 'Date TBD';

      if (!groups.has(label)) {
        groups.set(label, []);
      }

      groups.get(label)!.push(match);
    }

    return Array.from(groups.entries()).map(([label, grouped]) => ({
      label,
      matches: grouped.sort((a, b) => {
        const aTime = a.match_date ? new Date(a.match_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.match_date ? new Date(b.match_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
    }));
  }, [upcomingMatchesExcludingHero]);

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading && !team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">Loading team schedule...</main>;
  }

  if (message && !team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8 text-red-600">{message}</main>;
  }

  if (!team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8 text-red-600">Team not found.</main>;
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
   <PublicTeamPageShell team={team} teamId={teamId}>
      <ScheduleFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedSeasonId={selectedSeasonId}
        setSelectedSeasonId={setSelectedSeasonId}
        seasons={seasons}
      />

      {message ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {message}
        </div>
      ) : null}

      {featuredMatch ? (
        <FeaturedMatchCard match={featuredMatch} isLive={isFeaturedMatchLive} />
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          Loading schedule...
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">No matches found</h2>
          <p className="mt-2 text-slate-600">Try another search or season filter.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <SectionHeader
              title={featuredMatch ? 'More Upcoming Matches' : 'Upcoming Schedule'}
              subtitle="Matches grouped by date, including live and halftime fixtures."
              count={upcomingMatchesExcludingHero.length}
            />

            {groupedUpcomingMatches.length === 0 ? (
              <p className="text-sm text-slate-500">
                {featuredMatch
                  ? 'No additional upcoming matches after the featured fixture.'
                  : 'No upcoming matches found.'}
              </p>
            ) : (
              <div className="space-y-8">
                {groupedUpcomingMatches.map((group) => (
                  <GroupedMatchList
                    key={group.label}
                    label={group.label}
                    matches={group.matches}
                    teamId={teamId}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <SectionHeader
              title="Completed Matches"
              subtitle="Final results for completed fixtures."
              count={completedMatches.length}
            />

            {completedMatches.length === 0 ? (
              <p className="text-sm text-slate-500">No completed matches yet.</p>
            ) : (
              <div className="space-y-4">
                {completedMatches.map((match) => (
                  <PublicScheduleMatchCard key={match.id} match={match} teamId={teamId} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <SectionHeader
              title="Schedule Changes"
              subtitle="Postponed and cancelled fixtures."
              count={delayedMatches.length}
            />

            {delayedMatches.length === 0 ? (
              <p className="text-sm text-slate-500">No schedule changes right now.</p>
            ) : (
              <div className="space-y-4">
                {delayedMatches.map((match) => (
                  <PublicScheduleMatchCard key={match.id} match={match} teamId={teamId} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PublicTeamPageShell>
  );
}

// ---------------------------------------------------
// FILTER BAR
// ---------------------------------------------------

function ScheduleFilterBar({
  searchQuery,
  setSearchQuery,
  selectedSeasonId,
  setSelectedSeasonId,
  seasons,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedSeasonId: string;
  setSelectedSeasonId: (value: string) => void;
  seasons: Season[];
}) {
  return (
    <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div>
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
        </div>

        <div>
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
      </div>
    </section>
  );
}

// ---------------------------------------------------
// FEATURED MATCH CARD
// ---------------------------------------------------

function FeaturedMatchCard({
  match,
  isLive,
}: {
  match: MatchRow;
  isLive: boolean;
}) {
  return (
    <section
      className={`mb-8 rounded-3xl p-6 text-white shadow-sm ring-1 ${
        isLive ? 'sticky top-4 z-20 bg-red-950 ring-red-900' : 'bg-slate-900 ring-slate-800'
      }`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {isLive ? 'Live Match' : 'Next Match'}
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight">
            {match.home_team?.name || 'Home Team'} vs {match.away_team?.name || 'Away Team'}
          </h2>

          <p className="mt-2 text-slate-300">
            {isLive
              ? match.status === 'halftime'
                ? 'Halftime'
                : 'Live now'
              : match.match_date
                ? formatMatchDate(match.match_date)
                : 'Date TBD'}
            {match.venue ? ` • ${match.venue}` : ''}
          </p>
        </div>

        <StatusBadge status={match.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Home</p>
          <div className="mt-2 flex items-center gap-3">
            {match.home_team?.logo_url ? (
              <img
                src={match.home_team.logo_url}
                alt={`${match.home_team.name} logo`}
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
              />
            ) : null}

            <h3 className="truncate text-2xl font-black text-white">
              {match.home_team?.name || 'Home Team'}
            </h3>
          </div>
        </div>

        <div className="rounded-2xl bg-white/10 px-5 py-4 text-center ring-1 ring-white/10">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            {isLive ? (match.status === 'halftime' ? 'Halftime' : 'Live') : 'Upcoming'}
          </div>

          <div className="mt-1 text-lg font-bold text-white">
            {isLive ? `${match.home_score} - ${match.away_score}` : 'vs'}
          </div>
        </div>

        <div className="min-w-0 md:text-right">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Away</p>
          <div className="mt-2 flex items-center justify-end gap-3">
            <h3 className="truncate text-2xl font-black text-white">
              {match.away_team?.name || 'Away Team'}
            </h3>

            {match.away_team?.logo_url ? (
              <img
                src={match.away_team.logo_url}
                alt={`${match.away_team.name} logo`}
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {match.public_slug ? (
          <Link
            href={`/public/${match.public_slug}`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold hover:bg-emerald-600"
            style={{ color: '#ffffff' }}
          >
            {isLive ? 'Watch Live' : 'View Match'}
          </Link>
        ) : (
          <span className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white/70 ring-1 ring-white/10">
            Public link coming soon
          </span>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------
// SECTION HEADER
// ---------------------------------------------------

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------
// GROUPED MATCH LIST
// ---------------------------------------------------

function GroupedMatchList({
  label,
  matches,
  teamId,
}: {
  label: string;
  matches: MatchRow[];
  teamId: string;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
        <h3 className="text-lg font-bold text-slate-900">{label}</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {matches.length}
        </span>
      </div>

      <div className="space-y-4">
        {matches.map((match) => (
          <PublicScheduleMatchCard key={match.id} match={match} teamId={teamId} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------
// PUBLIC SCHEDULE MATCH CARD
// ---------------------------------------------------

function PublicScheduleMatchCard({
  match,
  teamId,
}: {
  match: MatchRow;
  teamId: string;
}) {
  const isHomeTeam = match.home_team_id === teamId;
  const teamSide = isHomeTeam ? match.home_team : match.away_team;
  const opponent = isHomeTeam ? match.away_team : match.home_team;
  const teamDisplayName = [teamSide?.club_name, teamSide?.name].filter(Boolean).join(' ') || 'Team';
  const opponentDisplayName =
    [opponent?.club_name, opponent?.name].filter(Boolean).join(' ') || 'Opponent';

  return (
    <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={match.status} />

            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
            </span>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {isHomeTeam ? 'Home' : 'Away'}
            </span>

            {match.venue ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {match.venue}
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Team</p>

              <div className="mt-1 flex items-center gap-3">
                {teamSide?.logo_url ? (
                  <img
                    src={teamSide.logo_url}
                    alt={`${teamSide.name} logo`}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                ) : null}

                <h3 className="truncate text-xl font-black text-slate-900">
                  {teamDisplayName}
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-center">
              <div className="rounded-2xl bg-slate-900 px-5 py-3 text-white shadow-sm">
                {match.status === 'final' || match.status === 'live' || match.status === 'halftime' ? (
                  <div className="text-3xl font-black">
                    {match.home_score} - {match.away_score}
                  </div>
                ) : (
                  <div className="text-lg font-bold uppercase tracking-wide">vs</div>
                )}
              </div>

              {match.public_slug ? (
                <Link
                  href={`/public/${match.public_slug}`}
                  target="_blank"
                  className="inline-flex rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  {match.status === 'live' || match.status === 'halftime' ? 'Watch Live' : 'View Recap'}
                </Link>
              ) : null}
            </div>

            <div className="min-w-0 md:text-right">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Opponent
              </p>

              <div className="mt-1 flex items-center justify-end gap-3">
                <h3 className="truncate text-xl font-black text-slate-900">
                  {opponentDisplayName}
                </h3>

                {opponent?.logo_url ? (
                  <img
                    src={opponent.logo_url}
                    alt={`${opponent.name} logo`}
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

        {!match.public_slug ? (
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <span className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">
              Public link coming soon
            </span>
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

  const diffDays = Math.floor(
    (matchDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

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
