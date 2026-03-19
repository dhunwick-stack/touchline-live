'use client';

import { useMemo, useState } from 'react';
import useLiveMatchPage from '@/components/live/useLiveMatchPage';
import type { MatchEvent, Player, TeamSide, TrackingMode } from '@/lib/types';

export type SidelineFlowType =
  | null
  | 'goal'
  | 'substitution'
  | 'yellow_card'
  | 'red_card'
  | 'undo'
  | 'end';

type LiveMatchController = ReturnType<typeof useLiveMatchPage>;

export default function useSidelineMode(live: LiveMatchController) {
  const [activeFlow, setActiveFlow] = useState<SidelineFlowType>(null);

  const canWrite = live.hasMatchAccess && !live.editingDisabled;

  const teamOptions = useMemo(
    () => [
      {
        side: 'home' as TeamSide,
        label: live.match?.home_team?.name || 'Home Team',
      },
      {
        side: 'away' as TeamSide,
        label: live.match?.away_team?.name || 'Away Team',
      },
    ],
    [live.match?.away_team?.name, live.match?.home_team?.name],
  );

  const recentEvents = useMemo(
    () => live.safeEvents.filter(Boolean).slice(0, 5),
    [live.safeEvents],
  );

  function getPlayersForSide(side: TeamSide) {
    return side === 'home' ? live.homePlayers : live.awayPlayers;
  }

  function getTrackingModeForSide(side: TeamSide): TrackingMode {
    if (!live.match) return 'basic';
    return side === 'home' ? live.match.home_tracking_mode : live.match.away_tracking_mode;
  }

  function getEffectiveStarterIdsForSide(side: TeamSide) {
    const players = side === 'home' ? live.homePlayers : live.awayPlayers;
    const selectedStarterIds =
      side === 'home' ? live.selectedHomeStarterIds : live.selectedAwayStarterIds;

    if (selectedStarterIds.length > 0) {
      return selectedStarterIds;
    }

    return players.slice(0, 11).map((player) => player.id);
  }

  function getOnFieldPlayersForSide(side: TeamSide) {
    const players = side === 'home' ? live.homePlayers : live.awayPlayers;
    const starters = getEffectiveStarterIdsForSide(side);
    const sideEvents = live.safeEvents.filter(
      (event) => event.team_side === side && event.event_type === 'substitution',
    );

    if ((side === 'home' ? live.match?.home_tracking_mode : live.match?.away_tracking_mode) !== 'full') {
      return players;
    }

    const activeIds = new Set(starters);

    sideEvents
      .slice()
      .reverse()
      .forEach((event) => {
        if (event.player_id) activeIds.delete(event.player_id);
        if (event.secondary_player_id) activeIds.add(event.secondary_player_id);
      });

    return players.filter((player) => activeIds.has(player.id));
  }

  function getBenchPlayersForSide(side: TeamSide) {
    const players = getPlayersForSide(side);
    const onFieldIds = new Set(getOnFieldPlayersForSide(side).map((player) => player.id));
    return players.filter((player) => !onFieldIds.has(player.id));
  }

  async function submitGoal(params: {
    side: TeamSide;
    playerId?: string;
    assistPlayerId?: string;
  }) {
    await live.addEvent({
      overrides: {
        type: 'goal',
        side: params.side,
        playerId: params.playerId || '',
        secondaryPlayerId: params.assistPlayerId || '',
        playerNameOverride: '',
        secondaryPlayerNameOverride: '',
        notes: '',
      },
      allowGoalWithoutPlayer: !params.playerId,
    });
    setActiveFlow(null);
  }

  async function submitCard(params: {
    type: 'yellow_card' | 'red_card';
    side: TeamSide;
    playerId?: string;
  }) {
    await live.addEvent({
      overrides: {
        type: params.type,
        side: params.side,
        playerId: params.playerId || '',
        secondaryPlayerId: '',
        playerNameOverride: '',
        secondaryPlayerNameOverride: '',
        notes: '',
      },
    });
    setActiveFlow(null);
  }

  async function submitSubstitution(params: {
    side: TeamSide;
    outgoingPlayerId: string;
    incomingPlayerId: string;
  }) {
    await live.addEvent({
      overrides: {
        type: 'substitution',
        side: params.side,
        playerId: params.outgoingPlayerId,
        secondaryPlayerId: params.incomingPlayerId,
        playerNameOverride: '',
        secondaryPlayerNameOverride: '',
        notes: '',
      },
    });
    setActiveFlow(null);
  }

  async function confirmUndo() {
    await live.undoLastEvent();
    setActiveFlow(null);
  }

  async function confirmEndMatch() {
    await live.addEvent({
      overrides: {
        type: 'full_time',
        side: 'home',
      },
    });
    setActiveFlow(null);
  }

  async function handlePrimaryClockAction() {
    if (!canWrite) return;

    if (live.match?.clock_running) {
      await live.pauseClock();
      return;
    }

    await live.startLivePeriod();
  }

  const primaryClockLabel = useMemo(() => {
    if (!live.match) return 'Start Match';
    if (live.match.clock_running) return 'Pause Match';
    if (live.match.status === 'live' || live.match.status === 'halftime') return 'Resume Match';
    return 'Start Match';
  }, [live.match]);

  return {
    activeFlow,
    setActiveFlow,
    canWrite,
    teamOptions,
    recentEvents,
    primaryClockLabel,
    getPlayersForSide,
    getTrackingModeForSide,
    getOnFieldPlayersForSide,
    getBenchPlayersForSide,
    submitGoal,
    submitCard,
    submitSubstitution,
    confirmUndo,
    confirmEndMatch,
    handlePrimaryClockAction,
  };
}
