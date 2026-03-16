'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Organization, Team } from '@/lib/types';

type TeamRow = Team & {
  organization: Organization | null;
};

export default function TeamsPage() {
  // ---------------------------------------------------
  // DATA STATE
  // ---------------------------------------------------

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');

  // ---------------------------------------------------
  // FORM STATE
  // ---------------------------------------------------

  const [name, setName] = useState('');
  const [clubName, setClubName] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [teamLevel, setTeamLevel] = useState('');
  const [gender, setGender] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // ---------------------------------------------------
  // UI STATE
  // ---------------------------------------------------

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ---------------------------------------------------
  // DATA LOADING
  // ---------------------------------------------------

  async function loadTeams() {
    const [
      { data: teamData, error: teamError },
      { data: organizationData, error: organizationError },
    ] = await Promise.all([
      supabase
        .from('teams')
        .select(`
          *,
          organization:organization_id (*)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('organizations').select('*').order('name', { ascending: true }),
    ]);

    if (teamError || organizationError) {
      setMessage(`Load error: ${teamError?.message || organizationError?.message}`);
      return;
    }

    setTeams((teamData as TeamRow[]) ?? []);
    setOrganizations((organizationData as Organization[]) ?? []);
  }

  useEffect(() => {
    loadTeams();
  }, []);

  // ---------------------------------------------------
  // CREATE TEAM
  // ---------------------------------------------------

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return;

    setLoading(true);
    setMessage('');

    const selectedOrganization =
      organizations.find((org) => org.id === organizationId) || null;

    const resolvedClubName = clubName.trim() || selectedOrganization?.name || null;

    const { error } = await supabase.from('teams').insert({
      name: name.trim(),
      club_name: resolvedClubName,
      organization_id: organizationId,
      team_level: teamLevel.trim() || null,
      gender: gender.trim() || null,
      age_group: ageGroup.trim() || null,
      logo_url: logoUrl.trim() || null,
      is_reusable: true,
    });

    if (error) {
      setMessage(`Save error: ${error.message}`);
      setLoading(false);
      return;
    }

    setName('');
    setClubName('');
    setOrganizationId(null);
    setTeamLevel('');
    setGender('');
    setAgeGroup('');
    setLogoUrl('');
    setMessage('Team added.');
    setLoading(false);
    setShowCreateForm(false);

    loadTeams();
  }

  // ---------------------------------------------------
  // FILTERED TEAMS
  // ---------------------------------------------------

  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return teams;

    return teams.filter((team) => {
      const teamName = (team.name || '').toLowerCase();
      const club = (team.club_name || '').toLowerCase();
      const orgName = (team.organization?.name || '').toLowerCase();
      const age = (team.age_group || '').toLowerCase();
      const level = (team.team_level || '').toLowerCase();
      const teamGender = (team.gender || '').toLowerCase();

      return (
        teamName.includes(q) ||
        club.includes(q) ||
        orgName.includes(q) ||
        age.includes(q) ||
        level.includes(q) ||
        teamGender.includes(q)
      );
    });
  }, [teams, search]);

  // ---------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------

  function getTeamSubtext(team: TeamRow) {
    const parentName = team.organization?.name || team.club_name || 'No organization';
    const details = [team.age_group, team.team_level, team.gender]
      .filter(Boolean)
      .join(' • ');

    return details ? `${parentName} • ${details}` : parentName;
  }

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Teams</h1>
          <p className="mt-2 text-slate-600">
            Search reusable teams or add a new one for future matches.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-800"
        >
          {showCreateForm ? 'Cancel' : '+ Create Team'}
        </button>
      </div>

      {/* --------------------------------------------------- */}
      {/* STATUS MESSAGE */}
      {/* --------------------------------------------------- */}

      {message ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* CREATE TEAM FORM */}
      {/* --------------------------------------------------- */}

      {showCreateForm ? (
        <form
          onSubmit={createTeam}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Team Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chicago Fire U17"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Club Name
              </label>
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Optional if organization is selected"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Organization
              </label>
              <select
                value={organizationId ?? ''}
                onChange={(e) => setOrganizationId(e.target.value || null)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              >
                <option value="">No organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Team Level
              </label>
              <input
                value={teamLevel}
                onChange={(e) => setTeamLevel(e.target.value)}
                placeholder="Premier, Elite, Varsity..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Gender
              </label>
              <input
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder="Boys, Girls, Coed..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Age Group
              </label>
              <input
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="U17, U14..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Logo URL
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Team'}
            </button>

            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* SEARCH BAR */}
      {/* --------------------------------------------------- */}

      <div className="mt-6">
        <div className="rounded-3xl bg-slate-100 p-4">
          <div className="flex items-center rounded-3xl border border-slate-200 bg-white px-4 py-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {filteredTeams.length} team{filteredTeams.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* TEAM GRID */}
      {/* --------------------------------------------------- */}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredTeams.map((team) => (
          <div
  key={team.id}
  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
>
  <div
  className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
  style={{
    backgroundColor: team.primary_color || '#0e172b',
  }}
/>
            {/* --------------------------------------------------- */}
            {/* TEAM CARD HEADER */}
            {/* --------------------------------------------------- */}

            <div className="flex items-center gap-3">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                  LOGO
                </div>
              )}

              <div className="min-w-0 flex-1">
               <Link
  href={`/public/team/${team.id}`}
  className="block truncate font-semibold hover:underline"
  style={{ color: team.primary_color || '#0f172a' }}
>
  {team.name}
</Link>

                <div className="truncate text-sm text-slate-500">
                  {getTeamSubtext(team)}
                </div>
              </div>
            </div>

            {/* --------------------------------------------------- */}
            {/* TEAM ACTIONS */}
            {/* --------------------------------------------------- */}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
             <Link
  href={`/public/team/${team.id}`}
  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
>
  Public View
</Link>

             <Link
  href={`/team-login?teamId=${team.id}&mode=admin`}
  className="flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
  style={{ backgroundColor: '#0e172b', color: '#ffffff' }}
>
  Admin Login
</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}