'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicTeamPageShell from '@/components/PublicTeamPageShell';
import {
  LatestTeamResultHero,
  TeamResultsArchive,
  type TeamResultsGroup,
  type TeamResultsMatchRow,
} from '@/components/team/TeamResultsSections';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Season, Team } from '@/lib/types';

type MatchRow = TeamResultsMatchRow;

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
        supabase
  .from('teams')
  .select(`
    *,
    organization:organization_id (*)
  `)
  .eq('id', teamId)
  .single(),
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

      setTeam(teamData as Team);
      setMatches(loadedMatches);
      setSeasons(loadedSeasons);
      setSelectedSeasonId('all');

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

  const groupedResults = useMemo<TeamResultsGroup[]>(() => {
    const groups = new Map<string, MatchRow[]>();

    for (const match of resultsExcludingHero) {
      const label = match.match_date
        ? String(new Date(match.match_date).getFullYear())
        : 'Year TBD';

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
        <LatestTeamResultHero match={latestResult} teamId={teamId} mode="public" />
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
        <TeamResultsArchive
          title={latestResult ? 'More Results' : 'Team Results'}
          subtitle="Completed matches grouped by year."
          count={resultsExcludingHero.length}
          groups={groupedResults}
          teamId={teamId}
          events={events}
          mode="public"
          emptyText={
            latestResult
              ? 'No additional completed matches beyond the featured result.'
              : 'No completed matches found.'
          }
          rightSlot={
            <Link
              href="/results"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              View All League Results →
            </Link>
          }
        />
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
