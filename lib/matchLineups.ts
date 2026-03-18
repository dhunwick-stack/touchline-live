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
// CREATE MATCH LINEUP SNAPSHOT
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
  // REMOVE EXISTING SNAPSHOT ROWS FOR THIS TEAM / MATCH
  // ---------------------------------------------------

  const { error: deleteError } = await supabase
    .from('match_lineups')
    .delete()
    .eq('match_id', matchId)
    .eq('team_id', teamId);

  if (deleteError) {
    throw new Error(deleteError.message || 'Failed to clear existing lineup snapshot.');
  }

  // ---------------------------------------------------
  // INSERT FRESH SNAPSHOT ROWS
  // ---------------------------------------------------

  if (activePlayers.length === 0) {
    return [];
  }

  const snapshotRows = activePlayers.map((player, index) => ({
    match_id: matchId,
    team_id: teamId,
    player_id: player.id,
    is_starter: false,
    is_available: true,
    lineup_order: index + 1,
    player_name_snapshot:
      [player.first_name, player.last_name].filter(Boolean).join(' ') || null,
    jersey_number_snapshot:
      player.jersey_number !== null && player.jersey_number !== undefined
        ? String(player.jersey_number)
        : null,
  }));

  const { data: insertedRows, error: insertError } = await supabase
    .from('match_lineups')
    .insert(snapshotRows)
    .select('*');

  if (insertError) {
    throw new Error(insertError.message || 'Failed to create lineup snapshot.');
  }

  return (insertedRows as MatchLineup[]) ?? [];
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
  // ALWAYS REBUILD FULL SNAPSHOT FIRST
  // ---------------------------------------------------

  await createMatchLineupSnapshot(matchId, teamId);

  // ---------------------------------------------------
  // MARK ALL PLAYERS AS NON-STARTERS
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
