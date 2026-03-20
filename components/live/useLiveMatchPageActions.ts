'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import {
  createMatchLineupSnapshot,
  loadPreviousMatchStarterIds,
  saveStartingLineup,
  validateStartingLineupCount,
} from '@/lib/matchLineups';
import { supabase } from '@/lib/supabase';
import type { Dispatch, SetStateAction } from 'react';
import type { EventType, MatchEvent, MatchLineup, Player, TeamSide, TrackingMode } from '@/lib/types';
import type { EventFormState, MatchRow } from '@/components/live/liveMatchPageShared';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type UseLiveMatchPageActionsParams = {
  match: MatchRow | null;
  setMatch: Dispatch<SetStateAction<MatchRow | null>>;
  form: EventFormState;
  setForm: Dispatch<SetStateAction<EventFormState>>;
  selectedTrackingMode: TrackingMode;
  editingDisabled: boolean;
  homePlayers: Player[];
  awayPlayers: Player[];
  selectedOnFieldPlayers: Player[];
  selectedBenchPlayers: Player[];
  selectedHomeStarterIds: string[];
  selectedAwayStarterIds: string[];
  setSelectedHomeStarterIds: Dispatch<SetStateAction<string[]>>;
  setSelectedAwayStarterIds: Dispatch<SetStateAction<string[]>>;
  setHomeLineups: Dispatch<SetStateAction<MatchLineup[]>>;
  setAwayLineups: Dispatch<SetStateAction<MatchLineup[]>>;
  setEvents: Dispatch<SetStateAction<MatchEvent[]>>;
  safeEvents: MatchEvent[];
  secondsElapsed: number;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setSavingHomeLineup: Dispatch<SetStateAction<boolean>>;
  setSavingAwayLineup: Dispatch<SetStateAction<boolean>>;
  setUndoing: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLineupNotice: Dispatch<SetStateAction<string | null>>;
  setNowMs: Dispatch<SetStateAction<number>>;
  setPauseNote: Dispatch<SetStateAction<string>>;
  setShowPauseModal: Dispatch<SetStateAction<boolean>>;
};

type AddEventOptions = {
  overrides?: Partial<EventFormState>;
  allowGoalWithoutPlayer?: boolean;
};

// ---------------------------------------------------
// HOOK
// FILE: components/live/useLiveMatchPageActions.ts
// ---------------------------------------------------

