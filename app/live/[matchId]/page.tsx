'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeftRight,
  Check,
  CircleDot,
  Pause,
  Play,
  RotateCcw,
  Square,
  Users,
} from 'lucide-react';
import MatchActionsCard from '@/components/MatchActionsCard';
import MatchHeader from '@/components/match/MatchHeader';
import {
  createMatchLineupSnapshot,
  saveStartingLineup,
  validateStartingLineupCount,
} from '@/lib/matchLineups';
import { supabase } from '@/lib/supabase';
import type {
  EventType,
  Match,
  MatchEvent,
  MatchLineup,
  Player,
  Team,
  TeamSide,
  TrackingMode,
} from '@/lib/types';

// ---------------------------------------------------
// LOCAL TYPES
// ---------------------------------------------------

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

// ---------------------------------------------------
// EVENT OPTIONS
// ---------------------------------------------------

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
  match_resumed: 'Match Resumed',
  match_paused: 'Match Paused',
  half_end: 'Halftime',
  full_time: 'Full Time',
};

// ---------------------------------------------------
// PAGE
// ---------------------------------------------------

export default function LiveMatchPage() {
  // ---------------------------------------------------
  // ROUTE PARAMS
  // ---------------------------------------------------

  const params = useParams();
  const matchId =
    typeof params?.matchId === 'string'
      ? params.matchId
      : Array.isArray(params?.matchId)
        ? params.matchId[0]
        : '';

  // ---------------------------------------------------
  // PAGE STATE
  // ---------------------------------------------------

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeLineups, setHomeLineups] = useState<MatchLineup[]>([]);
  const [awayLineups, setAwayLineups] = useState<MatchLineup[]>([]);
  const [selectedHomeStarterIds, setSelectedHomeStarterIds] = useState<string[]>([]);
  const [selectedAwayStarterIds, setSelectedAwayStarterIds] = useState<string[]>([]);
  const [loadingLineups, setLoadingLineups] = useState(false);
  const [savingHomeLineup, setSavingHomeLineup] = useState(false);
  const [savingAwayLineup, setSavingAwayLineup] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineupNotice, setLineupNotice] = useState<string | null>(null);

  // ---------------------------------------------------
  // EVENT FORM STATE
  // ---------------------------------------------------

  const [form, setForm] = useState<EventFormState>({
    type: 'goal',
    side: 'home',
    playerId: '',
    secondaryPlayerId: '',
    playerNameOverride: '',
    secondaryPlayerNameOverride: '',
    notes: '',
  });

  // ---------------------------------------------------
  // INITIAL DATA LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!matchId) return;

    async function loadMatch() {
      // ---------------------------------------------------
      // RESET PAGE-LEVEL STATE
      // ---------------------------------------------------

      setLoading(true);
      setError(null);
      setLineupNotice(null);
      setLoadingLineups(false);

      // ---------------------------------------------------
      // LOAD MATCH + EVENTS
      // ---------------------------------------------------

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

const loadedHomePlayers = (homePlayersResult.data as Player[]) ?? [];
const loadedAwayPlayers = (awayPlayersResult.data as Player[]) ?? [];

setHomePlayers(loadedHomePlayers);
setAwayPlayers(loadedAwayPlayers);

const { data: lineupData, error: lineupError } = await supabase
  .from('match_lineups')
  .select('*')
  .eq('match_id', loadedMatch.id);

if (lineupError) {
  setError(lineupError.message);
  setLoading(false);
  return;
}

const allLineups = (lineupData as MatchLineup[]) ?? [];

const realHomeLineups = allLineups.filter(
  (lineup) => lineup.team_id === loadedMatch.home_team_id,
);

const realAwayLineups = allLineups.filter(
  (lineup) => lineup.team_id === loadedMatch.away_team_id,
);

const resolvedHomeLineups =
  realHomeLineups.length > 0
    ? realHomeLineups
    : buildFallbackLineupRows(
        loadedMatch.id,
        loadedMatch.home_team_id,
        'home',
        loadedHomePlayers,
      );

const resolvedAwayLineups =
  realAwayLineups.length > 0
    ? realAwayLineups
    : buildFallbackLineupRows(
        loadedMatch.id,
        loadedMatch.away_team_id,
        'away',
        loadedAwayPlayers,
      );

setHomeLineups(resolvedHomeLineups);
setAwayLineups(resolvedAwayLineups);
setSelectedHomeStarterIds(
  resolvedHomeLineups.filter((row) => row.is_starter).map((row) => row.player_id),
);
setSelectedAwayStarterIds(
  resolvedAwayLineups.filter((row) => row.is_starter).map((row) => row.player_id),
);

      // ---------------------------------------------------
      // LOAD HOME / AWAY PLAYERS
      // ---------------------------------------------------

      const homePlayersResult = loadedMatch.home_team_id
        ? await supabase
            .from('players')
            .select('*')
            .eq('team_id', loadedMatch.home_team_id)
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

      const resolvedHomePlayers = (homePlayersResult.data as Player[]) ?? [];
      const resolvedAwayPlayers = (awayPlayersResult.data as Player[]) ?? [];

      setHomePlayers(resolvedHomePlayers);
      setAwayPlayers(resolvedAwayPlayers);

      // ---------------------------------------------------
      // LOAD OR CREATE MATCH LINEUP SNAPSHOTS
      // ---------------------------------------------------

      setLoadingLineups(true);

      try {
        // ---------------------------------------------------
        // HOME LINEUP SNAPSHOT
        // ---------------------------------------------------

        if (
          loadedMatch.home_team_id &&
          (loadedMatch.home_tracking_mode === 'lineups' ||
            loadedMatch.home_tracking_mode === 'full')
        ) {
          const homeSnapshot = await createMatchLineupSnapshot(
            loadedMatch.id,
            loadedMatch.home_team_id,
          );

          setHomeLineups(homeSnapshot);
          setSelectedHomeStarterIds(
            homeSnapshot.filter((row) => row.is_starter).map((row) => row.player_id),
          );
        } else {
          setHomeLineups([]);
          setSelectedHomeStarterIds([]);
        }

        // ---------------------------------------------------
        // AWAY LINEUP SNAPSHOT
        // ---------------------------------------------------

        if (
          loadedMatch.away_team_id &&
          (loadedMatch.away_tracking_mode === 'lineups' ||
            loadedMatch.away_tracking_mode === 'full')
        ) {
          const awaySnapshot = await createMatchLineupSnapshot(
            loadedMatch.id,
            loadedMatch.away_team_id,
          );

          setAwayLineups(awaySnapshot);
          setSelectedAwayStarterIds(
            awaySnapshot.filter((row) => row.is_starter).map((row) => row.player_id),
          );
        } else {
          setAwayLineups([]);
          setSelectedAwayStarterIds([]);
        }
      } catch (lineupError) {
        // ---------------------------------------------------
        // NON-BLOCKING LINEUP FAILURE
        // ---------------------------------------------------

        console.error('Failed to load match lineups:', lineupError);

        setHomeLineups([]);
        setAwayLineups([]);
        setSelectedHomeStarterIds([]);
        setSelectedAwayStarterIds([]);

        // ---------------------------------------------------
        // FALL BACK TO PLAYER ROSTERS INSTEAD OF SHOWING A RED PAGE ERROR
        // ---------------------------------------------------

        const homeNeedsLineups =
          loadedMatch.home_tracking_mode === 'lineups' ||
          loadedMatch.home_tracking_mode === 'full';

        const awayNeedsLineups =
          loadedMatch.away_tracking_mode === 'lineups' ||
          loadedMatch.away_tracking_mode === 'full';

        if (homeNeedsLineups && resolvedHomePlayers.length > 0) {
          setHomeLineups(buildFallbackLineupRows(loadedMatch.id, loadedMatch.home_team_id, resolvedHomePlayers));
        }

        if (awayNeedsLineups && resolvedAwayPlayers.length > 0) {
          setAwayLineups(buildFallbackLineupRows(loadedMatch.id, loadedMatch.away_team_id, resolvedAwayPlayers));
        }

        setLineupNotice('Lineup snapshot could not be loaded, but players are still available.');
      } finally {
        setLoadingLineups(false);
      }

      setLoading(false);
    }

    loadMatch();
  }, [matchId]);

  // ---------------------------------------------------
  // LIVE CLOCK TICKER
  // ---------------------------------------------------

  useEffect(() => {
    if (!match?.clock_running) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [match?.clock_running]);

  // ---------------------------------------------------
  // DERIVED MATCH CLOCK
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // DERIVED MATCH / TEAM MODES
  // ---------------------------------------------------

  const selectedTrackingMode = useMemo<TrackingMode>(() => {
    if (!match) return 'basic';
    return form.side === 'home' ? match.home_tracking_mode : match.away_tracking_mode;
  }, [form.side, match]);

  const selectedTeamName = useMemo(() => {
    if (!match) return 'Team';
    return form.side === 'home'
      ? match.home_team?.name || 'Home Team'
      : match.away_team?.name || 'Away Team';
  }, [form.side, match]);

  const homeSupportsLineups =
    match?.home_tracking_mode === 'lineups' || match?.home_tracking_mode === 'full';

  const awaySupportsLineups =
    match?.away_tracking_mode === 'lineups' || match?.away_tracking_mode === 'full';

  const editingDisabled =
    !!match &&
    (match.is_locked === true ||
      match.status === 'cancelled' ||
      match.status === 'postponed');

  const homeStarterCount = selectedHomeStarterIds.length;
  const awayStarterCount = selectedAwayStarterIds.length;

  // ---------------------------------------------------
  // DERIVED ON-FIELD / BENCH STATES
  // ---------------------------------------------------

  const homeActivePlayerIds = useMemo(() => {
    if (match?.home_tracking_mode !== 'full') {
      return new Set(homePlayers.map((player) => player.id));
    }

    const activeIds = new Set(selectedHomeStarterIds);

    events
      .filter((event) => event.team_side === 'home' && event.event_type === 'substitution')
      .slice()
      .reverse()
      .forEach((event) => {
        const playerOutId = event.player_id || null;
        const playerInId = event.secondary_player_id || null;

        if (playerOutId) {
          activeIds.delete(playerOutId);
        }

        if (playerInId) {
          activeIds.add(playerInId);
        }
      });

    return activeIds;
  }, [events, homePlayers, match?.home_tracking_mode, selectedHomeStarterIds]);

  const awayActivePlayerIds = useMemo(() => {
    if (match?.away_tracking_mode !== 'full') {
      return new Set(awayPlayers.map((player) => player.id));
    }

    const activeIds = new Set(selectedAwayStarterIds);

    events
      .filter((event) => event.team_side === 'away' && event.event_type === 'substitution')
      .slice()
      .reverse()
      .forEach((event) => {
        const playerOutId = event.player_id || null;
        const playerInId = event.secondary_player_id || null;

        if (playerOutId) {
          activeIds.delete(playerOutId);
        }

        if (playerInId) {
          activeIds.add(playerInId);
        }
      });

    return activeIds;
  }, [events, awayPlayers, match?.away_tracking_mode, selectedAwayStarterIds]);

  // ---------------------------------------------------
  // LINEUP ROW / PLAYER MAPPINGS
  // ---------------------------------------------------

  const homeLineupRows = useMemo(() => {
    return homeLineups.map((row) => {
      const player = homePlayers.find((item) => item.id === row.player_id);
      return { row, player };
    });
  }, [homeLineups, homePlayers]);

  const awayLineupRows = useMemo(() => {
    return awayLineups.map((row) => {
      const player = awayPlayers.find((item) => item.id === row.player_id);
      return { row, player };
    });
  }, [awayLineups, awayPlayers]);

  // ---------------------------------------------------
  // PLAYER SELECTION POOLS
  // ---------------------------------------------------

  const selectedRosterPlayers = useMemo(() => {
    return form.side === 'home' ? homePlayers : awayPlayers;
  }, [form.side, homePlayers, awayPlayers]);

  const selectedOnFieldPlayers = useMemo(() => {
    if (form.side === 'home') {
      return homePlayers.filter((player) => homeActivePlayerIds.has(player.id));
    }

    return awayPlayers.filter((player) => awayActivePlayerIds.has(player.id));
  }, [form.side, homeActivePlayerIds, awayActivePlayerIds, homePlayers, awayPlayers]);

  const selectedBenchPlayers = useMemo(() => {
    if (form.side === 'home') {
      return homePlayers.filter((player) => !homeActivePlayerIds.has(player.id));
    }

    return awayPlayers.filter((player) => !awayActivePlayerIds.has(player.id));
  }, [form.side, homeActivePlayerIds, awayActivePlayerIds, homePlayers, awayPlayers]);

  const eventSelectablePlayers = useMemo(() => {
    if (selectedTrackingMode === 'full') {
      return selectedOnFieldPlayers;
    }

    return selectedRosterPlayers;
  }, [selectedOnFieldPlayers, selectedRosterPlayers, selectedTrackingMode]);

  const eventSelectableSecondaryPlayers = useMemo(() => {
    if (selectedTrackingMode === 'full' && form.type === 'substitution') {
      return selectedBenchPlayers;
    }

    if (selectedTrackingMode === 'full') {
      return selectedOnFieldPlayers.filter((player) => player.id !== form.playerId);
    }

    return selectedRosterPlayers.filter((player) => player.id !== form.playerId);
  }, [
    form.playerId,
    form.type,
    selectedBenchPlayers,
    selectedOnFieldPlayers,
    selectedRosterPlayers,
    selectedTrackingMode,
  ]);

  // ---------------------------------------------------
  // FORM HELPERS
  // ---------------------------------------------------

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

  function validateEvent() {
    if (!match) return 'Match not loaded.';
    if (editingDisabled) return 'This match is not editable in its current state.';
    if (form.type === 'half_end' || form.type === 'full_time') return null;

    if (selectedTrackingMode === 'lineups' && form.type === 'substitution') {
      return 'Lineups mode does not support substitutions yet.';
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
        return 'Choose the incoming player for substitution.';
      }

      if (
        form.type === 'substitution' &&
        form.playerId &&
        form.secondaryPlayerId &&
        form.playerId === form.secondaryPlayerId
      ) {
        return 'Outgoing and incoming players must be different.';
      }

      if (form.type === 'substitution') {
        const outgoingOnField = selectedOnFieldPlayers.some(
          (player) => player.id === form.playerId,
        );

        const incomingOnBench = selectedBenchPlayers.some(
          (player) => player.id === form.secondaryPlayerId,
        );

        if (!outgoingOnField) {
          return 'Outgoing player must currently be on the field.';
        }

        if (!incomingOnBench) {
          return 'Incoming player must currently be off the field.';
        }
      }
    }

    if (selectedTrackingMode === 'basic' || selectedTrackingMode === 'lineups') {
      if (
        (form.type === 'goal' ||
          form.type === 'yellow_card' ||
          form.type === 'red_card') &&
        !form.playerId &&
        !form.playerNameOverride.trim()
      ) {
        return 'Choose a player or type a quick player label.';
      }

      if (form.type === 'substitution' && !form.playerNameOverride.trim() && !form.playerId) {
        return 'Add a quick player or note for this substitution.';
      }
    }

    return null;
  }

  // ---------------------------------------------------
  // STARTER TOGGLE HELPERS
  // ---------------------------------------------------

  function toggleHomeStarter(playerId: string) {
    setSelectedHomeStarterIds((current) => {
      const alreadySelected = current.includes(playerId);

      if (alreadySelected) {
        return current.filter((id) => id !== playerId);
      }

      if (current.length >= 11) {
        return current;
      }

      return [...current, playerId];
    });
  }

  function toggleAwayStarter(playerId: string) {
    setSelectedAwayStarterIds((current) => {
      const alreadySelected = current.includes(playerId);

      if (alreadySelected) {
        return current.filter((id) => id !== playerId);
      }

      if (current.length >= 11) {
        return current;
      }

      return [...current, playerId];
    });
  }

  // ---------------------------------------------------
  // SAVE STARTING LINEUPS
  // ---------------------------------------------------

  async function handleSaveHomeLineup() {
    if (!match?.home_team_id) return;

    if (!validateStartingLineupCount(selectedHomeStarterIds)) {
      setError('Home lineup must contain exactly 11 starters.');
      return;
    }

    setSavingHomeLineup(true);
    setError(null);

    try {
      await saveStartingLineup(match.id, match.home_team_id, selectedHomeStarterIds);

      const refreshed = await createMatchLineupSnapshot(match.id, match.home_team_id);
      setHomeLineups(refreshed);
      setSelectedHomeStarterIds(
        refreshed.filter((row) => row.is_starter).map((row) => row.player_id),
      );
      setLineupNotice(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save home lineup.');
    } finally {
      setSavingHomeLineup(false);
    }
  }

  async function handleSaveAwayLineup() {
    if (!match?.away_team_id) return;

    if (!validateStartingLineupCount(selectedAwayStarterIds)) {
      setError('Away lineup must contain exactly 11 starters.');
      return;
    }

    setSavingAwayLineup(true);
    setError(null);

    try {
      await saveStartingLineup(match.id, match.away_team_id, selectedAwayStarterIds);

      const refreshed = await createMatchLineupSnapshot(match.id, match.away_team_id);
      setAwayLineups(refreshed);
      setSelectedAwayStarterIds(
        refreshed.filter((row) => row.is_starter).map((row) => row.player_id),
      );
      setLineupNotice(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save away lineup.');
    } finally {
      setSavingAwayLineup(false);
    }
  }

  // ---------------------------------------------------
  // ADD EVENT
  // ---------------------------------------------------

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
    let nextElapsedSeconds = match.elapsed_seconds;

    if (form.type === 'goal') {
      if (form.side === 'home') nextHomeScore += 1;
      if (form.side === 'away') nextAwayScore += 1;
    }

    if (form.type === 'half_end') {
      nextStatus = 'halftime';
      nextClockRunning = false;
      nextPeriodStartedAt = null;
      nextElapsedSeconds = secondsElapsed;
    }

    if (form.type === 'full_time') {
      nextStatus = 'final';
      nextClockRunning = false;
      nextPeriodStartedAt = null;
      nextElapsedSeconds = secondsElapsed;
    }

    const updatePayload: Record<string, unknown> = {
      home_score: nextHomeScore,
      away_score: nextAwayScore,
      status: nextStatus,
      current_minute: minute,
    };

    if (!nextClockRunning) {
      updatePayload.elapsed_seconds = nextElapsedSeconds;
      updatePayload.clock_running = false;
      updatePayload.period_started_at = null;
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update(updatePayload)
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
            elapsed_seconds: !nextClockRunning ? nextElapsedSeconds : prev.elapsed_seconds,
            clock_running: nextClockRunning,
            period_started_at: nextPeriodStartedAt,
          }
        : prev,
    );

    setSaving(false);
    resetForm(form.side);
  }

  // ---------------------------------------------------
  // START / RESUME PERIOD
  // ---------------------------------------------------

  async function startLivePeriod() {
    if (!match || editingDisabled) return;

    setError(null);

    const startedAt = new Date().toISOString();
    const minute = Math.floor(secondsElapsed / 60);
    const previousStatus = match.status;
    const wasPausedLive = previousStatus === 'live' && !match.clock_running;

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

    const eventType: EventType = wasPausedLive ? 'match_resumed' : 'half_start';

    const { error: eventInsertError } = await supabase.from('match_events').insert({
      match_id: match.id,
      minute,
      event_type: eventType,
      team_side: 'home',
      team_id: match.home_team_id,
    });

    if (eventInsertError) {
      setError(eventInsertError.message);
      return;
    }

    const { data: refreshedEvents, error: refreshError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', match.id)
      .order('created_at', { ascending: false });

    if (refreshError) {
      setError(refreshError.message);
      return;
    }

    setEvents((refreshedEvents as MatchEvent[]) ?? []);
  }

  // ---------------------------------------------------
  // PAUSE CLOCK
  // ---------------------------------------------------

  async function pauseClock() {
    if (!match || !match.clock_running || editingDisabled) return;

    setError(null);

    const pausedElapsed = secondsElapsed;
    const minute = Math.floor(pausedElapsed / 60);

    const { error: matchUpdateError } = await supabase
      .from('matches')
      .update({
        clock_running: false,
        period_started_at: null,
        elapsed_seconds: pausedElapsed,
        current_minute: minute,
      })
      .eq('id', match.id);

    if (matchUpdateError) {
      setError(matchUpdateError.message);
      return;
    }

    setMatch({
      ...match,
      clock_running: false,
      period_started_at: null,
      elapsed_seconds: pausedElapsed,
      current_minute: minute,
    });

    const { error: eventInsertError } = await supabase.from('match_events').insert({
      match_id: match.id,
      minute,
      event_type: 'match_paused',
      team_side: 'home',
      team_id: match.home_team_id,
    });

    if (eventInsertError) {
      setError(`Clock paused, but timeline event failed: ${eventInsertError.message}`);
      return;
    }

    const { data: refreshedEvents, error: refreshError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', match.id)
      .order('created_at', { ascending: false });

    if (refreshError) {
      setError(`Clock paused, but event refresh failed: ${refreshError.message}`);
      return;
    }

    setEvents((refreshedEvents as MatchEvent[]) ?? []);
  }

  // ---------------------------------------------------
  // UNDO LAST EVENT
  // ---------------------------------------------------

  async function undoLastEvent() {
    if (!match || events.length === 0 || editingDisabled) return;

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

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-32">Loading match...</main>;
  }

  if (error && !match) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-32 text-red-600">{error}</main>;
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-7xl px-6 pt-0 pb-32 text-red-600">
        Match not found.
      </main>
    );
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-7xl px-6 pt-0 pb-32">
      <MatchHeader
        match={match}
        formattedClock={formattedClock}
        mode="admin"
        theme="team"
        actions={
          <>
            {(match.status === 'not_started' || match.status === 'halftime') && (
              <button
                onClick={startLivePeriod}
                disabled={editingDisabled}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {match.status === 'halftime' ? 'Start 2nd Half' : 'Start Match'}
              </button>
            )}

            {match.status === 'live' && match.clock_running && (
              <button
                onClick={pauseClock}
                disabled={editingDisabled}
                className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Pause
              </button>
            )}

            {match.status === 'live' && !match.clock_running && (
              <button
                onClick={startLivePeriod}
                disabled={editingDisabled}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Resume
              </button>
            )}

            <button
              onClick={undoLastEvent}
              disabled={undoing || events.length === 0 || editingDisabled}
              className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 disabled:opacity-40"
            >
              {undoing ? 'Undoing…' : 'Undo'}
            </button>

            {match.public_slug && (
              <Link
                href={`/public/${match.public_slug}`}
                target="_blank"
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-white/20"
                style={{ color: '#0f172a' }}
              >
                Public Scoreboard
              </Link>
            )}
          </>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Roster-Aware Event Entry</h2>
                <p className="text-sm text-slate-600">
                  The form adapts to each side’s tracking mode.
                </p>
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
                    disabled={editingDisabled}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-40 ${
                      form.side === 'home' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800'
                    }`}
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => resetForm('away')}
                    disabled={editingDisabled}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-40 ${
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
                    'Full tracking — player-based events, substitutions, and detailed logging'}
                  {selectedTrackingMode === 'lineups' &&
                    'Lineups mode — starting lineup support with simpler event entry'}
                  {selectedTrackingMode === 'basic' &&
                    'Basic tracking — optional roster player selection with no required lineups'}
                </div>
              </Field>

              <Field label="Event Type">
                <div className="grid grid-cols-2 gap-3">
                  {eventTypeOptions
                    .filter(
                      (option) =>
                        !(selectedTrackingMode === 'lineups' && option.value === 'substitution'),
                    )
                    .map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            type: option.value,
                            playerId: '',
                            secondaryPlayerId: '',
                            playerNameOverride: '',
                            secondaryPlayerNameOverride: '',
                          }));
                        }}
                        disabled={editingDisabled}
                        className={getEventTypeButtonClasses(
                          option.value,
                          form.type === option.value,
                          editingDisabled,
                        )}
                      >
                        <EventGlyph eventType={option.value} size="button" />
                        <span>{option.label}</span>
                      </button>
                    ))}
                </div>
              </Field>

              {(selectedTrackingMode === 'basic' || selectedTrackingMode === 'lineups') &&
                form.type !== 'half_end' &&
                form.type !== 'full_time' && (
                  <>
                    <Field label="Player (Optional)">
                      <select
                        value={form.playerId}
                        onChange={(e) => setForm((prev) => ({ ...prev, playerId: e.target.value }))}
                        disabled={editingDisabled}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                      >
                        <option value="">No linked player</option>
                        {eventSelectablePlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {playerDisplayName(player)}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Quick Player / Label (Optional)">
                      <input
                        value={form.playerNameOverride}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, playerNameOverride: e.target.value }))
                        }
                        disabled={editingDisabled}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                        placeholder="e.g. #10 or Smith"
                      />
                    </Field>

                    {form.type === 'goal' && (
                      <>
                        <Field label="Assist Player (Optional)">
                          <select
                            value={form.secondaryPlayerId}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                secondaryPlayerId: e.target.value,
                              }))
                            }
                            disabled={editingDisabled}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                          >
                            <option value="">No linked assist player</option>
                            {eventSelectableSecondaryPlayers.map((player) => (
                              <option key={player.id} value={player.id}>
                                {playerDisplayName(player)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Assist / Secondary Label (Optional)">
                          <input
                            value={form.secondaryPlayerNameOverride}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                secondaryPlayerNameOverride: e.target.value,
                              }))
                            }
                            disabled={editingDisabled}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                            placeholder="Optional assist"
                          />
                        </Field>
                      </>
                    )}
                  </>
                )}

              {selectedTrackingMode === 'full' &&
                form.type !== 'half_end' &&
                form.type !== 'full_time' &&
                form.type !== 'substitution' && (
                  <Field label="Player">
                    <select
                      value={form.playerId}
                      onChange={(e) => setForm((prev) => ({ ...prev, playerId: e.target.value }))}
                      disabled={editingDisabled}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                    >
                      <option value="">Select player</option>
                      {eventSelectablePlayers.map((player) => (
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
                    disabled={editingDisabled}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                  >
                    <option value="">No assist</option>
                    {eventSelectableSecondaryPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {playerDisplayName(player)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {selectedTrackingMode === 'full' && form.type === 'substitution' && (
                <>
                  <Field label="Outgoing Player">
                    <select
                      value={form.playerId}
                      onChange={(e) => setForm((prev) => ({ ...prev, playerId: e.target.value }))}
                      disabled={editingDisabled}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                    >
                      <option value="">Select outgoing player</option>
                      {eventSelectablePlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {playerDisplayName(player)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Incoming Player">
                    <select
                      value={form.secondaryPlayerId}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, secondaryPlayerId: e.target.value }))
                      }
                      disabled={editingDisabled}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                    >
                      <option value="">Select incoming player</option>
                      {eventSelectableSecondaryPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {playerDisplayName(player)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              {selectedTrackingMode === 'full' && form.type === 'substitution' && (
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-sm font-semibold text-slate-900">Current on-field state</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        On Field
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedOnFieldPlayers.length === 0 ? (
                          <span className="text-sm text-slate-400">No active players found.</span>
                        ) : (
                          selectedOnFieldPlayers.map((player) => (
                            <span
                              key={player.id}
                              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                            >
                              {playerDisplayName(player)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Bench
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedBenchPlayers.length === 0 ? (
                          <span className="text-sm text-slate-400">No bench players found.</span>
                        ) : (
                          selectedBenchPlayers.map((player) => (
                            <span
                              key={player.id}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                            >
                              {playerDisplayName(player)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Field label="Notes (Optional)">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  disabled={editingDisabled}
                  className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                  placeholder="Sideline note, context, or detail"
                />
              </Field>

              {lineupNotice ? (
                <p className="text-sm font-medium text-amber-700">{lineupNotice}</p>
              ) : null}

              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

              <button
                type="button"
                onClick={addEvent}
                disabled={saving || editingDisabled}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'Saving Event...' : 'Add Event'}
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Lineup Snapshot Status</h2>
                <p className="text-sm text-slate-600">
                  Match-day roster snapshots load automatically for teams using lineups or full
                  tracking.
                </p>
              </div>
              {loadingLineups ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                  Loading...
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                  Ready
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {match.home_team?.name || 'Home Team'}
                    </p>
                    <p className="text-xs text-slate-500">Mode: {match.home_tracking_mode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {homeSupportsLineups ? `${homeLineups.length} players snapped` : 'Not used'}
                    </p>
                    {homeSupportsLineups && (
                      <p className="text-xs text-slate-500">{homeStarterCount} starters selected</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {match.away_team?.name || 'Away Team'}
                    </p>
                    <p className="text-xs text-slate-500">Mode: {match.away_tracking_mode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {awaySupportsLineups ? `${awayLineups.length} players snapped` : 'Not used'}
                    </p>
                    {awaySupportsLineups && (
                      <p className="text-xs text-slate-500">{awayStarterCount} starters selected</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {homeSupportsLineups && (
            <LineupSelectionCard
              title={match.home_team?.name || 'Home Team'}
              subtitle="Choose exactly 11 starters."
              rows={homeLineupRows}
              selectedStarterIds={selectedHomeStarterIds}
              onToggleStarter={toggleHomeStarter}
              onSave={handleSaveHomeLineup}
              saving={savingHomeLineup}
              loading={loadingLineups}
              accent="home"
              disabled={editingDisabled}
            />
          )}

          {awaySupportsLineups && (
            <LineupSelectionCard
              title={match.away_team?.name || 'Away Team'}
              subtitle="Choose exactly 11 starters."
              rows={awayLineupRows}
              selectedStarterIds={selectedAwayStarterIds}
              onToggleStarter={toggleAwayStarter}
              onSave={handleSaveAwayLineup}
              saving={savingAwayLineup}
              loading={loadingLineups}
              accent="away"
              disabled={editingDisabled}
            />
          )}

          <MatchActionsCard
            match={match}
            onUpdated={(updatedMatch) =>
              setMatch((prev) =>
                prev
                  ? {
                      ...prev,
                      ...updatedMatch,
                    }
                  : (updatedMatch as MatchRow)
              )
            }
          />
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Live Timeline</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {events.length} events
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
              Goals: {events.filter((e) => e.event_type === 'goal').length}
            </span>
            <span className="rounded-full bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-700">
              Cards:{' '}
              {
                events.filter(
                  (e) => e.event_type === 'yellow_card' || e.event_type === 'red_card',
                ).length
              }
            </span>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">
              Subs: {events.filter((e) => e.event_type === 'substitution').length}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              Status: {match.status}
            </span>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
              No events yet. Start the match and add the first event.
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
        </section>
      </div>

      {/* --------------------------------------------------- */}
      {/* QUICK ACTION BAR */}
      {/* --------------------------------------------------- */}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                side: 'home',
                type: 'goal',
                playerId: '',
                secondaryPlayerId: '',
              }))
            }
            disabled={editingDisabled}
            className="flex items-center justify-center gap-2 rounded-2xl bg-sky-100 py-4 text-base font-bold text-sky-800 ring-1 ring-sky-300 disabled:opacity-40"
          >
            <CircleDot className="h-5 w-5" />
            <span>Home Goal</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                side: 'away',
                type: 'goal',
                playerId: '',
                secondaryPlayerId: '',
              }))
            }
            disabled={editingDisabled}
            className="flex items-center justify-center gap-2 rounded-2xl bg-sky-100 py-4 text-base font-bold text-sky-800 ring-1 ring-sky-300 disabled:opacity-40"
          >
            <CircleDot className="h-5 w-5" />
            <span>Away Goal</span>
          </button>

          <button
            type="button"
            onClick={undoLastEvent}
            disabled={undoing || events.length === 0 || editingDisabled}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 py-4 text-base font-bold text-white disabled:opacity-40"
          >
            <RotateCcw className="h-5 w-5" />
            <span>{undoing ? 'Undoing…' : 'Undo'}</span>
          </button>

          <button
            type="button"
            onClick={match.clock_running ? pauseClock : startLivePeriod}
            disabled={editingDisabled}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-100 py-4 text-base font-bold text-amber-900 ring-1 ring-amber-300 disabled:opacity-40"
          >
            {match.clock_running ? (
              <>
                <Pause className="h-5 w-5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                <span>Resume</span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------
// LINEUP SELECTION CARD
// ---------------------------------------------------

function LineupSelectionCard({
  title,
  subtitle,
  rows,
  selectedStarterIds,
  onToggleStarter,
  onSave,
  saving,
  loading,
  accent,
  disabled,
}: {
  title: string;
  subtitle: string;
  rows: { row: MatchLineup; player: Player | undefined }[];
  selectedStarterIds: string[];
  onToggleStarter: (playerId: string) => void;
  onSave: () => void;
  saving: boolean;
  loading: boolean;
  accent: 'home' | 'away';
  disabled: boolean;
}) {
  const selectedRows = rows.filter(({ row }) => selectedStarterIds.includes(row.player_id));
  const benchRows = rows.filter(({ row }) => !selectedStarterIds.includes(row.player_id));
  const isValid = validateStartingLineupCount(selectedStarterIds);

  const persistedStarterIds = rows
    .filter(({ row }) => row.is_starter)
    .map(({ row }) => row.player_id)
    .sort();

  const currentStarterIds = [...selectedStarterIds].sort();

  const isDirty =
    JSON.stringify(persistedStarterIds) !== JSON.stringify(currentStarterIds);

  const accentBadgeClass =
    accent === 'home' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700';

  const accentActiveClass =
    accent === 'home'
      ? 'border-blue-300 bg-blue-50'
      : 'border-rose-300 bg-rose-50';

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-700" />
            <h2 className="text-xl font-bold">{title} Starting 11</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${accentBadgeClass}`}>
          {selectedStarterIds.length}/11
        </span>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 ring-1 ring-slate-200">
          Loading lineup...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 ring-1 ring-slate-200">
          No lineup snapshot is available for this side yet.
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-900">Selected starters</p>
            <p className="mt-1 text-xs text-slate-500">
              Tap a selected starter to remove them. Tap an available player below to add them.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedRows.length === 0 ? (
                <span className="text-sm text-slate-400">No starters selected yet.</span>
              ) : (
                selectedRows.map(({ row, player }) => (
                  <button
                    key={row.player_id}
                    type="button"
                    onClick={() => onToggleStarter(row.player_id)}
                    disabled={disabled}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition disabled:opacity-40 ${accentActiveClass}`}
                  >
                    <Check className="h-4 w-4" />
                    <span>{playerDisplayName(player)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Available players (tap to add)
            </h3>
            <div className="space-y-2">
              {benchRows.map(({ row, player }) => {
                const selected = selectedStarterIds.includes(row.player_id);

                return (
                  <button
                    key={row.player_id}
                    type="button"
                    onClick={() => onToggleStarter(row.player_id)}
                    disabled={disabled}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition disabled:opacity-40 ${
                      selected
                        ? accentActiveClass
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {playerDisplayName(player) ||
                          row.player_name_snapshot ||
                          'Unnamed player'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selected ? 'Starter' : 'Available'}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        selected ? accentBadgeClass : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {selected ? 'Selected' : 'Tap to start'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p
              className={`text-sm font-medium ${
                !isValid
                  ? 'text-amber-700'
                  : isDirty
                    ? 'text-sky-700'
                    : 'text-emerald-700'
              }`}
            >
              {!isValid
                ? 'Select exactly 11 starters before saving.'
                : isDirty
                  ? 'Starting 11 is ready to save.'
                  : 'Starting 11 is saved.'}
            </p>

            <button
              type="button"
              onClick={onSave}
              disabled={!isValid || saving || disabled || !isDirty}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : isDirty ? 'Save Starting 11' : 'Starting 11 Saved'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------
// FALLBACK LINEUP ROW BUILDER
// ---------------------------------------------------

function buildFallbackLineupRows(
  matchId: string,
  teamId: string | null | undefined,
  teamSide: 'home' | 'away',
  players: Player[],
): MatchLineup[] {
  if (!teamId) return [];

  return players.map((player, index): MatchLineup => ({
    id: `fallback-${matchId}-${teamId}-${player.id}`,
    match_id: matchId,
    team_id: teamId,
    player_id: player.id,
    team_side: teamSide,
    is_starter: false,
    is_bench: true,
    lineup_order: index + 1,
    created_at: new Date().toISOString(),
  }));
}

// ---------------------------------------------------
// EVENT TYPE BUTTON STYLES
// ---------------------------------------------------

function getEventTypeButtonClasses(
  eventType: EventType,
  isActive: boolean,
  disabled: boolean,
) {
  const disabledClass = disabled ? 'opacity-40' : '';

  if (eventType === 'goal') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-300'
        : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100'
    }`;
  }

  if (eventType === 'yellow_card') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-yellow-200 text-yellow-900 ring-2 ring-yellow-400'
        : 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-300 hover:bg-yellow-100'
    }`;
  }

  if (eventType === 'red_card') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-red-200 text-red-900 ring-2 ring-red-400'
        : 'bg-red-50 text-red-800 ring-1 ring-red-300 hover:bg-red-100'
    }`;
  }

  if (eventType === 'substitution') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-violet-100 text-violet-800 ring-2 ring-violet-300'
        : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100'
    }`;
  }

  if (eventType === 'half_end') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-300'
        : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200'
    }`;
  }

  if (eventType === 'full_time') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-slate-800 text-white ring-2 ring-slate-400'
        : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200'
    }`;
  }

  return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
    isActive
      ? 'bg-slate-900 text-white ring-2 ring-slate-300'
      : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200'
  }`;
}

