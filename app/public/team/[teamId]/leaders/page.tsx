'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicTeamPageShell from '@/components/PublicTeamPageShell';
import {
  TeamLeadersGrid,
  TeamLeadersSummaryCards,
  type PlayerLeaderRow,
} from '@/components/team/TeamLeadersSections';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Season, Team } from '@/lib/types';
import {
  PUBLIC_MATCH_TEAM_RELATION_SELECT,
  PUBLIC_TEAM_WITH_ORGANIZATION_SELECT,
} from '@/lib/team-selects';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

// ---------------------------------------------------
// PAGE
// ---------------------------------------------------

export default function PublicTeamLeadersPage() {
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingLeaders, setLoadingLeaders] = useState(true);
  const [error, setError] = useState('');

  // ---------------------------------------------------
  // LOAD BASE PAGE DATA
  // TEAM / PLAYERS / SEASONS
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId) {
      setError('No team id found.');
      setLoadingBase(false);
      setLoadingLeaders(false);
      return;
    }

    let isMounted = true;

    async function loadBaseData() {
      setLoadingBase(true);
      setError('');

      const [
        { data: teamData, error: teamError },
        { data: playerData, error: playerError },
        { data: seasonData, error: seasonError },
      ] = await Promise.all([
        supabase
          .from('teams')
          .select(PUBLIC_TEAM_WITH_ORGANIZATION_SELECT)
          .eq('id', teamId)
          .single(),
        supabase
          .from('players')
          .select('*')
          .eq('team_id', teamId)
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true }),
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      ]);

      if (!isMounted) return;

      if (teamError || playerError || seasonError) {
        setError(
          teamError?.message ||
            playerError?.message ||
            seasonError?.message ||
            'Failed to load team leaders.',
        );
        setLoadingBase(false);
        setLoadingLeaders(false);
        return;
      }

      const loadedSeasons = (seasonData as Season[]) ?? [];

      setTeam(teamData as unknown as Team);
      setPlayers((playerData as Player[]) ?? []);
      setSeasons(loadedSeasons);
      setSelectedSeasonId('all');
      setLoadingBase(false);
    }

    loadBaseData();

    return () => {
      isMounted = false;
    };
  }, [teamId]);

  // ---------------------------------------------------
  // LOAD MATCHES + EVENTS FOR LEADERBOARDS
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId || loadingBase) return;

    let isMounted = true;

    async function loadLeaderData() {
      setLoadingLeaders(true);
      setError('');

      let matchesQuery = supabase
        .from('matches')
        .select(
          `
            *,
            ${PUBLIC_MATCH_TEAM_RELATION_SELECT}
          `,
        )
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('status', 'final')
        .order('match_date', { ascending: false, nullsFirst: false });

      if (selectedSeasonId !== 'all') {
        matchesQuery = matchesQuery.eq('season_id', selectedSeasonId);
      }

      const { data: matchData, error: matchError } = await matchesQuery;

      if (!isMounted) return;

      if (matchError) {
        setError(matchError.message);
        setMatches([]);
        setEvents([]);
        setLoadingLeaders(false);
        return;
      }

      const loadedMatches = (matchData as MatchRow[]) ?? [];
      setMatches(loadedMatches);

      if (loadedMatches.length === 0) {
        setEvents([]);
        setLoadingLeaders(false);
        return;
      }

      const matchIds = loadedMatches.map((match) => match.id);

      const { data: eventData, error: eventError } = await supabase
        .from('match_events')
        .select('*')
        .in('match_id', matchIds);

      if (!isMounted) return;

      if (eventError) {
        setError(eventError.message);
        setEvents([]);
        setLoadingLeaders(false);
        return;
      }

      setEvents((eventData as MatchEvent[]) ?? []);
      setLoadingLeaders(false);
    }

    loadLeaderData();

    return () => {
      isMounted = false;
    };
  }, [teamId, selectedSeasonId, loadingBase]);

  // ---------------------------------------------------
  // BUILD PER-PLAYER STAT ROWS
  // ---------------------------------------------------

  const leaderRows = useMemo<PlayerLeaderRow[]>(() => {
    const statsMap = new Map<string, PlayerLeaderRow>();

    // -------------------------------------------------
    // SEED PLAYERS WITH ZEROED STATS
    // -------------------------------------------------

    for (const player of players) {
      const playerName =
        [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Unnamed Player';

      statsMap.set(player.id, {
        playerId: player.id,
        playerName,
        jerseyNumber:
          player.jersey_number !== null && player.jersey_number !== undefined
            ? `#${player.jersey_number}`
            : '',
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
      });
    }

    // -------------------------------------------------
    // APPLY MATCH EVENTS TO PLAYER TOTALS
    // -------------------------------------------------

    for (const event of events) {
      if (event.team_id !== teamId) continue;

      if (event.event_type === 'goal' && event.player_id && statsMap.has(event.player_id)) {
        statsMap.get(event.player_id)!.goals += 1;
      }

      if (
        event.event_type === 'goal' &&
        event.secondary_player_id &&
        statsMap.has(event.secondary_player_id)
      ) {
        statsMap.get(event.secondary_player_id)!.assists += 1;
      }

      if (
        event.event_type === 'yellow_card' &&
        event.player_id &&
        statsMap.has(event.player_id)
      ) {
        statsMap.get(event.player_id)!.yellowCards += 1;
      }

      if (event.event_type === 'red_card' && event.player_id && statsMap.has(event.player_id)) {
        statsMap.get(event.player_id)!.redCards += 1;
      }
    }

    return Array.from(statsMap.values());
  }, [events, players, teamId]);

  // ---------------------------------------------------
  // SORTED LEADERBOARD VIEWS
  // ---------------------------------------------------

  const goalsLeaders = useMemo(
    () =>
      [...leaderRows]
        .filter((row) => row.goals > 0)
        .sort(
          (a, b) =>
            b.goals - a.goals ||
            b.assists - a.assists ||
            a.playerName.localeCompare(b.playerName),
        ),
    [leaderRows],
  );

  const assistsLeaders = useMemo(
    () =>
      [...leaderRows]
        .filter((row) => row.assists > 0)
        .sort(
          (a, b) =>
            b.assists - a.assists ||
            b.goals - a.goals ||
            a.playerName.localeCompare(b.playerName),
        ),
    [leaderRows],
  );

  const yellowCardLeaders = useMemo(
    () =>
      [...leaderRows]
        .filter((row) => row.yellowCards > 0)
        .sort(
          (a, b) =>
            b.yellowCards - a.yellowCards ||
            b.redCards - a.redCards ||
            a.playerName.localeCompare(b.playerName),
        ),
    [leaderRows],
  );

  const redCardLeaders = useMemo(
    () =>
      [...leaderRows]
        .filter((row) => row.redCards > 0)
        .sort(
          (a, b) =>
            b.redCards - a.redCards ||
            b.yellowCards - a.yellowCards ||
            a.playerName.localeCompare(b.playerName),
        ),
    [leaderRows],
  );

  // ---------------------------------------------------
  // SUMMARY VALUES
  // ---------------------------------------------------

  const totalGoals = useMemo(
    () => leaderRows.reduce((sum, row) => sum + row.goals, 0),
    [leaderRows],
  );

  const totalAssists = useMemo(
    () => leaderRows.reduce((sum, row) => sum + row.assists, 0),
    [leaderRows],
  );

  const playersWithStats = useMemo(
    () =>
      leaderRows.filter(
        (row) => row.goals > 0 || row.assists > 0 || row.yellowCards > 0 || row.redCards > 0,
      ).length,
    [leaderRows],
  );

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loadingBase) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading team leaders...</main>;
  }

  if (error || !team) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Team leaders unavailable
          </h1>
          <p className="mt-3 text-slate-600">{error || 'This team could not be found.'}</p>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------
  // PAGE RENDER
  // ---------------------------------------------------

  return (
    <PublicTeamPageShell team={team} teamId={teamId}>
      {/* --------------------------------------------- */}
      {/* PAGE INTRO / FILTER */}
      {/* --------------------------------------------- */}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Team Leaders
          </p>
          <p className="mt-2 max-w-2xl text-slate-600">
            Top performers across completed matches for this team.
          </p>
        </div>

        <div className="w-full max-w-[260px]">
          <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-500">
            Season
          </label>
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
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

      {/* --------------------------------------------- */}
      {/* SUMMARY CARDS */}
      {/* --------------------------------------------- */}

      <div className="mb-6">
        <TeamLeadersSummaryCards
          matchesCount={matches.length}
          playersWithStats={playersWithStats}
          totalGoals={totalGoals}
          totalAssists={totalAssists}
        />
      </div>

      {/* --------------------------------------------- */}
      {/* LEADERBOARDS */}
      {/* --------------------------------------------- */}

      {loadingLeaders ? (
        <div className="mb-6 rounded-3xl bg-white p-8 text-slate-600 shadow-md ring-1 ring-slate-200">
          Loading leaderboard data...
        </div>
      ) : (
        <TeamLeadersGrid
          goalsLeaders={goalsLeaders}
          assistsLeaders={assistsLeaders}
          yellowCardLeaders={yellowCardLeaders}
          redCardLeaders={redCardLeaders}
        />
      )}
    </PublicTeamPageShell>
  );
}

// ---------------------------------------------------
// SUMMARY CARD
// ---------------------------------------------------
