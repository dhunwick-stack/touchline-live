const TEAM_DESCRIPTOR_PATTERN =
  /\b(boys?|girls?|mens?|women|womens|varsity|junior varsity|jv|freshman|frosh|sophomore|sv|junior|seniors?)\b/gi;

function stripTeamDescriptors(value?: string | null) {
  return (value || '')
    .replace(TEAM_DESCRIPTOR_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLookupQueries({
  teamName,
  clubName,
  city,
  state,
}: {
  teamName?: string | null;
  clubName?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const locationSuffix = [city, state].filter(Boolean).join(', ');
  const baseTeamName = stripTeamDescriptors(teamName);
  const baseClubName = stripTeamDescriptors(clubName);
  const rawCandidates = [
    baseTeamName,
    `${baseTeamName} High School`,
    baseClubName,
    `${baseClubName} High School`,
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  const uniqueCandidates = [...new Set(rawCandidates)];

  return uniqueCandidates.map((value) =>
    locationSuffix ? `${value}, ${locationSuffix}` : value,
  );
}

type TeamLocationResult = {
  address: string;
  lat: number;
  lng: number;
};

const CHICAGO_AREA_BBOX = '-88.65,41.45,-87.35,42.35';
const CHICAGO_PROXIMITY = '-87.6298,41.8781';

export async function lookupTeamLocation({
  teamName,
  clubName,
  city,
  state,
}: {
  teamName?: string | null;
  clubName?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<TeamLocationResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const queries = buildLookupQueries({
    teamName,
    clubName,
    city,
    state,
  });

  if (queries.length === 0) return null;

  for (const query of queries) {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&country=us&bbox=${CHICAGO_AREA_BBOX}&proximity=${CHICAGO_PROXIMITY}&types=poi,address,place,locality&access_token=${token}`,
    );

    if (!response.ok) continue;

    const body = (await response.json()) as {
      features?: Array<{
        place_name?: string;
        center?: [number, number];
      }>;
    };

    const feature = body.features?.[0];
    const lng = feature?.center?.[0];
    const lat = feature?.center?.[1];
    const address = feature?.place_name?.trim();

    if (address && typeof lat === 'number' && typeof lng === 'number') {
      return {
        address,
        lat,
        lng,
      };
    }
  }

  return null;
}
