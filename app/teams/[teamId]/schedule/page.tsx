'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import TeamPageIntro from '@/components/TeamPageIntro';
import { getDefaultSeasonId } from '@/lib/seasonDefault';
import { buildReadableMatchSlug } from '@/lib/utils';
import { useTeamAccessGuard } from '@/lib/useTeamAccessGuard';
import { supabase } from '@/lib/supabase';
import type { Match, Season, Team } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type GroupedMatches = {
  label: string;
  matches: MatchRow[];
};

type ScheduleImportRow = {
  date: string;
  time: string;
  date_time: string;
  opponent: string;
  home_away: 'home' | 'away' | '';
  venue: string;
  season: string;
  errors: string[];
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHomeAway(value: string): 'home' | 'away' | '' {
  const normalized = value.trim().toLowerCase();

  if (['home', 'h', 'vs'].includes(normalized)) return 'home';
  if (['away', 'a', '@'].includes(normalized)) return 'away';

  return '';
}

function parseScheduleImportText(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [] as ScheduleImportRow[];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const date = cells[headerIndex.get('date') ?? -1] || '';
    const time = cells[headerIndex.get('time') ?? -1] || '';
    const dateTime = cells[headerIndex.get('date_time') ?? -1] || '';
    const opponent = cells[headerIndex.get('opponent') ?? -1] || '';
    const homeAwayValue = cells[headerIndex.get('home_away') ?? -1] || '';
    const venue = cells[headerIndex.get('venue') ?? -1] || '';
    const season = cells[headerIndex.get('season') ?? -1] || '';
    const normalizedHomeAway = normalizeHomeAway(homeAwayValue);
    const errors: string[] = [];
    const combinedDateTime =
      date.trim() && time.trim()
        ? `${date.trim()}T${time.trim()}`
        : dateTime.trim();

    if (!combinedDateTime) {
      errors.push('Missing date/time');
    } else if (Number.isNaN(new Date(combinedDateTime).getTime())) {
      errors.push('Invalid date/time');
    }

    if (!opponent.trim()) {
      errors.push('Missing opponent');
    }

    if (!normalizedHomeAway) {
      errors.push('home_away must be home or away');
    }

    return {
      date: date.trim(),
      time: time.trim(),
      date_time: combinedDateTime,
      opponent: opponent.trim(),
      home_away: normalizedHomeAway,
      venue: venue.trim(),
      season: season.trim(),
      errors,
    };
  });
}

