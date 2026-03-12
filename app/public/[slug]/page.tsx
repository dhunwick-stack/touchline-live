'use client';

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

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function loadPageData() {
      setError('');

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .eq('public_slug', slug)
        .single();

      if (matchError || !matchData) {
        if (!cancelled) {
          setError(matchError?.message || 'Match not found.');
          setLoading(false);
        }
        return;
      }

      const loadedMatch = matchData as PublicMatchRow;

      if (!loadedMatch.id) {
        if (!cancelled) {
          setError('Match ID missing.');
          setLoading(false);
        }
        return;
      }

      const { data: eventsData, error: eventsError } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', loadedMatch.id)
        .order('created_at', { ascending: false });

      if (eventsError) {
        if (!cancelled) {
          setError(eventsError.message);
          setLoading(false);
        }
        return;
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

      if (!cancelled) {
        setMatch(loadedMatch);
        setEvents((eventsData as MatchEvent[]) ?? []);
        setHomePlayers((homePlayersResult.data as Player[]) ?? []);
        setAwayPlayers((awayPlayersResult.data as Player[]) ?? []);
        setLoading(false);
      }
    }

    loadPageData();

    const refreshTimer = window.setInterval(() => {
      loadPageData();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [slug]);

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
    const secs = (secondsElapsed % 60)
      .toString()
      .padStart(2, '0');

    return `${mins}:${secs}`;
  }, [secondsElapsed]);

  const isLive = useMemo(() => match?.status === 'live', [match?.status]);

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

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Public Match Center
          </h1>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          {isLive ? 'Live' : prettyStatus(match.status)}
        </div>
      </div>

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-red-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-200/80">
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
                  <h2 className="text-2xl font-black leading-tight">
                    {match.home_team?.name || 'Home Team'}
                  </h2>
                  <p className="mt-1 text-sm text-red-200/75">
                    {match.home_team?.club_name || ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-red-200/75">
                {prettyStatus(match.status)}
              </div>

              <div className="mt-3 text-7xl font-black tracking-tight tabular-nums">
                {match.home_score} - {match.away_score}
              </div>

              <div className="mt-3 text-3xl font-semibold tabular-nums text-red-100">
                {formattedClock}
              </div>

              {!match.clock_running && match.status === 'live' && (
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-red-200/70">
                  Paused
                </div>
              )}

              <div className="mt-4 space-y-1">
                <div className="text-sm font-medium text-red-100/90">
                  {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
                </div>
                <div className="text-sm text-red-200/80">{getVenueName(match)}</div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-200/80">
                Away
              </p>

              <div className="mt-2 flex items-center justify-end gap-3">
                <div>
                  <h2 className="text-2xl font-black leading-tight">
                    {match.away_team?.name || 'Away Team'}
                  </h2>
                  <p className="mt-1 text-sm text-red-200/75">
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
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Match Timeline</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {events.length} events
            </span>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
              No match events yet.
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold tabular-nums text-slate-500">
                      {event.minute}'
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                        event.team_side === 'home'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {event.team_side}
                    </span>
                  </div>

                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {prettyEventText(event, match, homePlayers, awayPlayers)}
                  </p>

                  {event.notes ? (
                    <p className="mt-2 text-xs text-slate-500">{event.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Match Details</h3>
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
                <dt className="font-semibold text-slate-500">Refresh</dt>
                <dd className="text-right font-medium text-slate-900">
                  Every 10 seconds
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
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
  const secondaryName =
    event.secondary_player_name_override || playerDisplayName(secondary);

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