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
  teamId: string,
): Promise<MatchLineup[]> {
  // ---------------------------------------------------
  // LOAD ACTIVE PLAYERS
  // ---------------------------------------------------

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, first_name, last_name, jersey_number, active')
    .eq('team_id', teamId)
    .eq('active', true)
    .order('jersey_number', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true });

  if (playersError) {
    throw new Error(`Could not load active players: ${playersError.message}`);
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
    .select('*')
    .eq('match_id', matchId)
    .eq('team_id', teamId);

  if (existingError) {
    throw new Error(`Could not check existing lineup snapshot: ${existingError.message}`);
  }

  if ((existingRows ?? []).length > 0) {
    return (existingRows ?? []) as MatchLineup[];
  }

  // ---------------------------------------------------
  // RETURN EARLY IF NO PLAYERS
  // ---------------------------------------------------

  if (safePlayers.length === 0) {
    return [];
  }

  // ---------------------------------------------------
  // BUILD SNAPSHOT ROWS USING ONLY CONFIRMED COLUMNS
  // ---------------------------------------------------

  const lineupRows = safePlayers.map((player) => ({
    match_id: matchId,
    team_id: teamId,
    player_id: player.id,
    is_starter: false,
  }));

  // ---------------------------------------------------
  // INSERT SNAPSHOT
  // ---------------------------------------------------

  const { data: insertedRows, error: insertError } = await supabase
    .from('match_lineups')
    .insert(lineupRows)
    .select('*');

  if (insertError) {
    throw new Error(`Could not insert lineup snapshot: ${insertError.message}`);
  }

  return (insertedRows ?? []) as MatchLineup[];
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
    .update({
      is_starter: false,
    })
    .eq('match_id', matchId)
    .eq('team_id', teamId);

  if (resetError) {
    throw new Error(`Could not reset lineup starters: ${resetError.message}`);
  }

  // ---------------------------------------------------
  // MARK SELECTED PLAYERS AS STARTERS
  // ---------------------------------------------------

  const { error: starterError } = await supabase
    .from('match_lineups')
    .update({
      is_starter: true,
    })
    .eq('match_id', matchId)
    .eq('team_id', teamId)
    .in('player_id', starterPlayerIds);

  if (starterError) {
    throw new Error(`Could not save starting lineup: ${starterError.message}`);
  }
}

// ---------------------------------------------------
// VALIDATE STARTING LINEUP COUNT
// ---------------------------------------------------

export function validateStartingLineupCount(playerIds: string[]): boolean {
  return playerIds.length === 11;
}