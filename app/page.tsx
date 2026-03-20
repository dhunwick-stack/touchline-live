'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Match, Organization, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

const homeLinks = [
  {
    title: 'Organizations',
    description: 'Browse clubs, schools, and their teams.',
    href: '/public/org',
    variant: 'primary' as const,
  },
  {
    title: 'Teams',
    description: 'Find and manage saved teams.',
    href: '/teams',
    variant: 'secondary' as const,
  },
  {
  title: 'Matches',
  description: 'Browse recent and live matches across the platform.',
  href: '/matches',
  variant: 'secondary' as const,
},
  {
    title: 'Admin',
    description: 'Manage organizations, teams, and settings.',
    href: '/admin',
    variant: 'secondary' as const,
  },
];

export default function HomePage() {
  // ---------------------------------------------------
  // DASHBOARD STATE
  // ---------------------------------------------------

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------
  // LOAD DASHBOARD DATA
  // ---------------------------------------------------

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const [
        { data: organizationData },
        { data: teamData },
        { data: matchData },
      ] = await Promise.all([
        supabase.from('organizations').select('*').order('name', { ascending: true }).limit(6),
        supabase.from('teams').select('*').order('created_at', { ascending: false }).limit(12),
        supabase
          .from('matches')
          .select(`
            *,
            home_team:home_team_id (*),
            away_team:away_team_id (*)
          `)
          .order('match_date', { ascending: false, nullsFirst: false })
          .limit(4),
      ]);

      setOrganizations((organizationData as Organization[]) ?? []);
      setTeams((teamData as Team[]) ?? []);
      setRecentMatches((matchData as MatchRow[]) ?? []);
      setLoading(false);
    }

    loadDashboard();
  }, []);

  // ---------------------------------------------------
  // DERIVED VALUES
  // ---------------------------------------------------

  const liveMatches = useMemo(
    () =>
      recentMatches.filter(
        (match) => match.status === 'live' || match.status === 'halftime',
      ).length,
    [recentMatches],
  );

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* --------------------------------------------------- */}
      {/* HERO */}
      {/* --------------------------------------------------- */}

      <section className="text-center">
        <p className="mb-3 inline-flex rounded-full bg-emerald-50 px-4 py-1 text-sm font-semibold text-emerald-700">
          Touchline Live
        </p>

        <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
          Club, team, and match management built for the sidelines.
        </h1>

        <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-600">
          Browse organizations, manage teams, launch matches, and share public-facing pages for clubs,
          schools, and supporters.
        </p>
      </section>

      {/* --------------------------------------------------- */}
      {/* SUMMARY STRIP */}
      {/* --------------------------------------------------- */}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Organizations" value={organizations.length} />
        <SummaryCard label="Teams" value={teams.length} />
        <SummaryCard label="Live Matches" value={liveMatches} />
      </section>

      {/* --------------------------------------------------- */}
      {/* PRIMARY ACTIONS */}
      {/* --------------------------------------------------- */}

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {homeLinks.map((item) => (
  <Link
    key={item.href}
    href={item.href}
    className={`block rounded-3xl p-6 text-left shadow-sm ring-1 transition ${
      item.variant === 'primary'
        ? 'bg-slate-900 text-white ring-slate-900 hover:bg-slate-800'
        : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50'
    }`}
  >
    <div className="flex min-h-[180px] flex-col justify-between">
      <div className="space-y-2">
        <h2 className="text-2xl font-black tracking-tight">{item.title}</h2>

        <p
          className={`max-w-[24ch] text-sm leading-6 whitespace-normal ${
            item.variant === 'primary' ? 'text-white/80' : 'text-slate-600'
          }`}
        >
          {item.description}
        </p>
      </div>

      <div
        className={`mt-6 inline-flex items-center text-sm font-semibold ${
          item.variant === 'primary' ? 'text-white' : 'text-slate-900'
        }`}
      >
        Open <span className="ml-1">→</span>
      </div>
    </div>
  </Link>
))}
      </section>

      {/* --------------------------------------------------- */}
      {/* LOWER DASHBOARD */}
      {/* --------------------------------------------------- */}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* ------------------------------------------------- */}
        {/* ORGANIZATIONS PREVIEW */}
        {/* ------------------------------------------------- */}

        <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-900">Organizations</h2>
              <p className="mt-1 text-sm text-slate-500">
                Quick access to clubs and schools.
              </p>
            </div>

            <Link
              href="/public/org"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              View All
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading organizations...</p>
          ) : organizations.length === 0 ? (
            <p className="text-sm text-slate-500">No organizations found yet.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/public/org/${org.slug}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    {org.logo_url ? (
                      <img
                        src={org.logo_url}
                        alt={`${org.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{org.name}</p>
                      <p className="truncate text-sm text-slate-500 capitalize">
                        {org.organization_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------- */}
        {/* RECENT MATCHES */}
        {/* ------------------------------------------------- */}

        <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-slate-900">Recent Matches</h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest fixtures across the platform.
              </p>
            </div>

           
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading matches...</p>
          ) : recentMatches.length === 0 ? (
            <p className="text-sm text-slate-500">No matches found yet.</p>
          ) : (
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {match.home_team?.name || 'Home'} vs {match.away_team?.name || 'Away'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {match.match_date
                          ? new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }).format(new Date(match.match_date))
                          : 'Date TBD'}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                        match.status === 'live'
                          ? 'inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-700 ring-emerald-400/20'
                          : match.status === 'final'
                          ? 'bg-red-600 text-white ring-red-500/70'
                          : 'bg-white text-slate-600 ring-slate-200'
                      }`}
                    >
                      {match.status === 'live' ? (
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      ) : null}
                      {prettyStatus(match.status)}
                    </span>
                  </div>

                  {(match.status === 'live' ||
                    match.status === 'halftime' ||
                    match.status === 'final') && (
                    <div className="mt-3 text-lg font-black tabular-nums text-slate-900">
                      {match.home_score}-{match.away_score}
                    </div>
                  )}

                  <div className="mt-4">
                    {match.public_slug ? (
                      <Link
                        href={`/public/${match.public_slug}`}
                        className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                      >
                        View Match
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">Public link coming soon</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function prettyStatus(status: Match['status']) {
  if (status === 'not_started') return 'Not Started';
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'live') return 'Live';
  if (status === 'halftime') return 'Halftime';
  if (status === 'final') return 'Final';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'postponed') return 'Postponed';
  return status;
}
