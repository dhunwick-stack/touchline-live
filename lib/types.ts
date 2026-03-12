export type TrackingMode = 'full' | 'basic' | 'score_only';
export type MatchStatus = 'not_started' | 'live' | 'halftime' | 'final';
export type TeamSide = 'home' | 'away';
export type EventType =
  | 'goal'
  | 'yellow_card'
  | 'red_card'
  | 'substitution'
  | 'half_start'
  | 'half_end'
  | 'full_time';

export type Season = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  club_name: string | null;
  age_group: string | null;
  logo_url: string | null;
  home_field_name: string | null;
  home_field_address: string | null;
  is_reusable: boolean;
  created_at: string;
};

export type Player = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string | null;
  jersey_number: number | null;
  position: string | null;
  active: boolean;
  created_at: string;
};

export type Match = {
  id: string;
  season_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_tracking_mode: TrackingMode;
  away_tracking_mode: TrackingMode;
  match_date: string | null;
  venue: string | null;
  status: MatchStatus;
  current_minute: number;
  home_score: number;
  away_score: number;
  public_slug: string;
  clock_running: boolean;
  period_started_at: string | null;
  elapsed_seconds: number;
  created_at: string;
};

export type MatchEvent = {
  id: string;
  match_id: string;
  minute: number;
  event_type: EventType;
  team_side: TeamSide;
  team_id: string | null;
  player_id: string | null;
  secondary_player_id: string | null;
  player_name_override: string | null;
  secondary_player_name_override: string | null;
  notes: string | null;
  created_at: string;
};
