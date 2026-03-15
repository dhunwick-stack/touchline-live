import type { Organization, Team } from '@/lib/types';

// ---------------------------------------------------
// ORGANIZATION DISPLAY HELPERS
// ---------------------------------------------------

export function getOrganizationName(
  team?: Team | null,
  organization?: Organization | null,
) {
  return organization?.name || team?.organization?.name || team?.club_name || '';
}

export function getOrganizationType(
  team?: Team | null,
  organization?: Organization | null,
) {
  return organization?.organization_type || team?.organization?.organization_type || null;
}

export function getTeamBrandLogo(
  team?: Team | null,
  organization?: Organization | null,
) {
  return team?.logo_url || organization?.logo_url || team?.organization?.logo_url || null;
}

export function getTeamPrimaryColor(
  team?: Team | null,
  organization?: Organization | null,
) {
  return (
    team?.primary_color ||
    organization?.primary_color ||
    team?.organization?.primary_color ||
    '#0f172a'
  );
}

export function getTeamSecondaryColor(
  team?: Team | null,
  organization?: Organization | null,
) {
  return (
    team?.secondary_color ||
    organization?.secondary_color ||
    team?.organization?.secondary_color ||
    '#1e293b'
  );
}

export function getTeamBanner(
  team?: Team | null,
  organization?: Organization | null,
) {
  return team?.banner_url || organization?.banner_url || team?.organization?.banner_url || null;
}

export function getTeamLevelLabel(team?: Team | null) {
  return team?.team_level || null;
}

export function getTeamDescriptor(
  team?: Team | null,
  organization?: Organization | null,
) {
  const orgName = getOrganizationName(team, organization);
  const age = team?.age_group || '';
  const level = team?.team_level || '';

  return [orgName, age, level].filter(Boolean).join(' • ');
}