import type { Season } from '@/lib/types';

function getTrailingYear(season: Season) {
  const match = (season.name || '').trim().match(/(\d{4})\s*$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function getDefaultSeasonId(seasons: Season[]) {
  const currentYear = new Date().getFullYear();
  const now = Date.now();

  const exactYearSeason = seasons.find((season) => getTrailingYear(season) === currentYear);

  if (exactYearSeason) {
    return exactYearSeason.id;
  }

  const inRangeSeason = seasons.find((season) => {
    const start = season.start_date ? new Date(season.start_date).getTime() : null;
    const end = season.end_date ? new Date(season.end_date).getTime() : null;

    return start !== null && end !== null && start <= now && now <= end;
  });

  if (inRangeSeason) {
    return inRangeSeason.id;
  }

  const activeSeason = seasons.find((season) => season.is_active);

  if (activeSeason) {
    return activeSeason.id;
  }

  const closestFutureOrCurrentNamedSeason = seasons
    .map((season) => ({
      season,
      year: getTrailingYear(season),
    }))
    .filter((entry) => entry.year !== null && entry.year! >= currentYear)
    .sort((a, b) => (a.year as number) - (b.year as number))[0];

  if (closestFutureOrCurrentNamedSeason) {
    return closestFutureOrCurrentNamedSeason.season.id;
  }

  const closestPastNamedSeason = seasons
    .map((season) => ({
      season,
      year: getTrailingYear(season),
    }))
    .filter((entry) => entry.year !== null)
    .sort((a, b) => (b.year as number) - (a.year as number))[0];

  if (closestPastNamedSeason) {
    return closestPastNamedSeason.season.id;
  }

  return 'all';
}
