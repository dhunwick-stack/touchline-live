'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Organization, Team } from '@/lib/types';

type TeamRow = Team & {
  organization: Organization | null;
};

export default function AdminOrganizationPage() {
  // ---------------------------------------------------
  // ROUTE PARAMS
  // ---------------------------------------------------

  const params = useParams();
  const orgId =
    typeof params?.orgId === 'string'
      ? params.orgId
      : Array.isArray(params?.orgId)
        ? params.orgId[0]
        : '';

  // ---------------------------------------------------
  // ORG EDIT STATE
  // ---------------------------------------------------

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [organizationType, setOrganizationType] =
    useState<Organization['organization_type']>('club');
  const [shortName, setShortName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1e3a8a');
  const [secondaryColor, setSecondaryColor] = useState('#7c3aed');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [city, setCity] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [description, setDescription] = useState('');

  // ---------------------------------------------------
  // TEAM STATE
  // ---------------------------------------------------

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLevel, setNewTeamLevel] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newAgeGroup, setNewAgeGroup] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');

  // ---------------------------------------------------
  // UI STATE
  // ---------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [message, setMessage] = useState('');

  // ---------------------------------------------------
  // LOAD ORG + TEAMS
  // ---------------------------------------------------

  useEffect(() => {
    async function loadOrg() {
      if (!orgId) return;

      setLoading(true);
      setMessage('');

      const [
        { data: orgData, error: orgError },
        { data: teamData, error: teamError },
      ] = await Promise.all([
        supabase
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single(),
        supabase
          .from('teams')
          .select(`
            *,
            organization:organization_id (*)
          `)
          .eq('organization_id', orgId)
          .order('gender', { ascending: true })
          .order('age_group', { ascending: true, nullsFirst: false })
          .order('team_level', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true }),
      ]);

      if (orgError || !orgData) {
        setMessage(orgError?.message || 'Failed to load organization.');
        setLoading(false);
        return;
      }

      if (teamError) {
        setMessage(teamError.message);
        setLoading(false);
        return;
      }

      setName(orgData.name || '');
      setSlug(orgData.slug || '');
      setOrganizationType(orgData.organization_type || 'club');
      setShortName(orgData.short_name || '');
      setLogoUrl(orgData.logo_url || '');
      setBannerUrl(orgData.banner_url || '');
      setPrimaryColor(orgData.primary_color || '#1e3a8a');
      setSecondaryColor(orgData.secondary_color || '#7c3aed');
      setWebsiteUrl(orgData.website_url || '');
      setCity(orgData.city || '');
      setStateValue(orgData.state || '');
      setDescription(orgData.description || '');

      setTeams((teamData as TeamRow[]) ?? []);
      setLoading(false);
    }

    loadOrg();
  }, [orgId]);

  // ---------------------------------------------------
  // SAVE ORG
  // ---------------------------------------------------

  async function saveOrg() {
    if (!orgId) return;

    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('organizations')
      .update({
        name: name.trim() || null,
        slug: slug.trim() || null,
        organization_type: organizationType,
        short_name: shortName.trim() || null,
        logo_url: logoUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
        primary_color: primaryColor || null,
        secondary_color: secondaryColor || null,
        website_url: websiteUrl.trim() || null,
        city: city.trim() || null,
        state: stateValue.trim() || null,
        description: description.trim() || null,
      })
      .eq('id', orgId);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage('Organization saved.');
    setSaving(false);
  }

  // ---------------------------------------------------
  // CREATE TEAM IN ORG
  // ---------------------------------------------------

  async function createTeamInOrganization(e: React.FormEvent) {
    e.preventDefault();

    if (!orgId || !name.trim() || !newTeamName.trim()) return;

    setCreatingTeam(true);
    setMessage('');

    const displayClubName = shortName.trim() || name.trim();

    const { error } = await supabase.from('teams').insert({
      name: newTeamName.trim(),
      club_name: displayClubName || null,
      organization_id: orgId,
      team_level: newTeamLevel.trim() || null,
      gender: newGender.trim() || null,
      age_group: newAgeGroup.trim() || null,
      logo_url: newLogoUrl.trim() || logoUrl.trim() || null,
      banner_url: bannerUrl.trim() || null,
      primary_color: primaryColor || null,
      secondary_color: secondaryColor || null,
      is_reusable: true,
    });

    if (error) {
      setMessage(error.message);
      setCreatingTeam(false);
      return;
    }

    setNewTeamName('');
    setNewTeamLevel('');
    setNewGender('');
    setNewAgeGroup('');
    setNewLogoUrl('');
    setMessage('Team created.');

    const { data: refreshedTeams } = await supabase
      .from('teams')
      .select(`
        *,
        organization:organization_id (*)
      `)
      .eq('organization_id', orgId)
      .order('gender', { ascending: true })
      .order('age_group', { ascending: true, nullsFirst: false })
      .order('team_level', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    setTeams((refreshedTeams as TeamRow[]) ?? []);
    setCreatingTeam(false);
  }

  // ---------------------------------------------------
  // LOADING
  // ---------------------------------------------------

  if (loading) {
    return <div className="p-6">Loading organization...</div>;
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Organization</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage organization settings, branding, and teams.
          </p>
        </div>

        {slug ? (
          <Link
            href={`/public/org/${slug}`}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
          >
            View Public Page
          </Link>
        ) : null}
      </div>

      {/* --------------------------------------------------- */}
      {/* ORG SETTINGS */}
      {/* --------------------------------------------------- */}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900">Organization Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Edit branding, structure, and public-facing organization details.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Organization Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Slug">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Organization Type">
            <select
              value={organizationType}
              onChange={(e) =>
                setOrganizationType(e.target.value as Organization['organization_type'])
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="club">Club</option>
              <option value="school">School</option>
              <option value="academy">Academy</option>
              <option value="rec_program">Rec Program</option>
              <option value="league_program">League Program</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Short Name">
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="ETHS, Jahbat FC, etc."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Logo URL">
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Banner URL">
            <input
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Primary Color">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-2 py-2"
            />
          </Field>

          <Field label="Secondary Color">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-2 py-2"
            />
          </Field>

          <Field label="Website URL">
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="City">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="State">
            <input
              value={stateValue}
              onChange={(e) => setStateValue(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

        <div className="mt-6">
          <button
            type="button"
            onClick={saveOrg}
            className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white"
          >
            {saving ? 'Saving...' : 'Save Organization'}
          </button>
        </div>
      </section>

      {/* --------------------------------------------------- */}
      {/* CREATE TEAM IN ORG */}
      {/* --------------------------------------------------- */}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900">Create Team in Organization</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add a new team directly under this organization.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            New teams inherit this organization&apos;s banner and colors automatically. If no team
            logo is entered, the organization logo will be used by default.
          </p>
        </div>

        <form onSubmit={createTeamInOrganization} className="grid gap-4 md:grid-cols-2">
          <Field label="Team Name">
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="07 Premier, Varsity, JV..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Team Level">
            <input
              value={newTeamLevel}
              onChange={(e) => setNewTeamLevel(e.target.value)}
              placeholder="Premier, Varsity, Elite..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <Field label="Gender">
            <select
              value={newGender}
              onChange={(e) => setNewGender(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">Not set</option>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="coed">Coed</option>
            </select>
          </Field>

          <Field label="Age Group">
            <input
              value={newAgeGroup}
              onChange={(e) => setNewAgeGroup(e.target.value)}
              placeholder="2007, U14, Freshman..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Team Logo URL">
              <input
                value={newLogoUrl}
                onChange={(e) => setNewLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
              <p className="text-xs font-medium text-slate-500">
                Leave blank to use the organization logo automatically.
              </p>
            </Field>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white"
            >
              {creatingTeam ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </section>

      {/* --------------------------------------------------- */}
      {/* ORG TEAMS */}
      {/* --------------------------------------------------- */}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Teams in Organization</h2>
            <p className="mt-1 text-sm text-slate-500">
              View and manage teams currently assigned to this organization.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {teams.length} total
          </span>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">No teams linked yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
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
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
