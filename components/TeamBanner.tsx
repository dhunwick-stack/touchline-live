'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTeamHeaderIndicators, getTeamHeaderName } from '@/lib/team-display';
import type { Team } from '@/lib/types';

type Props = {
  team: Team;
  teamId: string;
  editing?: boolean;
  setEditing?: (v: boolean) => void;
};

export default function TeamBanner({
  team,
  teamId,
  editing,
  setEditing,
}: Props) {
  // ---------------------------------------------------
  // ROUTE STATE
  // ---------------------------------------------------

  const pathname = usePathname();
  const basePath = `/teams/${teamId}`;
  const showNationalChampionsPill =
    team.name === '06 Premier' && (team.club_name || '').toLowerCase().includes('jahbat');
  const secondaryLine = [team.club_name, team.nickname].filter(Boolean).join(' • ');
  const headerName = getTeamHeaderName(team);
  const headerIndicators = getTeamHeaderIndicators(team);

  // ---------------------------------------------------
  // BANNER STYLE
  // ---------------------------------------------------

  const bannerStyle = team?.banner_url
    ? {
        backgroundImage: `linear-gradient(135deg, ${team?.primary_color || '#0f172a'}dd, ${team?.secondary_color || '#1e293b'}cc), url(${team.banner_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: `
          radial-gradient(circle at 15% 20%, ${team?.secondary_color || '#f97316'}33, transparent 30%),
          radial-gradient(circle at 85% 50%, ${team?.secondary_color || '#f97316'}22, transparent 28%),
          linear-gradient(115deg, ${team?.primary_color || '#b91c1c'} 0%, ${team?.primary_color || '#b91c1c'} 46%, ${team?.secondary_color || '#7c2d12'} 100%)
        `,
      };

  // ---------------------------------------------------
  // NAV BUTTON STYLE
  // ---------------------------------------------------

  function primaryNavClass(isActive: boolean) {
    return isActive
      ? 'rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white'
      : 'rounded-xl px-5 py-3 text-sm font-semibold text-white hover:bg-white/10';
  }

  return (
    <section
      className="relative left-1/2 right-1/2 -mx-[50vw] w-screen text-white"
      style={bannerStyle}
    >
      {/* --------------------------------------------------- */}
      {/* OVERLAY */}
      {/* --------------------------------------------------- */}

      <div className="absolute inset-0 bg-gradient-to-b from-black/14 via-black/8 to-black/12" />

      <div className="relative mx-auto max-w-7xl px-6 py-14">
        {/* ------------------------------------------------- */}
        {/* FLOATING CARD */}
        {/* ------------------------------------------------- */}

        <div className="flex flex-col gap-6 rounded-3xl bg-white/12 p-6 backdrop-blur-md ring-1 ring-white/22 lg:flex-row lg:items-center lg:justify-between">
          {/* ----------------------------------------------- */}
          {/* TEAM IDENTITY */}
          {/* ----------------------------------------------- */}

          <div className="flex items-center gap-4">
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={`${team.name} logo`}
                className="h-28 w-28 rounded-[2rem] object-cover shadow-2xl"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-white/20 text-sm font-bold ring-1 ring-white/25">
                LOGO
              </div>
            )}

            <div>
              <p className="text-sm uppercase tracking-wide text-white/70">Team</p>

              <h1 className="text-3xl font-black tracking-tight">{headerName}</h1>

              <p className="text-white/85">{secondaryLine || 'No club name'}</p>

              {headerIndicators.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {headerIndicators.map((indicator) => (
                    <span
                      key={indicator}
                      className="inline-flex items-center rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
              ) : null}

              {showNationalChampionsPill ? (
                <div className="mt-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 backdrop-blur-sm">
                    <Trophy className="h-3.5 w-3.5" />
                    2025 USYS National Champions
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* ----------------------------------------------- */}
          {/* ACTION NAV */}
          {/* ----------------------------------------------- */}

          <div className="flex flex-col gap-4 lg:items-end">
            {/* --------------------------------------------- */}
            {/* MAIN NAV */}
            {/* --------------------------------------------- */}

            <div className="inline-flex flex-wrap rounded-2xl bg-white/10 p-1.5 backdrop-blur-sm ring-1 ring-white/18">
              <Link
                href={`${basePath}/stats`}
                className={primaryNavClass(pathname === `${basePath}/stats`)}
              >
                Stats
              </Link>

              <Link
                href={`${basePath}/roster`}
                className={primaryNavClass(pathname === `${basePath}/roster`)}
              >
                Roster
              </Link>

              <Link
                href={`${basePath}/leaders`}
                className={primaryNavClass(pathname === `${basePath}/leaders`)}
              >
                Leaders
              </Link>

              <Link
                href={`${basePath}/results`}
                className={primaryNavClass(pathname === `${basePath}/results`)}
              >
                Results
              </Link>

              <Link
                href={`${basePath}/schedule`}
                className={primaryNavClass(pathname === `${basePath}/schedule`)}
              >
                Schedule
              </Link>

              <Link
                href={basePath}
                className={
                  pathname === basePath
                    ? 'rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white'
                    : 'rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15'
                }
              >
                Team Page
              </Link>
            </div>

            {/* --------------------------------------------- */}
            {/* SECONDARY ACTIONS */}
            {/* --------------------------------------------- */}

            <div className="flex flex-wrap gap-3">
              <Link
      href={`/teams/${team.id}/new-match`}
      className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
    >
      New Match
    </Link>

              {setEditing && (
                <Link
                  href={`${basePath}?edit=1#team-edit-form`}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                >
                  {editing ? 'Close Edit' : 'Edit Team'}
                </Link>
              )}

              <button
  onClick={async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('teamId');
    localStorage.removeItem('teamName');
    window.location.href = '/';
  }}
  className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white/85 hover:bg-black/30"
>
  Logout
</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
