'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { lookupTeamLocation } from '@/lib/teamLocationLookup';
import { findInheritedBrandTeam } from '@/lib/teamBranding';
import type { Organization, Team } from '@/lib/types';

// ---------------------------------------------------
// LOCAL TYPES
// ---------------------------------------------------

type TeamRow = Team & {
  organization: Organization | null;
};

type SuggestedLocation = {
  source: 'inherited' | 'derived';
  address: string;
};

// ---------------------------------------------------
// PAGE
// FILE: app/teams/page.tsx
// ---------------------------------------------------

export default function TeamsPage() {
  const [showOnlyMine] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mine') === '1';
  });

  // ---------------------------------------------------
  // DATA STATE
  // ---------------------------------------------------

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [memberTeamIds, setMemberTeamIds] = useState<string[]>([]);

  // ---------------------------------------------------
  // ACCESS STATE
  // ---------------------------------------------------

  const [hasAccess] = useState(() => {
    if (typeof window === 'undefined') return false;

    try {
      const rawSession = localStorage.getItem('teamAdminSession');
      const storedTeamId = localStorage.getItem('teamId');

      if (!rawSession || !storedTeamId) {
        return false;
      }

      const session = JSON.parse(rawSession);
      return session.teamId === storedTeamId && session.expires > Date.now();
    } catch {
      localStorage.removeItem('teamAdminSession');
      localStorage.removeItem('teamId');
      return false;
    }
  });
  const [accessChecked] = useState(true);

  // ---------------------------------------------------
  // FORM STATE
  // ---------------------------------------------------

  const [name, setName] = useState('');
  const [clubName, setClubName] = useState('');
  const [nickname, setNickname] = useState('');
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
  const [suggestedLocation, setSuggestedLocation] = useState<SuggestedLocation | null>(null);
  const [lookingUpLocation, setLookingUpLocation] = useState(false);

  // ---------------------------------------------------
  // ACCESS CHECK
  // ---------------------------------------------------

  // ---------------------------------------------------
  // LOAD TEAMS + ORGANIZATIONS
  // ---------------------------------------------------

  const loadTeams = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const [
      { data: teamData, error: teamError },
      { data: organizationData, error: organizationError },
      membershipResult,
    ] = await Promise.all([
      supabase
        .from('teams')
        .select(`
          *,
          organization:organization_id (*)
        `),
      supabase.from('organizations').select('*').order('name', { ascending: true }),
      session?.user
        ? supabase.from('team_users').select('team_id').eq('user_id', session.user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (teamError || organizationError || membershipResult.error) {
      setMessage(
        `Load error: ${teamError?.message || organizationError?.message || membershipResult.error?.message}`,
      );
      return;
    }

    setTeams((teamData as TeamRow[]) ?? []);
    setOrganizations((organizationData as Organization[]) ?? []);
    setMemberTeamIds(((membershipResult.data as { team_id: string }[]) ?? []).map((row) => row.team_id));
  }, []);

  // ---------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTeams();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTeams]);

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === organizationId) || null,
    [organizationId, organizations],
  );

  const resolvedClubName = clubName.trim() || selectedOrganization?.name || null;
  const inheritedTeamPreview = useMemo(
    () =>
      findInheritedBrandTeam({
        teamName: name.trim(),
        clubName: resolvedClubName,
        organizationId,
        teams,
      }),
    [name, resolvedClubName, organizationId, teams],
  );
  const visibleSuggestedLocation = inheritedTeamPreview?.home_field_address
    ? {
        source: 'inherited' as const,
        address: inheritedTeamPreview.home_field_address,
      }
    : suggestedLocation;

  useEffect(() => {
    if (!showCreateForm || !name.trim() || inheritedTeamPreview?.home_field_address) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setLookingUpLocation(true);
        const derivedLocation = await lookupTeamLocation({
          teamName: name.trim(),
          clubName: resolvedClubName,
          city: selectedOrganization?.city || null,
          state: selectedOrganization?.state || null,
        });

        setSuggestedLocation(
          derivedLocation
            ? {
                source: 'derived',
                address: derivedLocation.address,
              }
            : null,
        );
        setLookingUpLocation(false);
      })();
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [showCreateForm, name, resolvedClubName, selectedOrganization, inheritedTeamPreview]);

  // ---------------------------------------------------
  // CREATE TEAM
  // ---------------------------------------------------

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();

    if (!hasAccess) {
      setMessage('You do not have permission to create a team.');
      return;
    }

    if (!name.trim()) return;

    setLoading(true);
    setMessage('');

    const inheritedTeam = findInheritedBrandTeam({
      teamName: name.trim(),
      clubName: resolvedClubName,
      organizationId,
      teams,
    });
    const derivedLocation =
      inheritedTeam?.home_field_address
        ? null
        : await lookupTeamLocation({
            teamName: name.trim(),
            clubName: resolvedClubName,
            city: selectedOrganization?.city || null,
            state: selectedOrganization?.state || null,
          });

    const { error } = await supabase.from('teams').insert({
      name: name.trim(),
      club_name: resolvedClubName,
      nickname: nickname.trim() || null,
      organization_id: organizationId,
      team_level: teamLevel.trim() || null,
      gender: gender.trim() || null,
      age_group: ageGroup.trim() || null,
      logo_url: logoUrl.trim() || inheritedTeam?.logo_url || null,
      banner_url: inheritedTeam?.banner_url || null,
      primary_color: inheritedTeam?.primary_color || null,
      secondary_color: inheritedTeam?.secondary_color || null,
      home_field_name: inheritedTeam?.home_field_name || null,
      home_field_address: inheritedTeam?.home_field_address || derivedLocation?.address || null,
      home_field_lat: inheritedTeam?.home_field_lat || derivedLocation?.lat || null,
      home_field_lng: inheritedTeam?.home_field_lng || derivedLocation?.lng || null,
      is_reusable: true,
    });

    if (error) {
      setMessage(`Save error: ${error.message}`);
      setLoading(false);
      return;
    }

    // ---------------------------------------------------
    // RESET FORM
    // ---------------------------------------------------

    setName('');
    setClubName('');
    setNickname('');
    setOrganizationId(null);
    setTeamLevel('');
    setGender('');
    setAgeGroup('');
    setLogoUrl('');
    setSuggestedLocation(null);
    setLookingUpLocation(false);
    setMessage('Team added.');
    setLoading(false);
    setShowCreateForm(false);

    loadTeams();
  }

  // ---------------------------------------------------
  // FILTERED + SORTED TEAMS
  // ---------------------------------------------------

  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase().trim();

    const sourceTeams = showOnlyMine ? teams.filter((team) => memberTeamIds.includes(team.id)) : teams;

    const base = !q
      ? sourceTeams
      : sourceTeams.filter((team) => {
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

    return [...base].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
    );
  }, [teams, memberTeamIds, search, showOnlyMine]);

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
  // ACCESS LOADING
  // ---------------------------------------------------

  if (!accessChecked) {
    return <main className="mx-auto max-w-5xl px-6 py-10">Checking access...</main>;
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
            {showOnlyMine
              ? 'Your approved team admin access.'
              : 'Search reusable teams or add a new one for future matches.'}
          </p>
        </div>

        {hasAccess ? (
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-800"
          >
            {showCreateForm ? 'Cancel' : '+ Create Team'}
          </button>
        ) : null}
      </div>

      {/* --------------------------------------------------- */}
      {/* STATUS MESSAGE */}
      {/* --------------------------------------------------- */}

      {message ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      {showOnlyMine ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Showing only teams you have access to.
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* CREATE TEAM FORM
      {/* --------------------------------------------------- */}

      {hasAccess && showCreateForm ? (
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
                Nickname / Mascot
              </label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Wildkits, Tigers, Bulldogs..."
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

          {name.trim() ? (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
              <p className="font-semibold text-slate-900">Suggested Home Field</p>
              {lookingUpLocation ? (
                <p className="mt-1 text-slate-600">Looking up likely address...</p>
              ) : visibleSuggestedLocation ? (
                <p className="mt-1 text-slate-600">
                  {visibleSuggestedLocation.source === 'inherited'
                    ? 'Inherited from a related team: '
                    : 'Derived from team/location data: '}
                  {visibleSuggestedLocation.address}
                </p>
              ) : (
                <p className="mt-1 text-slate-500">No address suggestion yet.</p>
              )}
            </div>
          ) : null}

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
              onClick={() => {
                setShowCreateForm(false);
                setSuggestedLocation(null);
                setLookingUpLocation(false);
              }}
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
        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4 text-slate-400"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams, clubs, age groups, or levels..."
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />

            <div className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:block">
              Search
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <p className="text-sm text-slate-500">
              {filteredTeams.length} team{filteredTeams.length === 1 ? '' : 's'}
            </p>

            <div className="flex items-center gap-3">
              {showOnlyMine ? (
                <Link
                  href="/teams"
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
                >
                  View All
                </Link>
              ) : null}

              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* TEAM GRID */}
      {/* --------------------------------------------------- */}

      {filteredTeams.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            No Teams Found
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            Nothing matches your search
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Try a different team name, club, age group, or level.
          </p>

          {search.trim() ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear Search
            </button>
          ) : null}
        </div>
      ) : (
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

                  <div className="truncate text-sm text-slate-500">{getTeamSubtext(team)}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/public/team/${team.id}`}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Public View
                </Link>

                <Link
                  href={`/teams/${team.id}`}
                  className="flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: '#0e172b', color: '#ffffff' }}
                >
                  Admin View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
