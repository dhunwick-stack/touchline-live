'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PublicTeamNav({ teamId }: { teamId: string }) {
  const pathname = usePathname();

  const links = [
    {
      href: `/public/team/${teamId}`,
      label: 'Overview',
    },
    {
      href: `/public/team/${teamId}/roster`,
      label: 'Roster',
    },
    {
      href: `/public/team/${teamId}/schedule`,
      label: 'Schedule',
    },
    {
      href: `/public/team/${teamId}/results`,
      label: 'Results',
    },
    {
      href: `/public/team/${teamId}/leaders`,
      label: 'Leaders',
    },
  ];

  return (
    <nav className="mb-6 overflow-x-auto">
      <div className="flex min-w-max gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
        {links.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
