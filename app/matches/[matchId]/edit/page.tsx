'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Match, Season, Team } from '@/lib/types';

// ---------------------------------------------------
// LOCAL TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

// ---------------------------------------------------
// DATETIME HELPER
// ---------------------------------------------------

function toLocalInputValue(isoString: string | null | undefined) {
  if (!isoString) return '';

  const date = new Date(isoString);
  const tzOffset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

// ---------------------------------------------------
// READABLE PUBLIC SLUG HELPER
// ---------------------------------------------------

function buildReadableMatchSlug({
  homeTeamName,
  awayTeamName,
  matchDate,
}: {
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  matchDate?: string | null;
}) {
  const home = slugifySegment(homeTeamName || 'home-team');
  const away = slugifySegment(awayTeamName || 'away-team');

  let datePart = 'date-tbd';

  if (matchDate) {
    const parsed = new Date(matchDate);

    if (!Number.isNaN(parsed.getTime())) {
      datePart = parsed.toISOString().slice(0, 10);
    }
  }

  return `${home}-vs-${away}-${datePart}`;
}

// ---------------------------------------------------
// SLUGIFY SEGMENT
// ---------------------------------------------------

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// ---------------------------------------------------
// PAGE
// FILE: app/matches/[matchId]/edit/page.tsx
// ---------------------------------------------------

export default function EditMatchPage() {
  // ---------------------------------------------------
  // ROUTE / NAVIGATION
  // ---------------------------------------------------

  const params = useParams();
  const router = useRouter();

  const matchId =
    typeof params?.matchId === 'string'
      ? params.matchId
      : Array.isArray(params?.matchId)
        ? params.matchId[0]
        : '';

  // ---------------------------------------------------
  // PAGE STATE
  // ---------------------------------------------------

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // ---------------------------------------------------
  // FORM STATE
  // ---------------------------------------------------

  const [seasonId, setSeasonId] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [venue, setVenue] = useState('');
  const [status, setStatus] = useState<Match['status']>('scheduled');
  const [statusNote, setStatusNote] = useState('');
  const [publicSlug, setPublicSlug] = useState('');

  // ---------------------------------------------------
  // LOAD MATCH + SEASONS
  // ---------------------------------------------------

  useEffect(() => {
    if (!matchId) return;

    async function loadPage() {
      setLoading(true);
      setMessage('');

      const [
        { data: matchData, error: matchError },
        { data: seasonsData, error: seasonsError },
      ] = await Promise.all([
        supabase
          .from('matches')
          .select(`
            *,
            home_team:home_team_id (*),
            away_team:away_team_id (*)
          `)
          .eq('id', matchId)
          .single(),
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      ]);

      if (matchError || seasonsError) {
        setMessage(matchError?.message || seasonsError?.message || 'Failed to load match.');
        setLoading(false);
        return;
      }

      const loadedMatch = matchData as MatchRow;
      const loadedSeasons = (seasonsData as Season[]) ?? [];

      setMatch(loadedMatch);
      setSeasons(loadedSeasons);

      // ---------------------------------------------------
      // SEED FORM STATE
      // ---------------------------------------------------

      setSeasonId(loadedMatch.season_id || '');
      setMatchDate(toLocalInputValue(loadedMatch.match_date || null));
      setVenue(loadedMatch.venue || '');
      setStatus(loadedMatch.status);
      setStatusNote(loadedMatch.status_note || '');
      setPublicSlug(
        loadedMatch.public_slug ||
          buildReadableMatchSlug({
            homeTeamName: loadedMatch.home_team?.name,
            awayTeamName: loadedMatch.away_team?.name,
            matchDate: loadedMatch.match_date,
          }),
      );

      setLoading(false);
    }

    loadPage();
  }, [matchId]);

  // ---------------------------------------------------
  // REGENERATE PUBLIC SLUG
  // ---------------------------------------------------

  function handleRegenerateSlug() {
    if (!match) return;

    setPublicSlug(
      buildReadableMatchSlug({
        homeTeamName: match.home_team?.name,
        awayTeamName: match.away_team?.name,
        matchDate: matchDate ? new Date(matchDate).toISOString() : match.match_date,
      }),
    );
  }

  // ---------------------------------------------------
  // SAVE MATCH
  // ---------------------------------------------------

  async function handleSave() {
    if (!match) return;

    setSaving(true);
    setMessage('');

    const updates = {
      season_id: seasonId || null,
      match_date: matchDate ? new Date(matchDate).toISOString() : null,
      venue: venue.trim() || null,
      status,
      status_note: statusNote.trim() || null,
      public_slug: publicSlug.trim() || null,
    };

    const { error } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', match.id);

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    setSaving(false);
    router.push(`/live/${match.id}`);
  }

  // ---------------------------------------------------
  // LOADING / EMPTY STATES
  // ---------------------------------------------------

  if (loading) {
    return <main className="mx-auto max-w-5xl px-6 py-8">Loading match editor...</main>;
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8 text-red-600">
        {message || 'Match not found.'}
      </main>
    );
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Match Admin
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Edit Match
          </h1>
          <p className="mt-2 text-slate-600">
            Update scheduling details, venue, status, and public match settings.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/live/${match.id}`}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Back to Match
          </Link>

          {match.public_slug ? (
            <Link
              href={`/public/${match.public_slug}`}
              target="_blank"
              className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
            >
              Open Public Scoreboard
            </Link>
          ) : null}
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* MATCH SUMMARY */}
      {/* --------------------------------------------------- */}

      <section className="mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-sm ring-1 ring-slate-800">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Match
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">
          {match.home_team?.name || 'Home Team'} vs {match.away_team?.name || 'Away Team'}
        </h2>
        <p className="mt-2 text-slate-300">
          Current status: <span className="font-semibold text-white">{match.status}</span>
        </p>
      </section>

      {/* --------------------------------------------------- */}
      {/* EDIT FORM */}
      {/* --------------------------------------------------- */}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-5 md:grid-cols-2">
          {/* ------------------------------------------------- */}
          {/* SEASON */}
          {/* ------------------------------------------------- */}

          <Field label="Season">
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="">No season</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </Field>

          {/* ------------------------------------------------- */}
          {/* STATUS */}
          {/* ------------------------------------------------- */}

          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Match['status'])}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="halftime">Halftime</option>
              <option value="final">Final</option>
              <option value="postponed">Postponed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>

          {/* ------------------------------------------------- */}
          {/* DATE / TIME */}
          {/* ------------------------------------------------- */}

          <Field label="Match Date & Time">
            <input
              type="datetime-local"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          {/* ------------------------------------------------- */}
          {/* VENUE */}
          {/* ------------------------------------------------- */}

          <Field label="Venue">
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="James Park"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            />
          </Field>

          {/* ------------------------------------------------- */}
          {/* PUBLIC SLUG */}
          {/* ------------------------------------------------- */}

          <div className="md:col-span-2">
            <Field label="Public Slug">
              <div className="flex items-stretch gap-3">
                <input
                  value={publicSlug}
                  onChange={(e) => setPublicSlug(e.target.value)}
                  placeholder="evanston-vs-new-trier-2026-04-12"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                />

                <button
                  type="button"
                  onClick={handleRegenerateSlug}
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                >
                  Regenerate
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Changing this updates the public scoreboard URL and old shared links will stop
                working.
              </p>
            </Field>
          </div>

          {/* ------------------------------------------------- */}
          {/* STATUS NOTE */}
          {/* ------------------------------------------------- */}

          <div className="md:col-span-2">
            <Field label="Status Note">
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Optional note about weather, field change, delay, etc."
                className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>
          </div>
        </div>

        {/* --------------------------------------------------- */}
        {/* FEEDBACK */}
        {/* --------------------------------------------------- */}

        {message ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        {/* --------------------------------------------------- */}
        {/* ACTIONS */}
        {/* --------------------------------------------------- */}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Link
            href={`/live/${match.id}`}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Match Changes'}
          </button>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------
// FIELD WRAPPER
// ---------------------------------------------------

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