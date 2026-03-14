'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type PublicTeamNavProps = {
  teamId: string;
};

export default function PublicTeamNav({ teamId }: PublicTeamNavProps) {
  // ---------------------------------------------------
  // ROUTE STATE
  // ---------------------------------------------------

  const pathname = usePathname();
  const basePath = `/public/team/${teamId}`;

  // ---------------------------------------------------
  // NAV STYLE
  // ---------------------------------------------------

  function navClass(isActive: boolean) {
    return isActive
      ? 'rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white'
      : 'rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100';
  }

  return (
    <div className="mb-8 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-2">
        <Link href={basePath} className={navClass(pathname === basePath)}>
          Team Page
        </Link>

        <Link
          href={`${basePath}/schedule`}
          className={navClass(pathname === `${basePath}/schedule`)}
        >
          Schedule
        </Link>

        <Link
          href={`${basePath}/results`}
          className={navClass(pathname === `${basePath}/results`)}
        >
          Results
        </Link>
      </div>
    </div>
  );
}
