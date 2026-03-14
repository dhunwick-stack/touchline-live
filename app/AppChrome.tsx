'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublicPage = pathname?.startsWith('/public');

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="text-lg font-black tracking-tight">
            Touchline Live
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Home
            </Link>

            <Link
              href="/teams"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Teams
            </Link>

            {/*/ <Link href="/schedule"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Schedules
            </Link> */}

            <Link
              href="/matches"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Matches
            </Link>

            <Link
              href="/matches/new"
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              New Match
            </Link>
          </nav>
        </div>
      </header>

      <div>{children}</div>
    </>
  );
}