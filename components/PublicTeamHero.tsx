'use client';

import Link from 'next/link';
import { Lock, Trophy } from 'lucide-react';
import { getOrganizationName } from '@/lib/team-display';
import type { Team } from '@/lib/types';

type PublicTeamHeroAction =
  | {
      type: 'link';
      href: string;
      label: string;
      variant?: 'glass' | 'admin' | 'primary';
      icon?: 'lock';
    }
  | {
      type: 'button';
      onClick: () => void;
      label: string;
      variant?: 'glass' | 'admin' | 'primary';
      icon?: 'lock';
    };

type PublicTeamHeroProps = {
  team: Team;
  eyebrow?: string;
  description?: string;
  actions?: PublicTeamHeroAction[];
};

export default function PublicTeamHero({
  team,
  eyebrow = 'Public Team Page',
  description,
  actions = [],
}: PublicTeamHeroProps) {
  // ---------------------------------------------------
  // DERIVED DISPLAY VALUES
  // ---------------------------------------------------

  const organizationName = getOrganizationName(team);
  const hasOrganizationLink = !!team.organization?.slug;
  const showNationalChampionsPill =
    team.name === '06 Premier' && (team.club_name || '').toLowerCase().includes('jahbat');

  const teamMeta = [
  team.age_group,
  team.team_level,
  team.gender ? team.gender.charAt(0).toUpperCase() + team.gender.slice(1) : null
]
  .filter(Boolean)
  .join(' • ');

  const secondaryLine =
    [team.nickname, teamMeta || description || organizationName].filter(Boolean).join(' • ') || '';

  // ---------------------------------------------------
  // HERO STYLE
  // ---------------------------------------------------

  const heroStyle = {
    background: `
      radial-gradient(circle at 14% 18%, ${team.secondary_color || '#f97316'}30, transparent 28%),
      radial-gradient(circle at 88% 38%, ${team.secondary_color || '#f97316'}1f, transparent 24%),
      linear-gradient(115deg, ${team.primary_color || '#1d4ed8'} 0%, ${team.primary_color || '#1d4ed8'} 48%, ${team.secondary_color || '#7c3aed'} 100%)
    `,
  };

  // ---------------------------------------------------
  // ACTION CLASS HELPER
  // ---------------------------------------------------

  function actionClassName(variant: PublicTeamHeroAction['variant']) {
    if (variant === 'admin') {
      return 'inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm';
    }

    if (variant === 'primary') {
      return 'inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm';
    }

    return 'inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm';
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <section
      className="relative left-1/2 right-1/2 -mx-[50vw] mb-8 w-screen overflow-hidden text-white"
      style={heroStyle}
    >
      <div className="absolute inset-0 bg-black/8" />

      <div className="relative mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-[32px] border border-white/16 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            {/* --------------------------------------------------- */}
            {/* LEFT SIDE */}
            {/* --------------------------------------------------- */}

            <div className="flex min-w-0 items-center gap-4 lg:flex-1">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="h-32 w-32 rounded-[2rem] object-cover shadow-2xl"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] bg-white/10 text-sm font-bold text-white/70 ring-1 ring-white/15">
                  LOGO
                </div>
              )}

              <div className="min-w-0">
                {/* --------------------------------------------------- */}
                {/* BREADCRUMBS */}
                {/* --------------------------------------------------- */}

                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-white/80">
                  <Link href="/public/org" className="transition hover:text-white">
                    Organizations
                  </Link>

                  {team.organization?.slug ? (
                    <>
                      <span className="text-white/50">›</span>
                      <Link
                        href={`/public/org/${team.organization.slug}`}
                        className="transition hover:text-white"
                      >
                        {team.organization.name}
                      </Link>
                    </>
                  ) : null}
                </div>

                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                  {eyebrow}
                </p>

                <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-white md:text-5xl">
                  {team.name}
                </h1>

                {secondaryLine ? (
                  <p className="mt-2 text-lg text-white/80">
                    {secondaryLine}
                  </p>
                ) : null}

                {showNationalChampionsPill ? (
                  <div className="mt-3">
                    <span className="inline-flex items-center rounded-full border border-amber-300/35 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 backdrop-blur-sm">
                      <Trophy className="mr-2 h-3.5 w-3.5" />
                      2025 USYS National Champions
                    </span>
                  </div>
                ) : null}

                {hasOrganizationLink ? (
                  <div className="mt-3">
                    <Link
                      href={`/public/org/${team.organization!.slug}`}
                      className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 ring-1 ring-white/15 transition hover:bg-white/15"
                    >
                      View all {organizationName} teams
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>

            {/* --------------------------------------------------- */}
            {/* RIGHT SIDE ACTIONS */}
            {/* --------------------------------------------------- */}

            {actions.length > 0 ? (
              <div className="flex flex-wrap gap-3 lg:ml-6 lg:max-w-[42%] lg:justify-end lg:self-end">
                {actions.map((action) => {
                  const content = (
                    <>
                      {action.icon === 'lock' ? <Lock className="h-4 w-4 opacity-90" /> : null}
                      {action.label}
                    </>
                  );

                  if (action.type === 'button') {
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className={actionClassName(action.variant)}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={`${action.href}-${action.label}`}
                      href={action.href}
                      className={actionClassName(action.variant)}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
