import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Team } from '@/lib/types';

type PublicMatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export const dynamic = 'force-dynamic';

export default async function PublicMatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
            This public scoreboard link may be invalid or no longer available.
          </p>
        </div>
      </main>
    );
  }

  const match = matchData as PublicMatchRow;

  const { data: eventsData } = await supabase
    .from('match_events')
    .select('*')
    .eq('match_id', match.id)
    .order('created_at', { ascending: false });

  const events = (eventsData as MatchEvent[]) ?? [];

  const [homePlayersResult, awayPlayersResult] = await Promise.all([
    match.home_team_id
      ? supabase
          .from('players')
          .select('*')
          .eq('team_id', match.home_team_id)
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    match.away_team_id
      ? supabase
          .from('players')
          .select('*')
          .eq('team_id', match.away_team_id)
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const homePlayers = (homePlayersResult.data as Player[]) ?? [];
  const awayPlayers = (awayPlayersResult.data as Player[]) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Live Match Center
          </h1>
        </div>

        <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          Public scoreboard
        </div>
      </div>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Home
            </p>
            <div className="mt-1 flex items-center gap-3">
              {match.home_team?.logo_url ? (
                <img
                  src={match.home_team.logo_url}
                  alt={`${match.home_team.name} logo`}
                  className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200"
                />
              ) : null}
              <h2 className="text-2xl font-black text-slate-900">
                {match.home_team?.name || 'Home Team'}
              </h2>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 px-8 py-5 text-center text-white">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-300">
              {prettyStatus(match.status)}
            </div>
            <div className="mt-2 text-5xl font-black tracking-tight tabular-nums">
              {match.home_score} - {match.away_score}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-300">
              {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
            </div>
            <div className="mt-1 text-sm text-slate-300">{getVenueName(match)}</div>
          </div>

          <div className="md:text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Away
            </p>
            <div className="mt-1 flex items-center justify-end gap-3">
              <h2 className="text-2xl font-black text-slate-900">
                {match.away_team?.name || 'Away Team'}
              </h2>
              {match.away_team?.logo_url ? (
                <img
                  src={match.away_team.logo_url}
                  alt={`${match.away_team.name} logo`}
                  className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-200"
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Live Timeline</h3>
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-500">
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