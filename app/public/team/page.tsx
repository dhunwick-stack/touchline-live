'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Organization, Team } from '@/lib/types';

type TeamRow = Team & {
  organization: Organization | null;
};

export default function PublicTeamsIndexPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTeams() {
      setLoading(true);
      setError('');

      const { data, error: teamError } = await supabase
        .from('teams')
        .select(`
          *,
          organization:organization_id (*)
        `)
        .order('name', { ascending: true });

      if (teamError) {
        setError(teamError.message || 'Failed to load public teams.');
        setLoading(false);
        return;
      }

      setTeams((data as TeamRow[]) ?? []);
      setLoading(false);
    }

    loadTeams();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredTeams = useMemo(() => {
    if (!normalizedQuery) return teams;

    return teams.filter((team) =>
      [team.name, team.club_name, team.nickname, team.organization?.name, team.team_level, team.age_group]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [teams, normalizedQuery]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Public Teams</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Browse Team Pages
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Find a public team page for schedules, results, leaders, and roster details.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search team, school, club, or nickname..."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 sm:max-w-md"
          />

          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {filteredTeams.length} team{filteredTeams.length === 1 ? '' : 's'}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          Loading public teams...
        </section>
      ) : error ? (
        <section className="mt-6 rounded-3xl bg-white p-6 text-red-600 shadow-sm ring-1 ring-slate-200">
          {error}
        </section>
      ) : filteredTeams.length === 0 ? (
        <section className="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">No teams found</h2>
          <p className="mt-2 text-sm text-slate-600">Try a different search.</p>
        </section>
      ) : (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTeams.map((team) => (
            <Link
              key={team.id}
              href={`/public/team/${team.id}`}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={`${team.name} logo`}
                    className="h-16 w-16 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-500">
                    LOGO
                  </div>
                )}

                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-900">{team.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {[team.club_name || team.organization?.name, team.nickname]
                      .filter(Boolean)
                      .join(' • ') || 'Team page'}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {[team.age_group, team.team_level, team.gender].filter(Boolean).join(' • ')}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
