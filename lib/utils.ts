export function slugifyMatch(): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `match-${rand}`;
}

// ---------------------------------------------------
// BUILD READABLE MATCH SLUG
// ---------------------------------------------------

export function buildReadableMatchSlug({
  homeTeamName,
  awayTeamName,
  matchDate,
}: {
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  matchDate?: string | null;
}) {
  const home = slugifySegment(homeTeamName || 'home-team');
  const away = slugifySegment(awayTeamName || 'away-team');

  const datePart = matchDate
    ? new Date(matchDate).toISOString().slice(0, 10)
    : 'date-tbd';

  return `${home}-vs-${away}-${datePart}`;
}

// ---------------------------------------------------
// SLUGIFY TEXT SEGMENT
// ---------------------------------------------------

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}