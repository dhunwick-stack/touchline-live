'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

  // ---------------------------------------------------
  // BANNER STYLE
  // ---------------------------------------------------

  const bannerStyle = team?.banner_url
    ? {
        backgroundImage: `linear-gradient(rgba(15,23,42,0.45), rgba(15,23,42,0.45)), url(${team.banner_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: `linear-gradient(135deg, ${team?.primary_color || '#7f1d1d'}, ${team?.secondary_color || '#450a0a'})`,
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

      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/20" />

      <div className="relative mx-auto max-w-7xl px-6 py-14">
        {/* ------------------------------------------------- */}
        {/* FLOATING CARD */}
        {/* ------------------------------------------------- */}

        <div className="flex flex-col gap-6 rounded-3xl bg-white/10 p-6 backdrop-blur-md ring-1 ring-white/20 lg:flex-row lg:items-center lg:justify-between">
          {/* ----------------------------------------------- */}
          {/* TEAM IDENTITY */}
          {/* ----------------------------------------------- */}

          <div className="flex items-center gap-4">
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={`${team.name} logo`}
                className="h-20 w-20 rounded-3xl object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-xs font-bold">
                LOGO
              </div>
            )}

            <div>
              <p className="text-sm uppercase tracking-wide text-white/70">Team</p>

              <h1 className="text-3xl font-black tracking-tight">{team.name}</h1>

              <p className="text-white/85">{team.club_name || 'No club name'}</p>
            </div>
          </div>

          {/* ----------------------------------------------- */}
          {/* ACTION NAV */}
          {/* ----------------------------------------------- */}

          <div className="flex flex-col gap-4 lg:items-end">
            {/* --------------------------------------------- */}
            {/* MAIN NAV */}
            {/* --------------------------------------------- */}

            <div className="inline-flex flex-wrap rounded-2xl bg-black/20 p-1.5 backdrop-blur-sm ring-1 ring-white/15">
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
      Start Match
    </Link>

              {setEditing && (
                <button
                  onClick={() => setEditing(!editing)}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                >
                  {editing ? 'Close Edit' : 'Edit Team'}
                </button>
              )}

              <button
                onClick={() => {
                  localStorage.removeItem('teamId');
                  localStorage.removeItem('teamName');
                  window.location.href = '/team-login';
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