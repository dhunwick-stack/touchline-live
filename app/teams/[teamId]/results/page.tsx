'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import TeamPageIntro from '@/components/TeamPageIntro';
import { useTeamAccessGuard } from '@/lib/useTeamAccessGuard';
import {
  LatestTeamResultHero,
  TeamResultsArchive,
  type TeamResultsGroup,
  type TeamResultsMatchRow,
} from '@/components/team/TeamResultsSections';
import { supabase } from '@/lib/supabase';
import type { MatchEvent, Season, Team } from '@/lib/types';

type MatchRow = TeamResultsMatchRow;

export default function TeamResultsPage() {
  const params = useParams();
  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  const {
    authChecked,
    error: accessError,
    loading: accessLoading,
  } = useTeamAccessGuard({
    teamId,
    nextPath: `/teams/${teamId}/results`,
  });

  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);

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

    setTeam((teamData as Team) ?? null);
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

  useEffect(() => {
    if (!teamId || !authChecked) return;
    loadData();
  }, [teamId, authChecked]);

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

  const latestResult = useMemo(() => filteredMatches[0] || null, [filteredMatches]);

  const resultsExcludingHero = useMemo(() => {
    if (!latestResult) return filteredMatches;
    return filteredMatches.filter((match) => match.id !== latestResult.id);
  }, [filteredMatches, latestResult]);

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

  if (accessLoading || (loading && !team)) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">Loading team results...</main>;
  }

  if (accessError && !team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8 text-red-600">{accessError}</main>;
  }

  if (message && !team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8 text-red-600">{message}</main>;
  }

  if (!team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8 text-red-600">Team not found.</main>;
  }

  return (
    <>
      <TeamPageIntro
        eyebrow="Team Results"
        title="Results"
        description="Full historical results archive, separated by year and filterable by season."
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
              placeholder="Search opponent or venue"
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </section>

        {accessError || message ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {accessError || message}
          </div>
        ) : null}

        {latestResult ? (
          <LatestTeamResultHero
            match={latestResult}
            teamId={teamId}
            mode="admin"
            onDeleteMatch={handleDeleteMatch}
            deletingMatchId={deletingMatchId}
          />
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
                href={`/teams/${team.id}/schedule`}
                className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
              >
                View Schedule
              </Link>
            </div>
          </div>
        ) : (
          <TeamResultsArchive
            title={latestResult ? 'Results Archive' : 'Team Results'}
            subtitle="Completed matches grouped by year."
            count={resultsExcludingHero.length}
            groups={groupedResults}
            teamId={teamId}
            events={events}
            mode="admin"
            emptyText={
              latestResult
                ? 'No additional completed matches beyond the featured result.'
                : 'No completed matches found.'
            }
            onDeleteMatch={handleDeleteMatch}
            deletingMatchId={deletingMatchId}
            rightSlot={
              <Link
                href={`/teams/${team.id}/schedule`}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                View Schedule
              </Link>
            }
          />
        )}
      </main>
    </>
  );
}
