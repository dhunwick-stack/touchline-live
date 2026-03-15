'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
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

  // ---------------------------------------------------
  // HERO STYLE
  // ---------------------------------------------------

  const heroStyle = {
    background: `linear-gradient(135deg, ${team.primary_color || '#1e3a8a'}, ${team.secondary_color || '#7c3aed'})`,
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
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* --------------------------------------------------- */}
            {/* TEAM INFO */}
            {/* --------------------------------------------------- */}

            <div className="flex items-center gap-4">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="h-24 w-24 rounded-3xl object-cover ring-1 ring-white/20"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 text-xs font-bold text-white/70 ring-1 ring-white/15">
                  LOGO
                </div>
              )}

              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                  {eyebrow}
                </p>

                <h1 className="mt-1 text-3xl font-black tracking-tight text-white md:text-5xl">
                  {team.name}
                </h1>

                <p className="mt-2 text-lg text-white/80">
                  {description || organizationName || ''}
                </p>

                {/* --------------------------------------------------- */}
                {/* ORGANIZATION LINK */}
                {/* --------------------------------------------------- */}

                {hasOrganizationLink ? (
                  <div className="mt-3">
                    <Link
                      href={`/public/org/${team.organization?.slug}`}
                      className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 ring-1 ring-white/15 transition hover:bg-white/15"
                    >
                      View all {organizationName} teams
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>

            {/* --------------------------------------------------- */}
            {/* HERO ACTIONS */}
            {/* --------------------------------------------------- */}

            {actions.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {actions.map((action) => {
                  const content = (
                    <>
                      {action.icon === 'lock' ? (
                        <Lock className="h-4 w-4 opacity-90" />
                      ) : null}
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