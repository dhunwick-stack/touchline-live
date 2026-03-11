'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Team } from '@/lib/types';

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState('');
  const [clubName, setClubName] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function loadTeams() {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(`Load error: ${error.message}`);
      return;
    }

    setTeams(data ?? []);
  }

  useEffect(() => {
    loadTeams();
  }, []);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setMessage('');

    const { error } = await supabase.from('teams').insert({
      name: name.trim(),
      club_name: clubName.trim() || null,
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
    setAgeGroup('');
    setLogoUrl('');
    setMessage('Team added.');
    setLoading(false);
    loadTeams();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-black">Teams</h1>

      <form onSubmit={createTeam} className="mt-6 space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
          <input
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            placeholder="Club name"
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
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
            className="rounded-xl border border-slate-300 px-4 py-3"
          />
        </div>

        <button
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
        >
          {loading ? 'Adding…' : 'Add Team'}
        </button>

        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className="block rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
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

              <div>
                <div className="font-semibold">{team.name}</div>
                <div className="text-sm text-slate-500">
                  {team.club_name || 'No club'} {team.age_group ? `• ${team.age_group}` : ''}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}