// ---------------------------------------------------
// EVENT CLASSIFICATION
// ---------------------------------------------------

function isSystemEvent(eventType: MatchEvent['event_type']) {
  return (
    eventType === 'half_start' ||
    eventType === 'match_resumed' ||
    eventType === 'match_paused' ||
    eventType === 'half_end' ||
    eventType === 'full_time'
  );
}

// ---------------------------------------------------
// EVENT CARD STYLES
// ---------------------------------------------------

function getEventCardClasses(event: MatchEvent) {
  if (event.event_type === 'goal') {
    return {
      shell: 'border-sky-300 bg-sky-50',
      icon: 'bg-sky-100 text-sky-800 ring-sky-300',
    };
  }

  if (event.event_type === 'yellow_card') {
    return {
      shell: 'border-yellow-300 bg-yellow-50',
      icon: 'bg-yellow-100 text-yellow-900 ring-yellow-300',
    };
  }

  if (event.event_type === 'red_card') {
    return {
      shell: 'border-red-300 bg-red-50',
      icon: 'bg-red-100 text-red-900 ring-red-300',
    };
  }

  if (event.event_type === 'substitution') {
    return {
      shell: 'border-violet-200 bg-violet-50',
      icon: 'bg-violet-100 text-violet-800 ring-violet-300',
    };
  }

  return {
    shell: 'border-slate-200 bg-slate-50',
    icon: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
}

// ---------------------------------------------------
// TIMELINE LABEL BUILDER
// ---------------------------------------------------

function buildPrettyTimelineText(
  event: MatchEvent,
  matchRow: MatchRow,
  homePlayers: Player[],
  awayPlayers: Player[],
) {
  const roster = event.team_side === 'home' ? homePlayers : awayPlayers;
  const primary = roster.find((p) => p.id === event.player_id);
  const secondary = roster.find((p) => p.id === event.secondary_player_id);

  const teamName =
    event.team_side === 'home'
      ? matchRow.home_team?.name || 'Home'
      : matchRow.away_team?.name || 'Away';

  const primaryName = event.player_name_override || playerDisplayName(primary) || teamName;
  const secondaryName = event.secondary_player_name_override || playerDisplayName(secondary);

  if (event.event_type === 'goal') {
    return secondaryName
      ? `Goal — ${primaryName} (Assist: ${secondaryName})`
      : `Goal — ${primaryName}`;
  }

  if (event.event_type === 'yellow_card') {
    return `Yellow Card — ${primaryName}`;
  }

  if (event.event_type === 'red_card') {
    return `Red Card — ${primaryName}`;
  }

  if (event.event_type === 'substitution') {
    return secondaryName
      ? `Substitution — ${primaryName || 'Player Out'} for ${secondaryName}`
      : `Substitution — ${primaryName}`;
  }

  if (event.event_type === 'half_start') return 'Half Started';
  if (event.event_type === 'match_resumed') return 'Match Resumed';
  if (event.event_type === 'match_paused') return 'Match Paused';
  if (event.event_type === 'half_end') return 'Halftime';
  if (event.event_type === 'full_time') return 'Full Time';

  return eventLabels[event.event_type] || event.event_type;
}

// ---------------------------------------------------
// TIMELINE EVENT CARD
// ---------------------------------------------------

function TimelineEventCard({
  event,
  match,
  homePlayers,
  awayPlayers,
}: {
  event: MatchEvent;
  match: MatchRow;
  homePlayers: Player[];
  awayPlayers: Player[];
}) {
  const systemEvent = isSystemEvent(event.event_type);
  const styles = getEventCardClasses(event);
  const label = buildPrettyTimelineText(event, match, homePlayers, awayPlayers);

  if (systemEvent) {
    return (
      <div className="relative overflow-hidden pl-14">
        <div className="absolute bottom-0 left-[1rem] top-0 w-px bg-slate-200" />

        <div className="absolute left-0 top-4 flex w-8 justify-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 ${styles.icon}`}
          >
            <EventGlyph eventType={event.event_type} size="timeline" />
          </div>
        </div>

        <div className={`rounded-2xl border px-4 py-3 ${styles.shell}`}>
          <div className="flex items-center gap-3">
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
              {event.minute}'
            </span>

            <p className="text-sm font-semibold text-slate-900">{label}</p>
          </div>

          {event.notes ? <p className="mt-2 text-xs text-slate-500">{event.notes}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden pl-14">
      <div className="absolute bottom-0 left-[1rem] top-0 w-px bg-slate-200" />

      <div className="absolute left-0 top-4 flex w-8 justify-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 ${styles.icon}`}
        >
          <EventGlyph eventType={event.event_type} size="timeline" />
        </div>
      </div>

      <div className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${styles.shell}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
              {event.minute}'
            </span>

            <p className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-6 text-slate-900">
              {label}
            </p>
          </div>

          <span
            className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
              event.team_side === 'home'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {event.team_side}
          </span>
        </div>

        {event.notes ? (
          <p className="mt-2 break-words text-xs text-slate-500">{event.notes}</p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------
// EVENT GLYPH
// ---------------------------------------------------

function EventGlyph({
  eventType,
  size = 'timeline',
}: {
  eventType: EventType;
  size?: 'button' | 'timeline';
}) {
  const iconSize = size === 'button' ? 'h-4 w-4' : 'h-4 w-4';

  if (eventType === 'goal') {
    return <CircleDot className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'substitution') {
    return <ArrowLeftRight className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'match_resumed' || eventType === 'half_start') {
    return <Play className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'match_paused' || eventType === 'half_end') {
    return <Pause className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'full_time') {
    return <Square className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'yellow_card') {
    return <span className="h-4 w-3 rounded-[2px] bg-yellow-400 ring-1 ring-yellow-500/60" />;
  }

  if (eventType === 'red_card') {
    return <span className="h-4 w-3 rounded-[2px] bg-red-500 ring-1 ring-red-600/60" />;
  }

  return <CircleDot className={iconSize} strokeWidth={2.5} />;
}

// ---------------------------------------------------
// FIELD WRAPPER
// ---------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------
// PLAYER DISPLAY NAME
// ---------------------------------------------------

function playerDisplayName(player: Player | undefined) {
  if (!player) return '';
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  return player?.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
}