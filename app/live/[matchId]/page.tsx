'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import StartingLineupSelector from '@/components/live/StartingLineupSelector';
import LiveTimeline from '@/components/live/LiveTimeline';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Pause,
  Play,
  RotateCcw,
  Square,
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

// ---------------------------------------------------
// PAGE
// ---------------------------------------------------

export default function LiveMatchPage() {
  // ---------------------------------------------------
  // ROUTE PARAMS
  // ---------------------------------------------------

  const params = useParams();
  const router = useRouter();

  const matchId =
    typeof params?.matchId === 'string'
      ? params.matchId
      : Array.isArray(params?.matchId)
        ? params.matchId[0]
        : '';

  // ---------------------------------------------------
  // ACCESS / PAGE STATE
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // COLLAPSIBLE STATE
  // ---------------------------------------------------

  const [showOnFieldState, setShowOnFieldState] = useState(true);
  const [showLineupSnapshotStatus, setShowLineupSnapshotStatus] = useState(true);
  const [showHomeLineupCard, setShowHomeLineupCard] = useState(true);
  const [showAwayLineupCard, setShowAwayLineupCard] = useState(true);

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
  // INITIAL LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!matchId) return;

    async function loadMatchPage() {
      // ---------------------------------------------------
      // RESET STATE
      // ---------------------------------------------------

      setLoading(true);
      setError(null);
      setLineupNotice(null);
      setAuthChecked(false);
      setHasMatchAccess(false);
      setLoadingLineups(false);

      // ---------------------------------------------------
      // LOAD MATCH
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

      if (matchError || !matchData) {
        setError(matchError?.message || 'Failed to load match.');
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      const loadedMatch = matchData as MatchRow;

      // ---------------------------------------------------
      // CHECK SESSION
      // ---------------------------------------------------

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

      // ---------------------------------------------------
      // CHECK TEAM ACCESS
      // ---------------------------------------------------

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

      // ---------------------------------------------------
      // LOAD EVENTS
      // ---------------------------------------------------

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

      setEvents((eventData as MatchEvent[]) ?? []);

      // ---------------------------------------------------
      // LOAD PLAYERS
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

      // ---------------------------------------------------
      // LOAD LINEUP SNAPSHOTS
      // ---------------------------------------------------

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

        const homeNeedsLineups =
          loadedMatch.home_tracking_mode === 'lineups' ||
          loadedMatch.home_tracking_mode === 'full';

        const awayNeedsLineups =
          loadedMatch.away_tracking_mode === 'lineups' ||
          loadedMatch.away_tracking_mode === 'full';

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

        const homeNeedsLineups =
          loadedMatch.home_tracking_mode === 'lineups' ||
          loadedMatch.home_tracking_mode === 'full';

        const awayNeedsLineups =
          loadedMatch.away_tracking_mode === 'lineups' ||
          loadedMatch.away_tracking_mode === 'full';

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

    loadMatchPage();
  }, [matchId, router]);

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
  // DERIVED CLOCK
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
  // DERIVED MATCH / MODE STATE
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

  // ---------------------------------------------------
  // DERIVED ON-FIELD / BENCH STATE
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
        if (event.player_id) {
          activeIds.delete(event.player_id);
        }

        if (event.secondary_player_id) {
          activeIds.add(event.secondary_player_id);
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
        if (event.player_id) {
          activeIds.delete(event.player_id);
        }

        if (event.secondary_player_id) {
          activeIds.add(event.secondary_player_id);
        }
      });

    return activeIds;
  }, [events, awayPlayers, match?.away_tracking_mode, selectedAwayStarterIds]);

  // ---------------------------------------------------
  // DERIVED LINEUP ROWS
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // DERIVED PLAYER POOLS
  // ---------------------------------------------------

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
            period_started_at: nextClockRunning ? prev.period_started_at : null,
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

    if (latest.event_type === 'full_time' || latest.event_type === 'half_end') {
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

  if (loading || !authChecked || !hasMatchAccess) {
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
      {/* --------------------------------------------------- */}
      {/* MATCH HEADER */}
      {/* --------------------------------------------------- */}

      <MatchHeader
        match={match}
        formattedClock={formattedClock}
        mode="admin"
        theme="team"
        actions={
          <>
            {(match.status === 'not_started' ||
  match.status === 'scheduled' ||
  match.status === 'halftime') && (
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
        {/* --------------------------------------------------- */}
        {/* LEFT COLUMN */}
        {/* --------------------------------------------------- */}

        <div className="space-y-6">
          {/* --------------------------------------------------- */}
          {/* EVENT ENTRY CARD */}
          {/* --------------------------------------------------- */}

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
              {/* --------------------------------------------------- */}
              {/* TEAM SIDE */}
              {/* --------------------------------------------------- */}

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

              {/* --------------------------------------------------- */}
              {/* TRACKING MODE */}
              {/* --------------------------------------------------- */}

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

              {/* --------------------------------------------------- */}
              {/* EVENT TYPE */}
              {/* --------------------------------------------------- */}

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

              {/* --------------------------------------------------- */}
              {/* BASIC / LINEUPS EVENT ENTRY */}
              {/* --------------------------------------------------- */}

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

              {/* --------------------------------------------------- */}
              {/* FULL MODE EVENT ENTRY */}
              {/* --------------------------------------------------- */}

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

              {/* --------------------------------------------------- */}
              {/* FULL MODE ON-FIELD STATE */}
              {/* --------------------------------------------------- */}

              {selectedTrackingMode === 'full' && form.type === 'substitution' && (
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowOnFieldState((prev) => !prev)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Current on-field state
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Expand to review active players and bench players.
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {showOnFieldState ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Show
                        </>
                      )}
                    </span>
                  </button>

                  {showOnFieldState ? (
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
                  ) : null}
                </div>
              )}

              {/* --------------------------------------------------- */}
              {/* NOTES */}
              {/* --------------------------------------------------- */}

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

          {/* --------------------------------------------------- */}
          {/* LINEUP SNAPSHOT STATUS */}
          {/* --------------------------------------------------- */}

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Lineup Snapshot Status</h2>
                <p className="text-sm text-slate-600">
                  Match-day roster snapshots load automatically for teams using lineups or full
                  tracking.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {loadingLineups ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                    Loading...
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                    Ready
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setShowLineupSnapshotStatus((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
                >
                  {showLineupSnapshotStatus ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show
                    </>
                  )}
                </button>
              </div>
            </div>

            {showLineupSnapshotStatus ? (
              <div className="mt-4 space-y-3">
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
                        <p className="text-xs text-slate-500">
                          {homeStarterCount} starters selected
                        </p>
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
                        <p className="text-xs text-slate-500">
                          {awayStarterCount} starters selected
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* --------------------------------------------------- */}
          {/* HOME LINEUP CARD */}
          {/* --------------------------------------------------- */}

          {homeSupportsLineups && (
            <StartingLineupSelector
              title={match.home_team?.name || 'Home Team'}
              subtitle="Choose exactly 11 starters."
              rows={homeLineupRows}
              selectedStarterIds={selectedHomeStarterIds}
              onToggleStarter={toggleHomeStarter}
              onSave={handleSaveHomeLineup}
              saving={savingHomeLineup}
              loading={loadingLineups}
              accent="home"
              disabled={lineupEditingDisabled}
              open={showHomeLineupCard}
              onToggleOpen={() => setShowHomeLineupCard((prev) => !prev)}
              playerDisplayName={playerDisplayName}
            />
          )}

          {/* --------------------------------------------------- */}
          {/* AWAY LINEUP CARD */}
          {/* --------------------------------------------------- */}

          {awaySupportsLineups && (
            <StartingLineupSelector
              title={match.away_team?.name || 'Away Team'}
              subtitle="Choose exactly 11 starters."
              rows={awayLineupRows}
              selectedStarterIds={selectedAwayStarterIds}
              onToggleStarter={toggleAwayStarter}
              onSave={handleSaveAwayLineup}
              saving={savingAwayLineup}
              loading={loadingLineups}
              accent="away"
              disabled={lineupEditingDisabled}
              open={showAwayLineupCard}
              onToggleOpen={() => setShowAwayLineupCard((prev) => !prev)}
              playerDisplayName={playerDisplayName}
            />
          )}

          {/* --------------------------------------------------- */}
          {/* MATCH ACTIONS */}
          {/* --------------------------------------------------- */}

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

        {/* --------------------------------------------------- */}
        {/* RIGHT COLUMN */}
        {/* --------------------------------------------------- */}

        <LiveTimeline
          events={events}
          match={match}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
        />
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
                <span>
                  {match.status === 'not_started'
                    ? 'Start'
                    : match.status === 'halftime'
                      ? 'Start 2nd Half'
                      : 'Resume'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------
// FALLBACK LINEUP ROW BUILDER
// ---------------------------------------------------

function buildFallbackLineupRows(
  matchId: string,
  teamId: string | null | undefined,
  players: Player[],
): MatchLineup[] {
  if (!teamId) return [];

  const now = new Date().toISOString();

  return players.map((player): MatchLineup => ({
    id: `fallback-${matchId}-${teamId}-${player.id}`,
    match_id: matchId,
    team_id: teamId,
    player_id: player.id,
    is_starter: false,
    is_available: true,
    player_name_snapshot:
      [player.first_name, player.last_name].filter(Boolean).join(' ') || null,
    jersey_number_snapshot:
      player.jersey_number !== null && player.jersey_number !== undefined
        ? String(player.jersey_number)
        : null,
    created_at: now,
    updated_at: now,
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