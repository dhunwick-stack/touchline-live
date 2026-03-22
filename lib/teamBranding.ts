import type { Team } from '@/lib/types';

const TEAM_DESCRIPTOR_PATTERN =
  /\b(boys?|girls?|mens?|women|womens|varsity|junior varsity|jv|freshman|frosh|sophomore|sv|junior|seniors?)\b/gi;

function normalizeBrandKey(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(TEAM_DESCRIPTOR_PATTERN, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTeamBrandKeys(team?: Team | null) {
  const keys = new Set<string>();

  const normalizedName = normalizeBrandKey(team?.name);
  const normalizedClubName = normalizeBrandKey(team?.club_name);

  if (normalizedName) keys.add(normalizedName);
  if (normalizedClubName) keys.add(normalizedClubName);

  return keys;
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
