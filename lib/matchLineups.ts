// File: /lib/matchLineups.ts

import { supabase } from '@/lib/supabase';
import type { MatchLineup } from '@/lib/types';

// ---------------------------------------------------
// VALIDATE STARTING LINEUP COUNT
// ---------------------------------------------------

export function validateStartingLineupCount(playerIds: string[]) {
  return playerIds.length === 11;
}

// ---------------------------------------------------
// CREATE OR COMPLETE MATCH LINEUP SNAPSHOT
// ---------------------------------------------------

export async function createMatchLineupSnapshot(
  matchId: string,
  teamId: string,
): Promise<MatchLineup[]> {
  // ---------------------------------------------------
  // LOAD ACTIVE PLAYERS FOR TEAM
  // ---------------------------------------------------

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, first_name, last_name, jersey_number, active')
    .eq('team_id', teamId)
    .eq('active', true)
    .order('jersey_number', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true });

  if (playersError) {
    throw new Error(playersError.message || 'Failed to load active players.');
  }

  const activePlayers = players ?? [];

  // ---------------------------------------------------
  // LOAD EXISTING SNAPSHOT ROWS FOR THIS TEAM / MATCH
  // ---------------------------------------------------

  const { data: existingRows, error: existingError } = await supabase
    .from('match_lineups')
    .select('*')
    .eq('match_id', matchId)
    .eq('team_id', teamId);

  if (existingError) {
    throw new Error(existingError.message || 'Failed to load existing lineup snapshot.');
  }

  const existingLineups = (existingRows as MatchLineup[]) ?? [];
  const existingPlayerIds = new Set(existingLineups.map((row) => row.player_id));

  // ---------------------------------------------------
  // INSERT ONLY MISSING PLAYERS
  // ---------------------------------------------------

  const missingPlayers = activePlayers.filter((player) => !existingPlayerIds.has(player.id));

  if (missingPlayers.length > 0) {
    const startingOrder = existingLineups.length;

    const rowsToInsert = missingPlayers.map((player, index) => ({
      match_id: matchId,
      team_id: teamId,
      player_id: player.id,
      is_starter: false,
      is_available: true,
      lineup_order: startingOrder + index + 1,
      player_name_snapshot:
        [player.first_name, player.last_name].filter(Boolean).join(' ') || null,
      jersey_number_snapshot:
        player.jersey_number !== null && player.jersey_number !== undefined
          ? String(player.jersey_number)
          : null,
    }));

    const { error: insertError } = await supabase
      .from('match_lineups')
      .insert(rowsToInsert);

    if (insertError) {
      throw new Error(insertError.message || 'Failed to create lineup snapshot.');
    }
  }

  // ---------------------------------------------------
  // RETURN ACTUAL SAVED SNAPSHOT ROWS
  // ---------------------------------------------------

  const { data: finalRows, error: finalError } = await supabase
    .from('match_lineups')
    .select('*')
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .order('lineup_order', { ascending: true });

  if (finalError) {
    throw new Error(finalError.message || 'Failed to reload lineup snapshot.');
  }

  return (finalRows as MatchLineup[]) ?? [];
}

// ---------------------------------------------------
// SAVE STARTING LINEUP
// ---------------------------------------------------

export async function saveStartingLineup(
  matchId: string,
  teamId: string,
  starterPlayerIds: string[],
): Promise<void> {
  // ---------------------------------------------------
  // ENFORCE EXACTLY 11 STARTERS
  // ---------------------------------------------------

  if (!validateStartingLineupCount(starterPlayerIds)) {
    throw new Error('Starting lineup must contain exactly 11 players.');
  }

  // ---------------------------------------------------
  // ENSURE SNAPSHOT EXISTS FIRST
  // ---------------------------------------------------

  await createMatchLineupSnapshot(matchId, teamId);

  // ---------------------------------------------------
  // RESET ALL PLAYERS AS NON-STARTERS
  // ---------------------------------------------------

  const { error: resetError } = await supabase
    .from('match_lineups')
    .update({ is_starter: false })
    .eq('match_id', matchId)
    .eq('team_id', teamId);

  if (resetError) {
    throw new Error(resetError.message || 'Failed to reset starters.');
  }

  // ---------------------------------------------------
  // MARK SELECTED 11 AS STARTERS
  // ---------------------------------------------------

  const { error: starterError } = await supabase
    .from('match_lineups')
    .update({ is_starter: true })
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .in('player_id', starterPlayerIds);

  if (starterError) {
    throw new Error(starterError.message || 'Failed to save starters.');
  }
}