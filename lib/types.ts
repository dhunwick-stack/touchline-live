// ---------------------------------------------------
// MATCH TRACKING MODES
// ---------------------------------------------------

export type TrackingMode = 'basic' | 'lineups' | 'full';

// ---------------------------------------------------
// MATCH STATUS
// ---------------------------------------------------

export type MatchStatus =
  | 'not_started'
  | 'scheduled'
  | 'live'
  | 'halftime'
  | 'final'
  | 'cancelled'
  | 'postponed';

// ---------------------------------------------------
// TEAM SIDE
// ---------------------------------------------------

export type TeamSide = 'home' | 'away';

// ---------------------------------------------------
// MATCH EVENT TYPES
// ---------------------------------------------------

export type EventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'substitution'
  | 'half_start'
  | 'match_resumed'
  | 'match_paused'
  | 'half_end'
  | 'full_time';

// ---------------------------------------------------
// ORGANIZATION TYPES
// ---------------------------------------------------

export type OrganizationType =
  | 'club'
  | 'school'
  | 'academy'
  | 'rec_program'
  | 'league_program'
  | 'other';

// ---------------------------------------------------
// ORGANIZATION
// ---------------------------------------------------

export type Organization = {
  id: string;
  name: string;
  slug: string;
  organization_type: string;
  short_name?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  website_url?: string | null;
  city?: string | null;
  state?: string | null;
  description?: string | null;
  created_at: string;
  is_public: boolean;
};

// ---------------------------------------------------
// SEASON
// ---------------------------------------------------

export type Season = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

// ---------------------------------------------------
// TEAM
// ---------------------------------------------------

export type Team = {
  id: string;
  name: string;
  club_name?: string | null;
  nickname?: string | null;
  age_group?: string | null;
  logo_url?: string | null;
  home_field_name?: string | null;
  home_field_address?: string | null;
  admin_code?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  banner_url?: string | null;
  created_at?: string | null;
  home_field_lat?: number | null;
  home_field_lng?: number | null;

  // ---------------------------------------------------
  // ORGANIZATION RELATION FIELDS
  // ---------------------------------------------------

  organization_id?: string | null;
  team_level?: string | null;
  gender?: string | null;
  team_slug?: string | null;
  organization?: Organization | null;

  // ---------------------------------------------------
  // MATCH ENGINE DEFAULTS
  // ---------------------------------------------------

  match_tracking_mode: TrackingMode;
};

// ---------------------------------------------------
// PLAYER
// ---------------------------------------------------

export type Player = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string | null;
  jersey_number: number | null;
  position: string | null;
  school_year?: string | null;
  height?: string | null;
  weight?: string | null;
  active: boolean;
  created_at: string;
};

// ---------------------------------------------------
// MATCH
// ---------------------------------------------------

export type Match = {
  id: string;
  season_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;

  // ---------------------------------------------------
  // TEAM TRACKING SNAPSHOTS
  // ---------------------------------------------------

  home_tracking_mode: TrackingMode;
  away_tracking_mode: TrackingMode;

  // ---------------------------------------------------
  // MATCH DETAILS
  // ---------------------------------------------------

  match_date: string | null;
  venue: string | null;
  status: MatchStatus;
  public_slug: string;

  // ---------------------------------------------------
  // LIVE MATCH STATE
  // ---------------------------------------------------

  current_minute: number;
  home_score: number;
  away_score: number;
  clock_running: boolean;
  period_started_at: string | null;
  elapsed_seconds: number;

  // ---------------------------------------------------
  // ADMIN / AUDIT FIELDS
  // ---------------------------------------------------

  created_at: string;
  is_locked?: boolean | null;
  status_note?: string | null;
  original_match_date?: string | null;
  final_recap_emailed_at?: string | null;
  final_recap_email_error?: string | null;
};

// ---------------------------------------------------
// MATCH LINEUP
// ---------------------------------------------------

export type MatchLineup = {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  is_starter: boolean;
  is_available: boolean;
  player_name_snapshot: string | null;
  jersey_number_snapshot: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------
// MATCH EVENT
// ---------------------------------------------------

export type MatchEvent = {
  id: string;
  match_id: string;
  minute: number;
  event_type: EventType;
  team_side: TeamSide;
  team_id: string | null;

  // ---------------------------------------------------
  // PRIMARY / SECONDARY PLAYER LINKS
  // ---------------------------------------------------

  player_id: string | null;
  secondary_player_id: string | null;

  // ---------------------------------------------------
  // SUBSTITUTION PLAYER LINKS
  // ---------------------------------------------------

  player_in_id?: string | null;
  player_out_id?: string | null;

  // ---------------------------------------------------
  // MANUAL NAME OVERRIDES
  // ---------------------------------------------------

  player_name_override: string | null;
  secondary_player_name_override: string | null;

  // ---------------------------------------------------
  // EVENT NOTES / AUDIT
  // ---------------------------------------------------

  notes: string | null;
  created_at: string;
};
