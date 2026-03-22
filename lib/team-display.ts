import type { Organization, Team } from '@/lib/types';

function formatGenderLabel(gender?: string | null) {
  const normalized = (gender || '').trim().toLowerCase();

  if (!normalized) return null;
  if (normalized === 'boys') return 'Boys';
  if (normalized === 'girls') return 'Girls';
  if (normalized === 'men') return 'Men';
  if (normalized === 'women') return 'Women';
  if (normalized === 'coed') return 'Coed';

  return gender;
}

function formatTeamLevelLabel(teamLevel?: string | null) {
  const normalized = (teamLevel || '').trim().toLowerCase();

  if (!normalized) return null;
  if (normalized === 'jv') return 'JV';
  if (normalized === 'junior varsity') return 'JV';
  if (normalized === 'varsity') return 'Varsity';

  return teamLevel;
}

function includesToken(value: string, token?: string | null) {
  if (!token) return false;
  return value.toLowerCase().includes(token.toLowerCase());
}

function looksLikeSchoolName(value?: string | null) {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes('school') ||
    normalized.includes('high school') ||
    normalized.includes('hs') ||
    normalized.includes('academy')
  );
}

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

export function getTeamHeaderName(
  team?: Team | null,
  organization?: Organization | null,
) {
  const baseName = team?.name?.trim() || 'Team';
  const orgType = getOrganizationType(team, organization);
  const organizationName = getOrganizationName(team, organization);
  const shouldUseSchoolHeader =
    orgType === 'school' ||
    looksLikeSchoolName(organizationName) ||
    looksLikeSchoolName(team?.club_name);

  if (!shouldUseSchoolHeader) {
    return baseName;
  }

  const genderLabel = formatGenderLabel(team?.gender);
  const levelLabel = formatTeamLevelLabel(team?.team_level);
  const parts = [baseName];

  if (!includesToken(baseName, genderLabel)) {
    parts.push(genderLabel || '');
  }

  if (!includesToken(baseName, levelLabel)) {
    parts.push(levelLabel || '');
  }

  return parts.filter(Boolean).join(' ');
}

export function getTeamHeaderIndicators(team?: Team | null) {
  return [formatGenderLabel(team?.gender), formatTeamLevelLabel(team?.team_level)].filter(
    Boolean,
  ) as string[];
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
