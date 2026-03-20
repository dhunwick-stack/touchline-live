'use client'; 

import { useEffect, useMemo, useState } from 'react';
import TeamPageIntro from '@/components/TeamPageIntro';
import { useTeamAccessGuard } from '@/lib/useTeamAccessGuard';
import {
  TeamLeadersGrid,
  TeamLeadersSummaryCards,
  type PlayerLeaderRow,
} from '@/components/team/TeamLeadersSections';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Season, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export default function TeamLeadersPage() {
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
  nextPath: `/teams/${teamId}/leaders`,
}); 

  
  const [editing, setEditing] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');



  useEffect(() => {
    if (!teamId || !authChecked) return;

    async function loadBaseData() {
      setLoading(true);
      setError('');

      const [
        { data: teamData, error: teamError },
        { data: playerData, error: playerError },
        { data: seasonData, error: seasonError },
      ] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('players')
          .select('*')
          .eq('team_id', teamId)
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true }),
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      ]);

      if (teamError || playerError || seasonError) {
        setError(
          teamError?.message ||
            playerError?.message ||
            seasonError?.message ||
            'Failed to load team leaders.',
        );
        setLoading(false);
        return;
      }

      const loadedSeasons = (seasonData as Season[]) ?? [];
      setTeam(teamData as Team);
      setPlayers((playerData as Player[]) ?? []);
      setSeasons(loadedSeasons);
      setSelectedSeasonId('all');
      setLoading(false);
    }

    loadBaseData();
  }, [teamId, authChecked]);

  useEffect(() => {
    if (!teamId || !authChecked) return;

    async function loadLeaderData() {
      setError('');

      let matchesQuery = supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('status', 'final')
        .order('match_date', { ascending: false, nullsFirst: false });

      if (selectedSeasonId !== 'all') {
        matchesQuery = matchesQuery.eq('season_id', selectedSeasonId);
      }

      const { data: matchData, error: matchError } = await matchesQuery;

      if (matchError) {
        setError(matchError.message);
        return;
      }

      const loadedMatches = (matchData as MatchRow[]) ?? [];
      setMatches(loadedMatches);

      if (loadedMatches.length === 0) {
        setEvents([]);
        return;
      }

      const matchIds = loadedMatches.map((match) => match.id);

      const { data: eventData, error: eventError } = await supabase
        .from('match_events')
        .select('*')
        .in('match_id', matchIds);

      if (eventError) {
        setError(eventError.message);
        return;
      }

      setEvents((eventData as MatchEvent[]) ?? []);
    }

    loadLeaderData();
  }, [teamId, selectedSeasonId, authChecked]);

  const leaderRows = useMemo<PlayerLeaderRow[]>(() => {
    const statsMap = new Map<string, PlayerLeaderRow>();

    for (const player of players) {
      const fullName =
        [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Unnamed Player';

      statsMap.set(player.id, {
        playerId: player.id,
        playerName: fullName,
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

  const goalsLeaders = useMemo(
    () =>
      leaderRows
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
      leaderRows
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
      leaderRows
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
      leaderRows
        .filter((row) => row.redCards > 0)
        .sort(
          (a, b) =>
            b.redCards - a.redCards ||
            b.yellowCards - a.yellowCards ||
            a.playerName.localeCompare(b.playerName),
        ),
    [leaderRows],
  );

  const totalGoals = useMemo(
    () => leaderRows.reduce((sum, row) => sum + row.goals, 0),
    [leaderRows],
  );

  const totalAssists = useMemo(
    () => leaderRows.reduce((sum, row) => sum + row.assists, 0),
    [leaderRows],
  );

 if (loading || accessLoading || !authChecked) {
  return <main className="mx-auto max-w-7xl px-6 py-8">Loading team leaders...</main>;
}

if ((accessError || error) && !team) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
      {accessError || error}
    </main>
  );
}

  if (!team) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
        Team not found.
      </main>
    );
  }

  return (
    <>
      {/* --------------------------------------------------- */}
      {/* TEAM PAGE INTRO */}
      {/* --------------------------------------------------- */}

      <TeamPageIntro
        eyebrow="Team Leaders"
        title="Leaders"
        description="See top scorers, assist leaders, and discipline leaders by season."
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
        {/* LEADERS DASHBOARD */}
        {/* --------------------------------------------------- */}

        <TeamLeadersSummaryCards
          matchesCount={matches.length}
          playersWithStats={leaderRows.length}
          totalGoals={totalGoals}
          totalAssists={totalAssists}
        />

        <div className="mt-6">
          <TeamLeadersGrid
            goalsLeaders={goalsLeaders}
            assistsLeaders={assistsLeaders}
            yellowCardLeaders={yellowCardLeaders}
            redCardLeaders={redCardLeaders}
          />
        </div>
      </main>
    </>
  );
}
