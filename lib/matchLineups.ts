// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { supabase } from '@/lib/supabase';
import type { MatchLineup, Player } from '@/lib/types';

// ---------------------------------------------------
// SNAPSHOT TEAM ROSTER INTO MATCH LINEUPS
// ---------------------------------------------------

export async function createMatchLineupSnapshot(
  matchId: string,
  teamId: string
): Promise<MatchLineup[]> {
  // ---------------------------------------------------
  // LOAD ACTIVE PLAYERS FOR THE TEAM
  // ---------------------------------------------------

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, first_name, last_name, jersey_number, active')
    .eq('team_id', teamId)
    .eq('active', true)
    .order('jersey_number', { ascending: true });

  if (playersError) {
    throw playersError;
  }

  const safePlayers = (players ?? []) as Pick<
    Player,
    'id' | 'first_name' | 'last_name' | 'jersey_number'
  >[];

  // ---------------------------------------------------
  // CHECK FOR EXISTING SNAPSHOT
  // ---------------------------------------------------

  const { data: existingRows, error: existingError } = await supabase
    .from('match_lineups')
    .select('id')
    .eq('match_id', matchId)
    .eq('team_id', teamId);

  if (existingError) {
    throw existingError;
  }

  if ((existingRows ?? []).length > 0) {
    const { data: currentRows, error: currentError } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('match_id', matchId)
      .eq('team_id', teamId)
      .order('jersey_number_snapshot', { ascending: true });

    if (currentError) {
      throw currentError;
    }

    return (currentRows ?? []) as MatchLineup[];
  }

  // ---------------------------------------------------
  // BUILD SNAPSHOT ROWS
  // ---------------------------------------------------

  const lineupRows = safePlayers.map((player) => ({
    match_id: matchId,
    team_id: teamId,
    player_id: player.id,
    is_starter: false,
    is_available: true,
    player_name_snapshot: [player.first_name, player.last_name]
      .filter(Boolean)
      .join(' ')
      .trim(),
    jersey_number_snapshot:
      player.jersey_number !== null && player.jersey_number !== undefined
        ? String(player.jersey_number)
        : null,
  }));

  // ---------------------------------------------------
  // PREVENT EMPTY SNAPSHOT INSERTS
  // ---------------------------------------------------

  if (lineupRows.length === 0) {
    return [];
  }

  // ---------------------------------------------------
  // INSERT SNAPSHOT
  // ---------------------------------------------------

  const { data: insertedRows, error: insertError } = await supabase
    .from('match_lineups')
    .insert(lineupRows)
    .select('*');

  if (insertError) {
    throw insertError;
  }

  return (insertedRows ?? []) as MatchLineup[];
}

// ---------------------------------------------------
// SAVE STARTING LINEUP
// ---------------------------------------------------

export async function saveStartingLineup(
  matchId: string,
  teamId: string,
  starterPlayerIds: string[]
): Promise<void> {
  // ---------------------------------------------------
  // VALIDATE STARTER COUNT
  // ---------------------------------------------------

  if (!validateStartingLineupCount(starterPlayerIds)) {
    throw new Error('Starting lineup must contain exactly 11 players.');
  }

  // ---------------------------------------------------
  // RESET ALL PLAYERS TO NON-STARTERS
  // ---------------------------------------------------

  const { error: resetError } = await supabase
    .from('match_lineups')
    .update({ is_starter: false })
    .eq('match_id', matchId)
    .eq('team_id', teamId);

  if (resetError) {
    throw resetError;
  }

  // ---------------------------------------------------
  // MARK SELECTED PLAYERS AS STARTERS
  // ---------------------------------------------------

  const { error: starterError } = await supabase
    .from('match_lineups')
    .update({ is_starter: true })
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .in('player_id', starterPlayerIds);

  if (starterError) {
    throw starterError;
  }
}

// ---------------------------------------------------
// VALIDATE STARTING LINEUP COUNT
// ---------------------------------------------------

export function validateStartingLineupCount(playerIds: string[]): boolean {
  return playerIds.length === 11;
}