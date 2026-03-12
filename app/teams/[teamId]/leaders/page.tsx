'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Season, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type PlayerLeaderRow = {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
};

export default function TeamLeadersPage() {
  const params = useParams();
  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  const [authChecked, setAuthChecked] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamId) return;

    const savedTeamId = localStorage.getItem('teamId');

    if (!savedTeamId || savedTeamId !== String(teamId)) {
      window.location.href = '/team-login';
      return;
    }

    setAuthChecked(true);
  }, [teamId]);

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
      setSelectedSeasonId(loadedSeasons.find((season) => season.is_active)?.id || 'all');
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

  if (loading || !authChecked) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading team leaders...</main>;
  }

  if (error && !team) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
        {error}
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
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={`${team.name} logo`}
                className="h-20 w-20 rounded-3xl object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                LOGO
              </div>
            )}

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Team Leaders
              </p>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">
                {team.name}
              </h1>
              <p className="mt-2 text-slate-600">
                Top scorers, assist leaders, and discipline leaders by season.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/teams/${team.id}`}
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm"
            >
              Team Page
            </Link>

            <Link
              href={`/teams/${team.id}/stats`}
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm"
            >
              Stats
            </Link>

            <Link
              href={`/teams/${team.id}/roster`}
              className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm"
            >
              Roster
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">Season Filter</h2>

          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="all">All Seasons</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <SummaryCard label="Final Matches Counted" value={matches.length} />
        <SummaryCard label="Players With Stats" value={leaderRows.length} />
        <SummaryCard label="Goals Logged" value={totalGoals} />
        <SummaryCard label="Assists Logged" value={totalAssists} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <LeaderboardTable
          title="Goals Leaders"
          statLabel="Goals"
          rows={goalsLeaders}
          valueKey="goals"
          emptyText="No goals recorded yet."
        />

        <LeaderboardTable
          title="Assist Leaders"
          statLabel="Assists"
          rows={assistsLeaders}
          valueKey="assists"
          emptyText="No assists recorded yet."
        />

        <LeaderboardTable
          title="Yellow Card Leaders"
          statLabel="Yellow Cards"
          rows={yellowCardLeaders}
          valueKey="yellowCards"
          emptyText="No yellow cards recorded yet."
        />

        <LeaderboardTable
          title="Red Card Leaders"
          statLabel="Red Cards"
          rows={redCardLeaders}
          valueKey="redCards"
          emptyText="No red cards recorded yet."
        />
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function LeaderboardTable({
  title,
  statLabel,
  rows,
  valueKey,
  emptyText,
}: {
  title: string;
  statLabel: string;
  rows: PlayerLeaderRow[];
  valueKey: 'goals' | 'assists' | 'yellowCards' | 'redCards';
  emptyText: string;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
          {rows.length} players
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[70px_1fr_110px] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div>Rank</div>
            <div>Player</div>
            <div className="text-right">{statLabel}</div>
          </div>

          <div className="divide-y divide-slate-200">
            {rows.map((row, index) => (
              <div
                key={row.playerId}
                className="grid grid-cols-[70px_1fr_110px] items-center px-4 py-4"
              >
                <div className="text-sm font-black text-slate-900">#{index + 1}</div>

                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {row.jerseyNumber || '—'}
                    </span>
                    <p className="truncate font-semibold text-slate-900">{row.playerName}</p>
                  </div>
                </div>

                <div className="text-right text-2xl font-black tabular-nums text-slate-900">
                  {row[valueKey]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}