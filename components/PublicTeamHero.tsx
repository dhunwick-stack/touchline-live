'use client';

import Link from 'next/link';
import type { Team } from '@/lib/types';

type PublicTeamHeroAction = {
  href: string;
  label: string;
  variant?: 'glass' | 'dark' | 'light' | 'admin';
  icon?: 'lock';
};

type PublicTeamHeroProps = {
  team: Team;
  eyebrow: string;
  description: string;
  actions?: PublicTeamHeroAction[];
};

export default function PublicTeamHero({
  team,
  eyebrow,
  description,
  actions = [],
}: PublicTeamHeroProps) {
  // ---------------------------------------------------
  // HERO STYLE
  // ---------------------------------------------------

  const heroStyle = {
    background: `linear-gradient(135deg, ${team?.primary_color || '#7f1d1d'}, ${team?.secondary_color || '#450a0a'})`,
  };

  function actionClass(variant: PublicTeamHeroAction['variant'] = 'glass') {
    if (variant === 'light') {
      return 'inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900';
    }

    if (variant === 'dark') {
      return 'inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-black/25 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-black/35';
    }

    if (variant === 'admin') {
      return 'inline-flex items-center gap-2 rounded-2xl border border-yellow-300/30 bg-yellow-400/10 px-4 py-2.5 text-sm font-semibold text-yellow-100 backdrop-blur-sm hover:bg-yellow-400/20';
    }

    return 'inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/15';
  }

  return (
    <section
      className="relative left-1/2 right-1/2 -mx-[50vw] mb-8 w-screen overflow-hidden text-white"
      style={heroStyle}
    >
      <div className="bg-black/25">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="h-20 w-20 rounded-3xl object-cover ring-1 ring-white/20"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-xs font-bold text-white/70 ring-1 ring-white/15">
                  LOGO
                </div>
              )}

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                  {eyebrow}
                </p>

                <h1 className="text-3xl font-black leading-tight md:text-4xl">
                  {team.name}
                </h1>

                <p className="mt-2 text-sm text-white/80">{description}</p>
              </div>
            </div>

            {actions.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {actions.map((action) => (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={actionClass(action.variant)}
                  >
                    {action.icon === 'lock' ? (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="10" rx="2" />
                        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                      </svg>
                    ) : null}
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}