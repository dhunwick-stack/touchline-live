'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type {
  EventType,
  Match,
  MatchEvent,
  Player,
  Team,
  TeamSide,
  TrackingMode,
} from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type EventFormState = {
  type: EventType;
  side: TeamSide;
  playerId: string;
  secondaryPlayerId: string;
  playerNameOverride: string;
  secondaryPlayerNameOverride: string;
  notes: string;
};

const eventTypeOptions: { value: EventType; label: string }[] = [
  { value: 'goal', label: 'Goal' },
  { value: 'yellow_card', label: 'Yellow Card' },
  { value: 'red_card', label: 'Red Card' },
  { value: 'substitution', label: 'Substitution' },
  { value: 'half_end', label: 'Halftime' },
  { value: 'full_time', label: 'Full Time' },
];

const eventLabels: Record<EventType, string> = {
  goal: 'Goal',
  yellow_card: 'Yellow Card',
  red_card: 'Red Card',
  substitution: 'Substitution',
  half_start: 'Half Started',
  half_end: 'Halftime',
  full_time: 'Full Time',
};

export default function LiveMatchPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<EventFormState>({
    type: 'goal',
    side: 'home',
    playerId: '',
    secondaryPlayerId: '',
    playerNameOverride: '',
    secondaryPlayerNameOverride: '',
    notes: '',
  });

  useEffect(() => {
    async function loadMatch() {
      setLoading(true);
      setError(null);

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .eq('id', matchId)
        .single();

      const { data: eventData, error: eventError } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false });

      if (matchError || eventError) {
        setError(matchError?.message || eventError?.message || 'Failed to load match.');
        setLoading(false);
        return;
      }

      const loadedMatch = matchData as MatchRow;
      setMatch(loadedMatch);
      setEvents((eventData as MatchEvent[]) ?? []);

      const homePlayersResult = loadedMatch.home_team_id
        ? await supabase
            .from('players')
            .select('*')
            .eq('team_id', loadedMatch.home_team_id)
            .eq('active', true)
            .order('jersey_number', { ascending: true, nullsFirst: false })
            .order('first_name', { ascending: true })
        : { data: [], error: null };

      const awayPlayersResult = loadedMatch.away_team_id
        ? await supabase
            .from('players')
            .select('*')
            .eq('team_id', loadedMatch.away_team_id)
            .eq('active', true)
            .order('jersey_number', { ascending: true, nullsFirst: false })
            .order('first_name', { ascending: true })
        : { data: [], error: null };

      if (homePlayersResult.error || awayPlayersResult.error) {
        setError(
          homePlayersResult.error?.message ||
            awayPlayersResult.error?.message ||
            'Failed to load players.',
        );
        setLoading(false);
        return;
      }

      setHomePlayers((homePlayersResult.data as Player[]) ?? []);
      setAwayPlayers((awayPlayersResult.data as Player[]) ?? []);
      setLoading(false);
    }

    loadMatch();
  }, [matchId]);

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

  const selectedTrackingMode = useMemo<TrackingMode>(() => {
    if (!match) return 'basic';
    return form.side === 'home' ? match.home_tracking_mode : match.away_tracking_mode;
  }, [form.side, match]);

  const selectedPlayers = useMemo(() => {
    return form.side === 'home' ? homePlayers : awayPlayers;
  }, [form.side, homePlayers, awayPlayers]);

  const selectedTeamName = useMemo(() => {
    if (!match) return 'Team';
    return form.side === 'home'
      ? match.home_team?.name || 'Home Team'
      : match.away_team?.name || 'Away Team';
  }, [form.side, match]);

  function resetForm(nextSide?: TeamSide) {
    setForm((prev) => ({
      ...prev,
      side: nextSide || prev.side,
      playerId: '',
      secondaryPlayerId: '',
      playerNameOverride: '',
      secondaryPlayerNameOverride: '',
      notes: '',
    }));
  }

  function playerDisplayName(player: Player | undefined) {
    if (!player) return '';
    const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
    return player.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
  }

  function buildEventText(event: MatchEvent, matchRow: MatchRow) {
    const roster = event.team_side === 'home' ? homePlayers : awayPlayers;
    const primary = roster.find((p) => p.id === event.player_id);
    const secondary = roster.find((p) => p.id === event.secondary_player_id);
    const teamName =
      event.team_side === 'home'
        ? matchRow.home_team?.name || 'Home'
        : matchRow.away_team?.name || 'Away';
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

    return eventLabels[event.event_type] || event.event_type;
  }

  function validateEvent() {
    if (!match) return 'Match not loaded.';
    if (form.type === 'half_end' || form.type === 'full_time') return null;

    if (selectedTrackingMode === 'score_only' && form.type !== 'goal') {
      return 'Score only mode only allows goals and match status events.';
    }

    if (selectedTrackingMode === 'full') {
      if (
        (form.type === 'goal' ||
          form.type === 'yellow_card' ||
          form.type === 'red_card' ||
          form.type === 'substitution') &&
        !form.playerId
      ) {
        return 'Choose a player for this event.';
      }
      if (form.type === 'substitution' && !form.secondaryPlayerId) {
        return 'Choose the second player for substitution.';
      }
    }

    if (selectedTrackingMode === 'basic') {
      if (form.type === 'substitution' && !form.playerNameOverride.trim() && !form.playerId) {
        return 'Add a quick player or note for this substitution.';
      }
    }

    return null;
  }

  async function addEvent() {
    if (!match) return;

    const validationError = validateEvent();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const minute = Math.floor(secondsElapsed / 60);
    const teamId = form.side === 'home' ? match.home_team_id : match.away_team_id;

    const insertPayload = {
      match_id: match.id,
      minute,
      event_type: form.type,
      team_side: form.side,
      team_id: teamId,
      player_id: form.playerId || null,
      secondary_player_id: form.secondaryPlayerId || null,
      player_name_override: form.playerNameOverride.trim() || null,
      secondary_player_name_override: form.secondaryPlayerNameOverride.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { data, error } = await supabase
      .from('match_events')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      setSaving(false);
      setError(error.message);
      return;
    }

    let nextHomeScore = match.home_score;
    let nextAwayScore = match.away_score;
    let nextStatus = match.status;
    let nextClockRunning = match.clock_running;
    let nextPeriodStartedAt = match.period_started_at;

    if (form.type === 'goal') {
      if (form.side === 'home') nextHomeScore += 1;
      if (form.side === 'away') nextAwayScore += 1;
    }

    if (form.type === 'half_end') {
      nextStatus = 'halftime';
      nextClockRunning = false;
      nextPeriodStartedAt = null;
    }

    if (form.type === 'full_time') {
      nextStatus = 'final';
      nextClockRunning = false;
      nextPeriodStartedAt = null;
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        home_score: nextHomeScore,
        away_score: nextAwayScore,
        status: nextStatus,
        current_minute: minute,
        elapsed_seconds: secondsElapsed,
        clock_running: nextClockRunning,
        period_started_at: nextPeriodStartedAt,
      })
      .eq('id', match.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    setEvents((prev) => [data as MatchEvent, ...prev]);
    setMatch((prev) =>
      prev
        ? {
            ...prev,
            home_score: nextHomeScore,
            away_score: nextAwayScore,
            status: nextStatus,
            current_minute: minute,
            elapsed_seconds: secondsElapsed,
            clock_running: nextClockRunning,
            period_started_at: nextPeriodStartedAt,
          }
        : prev,
    );

    setSaving(false);
    resetForm(form.side);
  }

  async function startLivePeriod() {
    if (!match) return;

    setError(null);

    const startedAt = new Date().toISOString();
    const minute = Math.floor(secondsElapsed / 60);

    const { error: statusError } = await supabase
      .from('matches')
      .update({
        status: 'live',
        current_minute: minute,
        clock_running: true,
        period_started_at: startedAt,
      })
      .eq('id', match.id);

    if (statusError) {
      setError(statusError.message);
      return;
    }

    setNowMs(Date.now());
    setMatch({
      ...match,
      status: 'live',
      current_minute: minute,
      clock_running: true,
      period_started_at: startedAt,
    });

    const { data: eventData, error: eventError } = await supabase
      .from('match_events')
      .insert({
        match_id: match.id,
        minute,
        event_type: 'half_start',
        team_side: 'home',
        team_id: match.home_team_id,
      })
      .select('*')
      .single();

    if (eventError) {
      setError(eventError.message);
      return;
    }

    setEvents((prev) => [eventData as MatchEvent, ...prev]);
  }

  async function pauseClock() {
    if (!match || !match.clock_running) return;

    setError(null);

    const pausedElapsed = secondsElapsed;
    const minute = Math.floor(pausedElapsed / 60);

    const { error } = await supabase
      .from('matches')
      .update({
        clock_running: false,
        period_started_at: null,
        elapsed_seconds: pausedElapsed,
        current_minute: minute,
      })
      .eq('id', match.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMatch({
      ...match,
      clock_running: false,
      period_started_at: null,
      elapsed_seconds: pausedElapsed,
      current_minute: minute,
    });
  }

  async function undoLastEvent() {
    if (!match || events.length === 0) return;

    const latest = events[0];
    setUndoing(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from('match_events')
      .delete()
      .eq('id', latest.id);

    if (deleteError) {
      setUndoing(false);
      setError(deleteError.message);
      return;
    }

    let nextHomeScore = match.home_score;
    let nextAwayScore = match.away_score;
    let nextStatus = match.status;

    if (latest.event_type === 'goal') {
      if (latest.team_side === 'home') nextHomeScore = Math.max(0, nextHomeScore - 1);
      if (latest.team_side === 'away') nextAwayScore = Math.max(0, nextAwayScore - 1);
    }

    if (latest.event_type === 'full_time') {
      nextStatus = 'live';
    }

    if (latest.event_type === 'half_end') {
      nextStatus = 'live';
    }

    const remainingEvents = events.slice(1);
    const fallbackMinute = remainingEvents.length > 0 ? remainingEvents[0].minute : 0;

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        home_score: nextHomeScore,
        away_score: nextAwayScore,
        status: nextStatus,
        current_minute: fallbackMinute,
      })
      .eq('id', match.id);

    if (updateError) {
      setUndoing(false);
      setError(updateError.message);
      return;
    }

    setEvents(remainingEvents);
    setMatch((prev) =>
      prev
        ? {
            ...prev,
            home_score: nextHomeScore,
            away_score: nextAwayScore,
            status: nextStatus,
            current_minute: fallbackMinute,
          }
        : prev,
    );

    setUndoing(false);
  }

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading match...</main>;
  }

  if (error && !match) {
    return <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">{error}</main>;
  }

  if (!match) {
    return <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">Match not found.</main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Home
              </p>
              <div className="mt-1 flex items-center gap-3">
                {match.home_team?.logo_url ? (
                  <img
                    src={match.home_team.logo_url}
                    alt={`${match.home_team.name} logo`}
                    className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
                  />
                ) : null}
                <h1 className="text-2xl font-black">
                  {match.home_team?.name || 'Home Team'}
                </h1>
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
                {match.status}
              </div>

              <div className="mt-2 text-6xl font-black tabular-nums tracking-tight">
                {match.home_score} - {match.away_score}
              </div>

              <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-300">
                {formattedClock}
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {(match.status === 'not_started' || match.status === 'halftime') && (
                  <button
                    onClick={startLivePeriod}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white"
                  >
                    {match.status === 'halftime' ? 'Start 2nd Half' : 'Start Match'}
                  </button>
                )}

                {match.status === 'live' && match.clock_running && (
                  <button
                    onClick={pauseClock}
                    className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white"
                  >
                    Pause
                  </button>
                )}

                {match.status === 'live' && !match.clock_running && (
                  <button
                    onClick={startLivePeriod}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white"
                  >
                    Resume
                  </button>
                )}

                <button
                  onClick={undoLastEvent}
                  disabled={undoing || events.length === 0}
                  className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 disabled:opacity-40"
                >
                  {undoing ? 'Undoing…' : 'Undo'}
                </button>

                {match.public_slug && (
                  <Link
                    href={`/public/${match.public_slug}`}
                    target="_blank"
                    className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                  >
                    Public Scoreboard
                  </Link>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Away
              </p>
              <div className="mt-1 flex items-center justify-end gap-3">
                <h1 className="text-2xl font-black">
                  {match.away_team?.name || 'Away Team'}
                </h1>
                {match.away_team?.logo_url ? (
                  <img
                    src={match.away_team.logo_url}
                    alt={`${match.away_team.name} logo`}
                    className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Roster-Aware Event Entry</h2>
              <p className="text-sm text-slate-600">The form adapts to each side’s tracking mode.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {selectedTeamName}
            </span>
          </div>

          <div className="space-y-4">
            <Field label="Team Side">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => resetForm('home')}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    form.side === 'home' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800'
                  }`}
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => resetForm('away')}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    form.side === 'away' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'
                  }`}
                >
                  Away
                </button>
              </div>
            </Field>

            <Field label="Tracking Mode for This Side">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                {selectedTrackingMode === 'full' &&
                  'Full tracking — player-based events and detailed logging'}
                {selectedTrackingMode === 'basic' &&
                  'Basic tracking — team events with optional player text'}
                {selectedTrackingMode === 'score_only' &&
                  'Score only — goals and match status events only'}
              </div>
            </Field>

            <Field label="Event Type">
              <div className="grid grid-cols-2 gap-3">
                {eventTypeOptions
                  .filter(
                    (option) =>
                      !(
                        selectedTrackingMode === 'score_only' &&
                        !['goal', 'half_end', 'full_time'].includes(option.value)
                      ),
                  )
                  .map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, type: option.value }))}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                        form.type === option.value
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
              </div>
            </Field>

            {selectedTrackingMode === 'full' &&
              form.type !== 'half_end' &&
              form.type !== 'full_time' && (
                <Field label={form.type === 'substitution' ? 'Primary Player' : 'Player'}>
                  <select
                    value={form.playerId}
                    onChange={(e) => setForm((prev) => ({ ...prev, playerId: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <option value="">Select player</option>
                    {selectedPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {playerDisplayName(player)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

            {selectedTrackingMode === 'full' && form.type === 'goal' && (
              <Field label="Assist Player (Optional)">
                <select
                  value={form.secondaryPlayerId}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, secondaryPlayerId: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <option value="">No assist</option>
                  {selectedPlayers
                    .filter((player) => player.id !== form.playerId)
                    .map((player) => (
                      <option key={player.id} value={player.id}>
                        {playerDisplayName(player)}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            {selectedTrackingMode === 'full' && form.type === 'substitution' && (
              <Field label="Second Player">
                <select
                  value={form.secondaryPlayerId}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, secondaryPlayerId: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <option value="">Select player</option>
                  {selectedPlayers
                    .filter((player) => player.id !== form.playerId)
                    .map((player) => (
                      <option key={player.id} value={player.id}>
                        {playerDisplayName(player)}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            {selectedTrackingMode === 'basic' &&
              form.type !== 'half_end' &&
              form.type !== 'full_time' && (
                <>
                  <Field label="Quick Player / Label (Optional)">
                    <input
                      value={form.playerNameOverride}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, playerNameOverride: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      placeholder="e.g. #10 or Smith"
                    />
                  </Field>

                  {form.type === 'goal' && (
                    <Field label="Assist / Secondary Label (Optional)">
                      <input
                        value={form.secondaryPlayerNameOverride}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            secondaryPlayerNameOverride: e.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        placeholder="Optional assist"
                      />
                    </Field>
                  )}
                </>
              )}

            <Field label="Notes (Optional)">
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Sideline note, context, or detail"
              />
            </Field>

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <button
              type="button"
              onClick={addEvent}
              disabled={saving}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving Event...' : 'Add Event'}
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Live Timeline</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {events.length} events
            </span>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
              No events yet. Start the match and add the first event.
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-500">{event.minute}'</span>
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
                    {buildEventText(event, match)}
                  </p>
                  {event.notes ? (
                    <p className="mt-2 text-xs text-slate-500">{event.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}