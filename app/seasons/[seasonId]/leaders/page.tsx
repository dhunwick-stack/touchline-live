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
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
};

export default function SeasonLeadersPage() {
  const params = useParams();
  const seasonId =
    typeof params?.seasonId === 'string'
      ? params.seasonId
      : Array.isArray(params?.seasonId)
        ? params.seasonId[0]
        : '';

  const [season, setSeason] = useState<Season | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!seasonId) return;

    async function loadData() {
      setLoading(true);
      setError('');

      const [
        { data: seasonData, error: seasonError },
        { data: matchData, error: matchError },
        { data: playerData, error: playerError },
        { data: teamData, error: teamError },
      ] = await Promise.all([
        supabase.from('seasons').select('*').eq('id', seasonId).single(),
        supabase
          .from('matches')
          .select(`
            *,
            home_team:home_team_id (*),
            away_team:away_team_id (*)
          `)
          .eq('season_id', seasonId)
          .eq('status', 'final')
          .order('match_date', { ascending: false, nullsFirst: false }),
        supabase.from('players').select('*'),
        supabase.from('teams').select('*').order('name', { ascending: true }),
      ]);

      if (seasonError || matchError || playerError || teamError) {
        setError(
          seasonError?.message ||
            matchError?.message ||
            playerError?.message ||
            teamError?.message ||
            'Failed to load season leaders.',
        );
        setLoading(false);
        return;
      }

      const loadedMatches = (matchData as MatchRow[]) ?? [];
      setSeason(seasonData as Season);
      setMatches(loadedMatches);
      setPlayers((playerData as Player[]) ?? []);
      setTeams((teamData as Team[]) ?? []);

      if (loadedMatches.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const matchIds = loadedMatches.map((match) => match.id);

      const { data: eventData, error: eventError } = await supabase
        .from('match_events')
        .select('*')
        .in('match_id', matchIds);

      if (eventError) {
        setError(eventError.message);
        setLoading(false);
        return;
      }

      setEvents((eventData as MatchEvent[]) ?? []);
      setLoading(false);
    }

    loadData();
  }, [seasonId]);

  const leaderRows = useMemo<PlayerLeaderRow[]>(() => {
    const playerMap = new Map<string, Player>();
    const teamMap = new Map<string, Team>();
    const statsMap = new Map<string, PlayerLeaderRow>();

    for (const player of players) {
      playerMap.set(player.id, player);
    }

    for (const team of teams) {
      teamMap.set(team.id, team);
    }

    function ensureRow(playerId: string) {
      const player = playerMap.get(playerId);
      if (!player?.team_id) return null;

      if (!statsMap.has(playerId)) {
        const team = teamMap.get(player.team_id);
        const playerName =
          [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Unnamed Player';

        statsMap.set(playerId, {
          playerId,
          playerName,
          jerseyNumber:
            player.jersey_number !== null && player.jersey_number !== undefined
              ? `#${player.jersey_number}`
              : '',
          teamId: player.team_id,
          teamName: team?.name || 'Unknown Team',
          teamLogoUrl: team?.logo_url || null,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
        });
      }

      return statsMap.get(playerId)!;
    }

    for (const event of events) {
      if (event.event_type === 'goal' && event.player_id) {
        const row = ensureRow(event.player_id);
        if (row) row.goals += 1;
      }

      if (event.event_type === 'goal' && event.secondary_player_id) {
        const row = ensureRow(event.secondary_player_id);
        if (row) row.assists += 1;
      }

      if (event.event_type === 'yellow_card' && event.player_id) {
        const row = ensureRow(event.player_id);
        if (row) row.yellowCards += 1;
      }

      if (event.event_type === 'red_card' && event.player_id) {
        const row = ensureRow(event.player_id);
        if (row) row.redCards += 1;
      }
    }

    return Array.from(statsMap.values());
  }, [events, players, teams]);

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

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading season leaders...</main>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
        {error}
      </main>
    );
  }

  if (!season) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
        Season not found.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Season Leaderboard
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {season.name}
          </h1>
          <p className="mt-2 text-slate-600">
            Player leaders for completed matches in this season.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/teams"
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
          >
            Teams
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Final Matches Counted" value={matches.length} />
        <SummaryCard label="Players With Stats" value={leaderRows.length} />
        <SummaryCard label="Goals Logged" value={leaderRows.reduce((sum, row) => sum + row.goals, 0)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
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
          <div className="grid grid-cols-[70px_1.5fr_1fr_110px] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div>Rank</div>
            <div>Player</div>
            <div>Team</div>
            <div className="text-right">{statLabel}</div>
          </div>

          <div className="divide-y divide-slate-200">
            {rows.map((row, index) => (
              <div
                key={row.playerId}
                className="grid grid-cols-[70px_1.5fr_1fr_110px] items-center px-4 py-4"
              >
                <div className="text-sm font-black text-slate-900">#{index + 1}</div>

                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {row.jerseyNumber || '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{row.playerName}</p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {row.teamLogoUrl ? (
                      <img
                        src={row.teamLogoUrl}
                        alt={`${row.teamName} logo`}
                        className="h-8 w-8 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                    ) : null}
                    <p className="truncate text-sm font-medium text-slate-700">{row.teamName}</p>
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