function normalizeName(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

// ---------------------------------------------------
// PAGE
// FILE: app/teams/[teamId]/schedule/page.tsx
// ---------------------------------------------------

export default function TeamSchedulePage() {
  // ---------------------------------------------------
  // ROUTE PARAMS
  // ---------------------------------------------------

  const params = useParams();
  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  // ---------------------------------------------------
  // SHARED TEAM ACCESS GUARD
  // ---------------------------------------------------

  const {
    authChecked,
    error: accessError,
    loading: accessLoading,
  } = useTeamAccessGuard({
    teamId,
    nextPath: `/teams/${teamId}/schedule`,
  });

  // ---------------------------------------------------
  // PAGE STATE
  // ---------------------------------------------------

  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [scheduleImportRows, setScheduleImportRows] = useState<ScheduleImportRow[]>([]);
  const [scheduleImportFileName, setScheduleImportFileName] = useState('');
  const [importingSchedule, setImportingSchedule] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  // ---------------------------------------------------
  // LOAD TEAM + MATCHES + SEASONS
  // ---------------------------------------------------

  const loadData = useCallback(async () => {
    if (!teamId) return;

    setLoading(true);
    setMessage('');

    const [
      { data: teamData, error: teamError },
      { data: matchData, error: matchError },
      { data: seasonData, error: seasonError },
    ] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('match_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('seasons').select('*').order('start_date', { ascending: false }),
    ]);

    if (teamError || matchError || seasonError) {
      setMessage(
        teamError?.message ||
          matchError?.message ||
          seasonError?.message ||
          'Failed to load team schedule.',
      );
      setLoading(false);
      return;
    }

    const loadedSeasons = (seasonData as Season[]) ?? [];

    setTeam((teamData as Team) ?? null);
    setMatches((matchData as MatchRow[]) ?? []);
    setSeasons(loadedSeasons);

    setSelectedSeasonId(getDefaultSeasonId(loadedSeasons));

    setLoading(false);
  }, [teamId]);

  // ---------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId || !authChecked) return;
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [teamId, authChecked, loadData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentTimeMs(Date.now());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // ---------------------------------------------------
  // DELETE MATCH
  // ---------------------------------------------------

  async function handleDeleteMatch(match: MatchRow) {
    const opponentName =
      match.home_team?.name && match.away_team?.name
        ? `${match.home_team.name} vs ${match.away_team.name}`
        : 'this match';

    const confirmed = window.confirm(
      `Delete ${opponentName}? This will permanently remove the match record and may also remove related live data. This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingMatchId(match.id);
    setMessage('');

    const { error } = await supabase.from('matches').delete().eq('id', match.id);

    if (error) {
      setMessage(error.message || 'Failed to delete match.');
      setDeletingMatchId(null);
      return;
    }

    await loadData();
    setDeletingMatchId(null);
  }

  async function handleScheduleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      setScheduleImportRows([]);
      setScheduleImportFileName('');
      return;
    }

    const text = await file.text();
    const parsedRows = parseScheduleImportText(text);

    setScheduleImportFileName(file.name);
    setScheduleImportRows(parsedRows);
    setMessage('');
  }

  async function handleImportScheduleCsv() {
    if (!team || !teamId || scheduleImportRows.length === 0) return;

    const validRows = scheduleImportRows.filter((row) => row.errors.length === 0);

    if (validRows.length === 0) {
      setMessage('Schedule import has no valid rows to add.');
      return;
    }

    setImportingSchedule(true);
    setMessage('');

    const [{ data: teamData, error: teamError }, { data: seasonData, error: seasonError }] =
      await Promise.all([
        supabase.from('teams').select('*').order('name', { ascending: true }),
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      ]);

    if (teamError || seasonError) {
      setMessage(teamError?.message || seasonError?.message || 'Failed to prepare schedule import.');
      setImportingSchedule(false);
      return;
    }

    const allTeams = (teamData as Team[]) ?? [];
    const allSeasons = (seasonData as Season[]) ?? [];
    const teamsByName = new Map<string, Team>();
    const seasonsByName = new Map<string, Season>();

    for (const candidateTeam of allTeams) {
      const key = normalizeName(candidateTeam.name);
      if (key && !teamsByName.has(key)) {
        teamsByName.set(key, candidateTeam);
      }
    }

    for (const season of allSeasons) {
      const key = normalizeName(season.name);
      if (key && !seasonsByName.has(key)) {
        seasonsByName.set(key, season);
      }
    }

    const createdOpponentIds = new Map<string, string>();
    const payload: Array<Record<string, string | null>> = [];

    for (const row of validRows) {
      const opponentKey = normalizeName(row.opponent);
      let opponentTeamId =
        createdOpponentIds.get(opponentKey) || teamsByName.get(opponentKey)?.id || '';

      if (!opponentTeamId) {
        const { data: createdOpponent, error: createOpponentError } = await supabase
          .from('teams')
          .insert({
            name: row.opponent,
            is_reusable: false,
            match_tracking_mode: 'basic',
          })
          .select('*')
          .single();

        if (createOpponentError) {
          setMessage(createOpponentError.message || `Failed to create opponent ${row.opponent}.`);
          setImportingSchedule(false);
          return;
        }

        opponentTeamId = (createdOpponent as Team).id;
        createdOpponentIds.set(opponentKey, opponentTeamId);
      }

      const matchedSeason =
        seasonsByName.get(normalizeName(row.season)) ||
        (selectedSeasonId !== 'all'
          ? allSeasons.find((season) => season.id === selectedSeasonId) || null
          : allSeasons.find((season) => season.is_active) || null);

      const isHome = row.home_away === 'home';

      payload.push({
        season_id: matchedSeason?.id || null,
        home_team_id: isHome ? teamId : opponentTeamId,
        away_team_id: isHome ? opponentTeamId : teamId,
        home_tracking_mode: isHome ? team.match_tracking_mode : 'basic',
        away_tracking_mode: isHome ? 'basic' : team.match_tracking_mode,
        venue: row.venue || null,
        match_date: new Date(row.date_time).toISOString(),
        public_slug: buildReadableMatchSlug({
          homeTeamName: isHome ? team.name : row.opponent,
          awayTeamName: isHome ? row.opponent : team.name,
          matchDate: new Date(row.date_time).toISOString(),
        }),
        status: 'not_started',
      });
    }

    const { error } = await supabase.from('matches').insert(payload);

    if (error) {
      setMessage(error.message || 'Failed to import schedule.');
      setImportingSchedule(false);
      return;
    }

    setScheduleImportRows([]);
    setScheduleImportFileName('');
    await loadData();
    setImportingSchedule(false);
  }

  // ---------------------------------------------------
  // FILTERED MATCHES
  // ---------------------------------------------------

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const matchesSeason =
        selectedSeasonId === 'all' || match.season_id === selectedSeasonId;

      if (!matchesSeason) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        match.home_team?.name,
        match.away_team?.name,
        match.venue,
        match.status,
        match.status_note,
        match.home_team?.club_name,
        match.away_team?.club_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [matches, normalizedQuery, selectedSeasonId]);

  // ---------------------------------------------------
  // MATCH GROUPS
  // ---------------------------------------------------

  const scheduledMatches = useMemo(
    () =>
      filteredMatches.filter((match) =>
        ['not_started', 'scheduled', 'live', 'halftime'].includes(match.status),
      ),
    [filteredMatches],
  );

  const delayedMatches = useMemo(
    () => filteredMatches.filter((match) => ['postponed', 'cancelled'].includes(match.status)),
    [filteredMatches],
  );

  const nextUpcomingMatch = useMemo(() => {
    return (
      scheduledMatches
        .filter((match) => {
          if (!match.match_date) return false;

          return (
            ['not_started', 'scheduled'].includes(match.status) &&
            new Date(match.match_date).getTime() >= currentTimeMs
          );
        })
        .sort((a, b) => {
          const aTime = a.match_date
            ? new Date(a.match_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          const bTime = b.match_date
            ? new Date(b.match_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        })[0] ?? null
    );
  }, [scheduledMatches, currentTimeMs]);

  const groupedScheduledMatches = useMemo<GroupedMatches[]>(() => {
    const groups = new Map<string, MatchRow[]>();

    for (const match of scheduledMatches) {
      const label = match.match_date ? formatGroupDate(match.match_date) : 'Date TBD';

      if (!groups.has(label)) {
        groups.set(label, []);
      }

      groups.get(label)!.push(match);
    }

    return Array.from(groups.entries()).map(([label, grouped]) => ({
      label,
      matches: grouped.sort((a, b) => {
        const aTime = a.match_date
          ? new Date(a.match_date).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.match_date
          ? new Date(b.match_date).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
    }));
  }, [scheduledMatches]);

  // ---------------------------------------------------
  // LOADING / ERROR / EMPTY TEAM
  // ---------------------------------------------------

  if ((loading || accessLoading) && !team) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading team schedule...</main>;
  }

  if ((accessError || message) && !team) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
        {accessError || message}
      </main>
    );
  }

  if (!authChecked && !team) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading team schedule...</main>;
  }

  if (!team) {
    return <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">Team not found.</main>;
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <>
      {/* --------------------------------------------------- */}
      {/* PAGE INTRO */}
      {/* --------------------------------------------------- */}

      <TeamPageIntro
        eyebrow="Team Schedule"
        title="Upcoming Fixtures"
        description="Browse this team's schedule, live fixtures, and match updates by season."
        rightSlot={
          <div className="min-w-[220px]">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Season
            </label>

            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
            >
              <option value="all">All Seasons</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search opponent, venue, or status"
              className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </section>

        <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Import Schedule CSV</h2>
              <p className="mt-1 text-sm text-slate-600">
                Upload rows with <code>date</code>, <code>time</code>, <code>opponent</code>, and{' '}
                <code>home_away</code>. Optional columns: <code>venue</code> and <code>season</code>. Legacy <code>date_time</code> is still supported.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleScheduleCsvFileChange}
                className="sr-only"
              />
            </label>
          </div>

          {scheduleImportFileName ? (
            <p className="mt-4 text-sm font-medium text-slate-600">Loaded: {scheduleImportFileName}</p>
          ) : null}

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
            Example headers: <code>date,time,opponent,home_away,venue,season</code>
          </div>

          {scheduleImportRows.length > 0 ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm font-medium text-slate-600">
                {scheduleImportRows.filter((row) => row.errors.length === 0).length} valid row
                {scheduleImportRows.filter((row) => row.errors.length === 0).length === 1 ? '' : 's'}{' '}
                ready to import out of {scheduleImportRows.length}.
              </p>

              <div className="space-y-3">
                {scheduleImportRows.map((row, index) => (
                  <div
                    key={`${row.opponent}-${row.date_time}-${index}`}
                    className={`rounded-2xl border px-4 py-3 ${
                      row.errors.length > 0
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {row.opponent || 'Opponent missing'} • {row.home_away || 'side missing'} •{' '}
                        {row.date && row.time ? `${row.date} ${row.time}` : row.date_time || 'date missing'}
                      </p>
                      {row.season ? (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ring-current/10">
                          {row.season}
                        </span>
                      ) : null}
                    </div>

                    {row.venue ? <p className="mt-2 text-sm">Venue: {row.venue}</p> : null}

                    {row.errors.length > 0 ? (
                      <p className="mt-2 text-sm font-medium">{row.errors.join(' • ')}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleImportScheduleCsv}
                  disabled={importingSchedule}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {importingSchedule ? 'Importing...' : 'Import Valid Rows'}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* --------------------------------------------------- */}
        {/* ERROR MESSAGE */}
        {/* --------------------------------------------------- */}

        {message ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        {/* --------------------------------------------------- */}
        {/* NEXT MATCH */}
        {/* --------------------------------------------------- */}

        {!loading && nextUpcomingMatch ? (
          <section className="mb-8 rounded-3xl bg-slate-900 p-6 text-white shadow-sm ring-1 ring-slate-800">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Next Match
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  {nextUpcomingMatch.home_team?.name || 'Home Team'} vs{' '}
                  {nextUpcomingMatch.away_team?.name || 'Away Team'}
                </h2>
                <p className="mt-2 text-slate-300">
                  {nextUpcomingMatch.match_date
                    ? formatMatchDate(nextUpcomingMatch.match_date)
                    : 'Date TBD'}
                  {nextUpcomingMatch.venue ? ` • ${nextUpcomingMatch.venue}` : ''}
                </p>
              </div>

              <StatusBadge status={nextUpcomingMatch.status} />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
              {/* ------------------------------------------------- */}
              {/* HOME */}
              {/* ------------------------------------------------- */}

              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Home
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {nextUpcomingMatch.home_team?.logo_url ? (
                    <img
                      src={nextUpcomingMatch.home_team.logo_url}
                      alt={`${nextUpcomingMatch.home_team.name} logo`}
                      className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
                    />
                  ) : null}

                  <h3 className="truncate text-2xl font-black text-white">
                    {nextUpcomingMatch.home_team?.name || 'Home Team'}
                  </h3>
                </div>
              </div>

              {/* ------------------------------------------------- */}
              {/* CENTER */}
              {/* ------------------------------------------------- */}

              <div className="rounded-2xl bg-white/10 px-5 py-4 text-center ring-1 ring-white/10">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Upcoming
                </div>
                <div className="mt-1 text-lg font-bold text-white">vs</div>
              </div>

              {/* ------------------------------------------------- */}
              {/* AWAY */}
              {/* ------------------------------------------------- */}

              <div className="min-w-0 md:text-right">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Away
                </p>
                <div className="mt-2 flex items-center justify-end gap-3">
                  <h3 className="truncate text-2xl font-black text-white">
                    {nextUpcomingMatch.away_team?.name || 'Away Team'}
                  </h3>

                  {nextUpcomingMatch.away_team?.logo_url ? (
                    <img
                      src={nextUpcomingMatch.away_team.logo_url}
                      alt={`${nextUpcomingMatch.away_team.name} logo`}
                      className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            {/* ------------------------------------------------- */}
            {/* NEXT MATCH ACTIONS */}
            {/* ------------------------------------------------- */}

            <div className="mt-6 border-t border-white/10 pt-5">
              <div className="flex flex-wrap justify-end gap-3">
                <Link
                  href={`/live/${nextUpcomingMatch.id}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm text-white ring-1 ring-amber-400 hover:bg-amber-600"
                >
                  Manage Match
                </Link>

                <Link
                  href={`/matches/${nextUpcomingMatch.id}/edit`}
                  className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm text-white ring-1 ring-white/15 hover:bg-white/15"
                >
                  Edit Match
                </Link>

                {nextUpcomingMatch.public_slug ? (
                  <Link
                    href={`/public/${nextUpcomingMatch.public_slug}`}
                    target="_blank"
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm text-white ring-1 ring-emerald-400 hover:bg-emerald-600"
                  >
                    Public Scoreboard
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* --------------------------------------------------- */}
        {/* LOADING / EMPTY STATE */}
        {/* --------------------------------------------------- */}

        {loading ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            Loading schedule...
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">No matches found</h2>
            <p className="mt-2 text-slate-600">
              Try another search or season filter, or create a new match.
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
            {/* ------------------------------------------------- */}
            {/* UPCOMING / LIVE */}
            {/* ------------------------------------------------- */}

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Upcoming Schedule</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Matches grouped by date, including live and halftime fixtures.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                  {scheduledMatches.length}
                </span>
              </div>

              {groupedScheduledMatches.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming matches found.</p>
              ) : (
                <div className="space-y-8">
                  {groupedScheduledMatches.map((group) => (
                    <div key={group.label}>
                      <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                        <h3 className="text-lg font-bold text-slate-900">{group.label}</h3>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {group.matches.length}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {group.matches.map((match) => (
                          <ScheduleMatchCard
                            key={match.id}
                            match={match}
                            deleting={deletingMatchId === match.id}
                            onDelete={handleDeleteMatch}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ------------------------------------------------- */}
            {/* SCHEDULE CHANGES */}
            {/* ------------------------------------------------- */}

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Schedule Changes</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Postponed and cancelled fixtures.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                  {delayedMatches.length}
                </span>
              </div>

              {delayedMatches.length === 0 ? (
                <p className="text-sm text-slate-500">No schedule changes right now.</p>
              ) : (
                <div className="space-y-4">
                  {delayedMatches.map((match) => (
                    <ScheduleMatchCard
                      key={match.id}
                      match={match}
                      deleting={deletingMatchId === match.id}
                      onDelete={handleDeleteMatch}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------
// SCHEDULE MATCH CARD
// ---------------------------------------------------

function ScheduleMatchCard({
  match,
  deleting,
  onDelete,
}: {
  match: MatchRow;
  deleting: boolean;
  onDelete: (match: MatchRow) => void;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
      {/* ------------------------------------------------- */}
      {/* MATCH DETAILS */}
      {/* ------------------------------------------------- */}

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={match.status} />

          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
          </span>

          {match.venue ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {match.venue}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          {/* ------------------------------------------------- */}
          {/* HOME TEAM */}
          {/* ------------------------------------------------- */}

          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Home
            </p>

            <div className="mt-1 flex items-center gap-3">
              {match.home_team?.logo_url ? (
                <img
                  src={match.home_team.logo_url}
                  alt={`${match.home_team.name} logo`}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                />
              ) : null}

              <h3 className="truncate text-xl font-black text-slate-900">
                {match.home_team?.name || 'Home Team'}
              </h3>
            </div>
          </div>

          {/* ------------------------------------------------- */}
          {/* SCORE / VS */}
          {/* ------------------------------------------------- */}

          <div className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-white shadow-sm">
            {match.status === 'final' || match.status === 'live' || match.status === 'halftime' ? (
              <div className="text-3xl font-black">
                {match.home_score} - {match.away_score}
              </div>
            ) : (
              <div className="text-lg font-bold uppercase tracking-wide">vs</div>
            )}
          </div>

          {/* ------------------------------------------------- */}
          {/* AWAY TEAM */}
          {/* ------------------------------------------------- */}

          <div className="min-w-0 md:text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Away
            </p>

            <div className="mt-1 flex items-center justify-end gap-3">
              <h3 className="truncate text-xl font-black text-slate-900">
                {match.away_team?.name || 'Away Team'}
              </h3>

              {match.away_team?.logo_url ? (
                <img
                  src={match.away_team.logo_url}
                  alt={`${match.away_team.name} logo`}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                />
              ) : null}
            </div>
          </div>
        </div>

        {match.status_note ? (
          <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
            <span className="font-semibold text-slate-800">Note:</span> {match.status_note}
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------- */}
      {/* ACTIONS BELOW MATCH INFO */}
      {/* ------------------------------------------------- */}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href={`/live/${match.id}`}
            className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
          >
            Manage Match
          </Link>

          <Link
            href={`/matches/${match.id}/edit`}
            className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Edit Match
          </Link>

          {match.public_slug ? (
            <Link
              href={`/public/${match.public_slug}`}
              target="_blank"
              className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
            >
              Public Scoreboard
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => onDelete(match)}
            disabled={deleting}
            className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete Match'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------
// STATUS BADGE
// ---------------------------------------------------

function StatusBadge({ status }: { status: Match['status'] }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-400/20">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
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
      <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
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

// ---------------------------------------------------
// DATE HELPERS
// ---------------------------------------------------

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatGroupDate(value: string) {
  const date = new Date(value);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const matchDay = new Date(date);
  matchDay.setHours(0, 0, 0, 0);

  if (matchDay.getTime() === today.getTime()) {
    return 'Today';
  }

  if (matchDay.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  const diffDays = Math.floor((matchDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 6) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}
