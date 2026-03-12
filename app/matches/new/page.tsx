'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function NewMatchPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [seasonId, setSeasonId] = useState('');
  const [venue, setVenue] = useState('');
  const [matchDate, setMatchDate] = useState(() => getDateTimeLocalValue(new Date()));

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
      setSeasonId(seasonsList.find((s) => s.is_active)?.id || seasonsList[0]?.id || '');
      setHomeTeamId(teamsList[0]?.id || '');
      setAwayTeamId(teamsList[1]?.id || teamsList[0]?.id || '');
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

      if (homeMode === 'new') {
        const createdHome = await createTeamIfNeeded(homeNewTeamName, homeSaveReusable);
        resolvedHomeTeamId = createdHome?.id || '';
      }

      if (awayMode === 'new') {
        const createdAway = await createTeamIfNeeded(awayNewTeamName, awaySaveReusable);
        resolvedAwayTeamId = createdAway?.id || '';
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
          match_date: matchDate ? new Date(matchDate).toISOString() : null,
          public_slug: slugifyMatch(),
          status: 'not_started',
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      router.push(`/live/${data.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
      setSaving(false);
      return;
    }

    setSaving(false);
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-6 py-8">Loading match setup...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Touchline Live</p>
        <h1 className="text-3xl font-black tracking-tight">New Match</h1>
        <p className="mt-2 text-slate-600">
          Choose saved teams or create one-off opponents, then set the tracking depth for each side.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
              <span className="text-sm font-medium text-slate-700">Save this team for reuse later</span>
            </label>
          </>
        )}

        <Field label="Tracking Mode">
          <select
            value={trackingMode}
            onChange={(e) => onTrackingModeChange(e.target.value as TrackingMode)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
          >
            <option value="full">Full tracking</option>
            <option value="basic">Basic tracking</option>
            <option value="score_only">Score only</option>
          </select>
        </Field>
      </div>
    </section>
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