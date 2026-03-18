'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Organization } from '@/lib/types';

// ---------------------------------------------------
// PAGE
// FILE: app/public/org/page.tsx
// ---------------------------------------------------

export default function PublicOrganizationDirectory() {
  // ---------------------------------------------------
  // STATE
  // ---------------------------------------------------

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  // ---------------------------------------------------
  // LOAD PUBLIC ORGANIZATIONS
  // ---------------------------------------------------

  async function loadOrganizations() {
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('is_public', true)
      .order('name', { ascending: true });

    if (error) {
      setMessage(`Load error: ${error.message}`);
      setLoading(false);
      return;
    }

    setOrganizations((data as Organization[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrganizations();
  }, []);

  // ---------------------------------------------------
  // FILTERED ORGANIZATIONS
  // ---------------------------------------------------

  const filteredOrganizations = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return organizations;

    return organizations.filter((org) => {
      const name = (org.name || '').toLowerCase();
      const shortName = (org.short_name || '').toLowerCase();
      const slug = (org.slug || '').toLowerCase();
      const type = (org.organization_type || '').toLowerCase();
      const city = (org.city || '').toLowerCase();
      const state = (org.state || '').toLowerCase();

      return (
        name.includes(q) ||
        shortName.includes(q) ||
        slug.includes(q) ||
        type.includes(q) ||
        city.includes(q) ||
        state.includes(q)
      );
    });
  }, [organizations, search]);

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="text-3xl font-black tracking-tight">Organizations</h1>
          <p className="mt-2 text-slate-600">
            Browse public clubs, schools, academies, and leagues using Touchline Live.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/admin-login?next=/admin/org"
            className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            Admin Login
          </Link>

          <Link
            href="/teams"
            className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 ring-1 ring-slate-200"
          >
            Teams
          </Link>
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* SEARCH BAR */}
      {/* --------------------------------------------------- */}

      <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Search
        </label>

        <div className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 ring-1 ring-slate-200">
          <svg
            className="h-4 w-4 shrink-0 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organization, location, or type"
            className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </section>

      {/* --------------------------------------------------- */}
      {/* STATUS MESSAGE */}
      {/* --------------------------------------------------- */}

      {message ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {message}
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* LOADING / EMPTY / GRID */}
      {/* --------------------------------------------------- */}

      {loading ? (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          Loading organizations...
        </div>
      ) : filteredOrganizations.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">No organizations found</h2>
          <p className="mt-2 text-slate-600">
            Try another search or check back once more organizations are published.
          </p>
        </div>
      ) : (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Public Organizations</h2>
              <p className="mt-1 text-sm text-slate-500">
                Clubs, schools, leagues, and academies available on the public site.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {filteredOrganizations.length}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrganizations.map((org) => (
              <Link
                key={org.id}
                href={`/public/org/${org.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:shadow-lg"
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                      LOGO
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold text-slate-900">{org.name}</h3>
                    <p className="truncate text-sm text-slate-500 capitalize">
                      {org.organization_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                {/* --------------------------------------------------- */}
                {/* ORG META */}
                {/* --------------------------------------------------- */}

                <div className="mt-4 flex flex-wrap gap-2">
                  {org.short_name ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {org.short_name}
                    </span>
                  ) : null}

                  {org.city || org.state ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {[org.city, org.state].filter(Boolean).join(', ')}
                    </span>
                  ) : null}
                </div>

                {/* --------------------------------------------------- */}
                {/* CTA */}
                {/* --------------------------------------------------- */}

                <div className="mt-5">
                  <div className="inline-flex rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 transition group-hover:bg-slate-50">
                    View Organization
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}