'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTeamAccessGuard } from '@/lib/useTeamAccessGuard';
import { supabase } from '@/lib/supabase';
import { slugifyMatch } from '@/lib/utils';
import type { Season, Team, TrackingMode } from '@/lib/types';

type TeamOptionMode = 'saved' | 'new';

function getDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultSeasonId(seasons: Season[]) {
  const currentYear = String(new Date().getFullYear());
  const currentYearSeason =
    seasons.find((season) => season.name?.includes(currentYear)) ||
    seasons.find((season) => season.start_date?.startsWith(currentYear)) ||
    seasons.find((season) => season.end_date?.startsWith(currentYear));

  return currentYearSeason?.id || seasons.find((s) => s.is_active)?.id || seasons[0]?.id || '';
}

export default function TeamNewMatchPage() {
  // ---------------------------------------------------
  // ROUTE PARAMS
  // ---------------------------------------------------

  const params = useParams();
  const router = useRouter();

  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  // ---------------------------------------------------
  // AUTH / PAGE STATE
  // ---------------------------------------------------

 const {
  authChecked,
  error: accessError,
  loading: accessLoading,
} = useTeamAccessGuard({
  teamId,
  nextPath: `/teams/${teamId}/new-match`,
});
  const [team, setTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [createdMatchId, setCreatedMatchId] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ---------------------------------------------------
  // FORM STATE
  // ---------------------------------------------------

  const [seasonId, setSeasonId] = useState('');
  const [venue, setVenue] = useState('');
  const [matchDate, setMatchDate] = useState(() => getDateTimeLocalValue(new Date()));

  const [awayMode, setAwayMode] = useState<TeamOptionMode>('saved');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [awayNewTeamName, setAwayNewTeamName] = useState('');
  const [awaySaveReusable, setAwaySaveReusable] = useState(false);

  const [homeTrackingMode, setHomeTrackingMode] = useState<TrackingMode>('full');
  const [awayTrackingMode, setAwayTrackingMode] = useState<TrackingMode>('basic');

  function resetAwayEntry(nextTeams: Team[]) {
    setAwayMode('saved');
    setAwayTeamId(nextTeams[0]?.id || '');
    setAwayNewTeamName('');
    setAwaySaveReusable(false);
    setAwayTrackingMode('basic');
    setMessage('');
  }



  // ---------------------------------------------------
  // LOAD TEAM + SUPPORTING DATA
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId || !authChecked) return;

    async function loadData() {
      setLoading(true);
      setMessage('');

      const [
        { data: teamData, error: teamError },
        { data: teamsData, error: teamsError },
        { data: seasonsData, error: seasonsError },
      ] = await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase.from('teams').select('*').order('name', { ascending: true }),
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
      ]);

      if (teamError || teamsError || seasonsError) {
        setMessage(
          teamError?.message ||
            teamsError?.message ||
            seasonsError?.message ||
            'Failed to load match setup.',
        );
        setLoading(false);
        return;
      }

      const currentTeam = teamData as Team;
      const teamsList = ((teamsData as Team[]) ?? []).filter((entry) => entry.id !== teamId);
      const seasonsList = (seasonsData as Season[]) ?? [];

      setTeam(currentTeam);
      setTeams(teamsList);
      setSeasons(seasonsList);
      setSeasonId(getDefaultSeasonId(seasonsList));
      resetAwayEntry(teamsList);
      setVenue(currentTeam.home_field_name || '');
      setLoading(false);
    }

    loadData();
  }, [teamId, authChecked]);

  // ---------------------------------------------------
  // CREATE AWAY TEAM IF NEEDED
  // ---------------------------------------------------

  async function createTeamIfNeeded(name: string, isReusable: boolean) {
    const cleanName = name.trim();
    if (!cleanName) return null;

    const { data, error } = await supabase
      .from('teams')
      .insert({
        name: cleanName,
        is_reusable: isReusable,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Team;
  }

  // ---------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!team) return;

    setSaving(true);
    setMessage('');

    try {
      let resolvedAwayTeamId = awayTeamId;
      let nextTeams = teams;

      if (awayMode === 'new') {
        const createdAway = await createTeamIfNeeded(awayNewTeamName, awaySaveReusable);
        resolvedAwayTeamId = createdAway?.id || '';
        if (createdAway) {
          nextTeams = [...nextTeams, createdAway].sort((a, b) => a.name.localeCompare(b.name));
        }
      }

      if (!resolvedAwayTeamId) {
        throw new Error('An away team is required.');
      }

      if (resolvedAwayTeamId === team.id) {
        throw new Error('Home and away teams must be different.');
      }

      const { data, error } = await supabase
        .from('matches')
        .insert({
          season_id: seasonId || null,
          home_team_id: team.id,
          away_team_id: resolvedAwayTeamId,
          home_tracking_mode: homeTrackingMode,
          away_tracking_mode: awayTrackingMode,
          venue: venue.trim() || null,
          match_date: matchDate ? new Date(matchDate).toISOString() : null,
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
    resetAwayEntry(teams);
  }

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading || accessLoading || !authChecked) {
  return <main className="mx-auto max-w-5xl px-6 py-8">Loading match setup...</main>;
}

if ((accessError || message) && !team) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8 text-red-600">
      {accessError || message}
    </main>
  );
}

if (!team) {
  return <main className="mx-auto max-w-5xl px-6 py-8 text-red-600">Team not found.</main>;
}

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="text-3xl font-black tracking-tight">Start Match</h1>
          <p className="mt-2 text-slate-600">
            Create a new match for <span className="font-semibold text-slate-900">{team.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/teams/${team.id}`}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
          >
            Back to Team
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* --------------------------------------------------- */}
        {/* MATCH DETAILS */}
        {/* --------------------------------------------------- */}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">Match Details</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
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

            <Field label="Match Date & Time">
              <input
                type="datetime-local"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
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

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* ------------------------------------------------- */}
          {/* HOME TEAM */}
          {/* ------------------------------------------------- */}

          <div className="flex self-start">
            <section className="w-full rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">Home Team</h2>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
                  Home
                </span>
              </div>

              <div className="space-y-4">
                <Field label="Team Source">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Current Team Context</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          This page starts a match for the team you are already managing.
                        </p>
                      </div>

                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-900 bg-slate-900 text-white">
                        <span className="text-[10px] leading-none">•</span>
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Home team is fixed here
                    </p>
                  </div>
                </Field>

                <Field label="Selected Team">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{team.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {team.club_name || 'Current authenticated team'}
                    </p>
                  </div>
                </Field>

                <Field label="Tracking Mode">
                  <TrackingModeChooser
                    trackingMode={homeTrackingMode}
                    onTrackingModeChange={setHomeTrackingMode}
                  />
                </Field>
              </div>
            </section>
          </div>

          {/* ------------------------------------------------- */}
          {/* AWAY TEAM */}
          {/* ------------------------------------------------- */}

          <div className="flex self-start">
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
              Jump into live match management or stay here to add another game quickly for this
              team.
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
    <section className="self-start rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${accentClass}`}>
          {title.includes('Home') ? 'Home' : 'Away'}
        </span>
      </div>

      <div className="space-y-4">
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
              <option value="">Select an away team</option>
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

            <label className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={saveReusable}
                onChange={(e) => onSaveReusableChange(e.target.checked)}
              />
              <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">
                Save this team for reuse later
              </span>
            </label>
          </>
        )}

        <Field label="Tracking Mode">
          <TrackingModeChooser
            trackingMode={trackingMode}
            onTrackingModeChange={onTrackingModeChange}
          />
        </Field>
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
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
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
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
