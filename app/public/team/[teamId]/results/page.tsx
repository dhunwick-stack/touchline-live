'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicTeamPageShell from '@/components/PublicTeamPageShell';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Season, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type GroupedResults = {
  label: string;
  matches: MatchRow[];
};

export default function PublicTeamResultsPage() {
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
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // ---------------------------------------------------
  // LOAD DATA
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
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('matches')
          .select(`
            *,
            home_team:home_team_id (*),
            away_team:away_team_id (*)
          `)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .eq('status', 'final')
          .order('match_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false }),
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      ]);

      if (teamError || matchError || seasonError) {
        setMessage(
          teamError?.message ||
            matchError?.message ||
            seasonError?.message ||
            'Failed to load team results.',
        );
        setLoading(false);
        return;
      }

      const loadedMatches = (matchData as MatchRow[]) ?? [];
      const loadedSeasons = (seasonData as Season[]) ?? [];
      const activeSeason = loadedSeasons.find((season) => season.is_active);

      setTeam(teamData as Team);
      setMatches(loadedMatches);
      setSeasons(loadedSeasons);
      setSelectedSeasonId(activeSeason?.id || 'all');

      if (loadedMatches.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const matchIds = loadedMatches.map((match) => match.id);

      const { data: eventData, error: eventError } = await supabase
        .from('match_events')
        .select('*')
        .in('match_id', matchIds)
        .eq('event_type', 'goal')
        .order('minute', { ascending: true });

      if (eventError) {
        setMessage(eventError.message);
        setLoading(false);
        return;
      }

      setEvents((eventData as MatchEvent[]) ?? []);
      setLoading(false);
    }

    loadData();
  }, [teamId]);

  // ---------------------------------------------------
  // FILTERED RESULTS
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
  // LATEST RESULT
  // ---------------------------------------------------

  const latestResult = useMemo(() => {
    return filteredMatches[0] || null;
  }, [filteredMatches]);

  // ---------------------------------------------------
  // REMAINING RESULTS
  // ---------------------------------------------------

  const resultsExcludingHero = useMemo(() => {
    if (!latestResult) return filteredMatches;
    return filteredMatches.filter((match) => match.id !== latestResult.id);
  }, [filteredMatches, latestResult]);

  // ---------------------------------------------------
  // GROUP RESULTS
  // ---------------------------------------------------

  const groupedResults = useMemo<GroupedResults[]>(() => {
    const groups = new Map<string, MatchRow[]>();

    for (const match of resultsExcludingHero) {
      const label = match.match_date ? formatGroupDate(match.match_date) : 'Date TBD';

      if (!groups.has(label)) {
        groups.set(label, []);
      }

      groups.get(label)!.push(match);
    }

    return Array.from(groups.entries()).map(([label, grouped]) => ({
      label,
      matches: grouped.sort((a, b) => {
        const aTime = a.match_date ? new Date(a.match_date).getTime() : 0;
        const bTime = b.match_date ? new Date(b.match_date).getTime() : 0;
        return bTime - aTime;
      }),
    }));
  }, [resultsExcludingHero]);

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading && !team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">Loading team results...</main>;
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
      <ResultsFilterBar
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

      {latestResult ? (
        <LatestResultHero match={latestResult} teamId={teamId} />
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          Loading results...
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">No team results found</h2>
          <p className="mt-2 text-slate-600">
            Completed results will appear here once this team finishes matches.
          </p>

          <div className="mt-5">
            <Link
              href="/results"
              className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
            >
              View All League Results
            </Link>
          </div>
        </div>
      ) : (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <SectionHeader
            title={latestResult ? 'More Results' : 'Team Results'}
            subtitle="Completed matches grouped by date."
            count={resultsExcludingHero.length}
            rightSlot={
              <Link
                href="/results"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                View All League Results →
              </Link>
            }
          />

          {groupedResults.length === 0 ? (
            <p className="text-sm text-slate-500">
              {latestResult
                ? 'No additional completed matches beyond the featured result.'
                : 'No completed matches found.'}
            </p>
          ) : (
            <div className="space-y-8">
              {groupedResults.map((group) => (
                <GroupedResultsList
                  key={group.label}
                  label={group.label}
                  matches={group.matches}
                  teamId={teamId}
                  events={events}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </PublicTeamPageShell>
  );
}

// ---------------------------------------------------
// FILTER BAR
// ---------------------------------------------------

function ResultsFilterBar({
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
              placeholder="Search opponent or venue"
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
// LATEST RESULT HERO
// ---------------------------------------------------

function LatestResultHero({
  match,
  teamId,
}: {
  match: MatchRow;
  teamId: string;
}) {
  const isHomeTeam = match.home_team_id === teamId;
  const result =
    (isHomeTeam ? match.home_score : match.away_score) >
    (isHomeTeam ? match.away_score : match.home_score)
      ? 'W'
      : (isHomeTeam ? match.home_score : match.away_score) <
          (isHomeTeam ? match.away_score : match.home_score)
        ? 'L'
        : 'D';

  return (
    <section className="mb-8 rounded-3xl bg-slate-900 p-6 text-white shadow-sm ring-1 ring-slate-800">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Latest Result
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight">
            {match.home_team?.name || 'Home Team'} vs {match.away_team?.name || 'Away Team'}
          </h2>

          <p className="mt-2 text-slate-300">
            {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
            {match.venue ? ` • ${match.venue}` : ''}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            result === 'W'
              ? 'bg-emerald-100 text-emerald-700'
              : result === 'L'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-amber-100 text-amber-700'
          }`}
        >
          {result}
        </span>
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
            Final
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {match.home_score} - {match.away_score}
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
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold hover:bg-emerald-600"
            style={{ color: '#ffffff' }}
          >
            Match Recap
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
  rightSlot,
}: {
  title: string;
  subtitle: string;
  count: number;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
          {count}
        </span>
        {rightSlot}
      </div>
    </div>
  );
}

// ---------------------------------------------------
// GROUPED RESULTS LIST
// ---------------------------------------------------

function GroupedResultsList({
  label,
  matches,
  teamId,
  events,
}: {
  label: string;
  matches: MatchRow[];
  teamId: string;
  events: MatchEvent[];
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
          <TeamResultScoreCard
            key={match.id}
            match={match}
            teamId={teamId}
            events={events.filter((event) => event.match_id === match.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------
// RESULT SCORE CARD
// ---------------------------------------------------

function TeamResultScoreCard({
  match,
  teamId,
  events,
}: {
  match: MatchRow;
  teamId: string;
  events: MatchEvent[];
}) {
  const isHomeTeam = match.home_team_id === teamId;
  const teamSide = isHomeTeam ? match.home_team : match.away_team;
  const opponent = isHomeTeam ? match.away_team : match.home_team;

  const teamGoals = isHomeTeam ? match.home_score : match.away_score;
  const opponentGoals = isHomeTeam ? match.away_score : match.home_score;

  const result = teamGoals > opponentGoals ? 'W' : teamGoals < opponentGoals ? 'L' : 'D';

  const teamScorers = buildScorerList(events, isHomeTeam ? match.home_team_id : match.away_team_id);
  const opponentScorers = buildScorerList(
    events,
    isHomeTeam ? match.away_team_id : match.home_team_id,
  );

  return (
    <div className="overflow-hidden rounded-3xl bg-slate-50 ring-1 ring-slate-200">
      <div className="border-b border-slate-200 bg-white/70 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              result === 'W'
                ? 'bg-emerald-100 text-emerald-700'
                : result === 'L'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {result}
          </span>

          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
            Final
          </span>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
          </span>

          {match.venue ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {match.venue}
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
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
                {teamSide?.name || 'Team'}
              </h3>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 px-5 py-4 text-center text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Score
            </div>
            <div className="mt-1 text-4xl font-black tabular-nums">
              {teamGoals} - {opponentGoals}
            </div>
          </div>

          <div className="min-w-0 md:text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Opponent
            </p>

            <div className="mt-1 flex items-center justify-end gap-3">
              <h3 className="truncate text-xl font-black text-slate-900">
                {opponent?.name || 'Opponent'}
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

        {(teamScorers.length > 0 || opponentScorers.length > 0) && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ScorerPanel title="Team Scorers" items={teamScorers} />
            <ScorerPanel title="Opponent Scorers" items={opponentScorers} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {match.public_slug ? (
            <Link
              href={`/public/${match.public_slug}`}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Match Recap
            </Link>
          ) : (
            <span className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">
              No recap yet
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------
// SCORER PANEL
// ---------------------------------------------------

function ScorerPanel({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No scorers recorded</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------
// GOAL SCORER HELPERS
// ---------------------------------------------------

function buildScorerList(events: MatchEvent[], teamId: string | null | undefined) {
  if (!teamId) return [];

  return events
    .filter((event) => event.team_id === teamId && event.event_type === 'goal')
    .map((event) => {
      const name = event.player_name_override?.trim() || 'Goal';
      return `${name}${event.minute !== null && event.minute !== undefined ? ` ${event.minute}'` : ''}`;
    });
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

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}