'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Organization } from '@/lib/types';

export default function PublicOrganizationDirectory() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadOrganizations() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true });

      setOrganizations(data ?? []);
    }

    loadOrganizations();
  }, []);

  const filtered = organizations.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-black">Organizations</h1>

      <p className="mt-2 text-slate-600">
        Browse clubs and schools using Touchline Live.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search organizations..."
        className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3"
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((org) => (
          <Link
            key={org.id}
            href={`/public/org/${org.slug}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">
                  LOGO
                </div>
              )}

              <div>
                <p className="font-semibold">{org.name}</p>
                <p className="text-sm text-slate-500 capitalize">
                  {org.organization_type.replace('_', ' ')}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
