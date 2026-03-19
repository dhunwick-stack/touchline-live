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
import useLiveMatchPageActions from '@/components/live/useLiveMatchPageActions';
import useLiveMatchPageDerived from '@/components/live/useLiveMatchPageDerived';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { MatchEvent, MatchLineup, Player } from '@/lib/types';
import type { EventFormState, MatchRow } from '@/components/live/liveMatchPageShared';

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

  const {
    secondsElapsed,
    formattedClock,
    safeEvents,
    selectedTrackingMode,
    selectedTeamName,
    homeSupportsLineups,
    awaySupportsLineups,
    editingDisabled,
    lineupEditingDisabled,
    homeSnapshotRow,
    awaySnapshotRow,
    homeLineupRows,
    awayLineupRows,
    selectedOnFieldPlayers,
    selectedBenchPlayers,
    eventSelectablePlayers,
    eventSelectableSecondaryPlayers,
    homeMinutesPlayedRows,
    awayMinutesPlayedRows,
  } = useLiveMatchPageDerived({
    match,
    form,
    events,
    homePlayers,
    awayPlayers,
    homeLineups,
    awayLineups,
    selectedHomeStarterIds,
    selectedAwayStarterIds,
    nowMs,
  });

  const {
    resetForm,
    openPauseModal,
    closePauseModal,
    applyPauseReason,
    toggleHomeStarter,
    toggleAwayStarter,
    handleSaveHomeLineup,
    handleSaveAwayLineup,
    addEvent,
    startLivePeriod,
    pauseClock,
    undoLastEvent,
  } = useLiveMatchPageActions({
    match,
    setMatch,
    form,
    setForm,
    selectedTrackingMode,
    editingDisabled,
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
  });

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
