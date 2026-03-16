'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Match, Organization, Team } from '@/lib/types';

type TeamRow = Team & {
  organization: Organization | null;
};

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export default function PublicOrganizationSchedulePage() {
  // ---------------------------------------------------
  // ROUTE PARAMS
  // ---------------------------------------------------

  const params = useParams();
  const slug =
    typeof params?.slug === 'string'
      ? params.slug
      : Array.isArray(params?.slug)
        ? params.slug[0]
        : '';

  // ---------------------------------------------------
  // PAGE STATE
  // ---------------------------------------------------

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ---------------------------------------------------
  // DATA LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!slug) {
      setError('No organization slug found.');
      setLoading(false);
      return;
    }

    async function loadPageData() {
      setLoading(true);
      setError('');

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', slug)
        .single();

      if (orgError || !orgData) {
        setError(orgError?.message || 'Organization not found.');
        setLoading(false);
        return;
      }

      const loadedOrganization = orgData as Organization;
      setOrganization(loadedOrganization);

      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          *,
          organization:organization_id (*)
        `)
        .eq('organization_id', loadedOrganization.id)
        .order('gender', { ascending: true })
        .order('age_group', { ascending: true, nullsFirst: false })
        .order('team_level', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (teamError) {
        setError(teamError.message);
        setLoading(false);
        return;
      }

      const loadedTeams = (teamData as TeamRow[]) ?? [];
      setTeams(loadedTeams);

      if (loadedTeams.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const teamIds = loadedTeams.map((team) => team.id);
      const orFilter = teamIds
        .flatMap((id) => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`])
        .join(',');

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .or(orFilter)
        .order('match_date', { ascending: true, nullsFirst: false });

      if (matchError) {
        setError(matchError.message);
        setLoading(false);
        return;
      }

      setMatches((matchData as MatchRow[]) ?? []);
      setLoading(false);
    }

    loadPageData();
  }, [slug]);

  // ---------------------------------------------------
  // DERIVED VALUES
  // ---------------------------------------------------

  const primaryColor =
    organization?.primary_color ||
    teams?.[0]?.primary_color ||
    '#0f172a';

  const secondaryColor =
    organization?.secondary_color ||
    teams?.[0]?.secondary_color ||
    '#1e293b';

  const heroStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
    }),
    [primaryColor, secondaryColor],
  );

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, MatchRow[]>();

    for (const match of matches) {
      const key = match.match_date
        ? new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }).format(new Date(match.match_date))
        : 'Date TBD';

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(match);
    }

    return Array.from(groups.entries());
  }, [matches]);

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading organization schedule...</main>;
  }

  if (error || !organization) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Organization schedule unavailable
          </h1>
          <p className="mt-3 text-slate-600">
            {error || 'This organization could not be found.'}
          </p>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">
      {/* --------------------------------------------------- */}
      {/* ORGANIZATION HERO */}
      {/* --------------------------------------------------- */}

      <section
        className="relative left-1/2 right-1/2 -mx-[50vw] mt-0 mb-10 w-screen overflow-hidden text-white"
        style={heroStyle}
      >
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* ------------------------------------------------- */}
            {/* LEFT SIDE */}
            {/* ------------------------------------------------- */}

            <div className="flex items-center gap-5">
              {organization.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={`${organization.name} logo`}
                  className="h-20 w-20 rounded-3xl object-cover ring-2 ring-white/30"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 text-xs font-bold text-white ring-2 ring-white/20">
                  LOGO
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Organization Schedule
                </p>

                <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                  {organization.name}
                </h1>

                <p className="mt-1 text-sm text-white/80">
                  {matches.length} match{matches.length === 1 ? '' : 'es'} across {teams.length}{' '}
                  team{teams.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* ------------------------------------------------- */}
            {/* RIGHT SIDE */}
            {/* ------------------------------------------------- */}

           <div className="flex flex-wrap gap-3">
  <Link
    href={`/public/org/${organization.slug}`}
    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
  >
    Overview
  </Link>

  <Link
    href={`/public/org/${organization.slug}/schedule`}
    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
  >
    Schedule
  </Link>
</div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- */}
      {/* SUMMARY */}
      {/* --------------------------------------------------- */}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Teams" value={teams.length} />
        <SummaryCard label="Matches" value={matches.length} />
        <SummaryCard label="Type" value={organization.organization_type.replace('_', ' ')} />
      </section>

      {/* --------------------------------------------------- */}
      {/* SCHEDULE */}
      {/* --------------------------------------------------- */}

      <section className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Organization Schedule</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {matches.length} total
          </span>
        </div>

        {matches.length === 0 ? (
          <p className="text-sm text-slate-500">No matches found for this organization yet.</p>
        ) : (
          <div className="space-y-8">
            {groupedMatches.map(([dateLabel, dateMatches]) => (
              <div key={dateLabel}>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {dateLabel}
                </h3>

                <div className="space-y-3">
                  {dateMatches.map((match) => (
                    <div
                      key={match.id}
                      className="grid items-center gap-4 rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200 md:grid-cols-[1fr_auto_auto]"
                    >
                      {/* ------------------------------------------- */}
                      {/* MATCHUP */}
                      {/* ------------------------------------------- */}

                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          {match.home_team?.logo_url ? (
                            <img
                              src={match.home_team.logo_url}
                              alt={`${match.home_team.name} logo`}
                              className="h-10 w-10 rounded-2xl object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                              LOGO
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {match.home_team?.name || 'Home Team'}
                            </p>
                            <p className="truncate text-sm text-slate-500">
                              vs {match.away_team?.name || 'Away Team'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ------------------------------------------- */}
                      {/* STATUS / TIME / SCORE */}
                      {/* ------------------------------------------- */}

                      <div className="text-right">
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                          {prettyStatus(match.status)}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {match.match_date
                            ? new Intl.DateTimeFormat('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(new Date(match.match_date))
                            : 'Time TBD'}
                        </p>

                        {(match.status === 'live' ||
                          match.status === 'halftime' ||
                          match.status === 'final') && (
                          <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
                            {match.home_score}-{match.away_score}
                          </p>
                        )}
                      </div>

                      {/* ------------------------------------------- */}
                      {/* ACTION */}
                      {/* ------------------------------------------- */}

                      <div className="text-right">
                        {match.status === 'final' && match.public_slug ? (
                          <Link
                            href={`/public/${match.public_slug}`}
                            className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Match Recap
                          </Link>
                        ) : match.public_slug ? (
                          <Link
                            href={`/public/${match.public_slug}`}
                            className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                          >
                            View Match
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
    <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
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
