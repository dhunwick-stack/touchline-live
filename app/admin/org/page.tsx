'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Organization } from '@/lib/types';

export default function AdminOrganizationsPage() {
  // ---------------------------------------------------
  // DATA STATE
  // ---------------------------------------------------

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // ---------------------------------------------------
  // LOAD ORGANIZATIONS
  // ---------------------------------------------------

  useEffect(() => {
    async function loadOrganizations() {
      setLoading(true);
      setMessage('');

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setOrganizations((data as Organization[]) ?? []);
      setLoading(false);
    }

    loadOrganizations();
  }, []);

  // ---------------------------------------------------
  // FILTERED ORGANIZATIONS
  // ---------------------------------------------------

  const filteredOrganizations = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return organizations;

    return organizations.filter((org) => {
      const haystack = [
        org.name,
        org.short_name,
        org.slug,
        org.organization_type,
        org.city,
        org.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [organizations, search]);

  // ---------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------

  function prettyOrgType(type: Organization['organization_type']) {
    if (type === 'school') return 'School';
    if (type === 'club') return 'Club';
    if (type === 'academy') return 'Academy';
    if (type === 'rec_program') return 'Rec Program';
    if (type === 'league_program') return 'League Program';
    return 'Other';
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Organizations</h1>
          <p className="mt-2 text-slate-600">
            Manage clubs, schools, and other organizations in Touchline Live.
          </p>
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* SEARCH BAR */}
      {/* --------------------------------------------------- */}

      <div className="mt-6 rounded-3xl bg-slate-100 p-4">
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
            placeholder="Search organizations, slugs, type, city, or state..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>

        <p className="mt-2 text-sm text-slate-500">
          {filteredOrganizations.length} organization
          {filteredOrganizations.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* --------------------------------------------------- */}
      {/* STATUS / ERROR */}
      {/* --------------------------------------------------- */}

      {message ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          Loading organizations...
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* ORGANIZATION GRID */}
      {/* --------------------------------------------------- */}

      {!loading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrganizations.map((org) => (
            <div
              key={org.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/60"
            >
              <div className="flex items-center gap-3">
                {org.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt={`${org.name} logo`}
                    className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                    LOGO
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{org.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {prettyOrgType(org.organization_type)}
                    {org.city || org.state
                      ? ` • ${[org.city, org.state].filter(Boolean).join(', ')}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  /{org.slug}
                </span>

                {org.short_name ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {org.short_name}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/admin/org/${org.id}`}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Edit
                </Link>

                <Link
                  href={`/public/org/${org.slug}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
                >
                  View Public Page
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* EMPTY STATE */}
      {/* --------------------------------------------------- */}

      {!loading && filteredOrganizations.length === 0 ? (
        <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">No organizations found</h2>
          <p className="mt-2 text-slate-600">
            Try a different search or create organizations from your database workflow.
          </p>
        </div>
      ) : null}
    </main>
  );
}