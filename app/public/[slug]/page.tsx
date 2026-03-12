'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Team } from '@/lib/types';

type PublicMatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export default function PublicMatchPage() {
  const params = useParams();

  const slug =
    typeof params?.slug === 'string'
      ? params.slug
      : Array.isArray(params?.slug)
        ? params.slug[0]
        : '';

  const [match, setMatch] = useState<PublicMatchRow | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  async function loadPageData(currentSlug: string) {
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:home_team_id (*),
        away_team:away_team_id (*)
      `)
      .eq('public_slug', currentSlug)
      .single();

    if (matchError || !matchData) {
      throw new Error(matchError?.message || 'Match not found.');
    }

    const loadedMatch = matchData as PublicMatchRow;

    const { data: eventsData, error: eventsError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', loadedMatch.id)
      .order('created_at', { ascending: false });

    if (eventsError) {
      throw new Error(eventsError.message);
    }

    const homePlayersResult =
      loadedMatch.home_team_id && loadedMatch.home_team_id !== 'undefined'
        ? await supabase
            .from('players')
            .select('*')
            .eq('team_id', loadedMatch.home_team_id)
            .order('jersey_number', { ascending: true, nullsFirst: false })
            .order('first_name', { ascending: true })
        : { data: [], error: null };

    const awayPlayersResult =
      loadedMatch.away_team_id && loadedMatch.away_team_id !== 'undefined'
        ? await supabase
            .from('players')
            .select('*')
            .eq('team_id', loadedMatch.away_team_id)
            .order('jersey_number', { ascending: true, nullsFirst: false })
            .order('first_name', { ascending: true })
        : { data: [], error: null };

    return {
      match: loadedMatch,
      events: (eventsData as MatchEvent[]) ?? [],
      homePlayers: (homePlayersResult.data as Player[]) ?? [],
      awayPlayers: (awayPlayersResult.data as Player[]) ?? [],
    };
  }

  useEffect(() => {
    if (!slug) return;

    let mounted = true;

    async function initialLoad() {
      try {
        setError('');
        setLoading(true);

        const data = await loadPageData(slug);

        if (!mounted) return;

        setMatch(data.match);
        setEvents(data.events);
        setHomePlayers(data.homePlayers);
        setAwayPlayers(data.awayPlayers);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load scoreboard.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialLoad();

    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!match?.id || !slug) return;

    const channel = supabase
      .channel(`public-match-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`,
        },
        async () => {
          try {
            const data = await loadPageData(slug);
            setMatch(data.match);
            setEvents(data.events);
            setHomePlayers(data.homePlayers);
            setAwayPlayers(data.awayPlayers);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Realtime refresh failed.');
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${match.id}`,
        },
        async () => {
          try {
            const data = await loadPageData(slug);
            setMatch(data.match);
            setEvents(data.events);
            setHomePlayers(data.homePlayers);
            setAwayPlayers(data.awayPlayers);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Realtime refresh failed.');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match?.id, slug]);

  useEffect(() => {
    if (!match?.clock_running) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [match?.clock_running]);

  const secondsElapsed = useMemo(() => {
    if (!match) return 0;

    const base = match.elapsed_seconds || 0;

    if (!match.clock_running || !match.period_started_at) {
      return base;
    }

    const startedMs = new Date(match.period_started_at).getTime();
    const deltaSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));

    return base + deltaSeconds;
  }, [match, nowMs]);

  const formattedClock = useMemo(() => {
    const mins = Math.floor(secondsElapsed / 60)
      .toString()
      .padStart(2, '0');
    const secs = (secondsElapsed % 60).toString().padStart(2, '0');

    return `${mins}:${secs}`;
  }, [secondsElapsed]);

  const goalEvents = useMemo(
    () => events.filter((event) => event.event_type === 'goal').slice().reverse(),
    [events],
  );

  const cardEvents = useMemo(
    () =>
      events
        .filter(
          (event) => event.event_type === 'yellow_card' || event.event_type === 'red_card',
        )
        .slice()
        .reverse(),
    [events],
  );

  const teamSnapshots = useMemo(() => {
    function buildSnapshot(side: 'home' | 'away') {
      const team = side === 'home' ? match?.home_team : match?.away_team;
      const teamId = side === 'home' ? match?.home_team_id : match?.away_team_id;

      if (!team || !teamId) return null;

      const teamGoalEvents = events.filter(
        (event) => event.team_id === teamId && event.event_type === 'goal',
      );

      const scorerCounts = new Map<string, number>();

      for (const event of teamGoalEvents) {
        const key = event.player_id || `override:${event.player_name_override || 'unknown'}`;
        scorerCounts.set(key, (scorerCounts.get(key) || 0) + 1);
      }

      let topScorerName = 'No scorer yet';
      let topScorerGoals = 0;

      for (const [key, count] of scorerCounts.entries()) {
        if (count > topScorerGoals) {
          topScorerGoals = count;

          if (key.startsWith('override:')) {
            topScorerName = key.replace('override:', '') || 'Unknown';
          } else {
            const roster = side === 'home' ? homePlayers : awayPlayers;
            const player = roster.find((p) => p.id === key);
            topScorerName = playerDisplayName(player) || 'Unknown';
          }
        }
      }

      return {
        side,
        team,
        record: 'Record coming next',
        topScorerName,
        topScorerGoals,
        recentForm: 'Form coming next',
      };
    }

    return {
      home: buildSnapshot('home'),
      away: buildSnapshot('away'),
    };
  }, [match, events, homePlayers, awayPlayers]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          Loading public scoreboard...
        </div>
      </main>
    );
  }

  if (error || !match) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Match not found
          </h1>
          <p className="mt-3 text-slate-600">
            {error || 'This public scoreboard link may be invalid or no longer available.'}
          </p>
        </div>
      </main>
    );
  }

  const isFinal = match.status === 'final';

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          {isFinal ? 'Match Recap' : 'Public Match Center'}
        </h1>
      </div>

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-gradient-to-b from-red-900 to-red-850 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                Home
              </p>

              <div className="mt-2 flex items-center gap-3">
                {match.home_team?.logo_url ? (
                  <img
                    src={match.home_team.logo_url}
                    alt={`${match.home_team.name} logo`}
                    className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-red-100 ring-1 ring-white/15">
                    LOGO
                  </div>
                )}

                <div>
                  <h2
                    className="text-xl font-black leading-tight md:text-2xl"
                    style={{ color: '#ffffff' }}
                  >
                    {match.home_team?.name || 'Home Team'}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {match.home_team?.club_name || ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <StatusPill status={match.status} />
                <PeriodPill
                  status={match.status}
                  clockRunning={match.clock_running}
                  secondsElapsed={secondsElapsed}
                />
              </div>

              <div className="mt-5 inline-flex min-w-[260px] flex-col items-center rounded-[28px] border border-white/15 bg-white/10 px-8 py-6 shadow-2xl backdrop-blur-md">
                <div className="text-6xl font-black tracking-tight tabular-nums text-white md:text-7xl">
                  {match.home_score} - {match.away_score}
                </div>

                <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90 md:text-3xl">
                  {formattedClock}
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="text-sm font-medium text-white/90">
                  {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
                </div>
                <div className="text-sm text-white/75">{getVenueName(match)}</div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                Away
              </p>

              <div className="mt-2 flex items-center justify-end gap-3">
                <div>
                  <h2
                    className="text-xl font-black leading-tight md:text-2xl"
                    style={{ color: '#ffffff' }}
                  >
                    {match.away_team?.name || 'Away Team'}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {match.away_team?.club_name || ''}
                  </p>
                </div>

                {match.away_team?.logo_url ? (
                  <img
                    src={match.away_team.logo_url}
                    alt={`${match.away_team.name} logo`}
                    className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-red-100 ring-1 ring-white/15">
                    LOGO
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6">
          {isFinal && (
            <>
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-xl font-bold text-slate-900">Goals</h3>

                {goalEvents.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No goals recorded.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {goalEvents.map((event) => (
                      <TimelineEventCard
                        key={event.id}
                        event={event}
                        match={match}
                        homePlayers={homePlayers}
                        awayPlayers={awayPlayers}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-xl font-bold text-slate-900">Cards</h3>

                {cardEvents.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No cards recorded.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {cardEvents.map((event) => (
                      <TimelineEventCard
                        key={event.id}
                        event={event}
                        match={match}
                        homePlayers={homePlayers}
                        awayPlayers={awayPlayers}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {isFinal ? 'Full Match Timeline' : 'Match Timeline'}
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {events.length} events
              </span>
            </div>

            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
                No match events yet.
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    match={match}
                    homePlayers={homePlayers}
                    awayPlayers={awayPlayers}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">
              {isFinal ? 'Recap Details' : 'Match Details'}
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Status</dt>
                <dd className="text-right font-medium text-slate-900">
                  {prettyStatus(match.status)}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Clock</dt>
                <dd className="text-right font-medium tabular-nums text-slate-900">
                  {formattedClock}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Date</dt>
                <dd className="text-right font-medium text-slate-900">
                  {match.match_date ? formatMatchDate(match.match_date) : 'TBD'}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Venue</dt>
                <dd className="text-right font-medium text-slate-900">
                  {getVenueName(match)}
                  {getVenueAddress(match) ? (
                    <div className="mt-2">
                      <a
                        href={getAppleMapsUrl(getVenueAddress(match)!)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                      >
                        Get Directions
                      </a>
                    </div>
                  ) : null}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">
                  {isFinal ? 'Total Goals' : 'Updates'}
                </dt>
                <dd className="text-right font-medium text-slate-900">
                  {isFinal ? goalEvents.length : 'Realtime'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Explore More</h3>
            <p className="mt-2 text-sm text-slate-600">
              View public team pages and season leaders for both sides.
            </p>

            <div className="mt-5 space-y-4">
              {match.home_team ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {match.home_team.logo_url ? (
                      <img
                        src={match.home_team.logo_url}
                        alt={`${match.home_team.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Home Team
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {match.home_team.name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/public/team/${match.home_team.id}`}
                      className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm"
                    >
                      Team Page
                    </Link>

                    <Link
                      href={`/public/team/${match.home_team.id}/leaders`}
                      className="inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                    >
                      Leaders
                    </Link>
                  </div>
                </div>
              ) : null}

              {match.away_team ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {match.away_team.logo_url ? (
                      <img
                        src={match.away_team.logo_url}
                        alt={`${match.away_team.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Away Team
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {match.away_team.name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/public/team/${match.away_team.id}`}
                      className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm"
                    >
                      Team Page
                    </Link>

                    <Link
                      href={`/public/team/${match.away_team.id}/leaders`}
                      className="inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                    >
                      Leaders
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Team Snapshot</h3>
            <p className="mt-2 text-sm text-slate-600">
              Quick team context for both sides in this match.
            </p>

            <div className="mt-5 space-y-4">
              {teamSnapshots.home ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {teamSnapshots.home.team.logo_url ? (
                      <img
                        src={teamSnapshots.home.team.logo_url}
                        alt={`${teamSnapshots.home.team.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Home Snapshot
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {teamSnapshots.home.team.name}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Record</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.home.record}
                      </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Top Scorer</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.home.topScorerGoals > 0
                          ? `${teamSnapshots.home.topScorerName} (${teamSnapshots.home.topScorerGoals})`
                          : teamSnapshots.home.topScorerName}
                      </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Recent Form</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.home.recentForm}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {teamSnapshots.away ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {teamSnapshots.away.team.logo_url ? (
                      <img
                        src={teamSnapshots.away.team.logo_url}
                        alt={`${teamSnapshots.away.team.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Away Snapshot
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {teamSnapshots.away.team.name}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Record</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.away.record}
                      </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Top Scorer</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.away.topScorerGoals > 0
                          ? `${teamSnapshots.away.topScorerName} (${teamSnapshots.away.topScorerGoals})`
                          : teamSnapshots.away.topScorerName}
                      </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Recent Form</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.away.recentForm}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">
              {isFinal ? 'Final Summary' : 'Live Updates'}
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              {isFinal
                ? 'This match has ended. The recap above summarizes the final score, goal events, cards, and full timeline.'
                : 'Leave this page open to follow the score, clock, and timeline as the match progresses.'}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function TimelineEventCard({
  event,
  match,
  homePlayers,
  awayPlayers,
}: {
  event: MatchEvent;
  match: PublicMatchRow;
  homePlayers: Player[];
  awayPlayers: Player[];
}) {
  return (
    <div className="relative pl-14">

      {/* vertical timeline rail */}
      <div className="absolute left-[1rem] top-0 bottom-0 w-px bg-slate-200" />

      {/* event icon */}
      <div className="absolute left-0 top-4 flex w-8 justify-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm shadow-sm ring-1 ${
            event.event_type === 'goal'
              ? 'bg-[#cfefff] text-sky-900 ring-[#8ecae6]'
              : event.event_type === 'yellow_card'
                ? 'bg-yellow-200 text-yellow-900 ring-yellow-400'
                : event.event_type === 'red_card'
                  ? 'bg-red-200 text-red-900 ring-red-400'
                  : 'bg-slate-100 text-slate-700 ring-slate-200'
          }`}
        >
          {event.event_type === 'goal'
            ? '⚽'
            : event.event_type === 'yellow_card'
              ? '🟨'
              : event.event_type === 'red_card'
                ? '🟥'
                : event.event_type === 'substitution'
                  ? '🔁'
                  : event.event_type === 'half_end'
                    ? '⏸'
                    : event.event_type === 'full_time'
                      ? '■'
                      : '•'}
        </div>
      </div>

      {/* event card */}
      <div
  className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${
    event.event_type === 'goal'
      ? 'border-[#8ecae6] bg-[#cfefff]'
      : event.event_type === 'yellow_card'
        ? 'border-yellow-400 bg-yellow-200/90'
        : event.event_type === 'red_card'
          ? 'border-red-400 bg-red-200/90'
          : 'border-slate-200 bg-slate-50'
  }`}
>
        <div className="flex items-center justify-between gap-3">

          {/* left content */}
          <div className="flex items-center gap-3 min-w-0">

            {/* time pill */}
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
              {event.minute}'
            </span>

            {/* event text */}
            <p className="truncate text-sm font-semibold text-slate-900">
              {prettyEventText(event, match, homePlayers, awayPlayers)}
            </p>

          </div>

          {/* team badge */}
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
              event.team_side === 'home'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {event.team_side}
          </span>

        </div>

        {event.notes && (
          <p className="mt-2 text-xs text-slate-600">{event.notes}</p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Match['status'] }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-400/20">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Live
      </span>
    );
  }

  if (status === 'halftime') {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300 ring-1 ring-amber-400/20">
        Halftime
      </span>
    );
  }

  if (status === 'final') {
    return (
      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/10">
        Final
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/10">
      Not Started
    </span>
  );
}

function PeriodPill({
  status,
  clockRunning,
  secondsElapsed,
}: {
  status: Match['status'];
  clockRunning: boolean;
  secondsElapsed: number;
}) {
  if (status === 'final') {
    return (
      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-100/80 ring-1 ring-white/10">
        Recap
      </span>
    );
  }

  if (status === 'halftime') {
    return (
      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-100/80 ring-1 ring-white/10">
        Halftime Break
      </span>
    );
  }

  if (status === 'not_started') {
    return (
      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-100/80 ring-1 ring-white/10">
        Pre-Match
      </span>
    );
  }

  const minute = Math.floor(secondsElapsed / 60);
  const halfLabel = minute >= 45 ? '2nd Half' : '1st Half';

  return (
    <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-100/80 ring-1 ring-white/10">
      {clockRunning ? halfLabel : 'Paused'}
    </span>
  );
}

function getVenueName(match: PublicMatchRow) {
  return match.venue || match.home_team?.home_field_name || 'Venue TBD';
}

function getVenueAddress(match: PublicMatchRow) {
  return match.home_team?.home_field_address || null;
}

function getAppleMapsUrl(address: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

function prettyStatus(status: Match['status']) {
  if (status === 'not_started') return 'Not Started';
  if (status === 'live') return 'Live';
  if (status === 'halftime') return 'Halftime';
  if (status === 'final') return 'Final';
  return status;
}

function playerDisplayName(player: Player | undefined) {
  if (!player) return '';
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  return player.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
}

function prettyEventText(
  event: MatchEvent,
  match: PublicMatchRow,
  homePlayers: Player[],
  awayPlayers: Player[],
) {
  const roster = event.team_side === 'home' ? homePlayers : awayPlayers;
  const primary = roster.find((p) => p.id === event.player_id);
  const secondary = roster.find((p) => p.id === event.secondary_player_id);

  const teamName =
    event.team_side === 'home'
      ? match.home_team?.name || 'Home Team'
      : match.away_team?.name || 'Away Team';

  const primaryName = event.player_name_override || playerDisplayName(primary);
  const secondaryName = event.secondary_player_name_override || playerDisplayName(secondary);

  if (event.event_type === 'goal') {
    return secondaryName
      ? `Goal — ${primaryName || teamName} (Assist: ${secondaryName})`
      : `Goal — ${primaryName || teamName}`;
  }

  if (event.event_type === 'yellow_card') {
    return `Yellow Card — ${primaryName || teamName}`;
  }

  if (event.event_type === 'red_card') {
    return `Red Card — ${primaryName || teamName}`;
  }

  if (event.event_type === 'substitution') {
    return secondaryName
      ? `Substitution — ${primaryName || 'Player Out'} for ${secondaryName}`
      : `Substitution — ${primaryName || teamName}`;
  }

  if (event.event_type === 'half_start') return 'Half Started';
  if (event.event_type === 'half_end') return 'Halftime';
  if (event.event_type === 'full_time') return 'Full Time';

  return event.event_type;
}

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}