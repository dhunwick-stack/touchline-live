'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Match, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadMatches() {
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:home_team_id (*),
        away_team:away_team_id (*)
      `)
      .order('match_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(`Load error: ${error.message}`);
      setLoading(false);
      return;
    }

    setMatches((data as MatchRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadMatches();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="text-3xl font-black tracking-tight">Matches</h1>
          <p className="mt-2 text-slate-600">
            Review live, scheduled, and completed matches.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/matches/new"
            className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            New Match
          </Link>
          <Link
            href="/teams"
            className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 ring-1 ring-slate-200"
          >
            Teams
          </Link>
        </div>
      </div>

      {message ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          Loading matches...
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">No matches yet</h2>
          <p className="mt-2 text-slate-600">
            Create your first match to start scoring live.
          </p>
          <Link
            href="/matches/new"
            className="mt-5 inline-flex rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            Create Match
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={match.status} />
                    {match.match_date ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {formatMatchDate(match.match_date)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Date TBD
                      </span>
                    )}
                    {match.venue ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {match.venue}
                      </span>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                    <div>
  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
    Home
  </p>
  <div className="mt-1 flex items-center gap-3">
    {match.home_team?.logo_url ? (
      <img
        src={match.home_team.logo_url}
        alt={`${match.home_team.name} logo`}
        className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200"
      />
    ) : null}
    <h2 className="truncate text-xl font-black text-slate-900">
      {match.home_team?.name || 'Home Team'}
    </h2>
  </div>
</div>

                    <div className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-white">
                      <div className="text-3xl font-black">
                        {match.home_score} - {match.away_score}
                      </div>
                    </div>

                    <div className="md:text-right">
  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
    Away
  </p>
  <div className="mt-1 flex items-center justify-end gap-3">
    <h2 className="truncate text-xl font-black text-slate-900">
      {match.away_team?.name || 'Away Team'}
    </h2>
    {match.away_team?.logo_url ? (
      <img
        src={match.away_team.logo_url}
        alt={`${match.away_team.name} logo`}
        className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200"
      />
    ) : null}
  </div>
</div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                      Home: {prettyTrackingMode(match.home_tracking_mode)}
                    </span>
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                      Away: {prettyTrackingMode(match.away_tracking_mode)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <Link
                    href={`/live/${match.id}`}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Open Match
                  </Link>

                  <Link
                    href={`/public/${match.public_slug}`}
                    target="_blank"
                    className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
                  >
                    Public Scoreboard
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: Match['status'] }) {
  if (status === 'live') {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
        Live
      </span>
    );
  }

  if (status === 'halftime') {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
        Halftime
      </span>
    );
  }

  if (status === 'final') {
    return (
      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
        Final
      </span>
    );
  }

  return (
    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
      Scheduled
    </span>
  );
}

function prettyTrackingMode(mode: Match['home_tracking_mode']) {
  if (mode === 'full') return 'Full';
  if (mode === 'basic') return 'Basic';
  if (mode === 'score_only') return 'Score Only';
  return mode;
}

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
