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
  // BANNER STYLE
  // ---------------------------------------------------

  const pathname = usePathname();
  const bannerStyle = team?.banner_url
    ? {
        backgroundImage: `linear-gradient(rgba(15,23,42,0.45), rgba(15,23,42,0.45)), url(${team.banner_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: `linear-gradient(135deg, ${team?.primary_color || '#7f1d1d'}, ${team?.secondary_color || '#450a0a'})`,
      };

  return (
    <section
      className="relative left-1/2 right-1/2 -mx-[50vw] w-screen text-white"
      style={bannerStyle}
    >
      {/* overlay */}

      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/20" />

      <div className="relative mx-auto max-w-7xl px-6 py-14">

        {/* floating card */}

        <div className="flex flex-col gap-6 rounded-3xl bg-white/10 p-6 backdrop-blur-md ring-1 ring-white/20 lg:flex-row lg:items-center lg:justify-between">

          {/* team identity */}

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
              <p className="text-sm uppercase tracking-wide text-white/70">
                Team
              </p>

              <h1 className="text-3xl font-black tracking-tight">
                {team.name}
              </h1>

              <p className="text-white/85">
                {team.club_name || 'No club name'}
              </p>
            </div>
          </div>

          {/* action nav */}

          <div className="flex flex-col gap-4 lg:items-end">

            {/* main nav */}

            <div className="inline-flex rounded-2xl bg-black/20 p-1.5 backdrop-blur-sm ring-1 ring-white/15">

       <Link
  href={`/teams/${teamId}/stats`}
  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
>
  Stats
</Link>

              <Link
                href={`/teams/${teamId}/roster`}
                className="rounded-xl px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/10"
              >
                Roster
              </Link>

              <Link
                href={`/teams/${teamId}/leaders`}
                className="rounded-xl px-5 py-3 text-sm font-semibold text-white/90 hover:bg-white/10"
              >
                Leaders
              </Link>

              <Link
  href={`/teams/${teamId}`}
  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
>
  Team Page
</Link>

            </div>

            {/* secondary actions */}

            <div className="flex flex-wrap gap-3">



              <Link
                href="/matches/new"
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                New Match
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
