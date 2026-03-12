'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function TeamLoginPage() {
  const router = useRouter();

  const [teamCode, setTeamCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedCode = teamCode.trim().toLowerCase();

    if (!normalizedCode) {
      setError('Enter your team code.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('teams')
      .select('id, name, admin_code')
      .eq('admin_code', normalizedCode)
      .single();

    if (error || !data) {
      setError('Invalid team code.');
      setLoading(false);
      return;
    }

   localStorage.setItem('teamId', String(data.id));
    localStorage.setItem('teamName', data.name);
    router.push(`/teams/${data.id}`);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-200">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Team Login
          </h1>
          <p className="mt-3 text-slate-600">
            Enter your team admin code to open your dashboard.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Team Code
            </label>
            <input
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value)}
              placeholder="e.g. eths-gv"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? 'Checking Code...' : 'Enter Dashboard'}
          </button>
        </form>
      </section>
    </main>
  );
}
