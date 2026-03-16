'use client';

import Link from 'next/link';

const adminSections = [
  {
    title: 'Organizations',
    description: 'Manage clubs, schools, branding, and organization structure.',
    href: '/admin/org',
  },
  {
    title: 'Teams',
    description: 'Manage teams, rosters, colors, and team-level details.',
    href: '/teams',
  },
  {
    title: 'Public Organizations',
    description: 'Jump to the public organization directory.',
    href: '/public/org',
  },
  {
    title: 'Public Teams',
    description: 'Jump to the public team directory and public-facing pages.',
    href: '/public/teams',
  },
];

export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Admin Dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Central place for managing organizations, teams, and public-facing content.
        </p>
      </div>

      {/* --------------------------------------------------- */}
      {/* ADMIN GRID */}
      {/* --------------------------------------------------- */}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {adminSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:bg-slate-50"
          >
            <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{section.description}</p>

            <div className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Open
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
