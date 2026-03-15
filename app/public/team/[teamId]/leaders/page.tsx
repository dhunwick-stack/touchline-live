'use client'; 

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicTeamPageShell from '@/components/PublicTeamPageShell';
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

export default function PublicTeamLeadersPage() {
  const params = useParams();
  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

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
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;

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
  }, [teamId, selectedSeasonId]);

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

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">Loading team leaders...</main>;
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
          <p className="mt-3 text-slate-600">
            {error || 'This team could not be found.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <PublicTeamPageShell
  team={team}
  teamId={teamId}
  description="Top performers across completed matches for this team."
  actions={[
    {
      href: `/public/team/${team.id}`,
      label: 'Team Page',
      variant: 'glass',
    },
    {
      href: `/public/team/${team.id}/schedule`,
      label: 'Schedule',
      variant: 'glass',
    },
  ]}
>
      <section className="mb-6 rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Leaderboard Scope
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Completed Match Leaders
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Goals, assists, and discipline stats pulled from completed matches only.
            </p>
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

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Final Matches Counted" value={matches.length} />
        <SummaryCard label="Players With Stats" value={leaderRows.length} />
        <SummaryCard label="Goals Logged" value={totalGoals} />
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

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/public/team/${team.id}`}
          className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
        >
          Back to Team Page
        </Link>

        <Link
          href={`/public/team/${team.id}/results`}
          className="inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm"
        >
          View Team Results
        </Link>
      </div>
    </PublicTeamPageShell>
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
  const gradientMap = {
    goals: 'bg-gradient-to-b from-green-50 to-white',
    assists: 'bg-gradient-to-b from-blue-50 to-white',
    yellowCards: 'bg-gradient-to-b from-yellow-50 to-white',
    redCards: 'bg-gradient-to-b from-red-50 to-white',
  };

  const statPillMap = {
    goals: 'bg-emerald-500 text-white',
    assists: 'bg-blue-500 text-white',
    yellowCards: 'bg-amber-400 text-slate-950',
    redCards: 'bg-red-500 text-white',
  };

  const gradient = gradientMap[valueKey] || 'bg-white';
  const statPillClass = statPillMap[valueKey] || 'bg-slate-900 text-white';

  return (
    <section className={`rounded-3xl ${gradient} p-6 shadow-md ring-1 ring-slate-200`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>

        <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
          {rows.length} players
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[70px_1fr_90px] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div>Rank</div>
            <div>Player</div>
            <div className="text-right">{statLabel}</div>
          </div>

          <div className="divide-y divide-slate-200">
            {rows.map((row, index) => (
              <div
                key={row.playerId}
                className="grid grid-cols-[70px_1fr_90px] items-center px-4 py-4"
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

                <div className="flex justify-end">
                  <span
                    className={`inline-flex min-w-[44px] items-center justify-center rounded-xl px-3 py-2 text-base font-black tabular-nums shadow-sm ${statPillClass}`}
                  >
                    {row[valueKey]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}