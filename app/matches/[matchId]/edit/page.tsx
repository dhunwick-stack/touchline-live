'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Match, MatchEvent, Player, Season, Team, TeamSide } from '@/lib/types';
import { useSuperAdminGuard } from '@/lib/useSuperAdminGuard';

// ---------------------------------------------------
// LOCAL TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type HistoricalEventBackfillRow = {
  id: string;
  eventType: 'goal' | 'yellow_card' | 'red_card';
  side: TeamSide;
  playerId: string;
  playerName: string;
  assistPlayerId: string;
  assistPlayerName: string;
  minute: string;
};

type QuickGoalBackfillRow = {
  id: string;
  side: TeamSide;
  playerId: string;
  scorer: string;
  assistPlayerId: string;
  assistName: string;
  minute: string;
};

// ---------------------------------------------------
// DATETIME HELPER
// ---------------------------------------------------

function toLocalInputValue(isoString: string | null | undefined) {
  if (!isoString) return '';

  const date = new Date(isoString);
  const tzOffset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

// ---------------------------------------------------
// READABLE PUBLIC SLUG HELPER
// ---------------------------------------------------

function buildReadableMatchSlug({
  homeTeamName,
  awayTeamName,
  matchDate,
}: {
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  matchDate?: string | null;
}) {
  const home = slugifySegment(homeTeamName || 'home-team');
  const away = slugifySegment(awayTeamName || 'away-team');

  let datePart = 'date-tbd';

  if (matchDate) {
    const parsed = new Date(matchDate);

    if (!Number.isNaN(parsed.getTime())) {
      datePart = parsed.toISOString().slice(0, 10);
    }
  }

  return `${home}-vs-${away}-${datePart}`;
}

// ---------------------------------------------------
// SLUGIFY SEGMENT
// ---------------------------------------------------

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// ---------------------------------------------------
// PAGE
// FILE: app/matches/[matchId]/edit/page.tsx
// ---------------------------------------------------

export default function EditMatchPage() {
  // ---------------------------------------------------
  // ROUTE / NAVIGATION
  // ---------------------------------------------------

  const params = useParams();
  const router = useRouter();

  const matchId =
    typeof params?.matchId === 'string'
      ? params.matchId
      : Array.isArray(params?.matchId)
        ? params.matchId[0]
        : '';
  const { authChecked, hasSuperAccess, loading: superAdminLoading } = useSuperAdminGuard({
    nextPath: matchId ? `/matches/${matchId}/edit` : '/matches',
  });

  // ---------------------------------------------------
  // PAGE STATE
  // ---------------------------------------------------

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [backfilling, setBackfilling] = useState(false);

  // ---------------------------------------------------
  // FORM STATE
  // ---------------------------------------------------

  const [seasonId, setSeasonId] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [venue, setVenue] = useState('');
  const [status, setStatus] = useState<Match['status']>('scheduled');
  const [statusNote, setStatusNote] = useState('');
  const [publicSlug, setPublicSlug] = useState('');
  const [backfillHomeScore, setBackfillHomeScore] = useState('0');
  const [backfillAwayScore, setBackfillAwayScore] = useState('0');
  const [quickGoalRows, setQuickGoalRows] = useState<QuickGoalBackfillRow[]>([]);
  const [historicalRows, setHistoricalRows] = useState<HistoricalEventBackfillRow[]>([]);
  const [playersByTeam, setPlayersByTeam] = useState<Record<string, Player[]>>({});

  function getPlayerDisplayName(player: Player) {
    const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ').trim();

    if (player.jersey_number !== null && player.jersey_number !== undefined) {
      return `#${player.jersey_number} ${fullName}`;
    }

    return fullName;
  }

  const loadPageData = useCallback(async () => {
    if (!matchId) return;

    setLoading(true);
    setMessage('');

    const [
      { data: matchData, error: matchError },
      { data: seasonsData, error: seasonsError },
      { data: eventData, error: eventError },
    ] = await Promise.all([
      supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .eq('id', matchId)
        .single(),
      supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchId)
        .in('event_type', ['goal', 'yellow_card', 'red_card'])
        .order('minute', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (matchError || seasonsError || eventError) {
      setMessage(
        matchError?.message ||
          seasonsError?.message ||
          eventError?.message ||
          'Failed to load match.',
      );
      setLoading(false);
      return;
    }

    const loadedMatch = matchData as MatchRow;
    const loadedSeasons = (seasonsData as Season[]) ?? [];
    const loadedBackfillEvents = (eventData as MatchEvent[]) ?? [];
    const playerTeamIds = [loadedMatch.home_team_id, loadedMatch.away_team_id].filter(
      Boolean,
    ) as string[];
    let loadedPlayers: Player[] = [];

    if (playerTeamIds.length > 0) {
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .in('team_id', playerTeamIds)
        .order('active', { ascending: false })
        .order('jersey_number', { ascending: true })
        .order('first_name', { ascending: true });

      if (playerError) {
        setMessage(playerError.message || 'Failed to load roster players.');
        setLoading(false);
        return;
      }

      loadedPlayers = (playerData as Player[]) ?? [];
    }
    const nextPlayersByTeam = loadedPlayers.reduce<Record<string, Player[]>>((acc, player) => {
      if (!acc[player.team_id]) {
        acc[player.team_id] = [];
      }

      acc[player.team_id].push(player);
      return acc;
    }, {});

    setMatch(loadedMatch);
    setSeasons(loadedSeasons);
    setPlayersByTeam(nextPlayersByTeam);

    setSeasonId(loadedMatch.season_id || '');
    setMatchDate(toLocalInputValue(loadedMatch.match_date || null));
    setVenue(loadedMatch.venue || '');
    setStatus(loadedMatch.status);
    setStatusNote(loadedMatch.status_note || '');
    setPublicSlug(
      loadedMatch.public_slug ||
        buildReadableMatchSlug({
          homeTeamName: loadedMatch.home_team?.name,
          awayTeamName: loadedMatch.away_team?.name,
          matchDate: loadedMatch.match_date,
        }),
    );

    setBackfillHomeScore(String(loadedMatch.home_score ?? 0));
    setBackfillAwayScore(String(loadedMatch.away_score ?? 0));
    setQuickGoalRows(
      loadedBackfillEvents
        .filter((event) => event.event_type === 'goal')
        .map((event, index) => ({
          id: `${event.id || `goal-${index}`}`,
          side: event.team_side,
          playerId: event.player_id || '',
          scorer: event.player_name_override || '',
          assistPlayerId: event.secondary_player_id || '',
          assistName: event.secondary_player_name_override || '',
          minute:
            event.minute !== null && event.minute !== undefined ? String(event.minute) : '',
        })),
    );
    setHistoricalRows(
      loadedBackfillEvents.map((event, index) => ({
        id: `${event.id || index}`,
        eventType: event.event_type as HistoricalEventBackfillRow['eventType'],
        side: event.team_side,
        playerId: event.player_id || '',
        playerName: event.player_name_override || '',
        assistPlayerId: event.secondary_player_id || '',
        assistPlayerName: event.secondary_player_name_override || '',
        minute:
          event.minute !== null && event.minute !== undefined ? String(event.minute) : '',
      })),
    );

    setLoading(false);
  }, [matchId]);

  // ---------------------------------------------------
  // LOAD MATCH + SEASONS
  // ---------------------------------------------------

  useEffect(() => {
    if (!matchId) return;
    const timeoutId = window.setTimeout(() => {
      void loadPageData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadPageData, matchId]);

  // ---------------------------------------------------
  // REGENERATE PUBLIC SLUG
  // ---------------------------------------------------

  function handleRegenerateSlug() {
    if (!match) return;

    setPublicSlug(
      buildReadableMatchSlug({
        homeTeamName: match.home_team?.name,
        awayTeamName: match.away_team?.name,
        matchDate: matchDate ? new Date(matchDate).toISOString() : match.match_date,
      }),
    );
  }

  // ---------------------------------------------------
  // SAVE MATCH
  // ---------------------------------------------------

  async function handleSave() {
    if (!match) return;

    setSaving(true);
    setMessage('');

    const updates = {
      season_id: seasonId || null,
      match_date: matchDate ? new Date(matchDate).toISOString() : null,
      venue: venue.trim() || null,
      status,
      status_note: statusNote.trim() || null,
      public_slug: publicSlug.trim() || null,
    };

    const { error } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', match.id);

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    setSaving(false);
    router.push(`/live/${match.id}`);
  }

  function addHistoricalRow(eventType: HistoricalEventBackfillRow['eventType'], side: TeamSide) {
    setHistoricalRows((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        eventType,
        side,
        playerId: '',
        playerName: '',
        assistPlayerId: '',
        assistPlayerName: '',
        minute: '',
      },
    ]);
  }

  function updateHistoricalRow(id: string, updates: Partial<HistoricalEventBackfillRow>) {
    setHistoricalRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...updates } : row)),
    );
  }

  function removeHistoricalRow(id: string) {
    setHistoricalRows((current) => current.filter((row) => row.id !== id));
  }

  function addQuickGoalRow(side: TeamSide) {
    setQuickGoalRows((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        side,
        playerId: '',
        scorer: '',
        assistPlayerId: '',
        assistName: '',
        minute: '',
      },
    ]);
  }

  function updateQuickGoalRow(id: string, updates: Partial<QuickGoalBackfillRow>) {
    setQuickGoalRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...updates } : row)),
    );
  }

  function removeQuickGoalRow(id: string) {
    setQuickGoalRows((current) => current.filter((row) => row.id !== id));
  }

  async function handleApplyQuickBackfill() {
    if (!match) return;

    const homeScore = Number.parseInt(backfillHomeScore, 10);
    const awayScore = Number.parseInt(backfillAwayScore, 10);

    if (!Number.isInteger(homeScore) || homeScore < 0) {
      setMessage('Home score must be a non-negative whole number.');
      return;
    }

    if (!Number.isInteger(awayScore) || awayScore < 0) {
      setMessage('Away score must be a non-negative whole number.');
      return;
    }

    const homeGoalRows = quickGoalRows.filter((row) => row.side === 'home');
    const awayGoalRows = quickGoalRows.filter((row) => row.side === 'away');

    if (homeGoalRows.length !== homeScore || awayGoalRows.length !== awayScore) {
      setMessage('Goal rows must match the final score for each side.');
      return;
    }

    if (quickGoalRows.some((row) => !row.minute.trim())) {
      setMessage('Each goal row needs a minute.');
      return;
    }

    if (quickGoalRows.some((row) => Number.parseInt(row.minute, 10) < 0)) {
      setMessage('Goal minutes must be zero or higher.');
      return;
    }

    if (quickGoalRows.some((row) => !row.playerId && !row.scorer.trim())) {
      setMessage('Each goal row needs a scorer name or selected roster player.');
      return;
    }

    const confirmed = window.confirm(
      'Apply quick final backfill? This will replace existing goal events for this match, update the final score, and mark the match as final.',
    );

    if (!confirmed) return;

    setBackfilling(true);
    setMessage('');

    const goalInserts = quickGoalRows.map((row) => {
      const teamId = row.side === 'home' ? match.home_team_id : match.away_team_id;
      const selectedPlayer =
        teamId && row.playerId
          ? (playersByTeam[teamId] || []).find((player) => player.id === row.playerId) || null
          : null;
      const scorerName = selectedPlayer
        ? [selectedPlayer.first_name, selectedPlayer.last_name].filter(Boolean).join(' ').trim()
        : row.scorer.trim();
      const selectedAssistPlayer =
        teamId && row.assistPlayerId
          ? (playersByTeam[teamId] || []).find((player) => player.id === row.assistPlayerId) || null
          : null;
      const assistName = selectedAssistPlayer
        ? [selectedAssistPlayer.first_name, selectedAssistPlayer.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()
        : row.assistName.trim();

      return {
        match_id: match.id,
        minute: Number.parseInt(row.minute, 10) || 0,
        event_type: 'goal' as const,
        team_side: row.side,
        team_id: teamId,
        player_id: selectedPlayer?.id || null,
        secondary_player_id: selectedAssistPlayer?.id || null,
        player_name_override: scorerName,
        secondary_player_name_override: assistName || null,
        notes: 'Quick final backfill',
      };
    });

    const { error: deleteError } = await supabase
      .from('match_events')
      .delete()
      .eq('match_id', match.id)
      .eq('event_type', 'goal');

    if (deleteError) {
      setBackfilling(false);
      setMessage(deleteError.message || 'Failed to clear existing goal events.');
      return;
    }

    if (goalInserts.length > 0) {
      const { error: insertError } = await supabase.from('match_events').insert(goalInserts);

      if (insertError) {
        setBackfilling(false);
        setMessage(insertError.message || 'Failed to save backfilled goals.');
        return;
      }
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'final',
        clock_running: false,
        current_minute: 90,
      })
      .eq('id', match.id);

    if (updateError) {
      setBackfilling(false);
      setMessage(updateError.message || 'Failed to update final result.');
      return;
    }

    setStatus('final');
    await loadPageData();
    setBackfilling(false);
    setMessage('Quick final backfill applied.');
  }

  async function handleApplyFinalBackfill() {
    if (!match || !hasSuperAccess) return;

    const homeScore = Number.parseInt(backfillHomeScore, 10);
    const awayScore = Number.parseInt(backfillAwayScore, 10);

    if (!Number.isInteger(homeScore) || homeScore < 0) {
      setMessage('Home score must be a non-negative whole number.');
      return;
    }

    if (!Number.isInteger(awayScore) || awayScore < 0) {
      setMessage('Away score must be a non-negative whole number.');
      return;
    }

    const goalRows = historicalRows.filter((row) => row.eventType === 'goal');
    const homeGoalRows = goalRows.filter((row) => row.side === 'home');
    const awayGoalRows = goalRows.filter((row) => row.side === 'away');

    if (homeGoalRows.length !== homeScore || awayGoalRows.length !== awayScore) {
      setMessage('Goal rows must match the final score for each side.');
      return;
    }

    if (historicalRows.some((row) => !row.minute.trim())) {
      setMessage('Each historical event needs a minute.');
      return;
    }

    if (historicalRows.some((row) => Number.parseInt(row.minute, 10) < 0)) {
      setMessage('Event minutes must be zero or higher.');
      return;
    }

    if (historicalRows.some((row) => !row.playerId && !row.playerName.trim())) {
      setMessage('Each event needs a player name or selected roster player.');
      return;
    }

    const confirmed = window.confirm(
      'Apply historical final backfill? This will replace existing goal and card events for this match, update the final score, and mark the match as final.',
    );

    if (!confirmed) return;

    setBackfilling(true);
    setMessage('');

    const eventInserts = historicalRows.map((row) => {
      const teamId = row.side === 'home' ? match.home_team_id : match.away_team_id;
      const selectedPlayer =
        teamId && row.playerId
          ? (playersByTeam[teamId] || []).find((player) => player.id === row.playerId) || null
          : null;
      const playerName = selectedPlayer
        ? [selectedPlayer.first_name, selectedPlayer.last_name].filter(Boolean).join(' ').trim()
        : row.playerName.trim();
      const selectedAssistPlayer =
        row.eventType === 'goal' && teamId && row.assistPlayerId
          ? (playersByTeam[teamId] || []).find((player) => player.id === row.assistPlayerId) || null
          : null;
      const assistName = selectedAssistPlayer
        ? [selectedAssistPlayer.first_name, selectedAssistPlayer.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()
        : row.assistPlayerName.trim();

      return {
        match_id: match.id,
        minute: Number.parseInt(row.minute, 10) || 0,
        event_type: row.eventType,
        team_side: row.side,
        team_id: teamId,
        player_id: selectedPlayer?.id || null,
        secondary_player_id: row.eventType === 'goal' ? selectedAssistPlayer?.id || null : null,
        player_name_override: playerName,
        secondary_player_name_override:
          row.eventType === 'goal' ? assistName || null : null,
        notes: 'Historical final backfill',
      };
    });

    const { error: deleteError } = await supabase
      .from('match_events')
      .delete()
      .eq('match_id', match.id)
      .in('event_type', ['goal', 'yellow_card', 'red_card']);

    if (deleteError) {
      setBackfilling(false);
      setMessage(deleteError.message || 'Failed to clear existing historical events.');
      return;
    }

    if (eventInserts.length > 0) {
      const { error: insertError } = await supabase.from('match_events').insert(eventInserts);

      if (insertError) {
        setBackfilling(false);
        setMessage(insertError.message || 'Failed to save historical events.');
        return;
      }
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'final',
        clock_running: false,
        current_minute: 90,
      })
      .eq('id', match.id);

    if (updateError) {
      setBackfilling(false);
      setMessage(updateError.message || 'Failed to update final result.');
      return;
    }

    setStatus('final');
    await loadPageData();
    setBackfilling(false);
    setMessage('Historical final backfill applied.');
  }

  // ---------------------------------------------------
  // LOADING / EMPTY STATES
  // ---------------------------------------------------

  if (loading) {
    return <main className="mx-auto max-w-5xl px-6 py-8">Loading match editor...</main>;
  }

  if (!authChecked || superAdminLoading) {
    return <main className="mx-auto max-w-5xl px-6 py-8">Loading match editor...</main>;
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8 text-red-600">
        {message || 'Match not found.'}
      </main>
    );
  }

  const homeRosterPlayers = match.home_team_id ? playersByTeam[match.home_team_id] || [] : [];
  const awayRosterPlayers = match.away_team_id ? playersByTeam[match.away_team_id] || [] : [];

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Match Admin
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Edit Match
          </h1>
          <p className="mt-2 text-slate-600">
            Update scheduling details, venue, status, and public match settings.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/live/${match.id}`}
            className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Manage Match
          </Link>

          {match.public_slug ? (
            <Link
              href={`/public/${match.public_slug}`}
              target="_blank"
              className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
            >
              Open Public Scoreboard
            </Link>
          ) : null}
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* MATCH SUMMARY */}
      {/* --------------------------------------------------- */}

      <section className="mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-sm ring-1 ring-slate-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Match
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">
          {match.home_team?.name || 'Home Team'} vs {match.away_team?.name || 'Away Team'}
        </h2>
        <p className="mt-2 text-slate-300">
          Current status: <span className="font-semibold text-white">{match.status}</span>
        </p>
      </section>

      {/* --------------------------------------------------- */}
      {/* EDIT FORM */}
      {/* --------------------------------------------------- */}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-5 md:grid-cols-2">
          {/* ------------------------------------------------- */}
          {/* SEASON */}
          {/* ------------------------------------------------- */}

          <Field label="Season">
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">No season</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </Field>

          {/* ------------------------------------------------- */}
          {/* STATUS */}
          {/* ------------------------------------------------- */}

          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Match['status'])}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="halftime">Halftime</option>
              <option value="final">Final</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>

          {/* ------------------------------------------------- */}
          {/* DATE / TIME */}
          {/* ------------------------------------------------- */}

          <Field label="Match Date & Time">
            <input
              type="datetime-local"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          {/* ------------------------------------------------- */}
          {/* VENUE */}
          {/* ------------------------------------------------- */}

          <Field label="Venue">
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="James Park"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          {/* ------------------------------------------------- */}
          {/* PUBLIC SLUG */}
          {/* ------------------------------------------------- */}

          <div className="md:col-span-2">
            <Field label="Public Slug">
              <div className="flex items-stretch gap-3">
                <input
                  value={publicSlug}
                  onChange={(e) => setPublicSlug(e.target.value)}
                  placeholder="evanston-vs-new-trier-2026-04-12"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />

                <button
                  type="button"
                  onClick={handleRegenerateSlug}
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                >
                  Regenerate
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Changing this updates the public scoreboard URL and old shared links will stop
                working.
              </p>
            </Field>
          </div>

          {/* ------------------------------------------------- */}
          {/* STATUS NOTE */}
          {/* ------------------------------------------------- */}

          <div className="md:col-span-2">
            <Field label="Status Note">
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Optional note about weather, field change, delay, etc."
                className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>
          </div>
        </div>

        {/* --------------------------------------------------- */}
        {/* FEEDBACK */}
        {/* --------------------------------------------------- */}

        {message ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        {/* --------------------------------------------------- */}
        {/* ACTIONS */}
        {/* --------------------------------------------------- */}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Link
            href={`/live/${match.id}`}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Match Changes'}
          </button>
        </div>
      </section>

      {/* --------------------------------------------------- */}
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Quick Final Backfill
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            Enter final score, goals, and assists fast
          </h2>
          <p className="mt-2 text-slate-600">
            Best for matches where live entry was missed. This replaces existing goal events only,
            keeps any card history untouched, and marks the match final.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label={`${match.home_team?.name || 'Home Team'} Goals`}>
            <input
              type="number"
              min="0"
              value={backfillHomeScore}
              onChange={(e) => setBackfillHomeScore(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label={`${match.away_team?.name || 'Away Team'} Goals`}>
            <input
              type="number"
              min="0"
              value={backfillAwayScore}
              onChange={(e) => setBackfillAwayScore(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => addQuickGoalRow('home')}
            className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 ring-1 ring-blue-200"
          >
            Add Home Goal
          </button>

          <button
            type="button"
            onClick={() => addQuickGoalRow('away')}
            className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
          >
            Add Away Goal
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {quickGoalRows.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
              No goal rows yet. Add one row for each goal in the final score.
            </div>
          ) : (
            quickGoalRows.map((row, index) => {
              const sidePlayers = row.side === 'home' ? homeRosterPlayers : awayRosterPlayers;

              return (
                <div key={row.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">Goal {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeQuickGoalRow(row.id)}
                      className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Side">
                      <select
                        value={row.side}
                        onChange={(e) =>
                          updateQuickGoalRow(row.id, {
                            side: e.target.value as TeamSide,
                            playerId: '',
                            assistPlayerId: '',
                          })
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <option value="home">Home</option>
                        <option value="away">Away</option>
                      </select>
                    </Field>

                    <Field label="Minute">
                      <input
                        type="number"
                        min="0"
                        value={row.minute}
                        onChange={(e) => updateQuickGoalRow(row.id, { minute: e.target.value })}
                        placeholder="67"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </Field>

                    <Field label="Roster Scorer (Optional)">
                      <select
                        value={row.playerId}
                        onChange={(e) => {
                          const nextPlayerId = e.target.value;
                          const selectedPlayer =
                            sidePlayers.find((player) => player.id === nextPlayerId) || null;

                          updateQuickGoalRow(row.id, {
                            playerId: nextPlayerId,
                            scorer: selectedPlayer
                              ? [selectedPlayer.first_name, selectedPlayer.last_name]
                                  .filter(Boolean)
                                  .join(' ')
                                  .trim()
                              : row.scorer,
                          });
                        }}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <option value="">
                          {sidePlayers.length > 0 ? 'Choose roster player' : 'No roster available'}
                        </option>
                        {sidePlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Scorer">
                      <input
                        value={row.scorer}
                        onChange={(e) =>
                          updateQuickGoalRow(row.id, { scorer: e.target.value, playerId: '' })
                        }
                        placeholder="Player name or scorer label"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </Field>

                    <Field label="Roster Assist (Optional)">
                      <select
                        value={row.assistPlayerId}
                        onChange={(e) => {
                          const nextAssistPlayerId = e.target.value;
                          const selectedAssistPlayer =
                            sidePlayers.find((player) => player.id === nextAssistPlayerId) || null;

                          updateQuickGoalRow(row.id, {
                            assistPlayerId: nextAssistPlayerId,
                            assistName: selectedAssistPlayer
                              ? [selectedAssistPlayer.first_name, selectedAssistPlayer.last_name]
                                  .filter(Boolean)
                                  .join(' ')
                                  .trim()
                              : row.assistName,
                          });
                        }}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <option value="">
                          {sidePlayers.length > 0
                            ? 'Choose assisting player'
                            : 'No roster available'}
                        </option>
                        {sidePlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {getPlayerDisplayName(player)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Assist Name (Optional)">
                      <input
                        value={row.assistName}
                        onChange={(e) =>
                          updateQuickGoalRow(row.id, {
                            assistName: e.target.value,
                            assistPlayerId: '',
                          })
                        }
                        placeholder="Assisting player"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      />
                    </Field>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleApplyQuickBackfill}
            disabled={backfilling}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {backfilling ? 'Applying Backfill...' : 'Apply Quick Backfill'}
          </button>
        </div>
      </section>

      {hasSuperAccess ? (
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Super Admin Historical Backfill
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Finalize a missed match with scoring timeline and cards
            </h2>
            <p className="mt-2 text-slate-600">
              Use this when live tracking was missed. It assumes a 90-minute final, replaces
              existing goal and card events, and lets you record when goals were scored plus any
              optional assists, yellow cards, and red cards.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label={`${match.home_team?.name || 'Home Team'} Goals`}>
              <input
                type="number"
                min="0"
                value={backfillHomeScore}
                onChange={(e) => setBackfillHomeScore(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label={`${match.away_team?.name || 'Away Team'} Goals`}>
              <input
                type="number"
                min="0"
                value={backfillAwayScore}
                onChange={(e) => setBackfillAwayScore(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => addHistoricalRow('goal', 'home')}
              className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 ring-1 ring-blue-200"
            >
              Add Home Goal
            </button>

            <button
              type="button"
              onClick={() => addHistoricalRow('goal', 'away')}
              className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200"
            >
              Add Away Goal
            </button>

            <button
              type="button"
              onClick={() => addHistoricalRow('yellow_card', 'home')}
              className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 ring-1 ring-amber-200"
            >
              Add Home Yellow Card
            </button>

            <button
              type="button"
              onClick={() => addHistoricalRow('yellow_card', 'away')}
              className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 ring-1 ring-amber-200"
            >
              Add Away Yellow Card
            </button>

            <button
              type="button"
              onClick={() => addHistoricalRow('red_card', 'home')}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200"
            >
              Add Home Red Card
            </button>

            <button
              type="button"
              onClick={() => addHistoricalRow('red_card', 'away')}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200"
            >
              Add Away Red Card
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {historicalRows.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
                No historical events yet. Add one row for each goal and any cards you want to
                backfill.
              </div>
            ) : (
              historicalRows.map((row, index) => {
                const sidePlayers = row.side === 'home' ? homeRosterPlayers : awayRosterPlayers;
                const eventLabel =
                  row.eventType === 'goal'
                    ? 'Goal'
                    : row.eventType === 'yellow_card'
                      ? 'Yellow Card'
                      : 'Red Card';

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">
                        {eventLabel} {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeHistoricalRow(row.id)}
                        className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Event Type">
                        <select
                          value={row.eventType}
                          onChange={(e) =>
                            updateHistoricalRow(row.id, {
                              eventType: e.target.value as HistoricalEventBackfillRow['eventType'],
                              assistPlayerId: '',
                              assistPlayerName: '',
                            })
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <option value="goal">Goal</option>
                          <option value="yellow_card">Yellow Card</option>
                          <option value="red_card">Red Card</option>
                        </select>
                      </Field>

                      <Field label="Side">
                        <select
                          value={row.side}
                          onChange={(e) =>
                            updateHistoricalRow(row.id, {
                              side: e.target.value as TeamSide,
                              playerId: '',
                              assistPlayerId: '',
                            })
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <option value="home">Home</option>
                          <option value="away">Away</option>
                        </select>
                      </Field>

                      <Field label="Minute">
                        <input
                          type="number"
                          min="0"
                          value={row.minute}
                          onChange={(e) => updateHistoricalRow(row.id, { minute: e.target.value })}
                          placeholder="67"
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        />
                      </Field>

                      <Field label="Roster Player (Optional)">
                        <select
                          value={row.playerId}
                          onChange={(e) => {
                            const nextPlayerId = e.target.value;
                            const selectedPlayer =
                              sidePlayers.find((player) => player.id === nextPlayerId) || null;

                            updateHistoricalRow(row.id, {
                              playerId: nextPlayerId,
                              playerName: selectedPlayer
                                ? [selectedPlayer.first_name, selectedPlayer.last_name]
                                    .filter(Boolean)
                                    .join(' ')
                                    .trim()
                                : row.playerName,
                            });
                          }}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                        >
                          <option value="">
                            {sidePlayers.length > 0 ? 'Choose roster player' : 'No roster available'}
                          </option>
                          {sidePlayers.map((player) => (
                            <option key={player.id} value={player.id}>
                              {getPlayerDisplayName(player)}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <div className={row.eventType === 'goal' ? 'xl:col-span-2' : 'xl:col-span-3'}>
                        <Field label={row.eventType === 'goal' ? 'Scorer / Carded Player' : 'Player'}>
                          <input
                            value={row.playerName}
                            onChange={(e) =>
                              updateHistoricalRow(row.id, {
                                playerName: e.target.value,
                                playerId: '',
                              })
                            }
                            placeholder="Player name"
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                          />
                        </Field>
                      </div>

                      {row.eventType === 'goal' ? (
                        <>
                          <Field label="Roster Assist (Optional)">
                            <select
                              value={row.assistPlayerId}
                              onChange={(e) => {
                                const nextAssistPlayerId = e.target.value;
                                const selectedAssistPlayer =
                                  sidePlayers.find((player) => player.id === nextAssistPlayerId) ||
                                  null;

                                updateHistoricalRow(row.id, {
                                  assistPlayerId: nextAssistPlayerId,
                                  assistPlayerName: selectedAssistPlayer
                                    ? [selectedAssistPlayer.first_name, selectedAssistPlayer.last_name]
                                        .filter(Boolean)
                                        .join(' ')
                                        .trim()
                                    : row.assistPlayerName,
                                });
                              }}
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                            >
                              <option value="">
                                {sidePlayers.length > 0
                                  ? 'Choose assisting player'
                                  : 'No roster available'}
                              </option>
                              {sidePlayers.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {getPlayerDisplayName(player)}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Assist Name (Optional)">
                            <input
                              value={row.assistPlayerName}
                              onChange={(e) =>
                                updateHistoricalRow(row.id, {
                                  assistPlayerName: e.target.value,
                                  assistPlayerId: '',
                                })
                              }
                              placeholder="Assisting player"
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                            />
                          </Field>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={handleApplyFinalBackfill}
              disabled={backfilling}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {backfilling ? 'Applying Backfill...' : 'Apply Historical Backfill'}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

// ---------------------------------------------------
// FIELD WRAPPER
// ---------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
