'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Season, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type PlayerStatRow = {
  playerId: string;
  name: string;
  jersey: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
};

type TeamSummary = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
};

export default function TeamStatsPage() {
  const params = useParams();
  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  const [team, setTeam] = useState<Team | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [players, setPlayers] = useState<Player[]>([]);
  const [finalMatches, setFinalMatches] = useState<MatchRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamId) return;

    async function loadBaseData() {
      setLoading(true);
      setError('');

      const [{ data: teamData, error: teamError }, { data: seasonData, error: seasonError }] =
        await Promise.all([
          supabase.from('teams').select('*').eq('id', teamId).single(),
          supabase.from('seasons').select('*').order('start_date', { ascending: false }),
        ]);

      if (teamError || seasonError) {
        setError(teamError?.message || seasonError?.message || 'Failed to load team data.');
        setLoading(false);
        return;
      }

      const loadedTeam = teamData as Team;
      const loadedSeasons = (seasonData as Season[]) ?? [];

      setTeam(loadedTeam);
      setSeasons(loadedSeasons);
      setSelectedSeasonId(loadedSeasons.find((s) => s.is_active)?.id || 'all');

      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('jersey_number', { ascending: true, nullsFirst: false })
        .order('first_name', { ascending: true });

      if (playerError) {
        setError(playerError.message);
        setLoading(false);
        return;
      }

      setPlayers((playerData as Player[]) ?? []);
      setLoading(false);
    }

    loadBaseData();
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;

    async function loadStatsData() {
      setError('');

      let finalMatchesQuery = supabase
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
        finalMatchesQuery = finalMatchesQuery.eq('season_id', selectedSeasonId);
      }

      const { data: finalMatchData, error: finalMatchError } = await finalMatchesQuery;

      if (finalMatchError) {
        setError(finalMatchError.message);
        return;
      }

      const loadedFinalMatches = (finalMatchData as MatchRow[]) ?? [];
      setFinalMatches(loadedFinalMatches);

      const { data: recentMatchData, error: recentMatchError } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('match_date', { ascending: false, nullsFirst: false })
        .limit(5);

      if (recentMatchError) {
        setError(recentMatchError.message);
        return;
      }

      setRecentMatches((recentMatchData as MatchRow[]) ?? []);

      if (loadedFinalMatches.length === 0) {
        setEvents([]);
        return;
      }

      const matchIds = loadedFinalMatches.map((m) => m.id);

      const { data: eventData, error: eventError } = await supabase
        .from('match_events')
        .select('*')
        .in('match_id', matchIds)
        .order('minute', { ascending: true });

      if (eventError) {
        setError(eventError.message);
        return;
      }

      setEvents((eventData as MatchEvent[]) ?? []);
    }

    loadStatsData();
  }, [teamId, selectedSeasonId]);

  const summary = useMemo<TeamSummary>(() => {
    let played = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let cleanSheets = 0;

    for (const match of finalMatches) {
      const isHome = match.home_team_id === teamId;
      const teamGoals = isHome ? match.home_score : match.away_score;
      const oppGoals = isHome ? match.away_score : match.home_score;

      played += 1;
      goalsFor += teamGoals;
      goalsAgainst += oppGoals;

      if (oppGoals === 0) cleanSheets += 1;

      if (teamGoals > oppGoals) wins += 1;
      else if (teamGoals < oppGoals) losses += 1;
      else draws += 1;
    }

    return {
      played,
      wins,
      losses,
      draws,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      cleanSheets,
    };
  }, [finalMatches, teamId]);

  const playerStats = useMemo<PlayerStatRow[]>(() => {
    const playerMap = new Map<string, PlayerStatRow>();

    for (const player of players) {
      const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
      playerMap.set(player.id, {
        playerId: player.id,
        name: fullName || 'Unnamed Player',
        jersey: player.jersey_number ? `#${player.jersey_number}` : '',
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
      });
    }

    for (const event of events) {
      if (event.team_id !== teamId) continue;

      if (event.event_type === 'goal' && event.player_id && playerMap.has(event.player_id)) {
        playerMap.get(event.player_id)!.goals += 1;
      }

      if (
        event.event_type === 'goal' &&
        event.secondary_player_id &&
        playerMap.has(event.secondary_player_id)
      ) {
        playerMap.get(event.secondary_player_id)!.assists += 1;
      }

      if (
        event.event_type === 'yellow_card' &&
        event.player_id &&
        playerMap.has(event.player_id)
      ) {
        playerMap.get(event.player_id)!.yellowCards += 1;
      }

      if (event.event_type === 'red_card' && event.player_id && playerMap.has(event.player_id)) {
        playerMap.get(event.player_id)!.redCards += 1;
      }
    }

    return Array.from(playerMap.values());
  }, [events, players, teamId]);

  const topScorers = useMemo(
    () =>
      playerStats
        .filter((p) => p.goals > 0)
        .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)),
    [playerStats],
  );

  const topAssists = useMemo(
    () =>
      playerStats
        .filter((p) => p.assists > 0)
        .sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name)),
    [playerStats],
  );

  const discipline = useMemo(
    () =>
      playerStats
        .filter((p) => p.yellowCards > 0 || p.redCards > 0)
        .sort(
          (a, b) =>
            b.redCards - a.redCards ||
            b.yellowCards - a.yellowCards ||
            a.name.localeCompare(b.name),
        ),
    [playerStats],
  );

  function resultLabel(match: MatchRow) {
    if (match.status !== 'final') return null;

    const isHome = match.home_team_id === teamId;
    const teamGoals = isHome ? match.home_score : match.away_score;
    const oppGoals = isHome ? match.away_score : match.home_score;

    if (teamGoals > oppGoals) return 'W';
    if (teamGoals < oppGoals) return 'L';
    return 'D';
  }

  function opponentName(match: MatchRow) {
    const isHome = match.home_team_id === teamId;
    return isHome
      ? match.away_team?.name || 'Opponent'
      : match.home_team?.name || 'Opponent';
  }

  function scoreLine(match: MatchRow) {
    const isHome = match.home_team_id === teamId;
    const teamGoals = isHome ? match.home_score : match.away_score;
    const oppGoals = isHome ? match.away_score : match.home_score;
    return `${teamGoals}-${oppGoals}`;
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-6 py-8">Loading team stats...</main>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8 text-red-600">
        {error}
      </main>
    );
  }

  if (!team) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8 text-red-600">
        Team not found.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Team Statistics
          </p>
          <h1 className="text-3xl font-black tracking-tight">{team.name}</h1>
          <p className="mt-2 text-slate-600">
            Season summary, player leaders, and recent results.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/teams/${team.id}`}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200"
          >
            Team Page
          </Link>
        </div>
      </div>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Season Filter</h2>

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
        <StatCard label="Record" value={`${summary.wins}-${summary.losses}-${summary.draws}`} />
        <StatCard label="Matches Played" value={summary.played} />
        <StatCard label="Goals For / Against" value={`${summary.goalsFor} / ${summary.goalsAgainst}`} />
        <StatCard
          label="Goal Difference"
          value={summary.goalDifference > 0 ? `+${summary.goalDifference}` : summary.goalDifference}
        />
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <StatCard label="Clean Sheets" value={summary.cleanSheets} />
        <StatCard label="Points" value={summary.wins * 3 + summary.draws} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <LeaderboardCard
          title="Top Scorers"
          emptyText="No goals recorded yet."
          rows={topScorers.map((player) => ({
            label: `${player.jersey} ${player.name}`.trim(),
            value: player.goals,
          }))}
        />

        <LeaderboardCard
          title="Top Assists"
          emptyText="No assists recorded yet."
          rows={topAssists.map((player) => ({
            label: `${player.jersey} ${player.name}`.trim(),
            value: player.assists,
          }))}
        />

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">Discipline</h2>

          {discipline.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No cards recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {discipline.map((player) => (
                <div
                  key={player.playerId}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {`${player.jersey} ${player.name}`.trim()}
                    </p>
                  </div>
                  <div className="ml-4 text-right text-sm font-semibold">
                    <div className="text-amber-600">YC {player.yellowCards}</div>
                    <div className="text-red-600">RC {player.redCards}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent Matches</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {recentMatches.length} matches
          </span>
        </div>

        {recentMatches.length === 0 ? (
          <p className="text-sm text-slate-500">No matches found yet.</p>
        ) : (
          <div className="space-y-3">
            {recentMatches.map((match) => {
              const result = resultLabel(match);

              return (
                <div
                  key={match.id}
                  className="grid items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 md:grid-cols-[90px_1fr_auto_auto]"
                >
                  <div>
                    {match.status === 'final' ? (
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          result === 'W'
                            ? 'bg-emerald-100 text-emerald-700'
                            : result === 'L'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {result}
                      </span>
                    ) : match.status === 'live' ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                        Scheduled
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">vs {opponentName(match)}</p>
                    <p className="text-sm text-slate-500">
                      {match.match_date
                        ? new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }).format(new Date(match.match_date))
                        : 'Date TBD'}
                    </p>
                  </div>

                  <div className="text-lg font-black tabular-nums text-slate-900">
                    {scoreLine(match)}
                  </div>

                  <div>
                    {match.status === 'final' && match.public_slug ? (
                      <Link
                        href={`/public/${match.public_slug}`}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Recap
                      </Link>
                    ) : match.status === 'live' && match.public_slug ? (
                      <Link
                        href={`/public/${match.public_slug}`}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
                      >
                        Follow Live
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Final Match Results</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {finalMatches.length} finals
          </span>
        </div>

        {finalMatches.length === 0 ? (
          <p className="text-sm text-slate-500">No completed matches found for this season.</p>
        ) : (
          <div className="space-y-3">
            {finalMatches.map((match) => {
              const result = resultLabel(match);

              return (
                <div
                  key={match.id}
                  className="grid items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 md:grid-cols-[90px_1fr_auto_auto]"
                >
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
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

                  <div>
                    <p className="font-semibold text-slate-900">vs {opponentName(match)}</p>
                    <p className="text-sm text-slate-500">
                      {match.match_date
                        ? new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }).format(new Date(match.match_date))
                        : 'Date TBD'}
                    </p>
                  </div>

                  <div className="text-lg font-black tabular-nums text-slate-900">
                    {scoreLine(match)}
                  </div>

                  <div>
                    {match.public_slug ? (
                      <Link
                        href={`/public/${match.public_slug}`}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Recap
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">No recap</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function LeaderboardCard({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: { label: string; value: number }[];
  emptyText: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-bold">{title}</h2>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
            >
              <p className="min-w-0 truncate font-medium text-slate-900">{row.label}</p>
              <p className="ml-4 text-lg font-black tabular-nums text-slate-900">{row.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}