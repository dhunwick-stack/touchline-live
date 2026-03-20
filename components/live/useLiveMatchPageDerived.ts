'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { calculateMinutesPlayed } from '@/lib/matchStats';
import { playerDisplayName, supportsLineups } from '@/components/live/liveMatchPageShared';
import { useMemo } from 'react';
import type { MatchEvent, MatchLineup, Player, TrackingMode } from '@/lib/types';
import type {
  EventFormState,
  MatchRow,
  MinutesPlayedRow,
  SnapshotStatusRow,
} from '@/components/live/liveMatchPageShared';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type UseLiveMatchPageDerivedParams = {
  match: MatchRow | null;
  form: EventFormState;
  events: MatchEvent[];
  homePlayers: Player[];
  awayPlayers: Player[];
  homeLineups: MatchLineup[];
  awayLineups: MatchLineup[];
  selectedHomeStarterIds: string[];
  selectedAwayStarterIds: string[];
  nowMs: number;
};

// ---------------------------------------------------
// HOOK
// FILE: components/live/useLiveMatchPageDerived.ts
// ---------------------------------------------------

export default function useLiveMatchPageDerived({
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
}: UseLiveMatchPageDerivedParams) {
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

  const effectiveHomeStarterIds = useMemo(() => {
    if (selectedHomeStarterIds.length > 0) {
      return selectedHomeStarterIds;
    }

    return homePlayers.slice(0, 11).map((player) => player.id);
  }, [homePlayers, selectedHomeStarterIds]);

  const effectiveAwayStarterIds = useMemo(() => {
    if (selectedAwayStarterIds.length > 0) {
      return selectedAwayStarterIds;
    }

    return awayPlayers.slice(0, 11).map((player) => player.id);
  }, [awayPlayers, selectedAwayStarterIds]);

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

    const activeIds = new Set(effectiveHomeStarterIds);

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
  }, [effectiveHomeStarterIds, safeEvents, homePlayers, match?.home_tracking_mode]);

  const awayActivePlayerIds = useMemo(() => {
    if (match?.away_tracking_mode !== 'full') {
      return new Set(awayPlayers.map((player) => player.id));
    }

    const activeIds = new Set(effectiveAwayStarterIds);

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
  }, [effectiveAwayStarterIds, safeEvents, awayPlayers, match?.away_tracking_mode]);

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

  const homeMinutesPlayedRows = useMemo<MinutesPlayedRow[]>(() => {
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
          startingPlayerIds: effectiveHomeStarterIds,
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
  }, [effectiveHomeStarterIds, safeEvents, homePlayers, match]);

  const awayMinutesPlayedRows = useMemo<MinutesPlayedRow[]>(() => {
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
          startingPlayerIds: effectiveAwayStarterIds,
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
  }, [awayPlayers, effectiveAwayStarterIds, safeEvents, match]);

  return {
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
  };
}
