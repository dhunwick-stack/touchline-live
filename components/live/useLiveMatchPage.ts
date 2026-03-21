'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { supabase } from '@/lib/supabase';
import {
  buildFallbackLineupRows,
  playerDisplayName,
  supportsLineups,
} from '@/components/live/liveMatchPageShared';
import useLiveMatchPageActions from '@/components/live/useLiveMatchPageActions';
import useLiveMatchPageDerived from '@/components/live/useLiveMatchPageDerived';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
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
  const autoCollapsedStartedCardsRef = useRef<Set<string>>(new Set());

  const [form, setForm] = useState<EventFormState>({
    type: 'goal',
    side: 'home',
    playerId: '',
    secondaryPlayerId: '',
    playerNameOverride: '',
    secondaryPlayerNameOverride: '',
    notes: '',
  });

  const refreshLiveState = useCallback(async (currentMatchId: string) => {
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:home_team_id (*),
        away_team:away_team_id (*)
      `)
      .eq('id', currentMatchId)
      .single();

    if (matchError || !matchData) {
      throw new Error(matchError?.message || 'Failed to refresh match.');
    }

    const refreshedMatch = matchData as MatchRow;

    const { data: eventData, error: eventError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', refreshedMatch.id)
      .order('created_at', { ascending: false });

    if (eventError) {
      throw new Error(eventError.message || 'Failed to refresh events.');
    }

    const homePlayersResult = refreshedMatch.home_team_id
      ? await supabase
          .from('players')
          .select('*')
          .eq('team_id', refreshedMatch.home_team_id)
          .eq('active', true)
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true })
      : { data: [], error: null };

    const awayPlayersResult = refreshedMatch.away_team_id
      ? await supabase
          .from('players')
          .select('*')
          .eq('team_id', refreshedMatch.away_team_id)
          .eq('active', true)
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true })
      : { data: [], error: null };

    if (homePlayersResult.error || awayPlayersResult.error) {
      throw new Error(
        homePlayersResult.error?.message ||
          awayPlayersResult.error?.message ||
          'Failed to refresh players.',
      );
    }

    const resolvedHomePlayers = (homePlayersResult.data as Player[]) ?? [];
    const resolvedAwayPlayers = (awayPlayersResult.data as Player[]) ?? [];

    const { data: lineupData, error: lineupError } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('match_id', refreshedMatch.id);

    if (lineupError) {
      throw new Error(lineupError.message || 'Failed to refresh lineups.');
    }

    const allLineups = (lineupData as MatchLineup[]) ?? [];
    const homeNeedsLineups = supportsLineups(refreshedMatch.home_tracking_mode);
    const awayNeedsLineups = supportsLineups(refreshedMatch.away_tracking_mode);

    const realHomeLineups = allLineups.filter(
      (lineup) => lineup.team_id === refreshedMatch.home_team_id,
    );
    const realAwayLineups = allLineups.filter(
      (lineup) => lineup.team_id === refreshedMatch.away_team_id,
    );

    const resolvedHomeLineups = homeNeedsLineups
      ? realHomeLineups.length > 0
        ? realHomeLineups
        : buildFallbackLineupRows(
            refreshedMatch.id,
            refreshedMatch.home_team_id,
            resolvedHomePlayers,
          )
      : [];

    const resolvedAwayLineups = awayNeedsLineups
      ? realAwayLineups.length > 0
        ? realAwayLineups
        : buildFallbackLineupRows(
            refreshedMatch.id,
            refreshedMatch.away_team_id,
            resolvedAwayPlayers,
          )
      : [];

    setMatch(refreshedMatch);
    setEvents(((eventData as MatchEvent[]) ?? []).filter(Boolean));
    setHomePlayers(resolvedHomePlayers);
    setAwayPlayers(resolvedAwayPlayers);
    setHomeLineups(resolvedHomeLineups);
    setAwayLineups(resolvedAwayLineups);
    setSelectedHomeStarterIds(
      resolvedHomeLineups.filter((row) => row.is_starter).map((row) => row.player_id),
    );
    setSelectedAwayStarterIds(
      resolvedAwayLineups.filter((row) => row.is_starter).map((row) => row.player_id),
    );
    setConnectionNotice(null);

    const homeIsMissingRequiredSnapshot = homeNeedsLineups && realHomeLineups.length === 0;
    const awayIsMissingRequiredSnapshot = awayNeedsLineups && realAwayLineups.length === 0;

    setLineupNotice(
      homeIsMissingRequiredSnapshot || awayIsMissingRequiredSnapshot
        ? 'Using roster fallback where saved lineup snapshots were not found.'
        : null,
    );
  }, []);

  const loadMatchPage = useCallback(async (options?: {
    preserveAccessState?: boolean;
    backgroundRefresh?: boolean;
  }) => {
    if (!matchId) return;

    if (!options?.backgroundRefresh) {
      setLoading(true);
    }
    setError(null);
    setLineupNotice(null);
    if (!options?.preserveAccessState) {
      setAuthChecked(false);
      setHasMatchAccess(false);
    }
    if (!options?.backgroundRefresh) {
      setLoadingLineups(false);
    }

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
      if (!options?.backgroundRefresh) {
        setLoading(false);
      }
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
      if (!options?.backgroundRefresh) {
        setLoading(false);
      }
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
      if (!options?.backgroundRefresh) {
        setLoading(false);
      }
      setAuthChecked(true);
      return;
    }

    const [
      { data: superAdmin, error: superAdminError },
      { data: memberships, error: membershipError },
    ] = await Promise.all([
      supabase
        .from('super_admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('team_users')
        .select('team_id')
        .eq('user_id', user.id)
        .in('team_id', eligibleTeamIds),
    ]);

    if (superAdminError || membershipError) {
      setError(
        superAdminError?.message ||
          membershipError?.message ||
          'Failed to verify match access.',
      );
      if (!options?.backgroundRefresh) {
        setLoading(false);
      }
      setAuthChecked(true);
      return;
    }

    if (!superAdmin && (!memberships || memberships.length === 0)) {
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
      if (!options?.backgroundRefresh) {
        setLoading(false);
      }
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

    if (!options?.backgroundRefresh) {
      setLoading(false);
    }
    setConnectionNotice(null);
  }, [matchId, router]);

  useEffect(() => {
    if (!matchId) return;
    void loadMatchPage();
  }, [loadMatchPage, matchId]);

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
          try {
            await refreshLiveState(match.id);
          } catch (refreshError) {
            setConnectionNotice('Live updates delayed. Reconnecting...');
            setError(
              refreshError instanceof Error
                ? refreshError.message
                : 'Realtime refresh failed.',
            );
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
            await refreshLiveState(match.id);
          } catch (refreshError) {
            setConnectionNotice('Live updates delayed. Reconnecting...');
            setError(
              refreshError instanceof Error
                ? refreshError.message
                : 'Realtime refresh failed.',
            );
          }
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
          try {
            await refreshLiveState(match.id);
          } catch (refreshError) {
            setConnectionNotice('Live updates delayed. Reconnecting...');
            setError(
              refreshError instanceof Error
                ? refreshError.message
                : 'Realtime refresh failed.',
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasMatchAccess, match?.id, refreshLiveState]);

  useEffect(() => {
    if (!match?.clock_running) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [match?.clock_running]);

  useEffect(() => {
    if (!match?.id) return;

    const hasStarted = ['live', 'halftime', 'final'].includes(match.status);

    if (!hasStarted || autoCollapsedStartedCardsRef.current.has(match.id)) {
      return;
    }

    setShowHomeLineupCard(false);
    setShowAwayLineupCard(false);
    setShowHomeMinutesCard(false);
    setShowAwayMinutesCard(false);
    autoCollapsedStartedCardsRef.current.add(match.id);
  }, [match?.id, match?.status]);

  useEffect(() => {
    if (!match?.id) return;
    if (match.status !== 'live' && match.status !== 'halftime') return;

    let cancelled = false;

    const poller = window.setInterval(async () => {
      if (document.visibilityState === 'hidden') return;

      try {
        await refreshLiveState(match.id);
      } catch (pollError) {
        if (!cancelled) {
          setConnectionNotice('Live updates delayed. Reconnecting...');
          setError(
            pollError instanceof Error ? pollError.message : 'Background refresh failed.',
          );
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [match?.id, match?.status, refreshLiveState]);

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

  const currentGameMinute = Math.max(0, Math.floor(secondsElapsed / 60));

  const {
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
    addSubstitutionBatch,
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
    homePlayers,
    awayPlayers,
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
    connectionNotice,
    formattedClock,
    currentGameMinute,
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
    addSubstitutionBatch,
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
    usePreviousHomeLineup,
    usePreviousAwayLineup,
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
