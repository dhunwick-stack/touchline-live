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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // ---------------------------------------------------
  // LOAD PUBLIC ORGANIZATIONS
  // ---------------------------------------------------

  useEffect(() => {
    async function loadOrganizations() {
      setLoading(true);
      setMessage('');

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('is_public', true)
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
      const name = (org.name || '').toLowerCase();
      const shortName = (org.short_name || '').toLowerCase();
      const type = (org.organization_type || '').toLowerCase();
      const city = (org.city || '').toLowerCase();
      const state = (org.state || '').toLowerCase();

      return (
        name.includes(q) ||
        shortName.includes(q) ||
        type.includes(q) ||
        city.includes(q) ||
        state.includes(q)
      );
    });
  }, [organizations, search]);

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Organizations</h1>
          <p className="mt-2 text-slate-600">
            Browse public clubs, schools, academies, and leagues using Touchline Live.
          </p>
        </div>

        <Link
          href="/admin/admin-login?next=/admin/org"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-800"
        >
          Admin Login
        </Link>
      </div>

      {/* --------------------------------------------------- */}
      {/* STATUS MESSAGE */}
      {/* --------------------------------------------------- */}

      {message ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* SEARCH BAR */}
      {/* --------------------------------------------------- */}

      <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
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
            placeholder="Search organizations..."
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />

          <div className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:block">
            Search
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between px-1">
          <p className="text-sm text-slate-500">
            {filteredOrganizations.length} organization
            {filteredOrganizations.length === 1 ? '' : 's'}
          </p>

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

      {/* --------------------------------------------------- */}
      {/* LOADING / EMPTY / GRID */}
      {/* --------------------------------------------------- */}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          Loading organizations...
        </div>
      ) : filteredOrganizations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            No Organizations Found
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            Nothing matches your search
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Try a different name, location, or organization type.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrganizations.map((org) => (
            <Link
              key={org.id}
              href={`/public/org/${org.slug}`}
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
                    {org.organization_type.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              {/* --------------------------------------------------- */}
              {/* ORG META */}
              {/* --------------------------------------------------- */}

              <div className="mt-4 flex flex-wrap gap-2">
                {org.city || org.state ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {[org.city, org.state].filter(Boolean).join(', ')}
                  </span>
                ) : null}

                {org.short_name ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {org.short_name}
                  </span>
                ) : null}
              </div>

              {/* --------------------------------------------------- */}
              {/* CTA */}
              {/* --------------------------------------------------- */}

              <div className="mt-4">
                <div className="rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition group-hover:bg-slate-50">
                  View Organization
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}