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

    const resolvedClubName =
      clubName.trim() ||
      selectedOrganization?.name ||
      null;

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
      {/* SEARCH BAR */}
      {/* --------------------------------------------------- */}

      <div className="mt-6">
        <div className="rounded-3xl bg-slate-100 p-4">
          <div className="flex items-center rounded-3xl border border-slate-200 bg-white px-4 py-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-3 h-5 w-5 shrink-0 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m1.85-5.4a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
              />
            </svg>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams, organizations, age groups, levels, or gender..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {filteredTeams.length} team{filteredTeams.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* CREATE TEAM FORM */}
      {/* --------------------------------------------------- */}

      <div
        className={`grid transition-all duration-300 ease-out ${
          showCreateForm ? 'mt-6 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <form
            onSubmit={createTeam}
            className="animate-subtle-slide-down space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <div>
              <h2 className="text-xl font-bold text-slate-900">Create Team</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add a reusable team with organization support, age group, level, gender, and logo.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Team name"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <select
                value={organizationId ?? ''}
                onChange={(e) => setOrganizationId(e.target.value || null)}
                className="rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">No organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>

              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Club / display name (legacy compatibility)"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                value={teamLevel}
                onChange={(e) => setTeamLevel(e.target.value)}
                placeholder="Team level (Varsity, JV, Premier...)"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Gender</option>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="coed">Coed</option>
              </select>

              <input
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder="Age group"
                className="rounded-xl border border-slate-300 px-4 py-3"
              />

              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Logo URL"
                className="rounded-xl border border-slate-300 px-4 py-3 md:col-span-2"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? 'Adding…' : 'Add Team'}
              </button>

              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          </form>
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* TEAM GRID */}
      {/* --------------------------------------------------- */}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredTeams.map((team) => (
          <Link
            key={team.id}
            href={`/team-login?teamId=${team.id}`}
            className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
          >
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

              <div className="min-w-0">
                <div className="truncate font-semibold">{team.name}</div>
                <div className="truncate text-sm text-slate-500">
                  {getTeamSubtext(team)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}