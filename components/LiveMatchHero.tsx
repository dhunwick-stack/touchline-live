'use client';

import Link from 'next/link';
import type { Match, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type LiveMatchHeroProps = {
  match: MatchRow;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  mode?: 'public' | 'admin';
  className?: string;
};

export default function LiveMatchHero({
  match,
  primaryColor,
  secondaryColor,
  mode = 'public',
  className = '',
}: LiveMatchHeroProps) {
  // ---------------------------------------------------
  // LIVE CLOCK / PERIOD HELPERS
  // ---------------------------------------------------

  const matchMeta = match as Record<string, unknown>;

  const liveClock =
    (typeof matchMeta.match_clock_display === 'string' && matchMeta.match_clock_display) ||
    (typeof matchMeta.clock_display === 'string' && matchMeta.clock_display) ||
    (typeof matchMeta.clock_text === 'string' && matchMeta.clock_text) ||
    (typeof matchMeta.game_clock === 'string' && matchMeta.game_clock) ||
    (typeof matchMeta.clock === 'string' && matchMeta.clock) ||
    '';

  const livePeriod =
    (typeof matchMeta.period_label === 'string' && matchMeta.period_label) ||
    (typeof matchMeta.current_period_label === 'string' && matchMeta.current_period_label) ||
    (typeof matchMeta.match_phase === 'string' && matchMeta.match_phase) ||
    (typeof matchMeta.period === 'string' && matchMeta.period) ||
    (match.status === 'halftime' ? 'Halftime' : 'Live');

  // ---------------------------------------------------
  // STYLING
  // ---------------------------------------------------

  const gradientStyle = {
    background: `linear-gradient(135deg, ${primaryColor || '#7f1d1d'}, ${secondaryColor || '#991b1b'})`,
  };

  const isAdmin = mode === 'admin';

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <section
      className={`relative overflow-hidden rounded-3xl text-white shadow-lg ${className}`}
      style={gradientStyle}
    >
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)]" />

      <div className="relative px-6 py-6 md:px-8 md:py-7">
        {/* --------------------------------------------------- */}
        {/* STATUS PILLS */}
        {/* --------------------------------------------------- */}

        <div className="flex flex-wrap justify-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200 ring-1 ring-emerald-300/25">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Live
          </div>

          <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/15">
            {livePeriod}
          </div>
        </div>

        {/* --------------------------------------------------- */}
        {/* SCORE / CLOCK */}
        {/* --------------------------------------------------- */}

        <div className="mx-auto mt-5 max-w-2xl rounded-[2rem] bg-white/10 px-6 py-5 text-center ring-1 ring-white/20 backdrop-blur md:px-8 md:py-6">
          <div className="text-5xl font-black leading-none md:text-6xl">
            {match.home_score} - {match.away_score}
          </div>

          {liveClock ? (
            <div className="mt-4 text-2xl font-black tracking-tight md:text-3xl">
              {liveClock}
            </div>
          ) : null}
        </div>

        {/* --------------------------------------------------- */}
        {/* MATCH META */}
        {/* --------------------------------------------------- */}

        <div className="mt-5 text-center">
          <p className="text-2xl font-black text-white/95">
            {match.home_team?.name || 'Home Team'} vs {match.away_team?.name || 'Away Team'}
          </p>

          <p className="mt-2 text-base font-semibold text-white/90">
            {match.match_date ? formatHeroMatchDate(match.match_date) : 'Match in progress'}
          </p>

          {match.venue ? (
            <p className="mt-1 text-sm text-white/75">
              {match.venue}
            </p>
          ) : null}
        </div>

        {/* --------------------------------------------------- */}
        {/* ACTIONS */}
        {/* --------------------------------------------------- */}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {isAdmin ? (
            <>
              <Link
                href={`/live/${match.id}`}
                className="rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm"
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
              >
                Update Match
              </Link>

              {match.public_slug ? (
                <Link
                  href={`/public/${match.public_slug}`}
                  target="_blank"
                  className="rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/20"
                >
                  View Public Page
                </Link>
              ) : null}
            </>
          ) : (
            <>
              {match.public_slug ? (
                <Link
                  href={`/public/${match.public_slug}`}
                  className="rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm"
                  style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                >
                  Follow Live
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------
// DATE FORMATTER
// ---------------------------------------------------

function formatHeroMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}