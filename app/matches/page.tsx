'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

  const liveMatches = useMemo(
    () =>
      matches
        .filter((match) => match.status === 'live' || match.status === 'halftime')
        .sort((a, b) => {
          const aTime = a.match_date ? new Date(a.match_date).getTime() : 0;
          const bTime = b.match_date ? new Date(b.match_date).getTime() : 0;
          return bTime - aTime;
        }),
    [matches],
  );

  const upcomingMatches = useMemo(
  () =>
    matches
      .filter((match) => ['not_started', 'scheduled'].includes(match.status))
      .sort((a, b) => {
        const aTime = a.match_date ? new Date(a.match_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.match_date ? new Date(b.match_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
  [matches],
);

  const recentResults = useMemo(
    () =>
      matches
        .filter((match) => match.status === 'final')
        .sort((a, b) => {
          const aTime = a.match_date ? new Date(a.match_date).getTime() : 0;
          const bTime = b.match_date ? new Date(b.match_date).getTime() : 0;
          return bTime - aTime;
        }),
    [matches],
  );

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
        <div className="space-y-8">
          <MatchSection
            title="Live Now"
            subtitle="Matches currently in progress or at halftime."
            count={liveMatches.length}
            emptyText="No live matches right now."
            matches={liveMatches}
            highlight={liveMatches.length > 0}
          />

          <MatchSection
            title="Upcoming"
            subtitle="Scheduled matches coming up next."
            count={upcomingMatches.length}
            emptyText="No upcoming matches scheduled."
            matches={upcomingMatches}
          />

          <MatchSection
            title="Recent Results"
            subtitle="Completed matches and final scores."
            count={recentResults.length}
            emptyText="No completed matches yet."
            matches={recentResults}
          />
        </div>
      )}
    </main>
  );
}

function MatchSection({
  title,
  subtitle,
  count,
  emptyText,
  matches,
  highlight = false,
}: {
  title: string;
  subtitle: string;
  count: number;
  emptyText: string;
  matches: MatchRow[];
  highlight?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl p-6 shadow-sm ring-1 ${
        highlight ? 'bg-red-50/70 ring-red-200' : 'bg-white ring-slate-200'
      }`}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className={`flex items-center gap-2 text-2xl font-bold ${
              highlight ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {highlight ? (
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
              </span>
            ) : null}
            {title}
          </h2>

          <p className={`mt-1 text-sm ${highlight ? 'text-red-700/80' : 'text-slate-500'}`}>
            {subtitle}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            highlight
              ? 'bg-white text-red-700 ring-1 ring-red-200'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {count}
        </span>
      </div>

      {matches.length === 0 ? (
        <p className={`text-sm ${highlight ? 'text-red-700/70' : 'text-slate-500'}`}>
          {emptyText}
        </p>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} highlight={highlight} />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({
  match,
  highlight = false,
}: {
  match: MatchRow;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 ring-1 ${
        highlight ? 'border-l-4 border-red-500 bg-white ring-red-100' : 'bg-slate-50 ring-slate-200'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={match.status} />
            {match.match_date ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {formatMatchDate(match.match_date)}
              </span>
            ) : (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                Date TBD
              </span>
            )}
            {match.venue ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {match.venue}
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Home</p>
              <div className="mt-1 flex items-center gap-3">
  {match.home_team?.logo_url ? (
    <Link href={`/teams/${match.home_team_id}`} className="shrink-0">
      <img
        src={match.home_team.logo_url}
        alt={`${match.home_team.name} logo`}
        className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20 transition hover:opacity-80"
      />
    </Link>
  ) : null}

  <Link
    href={`/teams/${match.home_team_id}`}
    className="text-2xl font-black transition hover:opacity-80 hover:underline"
  >
    {match.home_team?.name || 'Home Team'}
  </Link>
</div>
            </div>

            <div className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-white shadow-sm">
              <div className="text-3xl font-black">
                {match.home_score} - {match.away_score}
              </div>
            </div>

            <div className="min-w-0 md:text-right">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Away</p>
              <div className="mt-1 flex items-center justify-end gap-3">
  <Link
    href={`/teams/${match.away_team_id}`}
    className="text-2xl font-black transition hover:opacity-80 hover:underline"
  >
    {match.away_team?.name || 'Away Team'}
  </Link>

  {match.away_team?.logo_url ? (
    <Link href={`/teams/${match.away_team_id}`} className="shrink-0">
      <img
        src={match.away_team.logo_url}
        alt={`${match.away_team.name} logo`}
        className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20 transition hover:opacity-80"
      />
    </Link>
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

  if (status === 'postponed') {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
        Postponed
      </span>
    );
  }

  if (status === 'cancelled') {
    return (
      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">
        Cancelled
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