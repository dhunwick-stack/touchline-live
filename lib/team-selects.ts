export const PUBLIC_TEAM_FIELDS = `
  id,
  name,
  club_name,
  age_group,
  logo_url,
  home_field_name,
  home_field_address,
  primary_color,
  secondary_color,
  banner_url,
  created_at,
  home_field_lat,
  home_field_lng,
  organization_id,
  team_level,
  gender,
  team_slug,
  match_tracking_mode
`;

export const PUBLIC_TEAM_WITH_ORGANIZATION_SELECT = `
  ${PUBLIC_TEAM_FIELDS},
  organization:organization_id (*)
`;

export const PUBLIC_MATCH_TEAM_RELATION_SELECT = `
  home_team:home_team_id (${PUBLIC_TEAM_WITH_ORGANIZATION_SELECT}),
  away_team:away_team_id (${PUBLIC_TEAM_WITH_ORGANIZATION_SELECT})
`;
