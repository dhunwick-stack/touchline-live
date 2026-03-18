'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicTeamPageShell from '@/components/PublicTeamPageShell';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Team } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

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

// ---------------------------------------------------
// PAGE
// FILE: app/public/team/[teamId]/page.tsx
// ---------------------------------------------------

export default function PublicTeamPage() {
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
  const [nextMatch, setNextMatch] = useState<MatchRow | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ---------------------------------------------------
  // LOAD PAGE DATA
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId) return;

    async function loadPageData() {
      setLoading(true);
      setError('');

      const [
        { data: teamData, error: teamError },
        { data: playerData, error: playerError },
        { data: matchData, error: matchError },
        { data: nextMatchData, error: nextMatchError },
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
        supabase
          .from('matches')
          .select(`
            *,
            home_team:home_team_id (*),
            away_team:away_team_id (*)
          `)
          .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
          .in('status', ['not_started', 'scheduled', 'live', 'halftime'])
          .order('match_date', { ascending: true, nullsFirst: false })
          .limit(1),
      ]);

      if (teamError || playerError || matchError || nextMatchError) {
        setError(
          teamError?.message ||
            playerError?.message ||
            matchError?.message ||
            nextMatchError?.message ||
            'Failed to load public team page.',
        );
        setLoading(false);
        return;
      }

      const loadedMatches = (matchData as MatchRow[]) ?? [];

      setTeam(teamData as Team);
      setPlayers((playerData as Player[]) ?? []);
      setMatches(loadedMatches);
      setNextMatch(((nextMatchData as MatchRow[]) ?? [])[0] || null);

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

  // ---------------------------------------------------
  // TEAM SUMMARY
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // TOP SCORER
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // TOP ASSIST
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // RECENT FORM
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // FEATURED LIVE MATCH
  // Push live or halftime match to the top on mobile.
  // ---------------------------------------------------

  const featuredLiveMatch = useMemo(() => {
    if (!nextMatch) return null;

    if (nextMatch.status === 'live' || nextMatch.status === 'halftime') {
      return nextMatch;
    }

    return null;
  }, [nextMatch]);

  // ---------------------------------------------------
  // HERO STYLE
  // ---------------------------------------------------

  const nextMatchHeroStyle = {
    background: `linear-gradient(135deg, ${team?.primary_color || '#0f172a'}, ${team?.secondary_color || '#1e293b'})`,
  };

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">Loading team page...</main>;
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
          <p className="mt-3 text-slate-600">{error || 'This team could not be found.'}</p>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <PublicTeamPageShell team={team} teamId={teamId}>
      {/* --------------------------------------------------- */}
      {/* MOBILE FEATURED LIVE MATCH */}
      {/* --------------------------------------------------- */}

      {featuredLiveMatch ? (
        <section className="mb-6 block lg:hidden">
          <div
            className="overflow-hidden rounded-3xl shadow-md ring-1 ring-black/10"
            style={nextMatchHeroStyle}
          >
            <div className="bg-black/25 p-5 backdrop-blur-[2px]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    {featuredLiveMatch.status === 'halftime' ? 'Halftime Match' : 'Live Match'}
                  </p>

                  <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                    {featuredLiveMatch.home_team?.name || 'Home Team'} vs{' '}
                    {featuredLiveMatch.away_team?.name || 'Away Team'}
                  </h2>
                </div>

                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-900">
                  {featuredLiveMatch.status === 'halftime' ? 'Halftime' : 'Live'}
                </span>
              </div>

              <div className="rounded-2xl bg-white/15 px-5 py-4 text-center ring-1 ring-white/15">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                  Score
                </div>

                <div className="mt-1 text-3xl font-black text-white">
                  {featuredLiveMatch.home_score} - {featuredLiveMatch.away_score}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {featuredLiveMatch.public_slug ? (
                  <Link
                    href={`/public/${featuredLiveMatch.public_slug}`}
                    className="inline-flex rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
                  >
                    Open Live Match
                  </Link>
                ) : null}

                <Link
                  href={`/public/team/${team.id}/schedule`}
                  className="inline-flex rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Full Schedule
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* SUMMARY CARDS */}
      {/* --------------------------------------------------- */}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <SummaryCard label="Record" value={`${summary.wins}-${summary.losses}-${summary.draws}`} />
        <SummaryCard
          label="Goals For / Against"
          value={`${summary.goalsFor} / ${summary.goalsAgainst}`}
        />
        <SummaryCard
          label="Goal Difference"
          value={summary.goalDifference > 0 ? `+${summary.goalDifference}` : summary.goalDifference}
        />
        <SummaryCard label="Clean Sheets" value={summary.cleanSheets} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          {/* --------------------------------------------------- */}
          {/* NEXT MATCH HERO
          Hide on mobile when there is already a featured live match.
          --------------------------------------------------- */}

          {nextMatch ? (
            <div
              className={`overflow-hidden rounded-3xl shadow-md ring-1 ring-black/10 ${
                featuredLiveMatch ? 'hidden lg:block' : 'block'
              }`}
              style={nextMatchHeroStyle}
            >
              <div className="bg-black/25 p-6 backdrop-blur-[2px]">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-white/75">
                      Next Match
                    </p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
                      {nextMatch.home_team?.name || 'Home Team'} vs{' '}
                      {nextMatch.away_team?.name || 'Away Team'}
                    </h2>
                    <p className="mt-2 text-white/80">
                      {nextMatch.match_date
                        ? new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          }).format(new Date(nextMatch.match_date))
                        : 'Date TBD'}
                      {nextMatch.venue ? ` • ${nextMatch.venue}` : ''}
                    </p>
                  </div>

                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-900">
                    {nextMatch.status === 'live'
                      ? 'Live'
                      : nextMatch.status === 'halftime'
                        ? 'Halftime'
                        : 'Scheduled'}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                      Home
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      {nextMatch.home_team?.logo_url ? (
                        <img
                          src={nextMatch.home_team.logo_url}
                          alt={`${nextMatch.home_team.name} logo`}
                          className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/25"
                        />
                      ) : null}
                      <h3 className="truncate text-2xl font-black text-white">
                        {nextMatch.home_team?.name || 'Home Team'}
                      </h3>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/15 px-5 py-4 text-center ring-1 ring-white/15">
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
                      {nextMatch.status === 'live' || nextMatch.status === 'halftime'
                        ? 'Live'
                        : 'Upcoming'}
                    </div>
                    <div className="mt-1 text-lg font-bold text-white">
                      {nextMatch.status === 'live' || nextMatch.status === 'halftime'
                        ? `${nextMatch.home_score} - ${nextMatch.away_score}`
                        : 'vs'}
                    </div>
                  </div>

                  <div className="min-w-0 md:text-right">
                    <p className="text-sm font-semibold uppercase tracking-wide text-white/70">
                      Away
                    </p>
                    <div className="mt-2 flex items-center justify-end gap-3">
                      <h3 className="truncate text-2xl font-black text-white">
                        {nextMatch.away_team?.name || 'Away Team'}
                      </h3>
                      {nextMatch.away_team?.logo_url ? (
                        <img
                          src={nextMatch.away_team.logo_url}
                          alt={`${nextMatch.away_team.name} logo`}
                          className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/25"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/public/team/${team.id}/schedule`}
                    className="inline-flex rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Full Schedule
                  </Link>

                  {nextMatch.public_slug ? (
                    <Link
                      href={`/public/${nextMatch.public_slug}`}
                      className="inline-flex rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
                    >
                      {nextMatch.status === 'live' || nextMatch.status === 'halftime'
                        ? 'Watch Live'
                        : 'View Match'}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* --------------------------------------------------- */}
          {/* RECENT MATCHES */}
          {/* --------------------------------------------------- */}

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

          {/* --------------------------------------------------- */}
          {/* ROSTER PREVIEW */}
          {/* --------------------------------------------------- */}

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
          {/* --------------------------------------------------- */}
          {/* TEAM SNAPSHOT */}
          {/* --------------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Team Snapshot</h2>
            <p className="mt-2 text-sm text-slate-600">
              Quick view of recent performance and team leaders.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <SnapshotMiniCard label="Matches Played" value={summary.played} />

              <SnapshotMiniCard
                label="Top Scorer"
                value={
                  topScorer.goals > 0 ? `${topScorer.name} (${topScorer.goals})` : topScorer.name
                }
              />

              <SnapshotMiniCard
                label="Top Assist"
                value={
                  topAssist.assists > 0
                    ? `${topAssist.name} (${topAssist.assists})`
                    : topAssist.name
                }
              />

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recent Form
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {recentForm.length === 0 ? (
                    <span className="text-sm font-medium text-slate-400">No results yet</span>
                  ) : (
                    recentForm.map((result, index) => (
                      <span
                        key={`${result}-${index}`}
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold ${
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
              </div>
            </div>
          </div>

          {/* --------------------------------------------------- */}
          {/* EXPLORE MORE */}
          {/* --------------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Explore More</h2>
            <p className="mt-2 text-sm text-slate-600">
              Dive deeper into player stats, schedules, and match recaps.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/public/team/${team.id}/leaders`}
                className="inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                View Leaders
              </Link>

              <Link
                href={`/public/team/${team.id}/schedule`}
                className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm"
              >
                View Schedule
              </Link>
            </div>
          </div>
        </section>
      </div>
    </PublicTeamPageShell>
  );
}

// ---------------------------------------------------
// SUMMARY CARD
// ---------------------------------------------------

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------
// SNAPSHOT MINI CARD
// ---------------------------------------------------

function SnapshotMiniCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold leading-6 text-slate-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------
// PLAYER DISPLAY NAME
// ---------------------------------------------------

function playerDisplayName(player: Player | undefined) {
  if (!player) return '';
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  return player.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
}

// ---------------------------------------------------
// RESULT LABEL
// ---------------------------------------------------

function resultLabel(match: MatchRow, teamId: string) {
  const isHome = match.home_team_id === teamId;
  const teamGoals = isHome ? match.home_score : match.away_score;
  const oppGoals = isHome ? match.away_score : match.home_score;

  if (teamGoals > oppGoals) return 'W';
  if (teamGoals < oppGoals) return 'L';
  return 'D';
}

// ---------------------------------------------------
// OPPONENT NAME
// ---------------------------------------------------

function opponentName(match: MatchRow, teamId: string) {
  const isHome = match.home_team_id === teamId;
  return isHome ? match.away_team?.name || 'Opponent' : match.home_team?.name || 'Opponent';
}

// ---------------------------------------------------
// SCORE LINE
// ---------------------------------------------------

function scoreLine(match: MatchRow, teamId: string) {
  const isHome = match.home_team_id === teamId;
  const teamGoals = isHome ? match.home_score : match.away_score;
  const oppGoals = isHome ? match.away_score : match.home_score;
  return `${teamGoals}-${oppGoals}`;
}