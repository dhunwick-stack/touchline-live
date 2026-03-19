'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { calculateMinutesPlayed } from '@/lib/matchStats';
import {
  createMatchLineupSnapshot,
  saveStartingLineup,
  validateStartingLineupCount,
} from '@/lib/matchLineups';
import { supabase } from '@/lib/supabase';
import {
  buildFallbackLineupRows,
  eventTypeOptions,
  playerDisplayName,
  supportsLineups,
} from '@/components/live/liveMatchPageShared';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type {
  EventType,
  MatchEvent,
  MatchLineup,
  Player,
  TeamSide,
  TrackingMode,
} from '@/lib/types';
import type {
  EventFormState,
  MatchRow,
  SnapshotStatusRow,
} from '@/components/live/liveMatchPageShared';

// ---------------------------------------------------
// HOOK
// FILE: components/live/useLiveMatchPage.ts
// ---------------------------------------------------

export default function useLiveMatchPage() {
  const params = useParams();
  const router = useRouter();

  const matchId =
    typeof params?.matchId === 'string'
      ? params.matchId
      : Array.isArray(params?.matchId)
        ? params.matchId[0]
        : '';

  const [authChecked, setAuthChecked] = useState(false);
  const [hasMatchAccess, setHasMatchAccess] = useState(false);

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeLineups, setHomeLineups] = useState<MatchLineup[]>([]);
  const [awayLineups, setAwayLineups] = useState<MatchLineup[]>([]);
  const [selectedHomeStarterIds, setSelectedHomeStarterIds] = useState<string[]>([]);
  const [selectedAwayStarterIds, setSelectedAwayStarterIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingLineups, setLoadingLineups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingHomeLineup, setSavingHomeLineup] = useState(false);
  const [savingAwayLineup, setSavingAwayLineup] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineupNotice, setLineupNotice] = useState<string | null>(null);

  const [nowMs, setNowMs] = useState(Date.now());

  const [showOnFieldState, setShowOnFieldState] = useState(true);
  const [showLineupSnapshotStatus, setShowLineupSnapshotStatus] = useState(true);
  const [showHomeMinutesCard, setShowHomeMinutesCard] = useState(true);
  const [showAwayMinutesCard, setShowAwayMinutesCard] = useState(true);
  const [showHomeLineupCard, setShowHomeLineupCard] = useState(true);
  const [showAwayLineupCard, setShowAwayLineupCard] = useState(true);

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseNote, setPauseNote] = useState('');

  const [form, setForm] = useState<EventFormState>({
    type: 'goal',
    side: 'home',
    playerId: '',
    secondaryPlayerId: '',
    playerNameOverride: '',
    secondaryPlayerNameOverride: '',
    notes: '',
  });

  async function loadMatchPage() {
    if (!matchId) return;

    setLoading(true);
    setError(null);
    setLineupNotice(null);
    setAuthChecked(false);
    setHasMatchAccess(false);
    setLoadingLineups(false);

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:home_team_id (*),
        away_team:away_team_id (*)
      `)
      .eq('id', matchId)
      .single();

    if (matchError || !matchData) {
      setError(matchError?.message || 'Failed to load match.');
      setLoading(false);
      setAuthChecked(true);
      return;
    }

    const loadedMatch = matchData as MatchRow;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(sessionError.message || 'Failed to check sign-in status.');
      setLoading(false);
      setAuthChecked(true);
      return;
    }

    const user = session?.user ?? null;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/live/${matchId}`)}`);
      return;
    }

    const eligibleTeamIds = [loadedMatch.home_team_id, loadedMatch.away_team_id].filter(
      Boolean,
    ) as string[];

    if (eligibleTeamIds.length === 0) {
      setError('This match does not have valid team assignments.');
      setLoading(false);
      setAuthChecked(true);
      return;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('team_users')
      .select('team_id')
      .eq('user_id', user.id)
      .in('team_id', eligibleTeamIds);

    if (membershipError) {
      setError(membershipError.message || 'Failed to verify match access.');
      setLoading(false);
      setAuthChecked(true);
      return;
    }

    if (!memberships || memberships.length === 0) {
      const fallbackTeamId = loadedMatch.home_team_id || loadedMatch.away_team_id || '';
      router.replace(`/team-login?teamId=${fallbackTeamId}&mode=live`);
      return;
    }

    setAuthChecked(true);
    setHasMatchAccess(true);
    setMatch(loadedMatch);

    const { data: eventData, error: eventError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', loadedMatch.id)
      .order('created_at', { ascending: false });

    if (eventError) {
      setError(eventError.message || 'Failed to load match events.');
      setLoading(false);
      return;
    }

    setEvents(((eventData as MatchEvent[]) ?? []).filter(Boolean));

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

    const resolvedHomePlayers = (homePlayersResult.data as Player[]) ?? [];
    const resolvedAwayPlayers = (awayPlayersResult.data as Player[]) ?? [];

    setHomePlayers(resolvedHomePlayers);
    setAwayPlayers(resolvedAwayPlayers);

    setLoadingLineups(true);

    try {
      const { data: lineupData, error: lineupError } = await supabase
        .from('match_lineups')
        .select('*')
        .eq('match_id', loadedMatch.id);

      if (lineupError) {
        throw lineupError;
      }

      const allLineups = (lineupData as MatchLineup[]) ?? [];

      const homeNeedsLineups = supportsLineups(loadedMatch.home_tracking_mode);
      const awayNeedsLineups = supportsLineups(loadedMatch.away_tracking_mode);

      const realHomeLineups = allLineups.filter(
        (lineup) => lineup.team_id === loadedMatch.home_team_id,
      );

      const realAwayLineups = allLineups.filter(
        (lineup) => lineup.team_id === loadedMatch.away_team_id,
      );

      const resolvedHomeLineups = homeNeedsLineups
        ? realHomeLineups.length > 0
          ? realHomeLineups
          : buildFallbackLineupRows(
              loadedMatch.id,
              loadedMatch.home_team_id,
              resolvedHomePlayers,
            )
        : [];

      const resolvedAwayLineups = awayNeedsLineups
        ? realAwayLineups.length > 0
          ? realAwayLineups
          : buildFallbackLineupRows(
              loadedMatch.id,
              loadedMatch.away_team_id,
              resolvedAwayPlayers,
            )
        : [];

      setHomeLineups(resolvedHomeLineups);
      setAwayLineups(resolvedAwayLineups);

      setSelectedHomeStarterIds(
        resolvedHomeLineups.filter((row) => row.is_starter).map((row) => row.player_id),
      );

      setSelectedAwayStarterIds(
        resolvedAwayLineups.filter((row) => row.is_starter).map((row) => row.player_id),
      );

      const homeIsMissingRequiredSnapshot =
        homeNeedsLineups && realHomeLineups.length === 0;

      const awayIsMissingRequiredSnapshot =
        awayNeedsLineups && realAwayLineups.length === 0;

      setLineupNotice(
        homeIsMissingRequiredSnapshot || awayIsMissingRequiredSnapshot
          ? 'Using roster fallback where saved lineup snapshots were not found.'
          : null,
      );
    } catch (lineupLoadError) {
      console.error('Failed to load match lineups:', lineupLoadError);

      const homeNeedsLineups = supportsLineups(loadedMatch.home_tracking_mode);
      const awayNeedsLineups = supportsLineups(loadedMatch.away_tracking_mode);

      const fallbackHomeLineups = homeNeedsLineups
        ? buildFallbackLineupRows(
            loadedMatch.id,
            loadedMatch.home_team_id,
            resolvedHomePlayers,
          )
        : [];

      const fallbackAwayLineups = awayNeedsLineups
        ? buildFallbackLineupRows(
            loadedMatch.id,
            loadedMatch.away_team_id,
            resolvedAwayPlayers,
          )
        : [];

      setHomeLineups(fallbackHomeLineups);
      setAwayLineups(fallbackAwayLineups);

      setSelectedHomeStarterIds(
        fallbackHomeLineups.filter((row) => row.is_starter).map((row) => row.player_id),
      );

      setSelectedAwayStarterIds(
        fallbackAwayLineups.filter((row) => row.is_starter).map((row) => row.player_id),
      );

      setLineupNotice(null);
    } finally {
      setLoadingLineups(false);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!matchId) return;
    loadMatchPage();
  }, [matchId]);

  useEffect(() => {
    if (!match?.id || !hasMatchAccess) return;

    const channel = supabase
      .channel(`admin-match-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`,
        },
        async () => {
          await loadMatchPage();
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
          await loadMatchPage();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_lineups',
          filter: `match_id=eq.${match.id}`,
        },
        async () => {
          await loadMatchPage();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match?.id, hasMatchAccess]);

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

  const safeEvents = useMemo(() => {
    return events.filter((event): event is MatchEvent => Boolean(event));
  }, [events]);

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

  const homeSupportsLineups = supportsLineups(match?.home_tracking_mode);
  const awaySupportsLineups = supportsLineups(match?.away_tracking_mode);

  const editingDisabled =
    !!match &&
    (match.is_locked === true ||
      match.status === 'cancelled' ||
      match.status === 'postponed');

  const lineupEditingDisabled =
    !!match &&
    (match.is_locked === true ||
      match.status === 'cancelled' ||
      match.status === 'postponed' ||
      match.status === 'live' ||
      match.status === 'halftime' ||
      match.status === 'final');

  const homeStarterCount = selectedHomeStarterIds.length;
  const awayStarterCount = selectedAwayStarterIds.length;

  const homeSnapshotRow = useMemo<SnapshotStatusRow>(() => {
    return {
      teamName: match?.home_team?.name || 'Home Team',
      modeLabel: match?.home_tracking_mode || 'basic',
      playersSnappedLabel: homeSupportsLineups
        ? `${homeLineups.length} players snapped`
        : 'Not used',
      startersSelectedLabel: homeSupportsLineups
        ? `${homeStarterCount} starters selected`
        : null,
    };
  }, [
    homeLineups.length,
    homeStarterCount,
    homeSupportsLineups,
    match?.home_team?.name,
    match?.home_tracking_mode,
  ]);

  const awaySnapshotRow = useMemo<SnapshotStatusRow>(() => {
    return {
      teamName: match?.away_team?.name || 'Away Team',
      modeLabel: match?.away_tracking_mode || 'basic',
      playersSnappedLabel: awaySupportsLineups
        ? `${awayLineups.length} players snapped`
        : 'Not used',
      startersSelectedLabel: awaySupportsLineups
        ? `${awayStarterCount} starters selected`
        : null,
    };
  }, [
    awayLineups.length,
    awayStarterCount,
    awaySupportsLineups,
    match?.away_team?.name,
    match?.away_tracking_mode,
  ]);

  const homeActivePlayerIds = useMemo(() => {
    if (match?.home_tracking_mode !== 'full') {
      return new Set(homePlayers.map((player) => player.id));
    }

    const activeIds = new Set(selectedHomeStarterIds);

    safeEvents
      .filter((event) => event.team_side === 'home' && event.event_type === 'substitution')
      .slice()
      .reverse()
      .forEach((event) => {
        if (event.player_id) {
          activeIds.delete(event.player_id);
        }

        if (event.secondary_player_id) {
          activeIds.add(event.secondary_player_id);
        }
      });

    return activeIds;
  }, [safeEvents, homePlayers, match?.home_tracking_mode, selectedHomeStarterIds]);

  const awayActivePlayerIds = useMemo(() => {
    if (match?.away_tracking_mode !== 'full') {
      return new Set(awayPlayers.map((player) => player.id));
    }

    const activeIds = new Set(selectedAwayStarterIds);

    safeEvents
      .filter((event) => event.team_side === 'away' && event.event_type === 'substitution')
      .slice()
      .reverse()
      .forEach((event) => {
        if (event.player_id) {
          activeIds.delete(event.player_id);
        }

        if (event.secondary_player_id) {
          activeIds.add(event.secondary_player_id);
        }
      });

    return activeIds;
  }, [safeEvents, awayPlayers, match?.away_tracking_mode, selectedAwayStarterIds]);

  const homeLineupRows = useMemo(() => {
    return homeLineups.map((row) => ({
      row,
      player: homePlayers.find((player) => player.id === row.player_id),
    }));
  }, [homeLineups, homePlayers]);

  const awayLineupRows = useMemo(() => {
    return awayLineups.map((row) => ({
      row,
      player: awayPlayers.find((player) => player.id === row.player_id),
    }));
  }, [awayLineups, awayPlayers]);

  const selectedRosterPlayers = useMemo(() => {
    return form.side === 'home' ? homePlayers : awayPlayers;
  }, [form.side, homePlayers, awayPlayers]);

  const selectedOnFieldPlayers = useMemo(() => {
    if (form.side === 'home') {
      return homePlayers.filter((player) => homeActivePlayerIds.has(player.id));
    }

    return awayPlayers.filter((player) => awayActivePlayerIds.has(player.id));
  }, [form.side, homePlayers, awayPlayers, homeActivePlayerIds, awayActivePlayerIds]);

  const selectedBenchPlayers = useMemo(() => {
    if (form.side === 'home') {
      return homePlayers.filter((player) => !homeActivePlayerIds.has(player.id));
    }

    return awayPlayers.filter((player) => !awayActivePlayerIds.has(player.id));
  }, [form.side, homePlayers, awayPlayers, homeActivePlayerIds, awayActivePlayerIds]);

  const eventSelectablePlayers = useMemo(() => {
    return selectedTrackingMode === 'full' ? selectedOnFieldPlayers : selectedRosterPlayers;
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
    selectedTrackingMode,
    selectedBenchPlayers,
    selectedOnFieldPlayers,
    selectedRosterPlayers,
  ]);

  const homeMinutesPlayedRows = useMemo(() => {
    if (!match || match.home_tracking_mode !== 'full') {
      return [];
    }

    return homePlayers
      .map((player) => ({
        player,
        minutes: calculateMinutesPlayed({
          match,
          events: safeEvents,
          playerId: player.id,
          teamSide: 'home',
          startingPlayerIds: selectedHomeStarterIds,
        }),
      }))
      .filter((row) => row.minutes > 0)
      .sort((a, b) => {
        if (b.minutes !== a.minutes) return b.minutes - a.minutes;

        const aNumber = a.player.jersey_number ?? 999;
        const bNumber = b.player.jersey_number ?? 999;

        if (aNumber !== bNumber) return aNumber - bNumber;

        return playerDisplayName(a.player).localeCompare(playerDisplayName(b.player));
      });
  }, [safeEvents, homePlayers, match, selectedHomeStarterIds]);

  const awayMinutesPlayedRows = useMemo(() => {
    if (!match || match.away_tracking_mode !== 'full') {
      return [];
    }

    return awayPlayers
      .map((player) => ({
        player,
        minutes: calculateMinutesPlayed({
          match,
          events: safeEvents,
          playerId: player.id,
          teamSide: 'away',
          startingPlayerIds: selectedAwayStarterIds,
        }),
      }))
      .filter((row) => row.minutes > 0)
      .sort((a, b) => {
        if (b.minutes !== a.minutes) return b.minutes - a.minutes;

        const aNumber = a.player.jersey_number ?? 999;
        const bNumber = b.player.jersey_number ?? 999;

        if (aNumber !== bNumber) return aNumber - bNumber;

        return playerDisplayName(a.player).localeCompare(playerDisplayName(b.player));
      });
  }, [awayPlayers, safeEvents, match, selectedAwayStarterIds]);

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

      return null;
    }

    if (selectedTrackingMode === 'lineups') {
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

      return null;
    }

    if (selectedTrackingMode === 'basic') {
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
    const eventTeamId = form.side === 'home' ? match.home_team_id : match.away_team_id;

    const insertPayload = {
      match_id: match.id,
      minute,
      event_type: form.type,
      team_side: form.side,
      team_id: eventTeamId,
      player_id: form.playerId || null,
      secondary_player_id: form.secondaryPlayerId || null,
      player_name_override: form.playerNameOverride.trim() || null,
      secondary_player_name_override: form.secondaryPlayerNameOverride.trim() || null,
      notes: form.notes.trim() || null,
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

    if (form.type === 'goal') {
      if (form.side === 'home') nextHomeScore += 1;
      if (form.side === 'away') nextAwayScore += 1;
    }

    if (form.type === 'half_end') {
      nextStatus = 'halftime';
      nextClockRunning = false;
      nextElapsedSeconds = secondsElapsed;
    }

    if (form.type === 'full_time') {
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
    resetForm(form.side);
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
    match,
    setMatch,
    loading,
    authChecked,
    hasMatchAccess,
    error,
    formattedClock,
    safeEvents,
    homePlayers,
    awayPlayers,
    loadingLineups,
    saving,
    savingHomeLineup,
    savingAwayLineup,
    undoing,
    lineupNotice,
    selectedTeamName,
    selectedTrackingMode,
    editingDisabled,
    lineupEditingDisabled,
    form,
    setForm,
    resetForm,
    addEvent,
    eventSelectablePlayers,
    eventSelectableSecondaryPlayers,
    selectedOnFieldPlayers,
    selectedBenchPlayers,
    showOnFieldState,
    setShowOnFieldState,
    playerDisplayName,
    showLineupSnapshotStatus,
    setShowLineupSnapshotStatus,
    homeSnapshotRow,
    awaySnapshotRow,
    homeSupportsLineups,
    awaySupportsLineups,
    homeLineupRows,
    awayLineupRows,
    selectedHomeStarterIds,
    selectedAwayStarterIds,
    toggleHomeStarter,
    toggleAwayStarter,
    handleSaveHomeLineup,
    handleSaveAwayLineup,
    showHomeLineupCard,
    showAwayLineupCard,
    setShowHomeLineupCard,
    setShowAwayLineupCard,
    homeMinutesPlayedRows,
    awayMinutesPlayedRows,
    showHomeMinutesCard,
    showAwayMinutesCard,
    setShowHomeMinutesCard,
    setShowAwayMinutesCard,
    openPauseModal,
    startLivePeriod,
    undoLastEvent,
    showPauseModal,
    pauseNote,
    setPauseNote,
    closePauseModal,
    pauseClock,
    applyPauseReason,
  };
}
