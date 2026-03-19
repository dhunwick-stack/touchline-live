'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import type {
  EventType,
  Match,
  MatchLineup,
  Player,
  Team,
  TeamSide,
  TrackingMode,
} from '@/lib/types';

// ---------------------------------------------------
// SHARED TYPES
// FILE: components/live/liveMatchPageShared.ts
// ---------------------------------------------------

export type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export type EventFormState = {
  type: EventType;
  side: TeamSide;
  playerId: string;
  secondaryPlayerId: string;
  playerNameOverride: string;
  secondaryPlayerNameOverride: string;
  notes: string;
};

export type SnapshotStatusRow = {
  teamName: string;
  modeLabel: string;
  playersSnappedLabel: string;
  startersSelectedLabel: string | null;
};

export type EventTypeOption = {
  value: EventType;
  label: string;
};

export type LineupRow = {
  row: MatchLineup;
  player: Player | undefined;
};

export type MinutesPlayedRow = {
  player: Player;
  minutes: number;
};

// ---------------------------------------------------
// SHARED CONSTANTS
// ---------------------------------------------------

export const eventTypeOptions: EventTypeOption[] = [
  { value: 'goal', label: 'Goal' },
  { value: 'yellow_card', label: 'Yellow Card' },
  { value: 'red_card', label: 'Red Card' },
  { value: 'substitution', label: 'Substitution' },
  { value: 'half_end', label: 'Halftime' },
  { value: 'full_time', label: 'Full Time' },
];

// ---------------------------------------------------
// SHARED HELPERS
// ---------------------------------------------------

export function buildFallbackLineupRows(
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

export function playerDisplayName(player: Player | undefined) {
  if (!player) return '';
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  return player?.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
}

export function supportsLineups(mode: TrackingMode | null | undefined) {
  return mode === 'lineups' || mode === 'full';
}