export default function useLiveMatchPageActions({
  match,
  setMatch,
  form,
  setForm,
  selectedTrackingMode,
  editingDisabled,
  homePlayers,
  awayPlayers,
  selectedOnFieldPlayers,
  selectedBenchPlayers,
  selectedHomeStarterIds,
  selectedAwayStarterIds,
  setSelectedHomeStarterIds,
  setSelectedAwayStarterIds,
  setHomeLineups,
  setAwayLineups,
  setEvents,
  safeEvents,
  secondsElapsed,
  setSaving,
  setSavingHomeLineup,
  setSavingAwayLineup,
  setUndoing,
  setError,
  setLineupNotice,
  setNowMs,
  setPauseNote,
  setShowPauseModal,
}: UseLiveMatchPageActionsParams) {
  function getTrackingModeForSide(side: TeamSide): TrackingMode {
    if (!match) return selectedTrackingMode;
    return side === 'home' ? match.home_tracking_mode : match.away_tracking_mode;
  }

  function getEffectiveStarterIdsForSide(side: TeamSide) {
    const players = side === 'home' ? homePlayers : awayPlayers;
    const selectedStarterIds =
      side === 'home' ? selectedHomeStarterIds : selectedAwayStarterIds;

    if (selectedStarterIds.length > 0) {
      return selectedStarterIds;
    }

    return players.slice(0, 11).map((player) => player.id);
  }

  function getOnFieldPlayersForSide(side: TeamSide) {
    const players = side === 'home' ? homePlayers : awayPlayers;
    const starters = getEffectiveStarterIdsForSide(side);

    if (getTrackingModeForSide(side) !== 'full') {
      return players;
    }

    const activeIds = new Set(starters);

    safeEvents
      .filter((event) => event.team_side === side && event.event_type === 'substitution')
      .slice()
      .reverse()
      .forEach((event) => {
        if (event.player_id) activeIds.delete(event.player_id);
        if (event.secondary_player_id) activeIds.add(event.secondary_player_id);
      });

    return players.filter((player) => activeIds.has(player.id));
  }

  function getBenchPlayersForSide(side: TeamSide) {
    const players = side === 'home' ? homePlayers : awayPlayers;
    const onFieldIds = new Set(getOnFieldPlayersForSide(side).map((player) => player.id));
    return players.filter((player) => !onFieldIds.has(player.id));
  }

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

  function openPauseModal() {
    if (!match || !match.clock_running || editingDisabled) return;

    setPauseNote('');
    setShowPauseModal(true);
    setError(null);
  }

  function closePauseModal() {
    setShowPauseModal(false);
    setPauseNote('');
  }

  function applyPauseReason(reason: string) {
    setPauseNote(reason);
  }

  function validateEvent(
    eventForm: EventFormState,
    options?: { allowGoalWithoutPlayer?: boolean },
  ) {
    const effectiveTrackingMode = getTrackingModeForSide(eventForm.side);
    const effectiveOnFieldPlayers = getOnFieldPlayersForSide(eventForm.side);
    const effectiveBenchPlayers = getBenchPlayersForSide(eventForm.side);

    if (!match) return 'Match not loaded.';
    if (editingDisabled) return 'This match is not editable in its current state.';
    if (eventForm.type === 'half_end' || eventForm.type === 'full_time') return null;

    if (effectiveTrackingMode === 'lineups' && eventForm.type === 'substitution') {
      return 'Lineups mode does not support substitutions yet.';
    }

    if (effectiveTrackingMode === 'full') {
      if (
        (eventForm.type === 'yellow_card' ||
          eventForm.type === 'red_card' ||
          eventForm.type === 'substitution' ||
          (eventForm.type === 'goal' && !options?.allowGoalWithoutPlayer)) &&
        !eventForm.playerId
      ) {
        return 'Choose a player for this event.';
      }

      if (eventForm.type === 'substitution' && !eventForm.secondaryPlayerId) {
        return 'Choose the incoming player for substitution.';
      }

      if (
        eventForm.type === 'substitution' &&
        eventForm.playerId &&
        eventForm.secondaryPlayerId &&
        eventForm.playerId === eventForm.secondaryPlayerId
      ) {
        return 'Outgoing and incoming players must be different.';
      }

      if (eventForm.type === 'substitution') {
        const outgoingOnField = effectiveOnFieldPlayers.some(
          (player) => player.id === eventForm.playerId,
        );

        const incomingOnBench = effectiveBenchPlayers.some(
          (player) => player.id === eventForm.secondaryPlayerId,
        );

        if (!outgoingOnField) {
          return 'Outgoing player must currently be on the field.';
        }

        if (!incomingOnBench) {
          return 'Incoming player must currently be off the field.';
        }
      }

      return null;
    }

    if (effectiveTrackingMode === 'lineups') {
      if (
        (eventForm.type === 'goal' ||
          eventForm.type === 'yellow_card' ||
          eventForm.type === 'red_card') &&
        !eventForm.playerId &&
        !eventForm.playerNameOverride.trim()
      ) {
        return 'Choose a player or type a quick player label.';
      }

      if (
        eventForm.type === 'substitution' &&
        !eventForm.playerNameOverride.trim() &&
        !eventForm.playerId
      ) {
        return 'Add a quick player or note for this substitution.';
      }

      return null;
    }

    if (effectiveTrackingMode === 'basic') {
      return null;
    }

    return null;
  }

  function toggleHomeStarter(playerId: string) {
    setSelectedHomeStarterIds((current) => {
      if (current.includes(playerId)) {
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
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }

      if (current.length >= 11) {
        return current;
      }

      return [...current, playerId];
    });
  }

  async function usePreviousHomeLineup() {
    if (!match?.home_team_id) return;

    try {
      const previousStarterIds = await loadPreviousMatchStarterIds(
        match.id,
        match.home_team_id,
        match.match_date,
      );

      if (previousStarterIds.length === 0) {
        setError('No previous saved starting 11 was found for the home team.');
        return;
      }

      const currentHomePlayerIds = new Set(homePlayers.map((player) => player.id));
      const nextStarterIds = previousStarterIds.filter((playerId) =>
        currentHomePlayerIds.has(playerId),
      );

      setSelectedHomeStarterIds(nextStarterIds.slice(0, 11));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load previous home starters.',
      );
    }
  }

  async function usePreviousAwayLineup() {
    if (!match?.away_team_id) return;

    try {
      const previousStarterIds = await loadPreviousMatchStarterIds(
        match.id,
        match.away_team_id,
        match.match_date,
      );

      if (previousStarterIds.length === 0) {
        setError('No previous saved starting 11 was found for the away team.');
        return;
      }

      const currentAwayPlayerIds = new Set(awayPlayers.map((player) => player.id));
      const nextStarterIds = previousStarterIds.filter((playerId) =>
        currentAwayPlayerIds.has(playerId),
      );

      setSelectedAwayStarterIds(nextStarterIds.slice(0, 11));
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load previous away starters.',
      );
    }
  }

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

  async function addEvent(options?: AddEventOptions) {
    if (!match) return;

    const effectiveForm: EventFormState = {
      ...form,
      ...options?.overrides,
    };

    const validationError = validateEvent(effectiveForm, {
      allowGoalWithoutPlayer: options?.allowGoalWithoutPlayer,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const minute = Math.floor(secondsElapsed / 60);
    const eventTeamId =
      effectiveForm.side === 'home' ? match.home_team_id : match.away_team_id;

    const insertPayload = {
      match_id: match.id,
      minute,
      event_type: effectiveForm.type,
      team_side: effectiveForm.side,
      team_id: eventTeamId,
      player_id: effectiveForm.playerId || null,
      secondary_player_id: effectiveForm.secondaryPlayerId || null,
      player_name_override: effectiveForm.playerNameOverride.trim() || null,
      secondary_player_name_override:
        effectiveForm.secondaryPlayerNameOverride.trim() || null,
      notes: effectiveForm.notes.trim() || null,
    };

    const { data, error: insertError } = await supabase
      .from('match_events')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError) {
      setSaving(false);
      setError(insertError.message);
      return;
    }

    let nextHomeScore = match.home_score;
    let nextAwayScore = match.away_score;
    let nextStatus = match.status;
    let nextClockRunning = match.clock_running;
    let nextElapsedSeconds = match.elapsed_seconds;

    if (effectiveForm.type === 'goal') {
      if (effectiveForm.side === 'home') nextHomeScore += 1;
      if (effectiveForm.side === 'away') nextAwayScore += 1;
    }

    if (effectiveForm.type === 'half_end') {
      nextStatus = 'halftime';
      nextClockRunning = false;
      nextElapsedSeconds = secondsElapsed;
    }

    if (effectiveForm.type === 'full_time') {
      nextStatus = 'final';
      nextClockRunning = false;
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

    setEvents((prev) => [data as MatchEvent, ...prev].filter(Boolean));
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
            period_started_at: nextClockRunning ? prev.period_started_at : null,
          }
        : prev,
    );

    setSaving(false);
    resetForm(effectiveForm.side);
  }

  async function startLivePeriod() {
    if (!match || editingDisabled) return;

    setError(null);

    const startedAt = new Date().toISOString();
    const minute = Math.floor(secondsElapsed / 60);
    const wasPausedLive = match.status === 'live' && !match.clock_running;

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

    setEvents(((refreshedEvents as MatchEvent[]) ?? []).filter(Boolean));
  }

  async function pauseClock(note?: string) {
    if (!match || !match.clock_running || editingDisabled) return;

    setError(null);

    const pausedElapsed = secondsElapsed;
    const minute = Math.floor(pausedElapsed / 60);
    const cleanPauseNote = note?.trim() || null;

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
      notes: cleanPauseNote,
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

    setEvents(((refreshedEvents as MatchEvent[]) ?? []).filter(Boolean));
    closePauseModal();
  }

  async function undoLastEvent() {
    if (!match || safeEvents.length === 0 || editingDisabled) return;

    const latest = safeEvents[0];

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

    if (latest.event_type === 'full_time' || latest.event_type === 'half_end') {
      nextStatus = 'live';
    }

    const remainingEvents = safeEvents.slice(1);
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

  return {
    resetForm,
    openPauseModal,
    closePauseModal,
    applyPauseReason,
    toggleHomeStarter,
    toggleAwayStarter,
    usePreviousHomeLineup,
    usePreviousAwayLineup,
    handleSaveHomeLineup,
    handleSaveAwayLineup,
    addEvent,
    startLivePeriod,
    pauseClock,
    undoLastEvent,
  };
}
