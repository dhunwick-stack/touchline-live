'use client';

import Link from 'next/link';
import type { Match, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type MatchHeaderTheme = 'team' | 'publicLive';
type MatchHeaderMode = 'admin' | 'public';

type Props = {
  match: MatchRow;
  formattedClock: string;
  mode: MatchHeaderMode;
  theme: MatchHeaderTheme;
  actions?: React.ReactNode;
};

export default function MatchHeader({
  match,
  formattedClock,
  mode,
  theme,
  actions,
}: Props) {
  const isPublic = mode === 'public';

  const teamPrimary =
    match.home_team?.primary_color ||
    match.away_team?.primary_color ||
    '#0f172a';

  const teamSecondary =
    match.home_team?.secondary_color ||
    match.away_team?.secondary_color ||
    '#1e293b';

  const shellClass =
    theme === 'publicLive'
      ? 'bg-gradient-to-b from-red-900 to-[#7f1d1d]'
      : '';

  const shellStyle =
    theme === 'team'
      ? {
          background: `linear-gradient(135deg, ${teamPrimary}, ${teamSecondary})`,
        }
      : undefined;

  const statusClass =
    theme === 'publicLive' ? 'text-white/70' : 'text-white/65';

  const clockClass =
    theme === 'publicLive' ? 'text-white/90' : 'text-white/85';

  return (
    <section
      className={`relative left-1/2 right-1/2 -mx-[50vw] w-screen text-white ${shellClass}`}
      style={shellStyle}
    >
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative mx-auto max-w-7xl px-6 py-6">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <TeamIdentityBlock
            team={match.home_team}
            teamId={match.home_team_id}
            side="left"
            mode={mode}
            theme={theme}
            fallback="Home Team"
          />

          <div className="text-center">
            <div className={`text-sm uppercase tracking-[0.2em] ${statusClass}`}>
              {prettyStatus(match.status)}
            </div>

            <div className="mt-2 text-6xl font-black tabular-nums tracking-tight md:text-7xl">
              {match.home_score} - {match.away_score}
            </div>

            <div className={`mt-2 text-2xl font-semibold tabular-nums md:text-3xl ${clockClass}`}>
              {formattedClock}
            </div>

            {actions ? (
              <div className="mt-5 flex flex-wrap justify-center gap-3">{actions}</div>
            ) : null}
          </div>

          <TeamIdentityBlock
            team={match.away_team}
            teamId={match.away_team_id}
            side="right"
            mode={mode}
            theme={theme}
            fallback="Away Team"
          />
        </div>
      </div>
    </section>
  );
}

function TeamIdentityBlock({
  team,
  teamId,
  side,
  mode,
  theme,
  fallback,
}: {
  team: Team | null;
  teamId: string | null;
  side: 'left' | 'right';
  mode: MatchHeaderMode;
  theme: MatchHeaderTheme;
  fallback: string;
}) {
  const href =
    mode === 'public'
      ? teamId
        ? `/public/team/${teamId}`
        : '#'
      : teamId
        ? `/teams/${teamId}`
        : '#';

  const eyebrowClass =
    theme === 'publicLive' ? 'text-white/70' : 'text-white/65';

  const subClass =
    theme === 'publicLive' ? 'text-white/75' : 'text-white/70';

  const helperLabel = mode === 'public' ? 'Public Team Page' : 'View Team Page';

  if (side === 'right') {
    return (
      <div className="text-right">
        <p className={`text-sm font-semibold uppercase tracking-wide ${eyebrowClass}`}>
          Away
        </p>

        <div className="mt-1 flex items-center justify-end gap-3">
          <div className="text-right">
            <Link
              href={href}
              className="text-2xl font-black transition hover:opacity-80 hover:underline"
            >
              {team?.name || fallback}
            </Link>

            <div className={`mt-1 text-xs font-semibold uppercase tracking-wide ${subClass}`}>
              {helperLabel}
            </div>
          </div>

          {team?.logo_url ? (
            <Link href={href} className="shrink-0">
              <img
                src={team.logo_url}
                alt={`${team.name} logo`}
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20 transition hover:opacity-80"
              />
            </Link>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-white/80 ring-1 ring-white/15">
              LOGO
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className={`text-sm font-semibold uppercase tracking-wide ${eyebrowClass}`}>
        Home
      </p>

      <div className="mt-1 flex items-center gap-3">
        {team?.logo_url ? (
          <Link href={href} className="shrink-0">
            <img
              src={team.logo_url}
              alt={`${team.name} logo`}
              className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20 transition hover:opacity-80"
            />
          </Link>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-white/80 ring-1 ring-white/15">
            LOGO
          </div>
        )}

        <div>
          <Link
            href={href}
            className="text-2xl font-black transition hover:opacity-80 hover:underline"
          >
            {team?.name || fallback}
          </Link>

          <div className={`mt-1 text-xs font-semibold uppercase tracking-wide ${subClass}`}>
            {helperLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

function prettyStatus(status: Match['status']) {
  if (status === 'not_started') return 'Not Started';
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'live') return 'Live';
  if (status === 'halftime') return 'Halftime';
  if (status === 'final') return 'Final';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'postponed') return 'Postponed';
  return status;
}