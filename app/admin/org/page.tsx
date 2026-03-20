'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Organization } from '@/lib/types';
import { useSuperAdminGuard } from '@/lib/useSuperAdminGuard';

// ---------------------------------------------------
// SLUG HELPER
// ---------------------------------------------------

function slugifyOrganization(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminOrgPage() {
  const { authChecked, currentUser, hasSuperAccess, loading: accessLoading } = useSuperAdminGuard({
    nextPath: '/admin/org',
  });

  // ---------------------------------------------------
  // PAGE STATE
  // ---------------------------------------------------

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [name, setName] = useState('');
  const [organizationType, setOrganizationType] = useState('club');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [message, setMessage] = useState('');

  // ---------------------------------------------------
  // LOAD ORGANIZATIONS
  // ---------------------------------------------------

  async function loadOrgs() {
    setLoadingOrgs(true);

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoadingOrgs(false);
      return;
    }

    setOrgs((data as Organization[]) ?? []);
    setLoadingOrgs(false);
  }

  // ---------------------------------------------------
  // INITIAL DATA LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!authChecked || !hasSuperAccess) return;
    loadOrgs();
  }, [authChecked, hasSuperAccess]);

  // ---------------------------------------------------
  // CREATE ORGANIZATION
  // ---------------------------------------------------

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();

    // ---------------------------------------------------
    // HARD STOP IF NOT AUTHORIZED
    // ---------------------------------------------------

    if (!hasSuperAccess) {
      setMessage('You must log in as a global admin to create an organization.');
      return;
    }

    const cleanName = name.trim();

    if (!cleanName) {
      setMessage('Organization name is required.');
      return;
    }

    setLoading(true);
    setMessage('');

    const slug = slugifyOrganization(cleanName);

    if (!slug) {
      setMessage('Could not generate a valid slug for this organization.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('organizations').insert({
      name: cleanName,
      slug,
      organization_type: organizationType,
      is_public: isPublic,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    // ---------------------------------------------------
    // RESET FORM
    // ---------------------------------------------------

    setName('');
    setOrganizationType('club');
    setIsPublic(true);
    setLoading(false);
    setMessage('Organization created.');

    loadOrgs();
  }

  // ---------------------------------------------------
  // ACCESS LOADING
  // ---------------------------------------------------

  if (!authChecked || accessLoading) {
    return <main className="mx-auto max-w-5xl px-6 py-10">Checking access...</main>;
  }

  if (!hasSuperAccess) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black">Super Admin Access Required</h1>
          <p className="mt-3 text-slate-600">
            {currentUser?.email || 'This account'} is signed in, but it is not authorized to manage
            organizations.
          </p>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Organizations</h1>
          <p className="mt-2 text-slate-600">
            Browse clubs, schools, leagues, and academies across Touchline.
          </p>
        </div>

        <Link
          href="/admin"
          className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
        >
          Admin Dashboard
        </Link>
      </div>

      {/* --------------------------------------------------- */}
      {/* ADMIN-ONLY CREATE ORGANIZATION FORM */}
      {/* --------------------------------------------------- */}

      {hasSuperAccess ? (
        <form
          onSubmit={createOrg}
          className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-bold">Create Organization</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Organization Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chicago Fire Academy"
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Organization Type
              </label>
              <select
                value={organizationType}
                onChange={(e) => setOrganizationType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="club">Club</option>
                <option value="school">School</option>
                <option value="academy">Academy</option>
                <option value="league">League</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Visibility
              </label>
              <select
                value={isPublic ? 'public' : 'private'}
                onChange={(e) => setIsPublic(e.target.value === 'public')}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* STATUS MESSAGE */}
      {/* --------------------------------------------------- */}

      {message ? (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          {message}
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* ORGANIZATION GRID */}
      {/* --------------------------------------------------- */}

      {loadingOrgs ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          Loading organizations...
        </div>
      ) : orgs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            No Organizations Yet
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            No organizations have been added
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Clubs, schools, academies, and leagues will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              {/* --------------------------------------------------- */}
              {/* ORG BRAND STRIPE */}
              {/* --------------------------------------------------- */}

              <div
                className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
                style={{
                  backgroundColor: org.primary_color || '#0e172b',
                }}
              />

              {/* --------------------------------------------------- */}
              {/* ORG HEADER */}
              {/* --------------------------------------------------- */}

              <div className="flex items-center gap-3">
                {org.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt={`${org.name} logo`}
                    className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                    LOGO
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{org.name}</p>
                  <div className="truncate text-sm text-slate-500">
                    {org.organization_type?.replace(/_/g, ' ') || 'Unknown'}
                  </div>
                </div>
              </div>

              {/* --------------------------------------------------- */}
              {/* ORG META PILLS */}
              {/* --------------------------------------------------- */}

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {org.slug}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    org.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {org.is_public ? 'Public' : 'Private'}
                </span>
              </div>

              {/* --------------------------------------------------- */}
              {/* ACTIONS */}
              {/* --------------------------------------------------- */}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {org.is_public ? (
                  <Link
                    href={`/public/org/${org.slug}`}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Public View
                  </Link>
                ) : (
                  <div className="flex-1 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-400">
                    Private Org
                  </div>
                )}

                <Link
                  href={`/admin/org/${org.id}`}
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
