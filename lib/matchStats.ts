// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import type { Match, MatchEvent, TeamSide } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type CalculateMinutesPlayedParams = {
  match: Match;
  events: MatchEvent[];
  playerId: string;
  teamSide: TeamSide;
  startingPlayerIds: string[];
};

// ---------------------------------------------------
// CALCULATE CURRENT MATCH MINUTE
// ---------------------------------------------------

function getCurrentMatchMinute(match: Match) {
  const baseSeconds = match.elapsed_seconds || 0;

  // ---------------------------------------------------
  // LIVE RUNNING CLOCK
  // ---------------------------------------------------

  if (match.clock_running && match.period_started_at) {
    const startedMs = new Date(match.period_started_at).getTime();
    const nowMs = Date.now();
    const extraSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
    return Math.floor((baseSeconds + extraSeconds) / 60);
  }

  // ---------------------------------------------------
  // PAUSED / HALFTIME / FINAL
  // ---------------------------------------------------

  return Math.floor(baseSeconds / 60);
}

// ---------------------------------------------------
// CALCULATE MINUTES PLAYED FOR A SINGLE PLAYER
// FILE: lib/matchStats.ts
// ---------------------------------------------------

export function calculateMinutesPlayed({
  match,
  events,
  playerId,
  teamSide,
  startingPlayerIds,
}: CalculateMinutesPlayedParams) {
  // ---------------------------------------------------
  // MATCH MUST EXIST
  // ---------------------------------------------------

  if (!match || !playerId) {
    return 0;
  }

  // ---------------------------------------------------
  // CURRENT MATCH MINUTE
  // ---------------------------------------------------

  const currentMinute = getCurrentMatchMinute(match);

  // ---------------------------------------------------
  // EVENTS IN CHRONOLOGICAL ORDER
  // ---------------------------------------------------

  const chronologicalEvents = [...events].reverse();

  // ---------------------------------------------------
  // STARTING STATE
  // ---------------------------------------------------

  let totalMinutes = 0;
  let isOnField = startingPlayerIds.includes(playerId);
  let currentStintStartMinute: number | null = isOnField ? 0 : null;

  // ---------------------------------------------------
  // APPLY SUBSTITUTIONS
  // player_id = outgoing player
  // secondary_player_id = incoming player
  // ---------------------------------------------------

  for (const event of chronologicalEvents) {
    if (event.team_side !== teamSide) continue;
    if (event.event_type !== 'substitution') continue;

    const minute = event.minute ?? 0;

    // ---------------------------------------------------
    // PLAYER SUBBED OFF
    // ---------------------------------------------------

    if (event.player_id === playerId && isOnField && currentStintStartMinute !== null) {
      totalMinutes += Math.max(0, minute - currentStintStartMinute);
      isOnField = false;
      currentStintStartMinute = null;
      continue;
    }

    // ---------------------------------------------------
    // PLAYER SUBBED ON
    // ---------------------------------------------------

    if (event.secondary_player_id === playerId && !isOnField) {
      isOnField = true;
      currentStintStartMinute = minute;
    }
  }

  // ---------------------------------------------------
  // STILL ON FIELD AT CURRENT MATCH TIME
  // ---------------------------------------------------

  if (isOnField && currentStintStartMinute !== null) {
    totalMinutes += Math.max(0, currentMinute - currentStintStartMinute);
  }

  return totalMinutes;
}