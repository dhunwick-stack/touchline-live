'use client';

import { useMemo, useState } from 'react';
import useLiveMatchPage from '@/components/live/useLiveMatchPage';
import type { MatchEvent, TeamSide } from '@/lib/types';

type LiveMatchController = ReturnType<typeof useLiveMatchPage>;

export default function useQuickEntryMode(live: LiveMatchController) {
  const [goalSide, setGoalSide] = useState<TeamSide | null>(null);
  const [showGoalFlow, setShowGoalFlow] = useState(false);

  const canWrite = live.hasMatchAccess && !live.editingDisabled;

  const recentGoals = useMemo(
    () =>
      live.safeEvents
        .filter((event): event is MatchEvent => event.event_type === 'goal')
        .slice(0, 5),
    [live.safeEvents],
  );

  function openGoalFlow(side: TeamSide) {
    if (!canWrite) return;
    setGoalSide(side);
    setShowGoalFlow(true);
  }

  function closeGoalFlow() {
    setGoalSide(null);
    setShowGoalFlow(false);
  }

  async function submitGoal(playerId?: string) {
    if (!goalSide) return;

    await live.addEvent({
      overrides: {
        type: 'goal',
        side: goalSide,
        playerId: playerId || '',
        secondaryPlayerId: '',
        playerNameOverride: '',
        secondaryPlayerNameOverride: '',
        notes: '',
      },
      allowGoalWithoutPlayer: true,
    });

    closeGoalFlow();
  }

  async function handlePrimaryClockAction() {
    if (!canWrite) return;

    if (live.match?.clock_running) {
      await live.pauseClock();
      return;
    }

    await live.startLivePeriod();
  }

  async function confirmEndMatch() {
    await live.addEvent({
      overrides: {
        type: 'full_time',
        side: 'home',
      },
    });
  }

  const primaryClockLabel = useMemo(() => {
    if (!live.match) return 'Start Match';
    if (live.match.clock_running) return 'Pause Match';
    if (live.match.status === 'live' || live.match.status === 'halftime') return 'Resume Match';
    return 'Start Match';
  }, [live.match]);

  const availablePlayers = useMemo(() => {
    if (!goalSide) return [];
    return goalSide === 'home' ? live.homePlayers : live.awayPlayers;
  }, [goalSide, live.awayPlayers, live.homePlayers]);

  return {
    canWrite,
    recentGoals,
    goalSide,
    showGoalFlow,
    setShowGoalFlow,
    openGoalFlow,
    closeGoalFlow,
    submitGoal,
    handlePrimaryClockAction,
    confirmEndMatch,
    primaryClockLabel,
    availablePlayers,
  };
}
