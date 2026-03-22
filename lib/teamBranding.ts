import type { Team } from '@/lib/types';

const TEAM_DESCRIPTOR_PATTERN =
  /\b(boys?|girls?|mens?|women|womens|varsity|junior varsity|jv|freshman|frosh|sophomore|sv|junior|seniors?)\b/gi;
const SCHOOL_DESCRIPTOR_PATTERN =
  /\b(high school|high|school|academy|township|hs)\b/gi;

export function normalizeBrandKey(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(TEAM_DESCRIPTOR_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSchoolDescriptors(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(TEAM_DESCRIPTOR_PATTERN, ' ')
    .replace(SCHOOL_DESCRIPTOR_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAcronym(value?: string | null) {
  const words = (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(TEAM_DESCRIPTOR_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (words.length < 2) return '';

  return words.map((word) => word[0]).join('');
}

export function getBrandSearchKeys(values: Array<string | null | undefined>) {
  const keys = new Set<string>();

  values.forEach((value) => {
    const normalized = normalizeBrandKey(value);
    const stripped = stripSchoolDescriptors(value);
    const acronym = buildAcronym(value);

    if (normalized) keys.add(normalized);
    if (stripped) keys.add(stripped);
    if (acronym) keys.add(acronym);
  });

  return keys;
}

function getTeamBrandKeys(team?: Team | null) {
  return getBrandSearchKeys([team?.name, team?.club_name]);
}

export function findInheritedBrandTeam({
  teamName,
  clubName,
  organizationId,
  teams,
}: {
  teamName?: string | null;
  clubName?: string | null;
  organizationId?: string | null;
  teams: Team[];
}) {
  const requestedKeys = new Set<string>();
  const normalizedTeamName = normalizeBrandKey(teamName);
  const normalizedClubName = normalizeBrandKey(clubName);

  if (normalizedTeamName) requestedKeys.add(normalizedTeamName);
  if (normalizedClubName) requestedKeys.add(normalizedClubName);

  if (requestedKeys.size === 0) return null;

  const scopedCandidates = organizationId
    ? teams.filter((team) => team.organization_id === organizationId)
    : teams;

  const exactClubMatch =
    normalizedClubName &&
    scopedCandidates.find(
      (candidate) => normalizeBrandKey(candidate.club_name) === normalizedClubName,
    );

  if (exactClubMatch) return exactClubMatch;

  return (
    scopedCandidates.find((candidate) => {
      const candidateKeys = getTeamBrandKeys(candidate);
      return [...requestedKeys].some((key) => candidateKeys.has(key));
    }) || null
  );
}
