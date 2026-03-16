'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Users, Trophy, Calendar } from 'lucide-react';
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

export default function PublicOrganizationPage() {
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
  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([]);
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

    async function loadPage() {
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
        setRecentMatches([]);
        setLoading(false);
        return;
      }

      const teamIds = loadedTeams.map((team) => team.id);

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .or(teamIds.map((id) => `home_team_id.eq.${id}`).concat(teamIds.map((id) => `away_team_id.eq.${id}`)).join(','))
        .eq('status', 'final')
        .order('match_date', { ascending: false, nullsFirst: false })
        .limit(12);

      if (matchError) {
        setError(matchError.message);
        setLoading(false);
        return;
      }

      setRecentMatches((matchData as MatchRow[]) ?? []);
      setLoading(false);
    }

    loadPage();
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

  const groupedTeams = useMemo(() => {
    const groups = new Map<string, TeamRow[]>();

    for (const team of teams) {
      const key =
        [team.gender, team.age_group, team.team_level].filter(Boolean).join(' • ') || 'Teams';

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(team);
    }

    return Array.from(groups.entries());
  }, [teams]);

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading) {
    return <main className="mx-auto max-w-7xl px-5 py-8">Loading organization page...</main>;
  }

  if (error || !organization) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Organization not found
          </h1>
          <p className="mt-3 text-slate-600">{error || 'This organization could not be found.'}</p>
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
  {/* dark overlay */}
  <div className="absolute inset-0 bg-black/30" />

  <div className="relative mx-auto max-w-7xl px-6 py-12">

    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

      {/* LEFT SIDE */}
      <div className="flex items-center gap-5">

        {/* LOGO */}
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

        {/* NAME */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Organization
          </p>

          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            {organization.name}
          </h1>

          <p className="mt-1 text-sm text-white/80">
            {teams.length} team{teams.length !== 1 ? 's' : ''} in Touchline Live
          </p>
        </div>
      </div>

      {/* RIGHT SIDE */}
<div className="flex flex-wrap gap-3">
 <Link
  href={`/public/org/${organization.slug}`}
  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
>
  Overview
</Link>

  <Link
    href={`/public/org/${organization.slug}/schedule`}
    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/20"
  >
    Schedule
  </Link>
</div>
    </div>

  </div>
</section>

       {/* --------------------------------------------------- */}
      {/* RECENT MATCHES STRIP */}
      {/* --------------------------------------------------- */}

      <section className="mb-6 rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Recent Matches
          </h2>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {Math.min(recentMatches.length, 4)} shown
          </span>
        </div>

        {recentMatches.length === 0 ? (
          <p className="text-sm text-slate-500">No recent matches yet.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto scroll-smooth pb-2 md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible">
            {recentMatches.slice(0, 4).map((match) => (
              <div
                key={match.id}
                className="min-w-[280px] rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:min-w-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* --------------------------------------------------- */}
                    {/* HOME TEAM */}
                    {/* --------------------------------------------------- */}

                    <div className="flex items-center gap-2">
                      {match.home_team?.logo_url ? (
                        <img
                          src={match.home_team.logo_url}
                          alt={`${match.home_team.name} logo`}
                          className="h-8 w-8 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                          LOGO
                        </div>
                      )}

                      <p className="truncate text-sm font-semibold text-slate-900">
                        {match.home_team?.name || 'Home'}
                      </p>
                    </div>

                    {/* --------------------------------------------------- */}
                    {/* AWAY TEAM */}
                    {/* --------------------------------------------------- */}

                    <div className="mt-2 flex items-center gap-2">
                      {match.away_team?.logo_url ? (
                        <img
                          src={match.away_team.logo_url}
                          alt={`${match.away_team.name} logo`}
                          className="h-8 w-8 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                          LOGO
                        </div>
                      )}

                      <p className="truncate text-sm text-slate-600">
                        {match.away_team?.name || 'Away'}
                      </p>
                    </div>
                  </div>

                  {/* --------------------------------------------------- */}
                  {/* SCORE */}
                  {/* --------------------------------------------------- */}

                  <div className="shrink-0 text-lg font-black tabular-nums text-slate-900">
                    {match.home_score}-{match.away_score}
                  </div>
                </div>

                {/* --------------------------------------------------- */}
                {/* DATE */}
                {/* --------------------------------------------------- */}

                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {match.match_date
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }).format(new Date(match.match_date))
                    : 'Date TBD'}
                </p>

                {/* --------------------------------------------------- */}
                {/* ACTION */}
                {/* --------------------------------------------------- */}

                <div className="mt-4">
                  {match.public_slug ? (
                    <Link
                      href={`/public/${match.public_slug}`}
                      className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      View Recap
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">No recap link</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------- */}
      {/* SUMMARY */}
      {/* --------------------------------------------------- */}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Teams" value={teams.length} />
        <SummaryCard label="Recent Finals" value={recentMatches.length} />
        <SummaryCard
          label="Type"
          value={organization.organization_type.replace('_', ' ')}
        />
      </section>

      {/* --------------------------------------------------- */}
      {/* TEAMS */}
      {/* --------------------------------------------------- */}

      <section className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Teams</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {teams.length} total
          </span>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">No teams are linked to this organization yet.</p>
        ) : (
          <div className="space-y-6">
            {groupedTeams.map(([groupLabel, groupTeams]) => (
              <div key={groupLabel}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {groupLabel}
                </h3>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupTeams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/public/team/${team.id}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {team.logo_url ? (
                          <img
                            src={team.logo_url}
                            alt={`${team.name} logo`}
                            className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                            LOGO
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{team.name}</p>
                          <p className="truncate text-sm text-slate-500">
                            {[team.age_group, team.team_level, team.gender]
                              .filter(Boolean)
                              .join(' • ') || 'Team'}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------- */}
      {/* RECENT RESULTS */}
      {/* --------------------------------------------------- */}

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Recent Results</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {recentMatches.length} matches
          </span>
        </div>

        {recentMatches.length === 0 ? (
          <p className="text-sm text-slate-500">No completed matches found yet.</p>
        ) : (
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <div
                key={match.id}
                className="grid items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200 md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {match.home_team?.name || 'Home'} vs {match.away_team?.name || 'Away'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {match.match_date
                      ? new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(match.match_date))
                      : 'Date TBD'}
                  </p>
                </div>

                <div className="text-lg font-black tabular-nums text-slate-900">
                  {match.home_score}-{match.away_score}
                </div>

                <div>
                  {match.public_slug ? (
                    <Link
                      href={`/public/${match.public_slug}`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Match Recap
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
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
  // ---------------------------------------------------
  // ICON PICKER
  // ---------------------------------------------------

  function renderIcon() {
    if (label === 'Teams') {
      return <Users className="h-6 w-6 text-slate-400" />;
    }

    if (label === 'Recent Finals') {
      return <Trophy className="h-6 w-6 text-slate-400" />;
    }

    if (label === 'Type') {
      return <Calendar className="h-6 w-6 text-slate-400" />;
    }

    return null;
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        {renderIcon()}

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
