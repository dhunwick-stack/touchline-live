'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { combineLocalDateAndTime, getLocalDateInputValue, getLocalTimeInputValue } from '@/lib/matchDateTime';
import { slugifyMatch } from '@/lib/utils';
import type { Season, Team, TrackingMode } from '@/lib/types';

type TeamOptionMode = 'saved' | 'new';

function getDefaultSeasonId(seasons: Season[]) {
  const currentYear = String(new Date().getFullYear());
  const currentYearSeason =
    seasons.find((season) => season.name?.includes(currentYear)) ||
    seasons.find((season) => season.start_date?.startsWith(currentYear)) ||
    seasons.find((season) => season.end_date?.startsWith(currentYear));

  return currentYearSeason?.id || seasons.find((s) => s.is_active)?.id || seasons[0]?.id || '';
}

export default function NewMatchPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [createdMatchId, setCreatedMatchId] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [seasonId, setSeasonId] = useState('');
  const [venue, setVenue] = useState('');
  const [matchDate, setMatchDate] = useState(() => getLocalDateInputValue(new Date()));
  const [matchTime, setMatchTime] = useState(() => getLocalTimeInputValue(new Date()));

  const [homeMode, setHomeMode] = useState<TeamOptionMode>('saved');
  const [awayMode, setAwayMode] = useState<TeamOptionMode>('saved');

  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');

  const [homeNewTeamName, setHomeNewTeamName] = useState('');
  const [awayNewTeamName, setAwayNewTeamName] = useState('');
  const [homeSaveReusable, setHomeSaveReusable] = useState(true);
  const [awaySaveReusable, setAwaySaveReusable] = useState(false);

  const [homeTrackingMode, setHomeTrackingMode] = useState<TrackingMode>('full');
  const [awayTrackingMode, setAwayTrackingMode] = useState<TrackingMode>('basic');

  function resetTeamEntry(nextTeams: Team[]) {
    setHomeMode('saved');
    setAwayMode('saved');
    setHomeTeamId(nextTeams[0]?.id || '');
    setAwayTeamId(nextTeams[1]?.id || nextTeams[0]?.id || '');
    setHomeNewTeamName('');
    setAwayNewTeamName('');
    setHomeSaveReusable(true);
    setAwaySaveReusable(false);
    setHomeTrackingMode('full');
    setAwayTrackingMode('basic');
    setMessage('');
  }

  useEffect(() => {
    async function loadData() {
      const [{ data: teamsData, error: teamsError }, { data: seasonsData, error: seasonsError }] =
        await Promise.all([
          supabase.from('teams').select('*').order('name', { ascending: true }),
          supabase.from('seasons').select('*').order('start_date', { ascending: false }),
        ]);

      if (teamsError || seasonsError) {
        setMessage(teamsError?.message || seasonsError?.message || 'Failed to load data.');
        setLoading(false);
        return;
      }

      const teamsList = (teamsData as Team[]) ?? [];
      const seasonsList = (seasonsData as Season[]) ?? [];

      setTeams(teamsList);
      setSeasons(seasonsList);
      setSeasonId(getDefaultSeasonId(seasonsList));
      resetTeamEntry(teamsList);
      setLoading(false);
    }

    loadData();
  }, []);

  async function createTeamIfNeeded(name: string, isReusable: boolean) {
    const cleanName = name.trim();
    if (!cleanName) return null;

    const { data, error } = await supabase
      .from('teams')
      .insert({ name: cleanName, is_reusable: isReusable })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Team;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      let resolvedHomeTeamId = homeTeamId;
      let resolvedAwayTeamId = awayTeamId;
      let nextTeams = teams;

      if (homeMode === 'new') {
        const createdHome = await createTeamIfNeeded(homeNewTeamName, homeSaveReusable);
        resolvedHomeTeamId = createdHome?.id || '';
        if (createdHome) {
          nextTeams = [...nextTeams, createdHome].sort((a, b) => a.name.localeCompare(b.name));
        }
      }

      if (awayMode === 'new') {
        const createdAway = await createTeamIfNeeded(awayNewTeamName, awaySaveReusable);
        resolvedAwayTeamId = createdAway?.id || '';
        if (createdAway) {
          nextTeams = [...nextTeams, createdAway].sort((a, b) => a.name.localeCompare(b.name));
        }
      }

      if (!resolvedHomeTeamId || !resolvedAwayTeamId) {
        throw new Error('Both home and away teams are required.');
      }

      if (resolvedHomeTeamId === resolvedAwayTeamId) {
        throw new Error('Home and away teams must be different.');
      }

      const { data, error } = await supabase
        .from('matches')
        .insert({
          season_id: seasonId || null,
          home_team_id: resolvedHomeTeamId,
          away_team_id: resolvedAwayTeamId,
          home_tracking_mode: homeTrackingMode,
          away_tracking_mode: awayTrackingMode,
          venue: venue.trim() || null,
          match_date: combineLocalDateAndTime(matchDate, matchTime),
          public_slug: slugifyMatch(),
          status: 'not_started',
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      setTeams(nextTeams);
      setCreatedMatchId(data.id);
      setShowSuccessModal(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  function handleGoToMatch() {
    if (!createdMatchId) return;
    router.push(`/live/${createdMatchId}`);
  }

  function handleAddAnotherGame() {
    setShowSuccessModal(false);
    setCreatedMatchId('');
    resetTeamEntry(teams);
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-6 py-8">Loading match setup...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="text-3xl font-black tracking-tight">New Match</h1>
        <p className="mt-2 text-slate-600">
          Choose saved teams or create one-off opponents, then set the tracking depth for each side.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">Match Details</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
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

            <Field label="Match Date">
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label="Match Time">
              <input
                type="time"
                value={matchTime}
                onChange={(e) => setMatchTime(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label="Venue">
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="James Park"
              />
            </Field>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <TeamSetupCard
            title="Home Team"
            accent="blue"
            mode={homeMode}
            onModeChange={setHomeMode}
            teams={teams}
            selectedTeamId={homeTeamId}
            onSelectedTeamIdChange={setHomeTeamId}
            newTeamName={homeNewTeamName}
            onNewTeamNameChange={setHomeNewTeamName}
            saveReusable={homeSaveReusable}
            onSaveReusableChange={setHomeSaveReusable}
            trackingMode={homeTrackingMode}
            onTrackingModeChange={setHomeTrackingMode}
          />

          <TeamSetupCard
            title="Away Team"
            accent="rose"
            mode={awayMode}
            onModeChange={setAwayMode}
            teams={teams}
            selectedTeamId={awayTeamId}
            onSelectedTeamIdChange={setAwayTeamId}
            newTeamName={awayNewTeamName}
            onNewTeamNameChange={setAwayNewTeamName}
            saveReusable={awaySaveReusable}
            onSaveReusableChange={setAwaySaveReusable}
            trackingMode={awayTrackingMode}
            onTrackingModeChange={setAwayTrackingMode}
          />
        </div>

        {message ? <p className="text-sm font-medium text-slate-600">{message}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Creating Match...' : 'Create Match'}
        </button>
      </form>

      {showSuccessModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Match Created
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              What would you like to do next?
            </h2>
            <p className="mt-2 text-slate-600">
              Jump straight into live match management or keep this form open for another quick
              entry.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleGoToMatch}
                className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Go to Match
              </button>

              <button
                type="button"
                onClick={handleAddAnotherGame}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Add Another Game
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function TeamSetupCard({
  title,
  accent,
  mode,
  onModeChange,
  teams,
  selectedTeamId,
  onSelectedTeamIdChange,
  newTeamName,
  onNewTeamNameChange,
  saveReusable,
  onSaveReusableChange,
  trackingMode,
  onTrackingModeChange,
}: {
  title: string;
  accent: 'blue' | 'rose';
  mode: TeamOptionMode;
  onModeChange: (value: TeamOptionMode) => void;
  teams: Team[];
  selectedTeamId: string;
  onSelectedTeamIdChange: (value: string) => void;
  newTeamName: string;
  onNewTeamNameChange: (value: string) => void;
  saveReusable: boolean;
  onSaveReusableChange: (value: boolean) => void;
  trackingMode: TrackingMode;
  onTrackingModeChange: (value: TrackingMode) => void;
}) {
  const accentClass = accent === 'blue' ? 'bg-blue-50 text-blue-800' : 'bg-rose-50 text-rose-800';

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${accentClass}`}>
          {title.includes('Home') ? 'Home' : 'Away'}
        </span>
      </div>

      <div className="space-y-5">
        <Field label="Team Source">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onModeChange('saved')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                mode === 'saved' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Saved Team
            </button>
            <button
              type="button"
              onClick={() => onModeChange('new')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                mode === 'new' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              New Team
            </button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DescriptorCard
              title="Saved Team"
              body="Use a team already in Touchline with its existing roster, branding, and team settings."
              hint="Best for returning teams"
              active={mode === 'saved'}
              onClick={() => onModeChange('saved')}
            />
            <DescriptorCard
              title="New Team"
              body="Create a one-off or brand new opponent during setup. You can optionally save it for later."
              hint="Best for ad hoc opponents"
              active={mode === 'new'}
              onClick={() => onModeChange('new')}
            />
          </div>
        </Field>

        {mode === 'saved' ? (
          <Field label="Choose Team">
            <select
              value={selectedTeamId}
              onChange={(e) => onSelectedTeamIdChange(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="New Team Name">
              <input
                value={newTeamName}
                onChange={(e) => onNewTeamNameChange(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="North Shore Strikers"
              />
            </Field>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={saveReusable}
                onChange={(e) => onSaveReusableChange(e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-700">
                Save this team for reuse later
              </span>
            </label>
          </>
        )}

        <TrackingModeChooser
          trackingMode={trackingMode}
          onTrackingModeChange={onTrackingModeChange}
        />
      </div>
    </section>
  );
}

function TrackingModeChooser({
  trackingMode,
  onTrackingModeChange,
}: {
  trackingMode: TrackingMode;
  onTrackingModeChange: (value: TrackingMode) => void;
}) {
  return (
    <Field label="Tracking Mode">
      <div className="grid gap-3">
        <DescriptorCard
          title="Full Tracking"
          body="Track player-based match events like goals, cards, and substitutions with the most detail."
          hint="Best for full match coverage"
          active={trackingMode === 'full'}
          onClick={() => onTrackingModeChange('full')}
        />

        <DescriptorCard
          title="Lineups"
          body="Track score and match flow with lineup support when you want to manage player availability or starters without full stat detail."
          hint="Best for lineup-based coverage"
          active={trackingMode === 'lineups'}
          onClick={() => onTrackingModeChange('lineups')}
        />

        <DescriptorCard
          title="Basic Tracking"
          body="Track the score and key match events with lighter setup and less player-level detail."
          hint="Best for quick but useful coverage"
          active={trackingMode === 'basic'}
          onClick={() => onTrackingModeChange('basic')}
        />
      </div>
    </Field>
  );
}

function DescriptorCard({
  title,
  body,
  hint,
  active,
  onClick,
}: {
  title: string;
  body: string;
  hint: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 text-left transition cursor-pointer ${
        active
          ? 'border-slate-900 bg-slate-50 shadow-sm ring-2 ring-slate-900/10'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-left text-sm font-semibold text-slate-900">{title}</h3>
        <span
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
            active
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 bg-white text-transparent'
          }`}
          aria-hidden="true"
        >
          <span className="text-[10px] leading-none">•</span>
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
      <p className="mt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        {hint}
      </p>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
