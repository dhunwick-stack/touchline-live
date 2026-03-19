'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import type { Match, MatchEvent, Player, Team } from '@/lib/types';

// ---------------------------------------------------
// SHARED TYPES
// FILE: components/public/publicMatchPageShared.ts
// ---------------------------------------------------

export type PublicMatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export type MatchLineupRow = {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  is_starter: boolean;
  is_available?: boolean;
  lineup_order?: number | null;
  player: Player | null;
};

export type TeamRecordSummary = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
};

// ---------------------------------------------------
// SHARED HELPERS
// ---------------------------------------------------

export function isRenderableMatchEvent(
  event: MatchEvent | null | undefined,
): event is MatchEvent {
  return Boolean(event && typeof event.event_type === 'string');
}

export function playerDisplayName(player: Player | undefined) {
  if (!player) return '';
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  return player.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
}

export function getStartersForSide({
  lineups,
  side,
  match,
}: {
  lineups: MatchLineupRow[];
  side: 'home' | 'away';
  match: PublicMatchRow;
}) {
  const sideTeamId = side === 'home' ? match.home_team_id : match.away_team_id;

  return lineups
    .filter((lineup) => lineup.team_id === sideTeamId && lineup.is_starter)
    .sort(sortLineupRows)
    .map((lineup) => lineup.player)
    .filter(Boolean) as Player[];
}

export function deriveCurrentOnField({
  side,
  lineups,
  events,
  roster,
  match,
}: {
  side: 'home' | 'away';
  lineups: MatchLineupRow[];
  events: MatchEvent[];
  roster: Player[];
  match: PublicMatchRow;
}) {
  const sideTeamId = side === 'home' ? match.home_team_id : match.away_team_id;

  const starters = lineups
    .filter((lineup) => lineup.team_id === sideTeamId && lineup.is_starter)
    .sort(sortLineupRows);

  if (starters.length === 0) return [];

  const onFieldIds = new Set<string>(
    starters.map((lineup) => lineup.player_id).filter(Boolean),
  );

  const chronologicalEvents = events.slice().reverse();

  for (const event of chronologicalEvents) {
    if (event.team_id !== sideTeamId || event.event_type !== 'substitution') continue;

    if (event.player_id) {
      onFieldIds.delete(event.player_id);
    }

    if (event.secondary_player_id) {
      onFieldIds.add(event.secondary_player_id);
    }
  }

  return roster
    .filter((player) => onFieldIds.has(player.id))
    .sort((a, b) => {
      const aNumber = a.jersey_number ?? 999;
      const bNumber = b.jersey_number ?? 999;

      if (aNumber !== bNumber) return aNumber - bNumber;

      const aName = [a.first_name, a.last_name].filter(Boolean).join(' ');
      const bName = [b.first_name, b.last_name].filter(Boolean).join(' ');

      return aName.localeCompare(bName);
    });
}

export function sortLineupRows(a: MatchLineupRow, b: MatchLineupRow) {
  const aOrder = a.lineup_order ?? 999;
  const bOrder = b.lineup_order ?? 999;

  if (aOrder !== bOrder) return aOrder - bOrder;

  const aNumber = a.player?.jersey_number ?? 999;
  const bNumber = b.player?.jersey_number ?? 999;

  if (aNumber !== bNumber) return aNumber - bNumber;

  const aName = [a.player?.first_name, a.player?.last_name].filter(Boolean).join(' ');
  const bName = [b.player?.first_name, b.player?.last_name].filter(Boolean).join(' ');

  return aName.localeCompare(bName);
}

export function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function getVenueName(match: PublicMatchRow) {
  return match.venue || match.home_team?.home_field_name || 'Venue TBD';
}

export function getVenueAddress(match: PublicMatchRow) {
  return match.home_team?.home_field_address || null;
}

export function getAppleMapsUrl(address: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

export function prettyStatus(status: Match['status']) {
  if (status === 'not_started') return 'Not Started';
  if (status === 'live') return 'Live';
  if (status === 'halftime') return 'Halftime';
  if (status === 'final') return 'Final';
  return status;
}

export function formatEventMinute(minute: number | null | undefined) {
  return Number.isFinite(minute) ? `${minute}'` : 'an unknown minute';
}

export function buildTeamRecordSummary(matches: Match[], teamId: string): TeamRecordSummary {
  let played = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const match of matches) {
    const isHome = match.home_team_id === teamId;
    const isAway = match.away_team_id === teamId;

    if (!isHome && !isAway) continue;

    const teamGoals = isHome ? match.home_score : match.away_score;
    const opponentGoals = isHome ? match.away_score : match.home_score;

    played += 1;

    if (teamGoals > opponentGoals) wins += 1;
    else if (teamGoals < opponentGoals) losses += 1;
    else draws += 1;
  }

  return { played, wins, losses, draws };
}

export function buildRecentForm(matches: Match[], teamId: string) {
  return matches
    .filter((match) => match.home_team_id === teamId || match.away_team_id === teamId)
    .slice(0, 5)
    .map((match) => {
      const isHome = match.home_team_id === teamId;
      const teamGoals = isHome ? match.home_score : match.away_score;
      const opponentGoals = isHome ? match.away_score : match.home_score;

      if (teamGoals > opponentGoals) return 'W';
      if (teamGoals < opponentGoals) return 'L';
      return 'D';
    });
}

export function formatTeamRecord(summary: TeamRecordSummary | null | undefined) {
  if (!summary) return 'Record unavailable';
  return `${summary.wins}-${summary.losses}-${summary.draws}`;
}
