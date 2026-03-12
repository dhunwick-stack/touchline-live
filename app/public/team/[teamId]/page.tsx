'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
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

export default function PublicTeamPage() {
  const params = useParams();
  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamId) return;

    async function loadPageData() {
      setLoading(true);
      setError('');

      const [
        { data: teamData, error: teamError },
        { data: playerData, error: playerError },
        { data: matchData, error: matchError },
      ] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('players')
          .select('*')
          .eq('team_id', teamId)
          .eq('active', true)
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true }),
        supabase
          .from('matches')
          .select(`
            *,
            home_team:home_team_id (*),
            away_team:away_team_id (*)
          `)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .eq('status', 'final')
          .order('match_date', { ascending: false, nullsFirst: false }),
      ]);

      if (teamError || playerError || matchError) {
        setError(
          teamError?.message ||
            playerError?.message ||
            matchError?.message ||
            'Failed to load public team page.',
        );
        setLoading(false);
        return;
      }

      const loadedMatches = (matchData as MatchRow[]) ?? [];
      setTeam(teamData as Team);
      setPlayers((playerData as Player[]) ?? []);
      setMatches(loadedMatches);

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

    loadPageData();
  }, [teamId]);

  const summary = useMemo<TeamSummary>(() => {
    let played = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let cleanSheets = 0;

    for (const match of matches) {
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
  }, [matches, teamId]);

  const topScorer = useMemo(() => {
    const goalCounts = new Map<string, number>();

    for (const event of events) {
      if (event.team_id !== teamId) continue;
      if (event.event_type !== 'goal') continue;

      const key = event.player_id || `override:${event.player_name_override || 'Unknown'}`;
      goalCounts.set(key, (goalCounts.get(key) || 0) + 1);
    }

    let bestKey = '';
    let bestCount = 0;

    for (const [key, count] of goalCounts.entries()) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }

    if (!bestKey) {
      return { name: 'No scorer yet', goals: 0 };
    }

    if (bestKey.startsWith('override:')) {
      return {
        name: bestKey.replace('override:', '') || 'Unknown',
        goals: bestCount,
      };
    }

    const player = players.find((p) => p.id === bestKey);
    return {
      name: playerDisplayName(player) || 'Unknown',
      goals: bestCount,
    };
  }, [events, players, teamId]);

  const topAssist = useMemo(() => {
    const assistCounts = new Map<string, number>();

    for (const event of events) {
      if (event.team_id !== teamId) continue;
      if (event.event_type !== 'goal') continue;
      if (!event.secondary_player_id) continue;

      assistCounts.set(
        event.secondary_player_id,
        (assistCounts.get(event.secondary_player_id) || 0) + 1,
      );
    }

    let bestKey = '';
    let bestCount = 0;

    for (const [key, count] of assistCounts.entries()) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }

    if (!bestKey) {
      return { name: 'No assists yet', assists: 0 };
    }

    const player = players.find((p) => p.id === bestKey);
    return {
      name: playerDisplayName(player) || 'Unknown',
      assists: bestCount,
    };
  }, [events, players, teamId]);

  const recentForm = useMemo(() => {
    return matches.slice(0, 5).map((match) => {
      const isHome = match.home_team_id === teamId;
      const teamGoals = isHome ? match.home_score : match.away_score;
      const oppGoals = isHome ? match.away_score : match.home_score;

      if (teamGoals > oppGoals) return 'W';
      if (teamGoals < oppGoals) return 'L';
      return 'D';
    });
  }, [matches, teamId]);

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading team page...</main>;
  }

  if (error || !team) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Team not found
          </h1>
          <p className="mt-3 text-slate-600">
            {error || 'This team could not be found.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="relative left-1/2 right-1/2 -mx-[50vw] mb-8 w-screen bg-gradient-to-b from-red-950 via-red-900 to-red-800 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="h-20 w-20 rounded-3xl object-cover ring-1 ring-white/20"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-xs font-bold text-white/70 ring-1 ring-white/15">
                  LOGO
                </div>
              )}

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                  Public Team Page
                </p>
                <h1
                  className="text-3xl font-black leading-tight md:text-4xl"
                  style={{ color: '#ffffff' }}
                >
                  {team.name}
                </h1>
                <p className="mt-2 text-sm text-white/75">
                  {team.club_name || 'Team overview, leaders, roster, and recent results'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/public/team/${team.id}/leaders`}
                className="inline-flex rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm"
              >
                Team Leaders
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <SummaryCard label="Record" value={`${summary.wins}-${summary.losses}-${summary.draws}`} />
        <SummaryCard label="Goals For / Against" value={`${summary.goalsFor} / ${summary.goalsAgainst}`} />
        <SummaryCard
          label="Goal Difference"
          value={summary.goalDifference > 0 ? `+${summary.goalDifference}` : summary.goalDifference}
        />
        <SummaryCard label="Clean Sheets" value={summary.cleanSheets} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Recent Matches</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {matches.length} finals
              </span>
            </div>

            {matches.length === 0 ? (
              <p className="text-sm text-slate-500">No completed matches found yet.</p>
            ) : (
              <div className="space-y-3">
                {matches.slice(0, 8).map((match) => {
                  const result = resultLabel(match, teamId);
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
                        <p className="font-semibold text-slate-900">
                          vs {opponentName(match, teamId)}
                        </p>
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
                        {scoreLine(match, teamId)}
                      </div>

                      <div>
                        {match.public_slug ? (
                          <Link
                            href={`/public/${match.public_slug}`}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Match Recap
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
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Roster Preview</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {players.length} players
              </span>
            </div>

            {players.length === 0 ? (
              <p className="text-sm text-slate-500">No active players found.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {players.slice(0, 10).map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {[player.first_name, player.last_name].filter(Boolean).join(' ') ||
                          'Unnamed Player'}
                      </p>
                      <p className="text-sm text-slate-500">{player.position || 'No position'}</p>
                    </div>

                    <div className="ml-4 shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                      {player.jersey_number !== null && player.jersey_number !== undefined
                        ? `#${player.jersey_number}`
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Team Snapshot</h2>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Matches Played</dt>
                <dd className="text-right font-medium text-slate-900">{summary.played}</dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Top Scorer</dt>
                <dd className="text-right font-medium text-slate-900">
                  {topScorer.goals > 0 ? `${topScorer.name} (${topScorer.goals})` : topScorer.name}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Top Assist</dt>
                <dd className="text-right font-medium text-slate-900">
                  {topAssist.assists > 0 ? `${topAssist.name} (${topAssist.assists})` : topAssist.name}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Recent Form</dt>
                <dd className="text-right font-medium text-slate-900">
                  <div className="flex justify-end gap-1">
                    {recentForm.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      recentForm.map((result, index) => (
                        <span
                          key={`${result}-${index}`}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            result === 'W'
                              ? 'bg-emerald-100 text-emerald-700'
                              : result === 'L'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {result}
                        </span>
                      ))
                    )}
                  </div>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Explore More</h2>
            <p className="mt-2 text-sm text-slate-600">
              Dive deeper into player stats and match recaps.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/public/team/${team.id}/leaders`}
                className="inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                View Leaders
              </Link>
            </div>
          </div>
        </section>
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
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function playerDisplayName(player: Player | undefined) {
  if (!player) return '';
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  return player.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
}

function resultLabel(match: MatchRow, teamId: string) {
  const isHome = match.home_team_id === teamId;
  const teamGoals = isHome ? match.home_score : match.away_score;
  const oppGoals = isHome ? match.away_score : match.home_score;

  if (teamGoals > oppGoals) return 'W';
  if (teamGoals < oppGoals) return 'L';
  return 'D';
}

function opponentName(match: MatchRow, teamId: string) {
  const isHome = match.home_team_id === teamId;
  return isHome ? match.away_team?.name || 'Opponent' : match.home_team?.name || 'Opponent';
}

function scoreLine(match: MatchRow, teamId: string) {
  const isHome = match.home_team_id === teamId;
  const teamGoals = isHome ? match.home_score : match.away_score;
  const oppGoals = isHome ? match.away_score : match.home_score;
  return `${teamGoals}-${oppGoals}`;
}
