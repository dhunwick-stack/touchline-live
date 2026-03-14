'use client';

import type { ReactNode } from 'react';
import PublicTeamHero from '@/components/PublicTeamHero';
import PublicTeamNav from '@/components/PublicTeamNav';
import type { Team } from '@/lib/types';

type PublicTeamPageShellProps = {
  team: Team;
  teamId: string;
  children: ReactNode;
};

export default function PublicTeamPageShell({
  team,
  teamId,
  children,
}: PublicTeamPageShellProps) {
  // ---------------------------------------------------
  // STANDARD PUBLIC TEAM BANNER ACTIONS
  // ---------------------------------------------------

  const bannerActions = [
    {
      href: `/public/team/${team.id}`,
      label: 'Team Page',
      variant: 'glass' as const,
    },
    {
      href: `/public/team/${team.id}/schedule`,
      label: 'Schedule',
      variant: 'glass' as const,
    },
    {
      href: `/teams/${team.id}`,
      label: 'Admin Page',
      variant: 'admin' as const,
      icon: 'lock' as const,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">
      {/* --------------------------------------------------- */}
      {/* PUBLIC TEAM HERO */}
      {/* --------------------------------------------------- */}

      <PublicTeamHero
        team={team}
        eyebrow="Public Team Page"
        description={team.club_name || 'Team overview, schedules, results, and match recaps.'}
        actions={bannerActions}
      />

      {/* --------------------------------------------------- */}
      {/* PUBLIC TEAM NAV */}
      {/* --------------------------------------------------- */}

      <PublicTeamNav teamId={teamId} />

      {/* --------------------------------------------------- */}
      {/* PAGE CONTENT */}
      {/* --------------------------------------------------- */}

      {children}
    </main>
  );
}