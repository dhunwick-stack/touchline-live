'use client';

import { useEffect, useMemo, useState } from 'react';
import TeamPageIntro from '@/components/TeamPageIntro';
import FieldCard from '@/components/FieldCard';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Match, Player, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export default function TeamDetailPage() {
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
  // AUTH / PAGE STATE
  // ---------------------------------------------------

  const [authChecked, setAuthChecked] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------------------------------------------------
  // EDIT FORM STATE
  // ---------------------------------------------------

  const [teamName, setTeamName] = useState('');
  const [clubName, setClubName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [homeFieldName, setHomeFieldName] = useState('');
  const [homeFieldAddress, setHomeFieldAddress] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // ---------------------------------------------------
  // TEAM AUTH GUARD
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId) return;

    const savedTeamId = localStorage.getItem('teamId');

    if (!savedTeamId || savedTeamId !== String(teamId)) {
      window.location.href = '/team-login';
      return;
    }

    setAuthChecked(true);
  }, [teamId]);

  // ---------------------------------------------------
  // INITIAL DATA LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId || !authChecked) return;
    loadTeamData();
  }, [teamId, authChecked]);

  // ---------------------------------------------------
  // LOAD TEAM DATA
  // ---------------------------------------------------

  async function loadTeamData() {
    setLoading(true);
    setError('');

    const [
      { data: teamData, error: teamError },
      { data: playerData, error: playerError },
      { data: recentMatchData, error: recentMatchError },
    ] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),
      supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .order('jersey_number', { ascending: true, nullsFirst: false })
        .order('first_name', { ascending: true }),
      supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('match_date', { ascending: false, nullsFirst: false })
        .limit(5),
    ]);

    if (teamError || playerError || recentMatchError) {
      setError(
        teamError?.message ||
          playerError?.message ||
          recentMatchError?.message ||
          'Failed to load team.',
      );
      setLoading(false);
      return;
    }

    const loadedTeam = teamData as Team;
    const loadedPlayers = (playerData as Player[]) ?? [];
    const loadedRecentMatches = (recentMatchData as MatchRow[]) ?? [];

    setTeam(loadedTeam);
    setPlayers(loadedPlayers);
    setRecentMatches(loadedRecentMatches);

    // -----------------------------------------------
    // PREFILL EDIT FORM
    // -----------------------------------------------

    setTeamName(loadedTeam.name || '');
    setClubName(loadedTeam.club_name || '');
    setLogoUrl(loadedTeam.logo_url || '');
    setHomeFieldName(loadedTeam.home_field_name || '');
    setHomeFieldAddress(loadedTeam.home_field_address || '');
    setPrimaryColor(loadedTeam.primary_color || '');
    setSecondaryColor(loadedTeam.secondary_color || '');
    setBannerUrl(loadedTeam.banner_url || '');

    setLoading(false);
  }

  // ---------------------------------------------------
  // SAVE TEAM CHANGES
  // ---------------------------------------------------

  async function handleSaveTeam() {
    if (!team) return;

    setSaving(true);
    setError('');

    const { data, error } = await supabase
      .from('teams')
      .update({
        name: teamName.trim() || null,
        club_name: clubName.trim() || null,
        logo_url: logoUrl.trim() || null,
        home_field_name: homeFieldName.trim() || null,
        home_field_address: homeFieldAddress.trim() || null,
        primary_color: primaryColor.trim() || null,
        secondary_color: secondaryColor.trim() || null,
        banner_url: bannerUrl.trim() || null,
      })
      .eq('id', team.id)
      .select()
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    const updatedTeam = data as Team;
    setTeam(updatedTeam);
    setEditing(false);
    setSaving(false);
  }

  // ---------------------------------------------------
  // DERIVED VALUES
  // ---------------------------------------------------

  const activePlayers = useMemo(
    () => players.filter((player) => player.active !== false),
    [players],
  );

  const goalkeepers = useMemo(
    () =>
      activePlayers.filter(
        (player) =>
          player.position?.toLowerCase() === 'goalkeeper' ||
          player.position?.toLowerCase() === 'gk',
      ),
    [activePlayers],
  );

  // ---------------------------------------------------
  // MATCH HELPERS
  // ---------------------------------------------------

  function opponentName(match: MatchRow) {
    const isHome = match.home_team_id === teamId;

    return isHome
      ? match.away_team?.name || 'Opponent'
      : match.home_team?.name || 'Opponent';
  }

  function scoreLine(match: MatchRow) {
    const isHome = match.home_team_id === teamId;
    const teamGoals = isHome ? match.home_score : match.away_score;
    const oppGoals = isHome ? match.away_score : match.home_score;

    return `${teamGoals}-${oppGoals}`;
  }

  function resultLabel(match: MatchRow) {
    if (match.status !== 'final') return null;

    const isHome = match.home_team_id === teamId;
    const teamGoals = isHome ? match.home_score : match.away_score;
    const oppGoals = isHome ? match.away_score : match.home_score;

    if (teamGoals > oppGoals) return 'W';
    if (teamGoals < oppGoals) return 'L';
    return 'D';
  }

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading || !authChecked) {
    return <div>Loading team...</div>;
  }

  if (error && !team) {
    return <div className="text-red-600">{error}</div>;
  }

  if (!team) {
    return <div className="text-red-600">Team not found.</div>;
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <>
     {/* --------------------------------------------------- */}
{/* TEAM PAGE INTRO */}
{/* --------------------------------------------------- */}

<TeamPageIntro
  eyebrow="Team Overview"
  title="Overview"
  description="Overview, roster preview, field details, recent matches, and team settings."
  rightSlot={
    <>
      <button
        type="button"
        onClick={() => setEditing((prev) => !prev)}
        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
      >
        {editing ? 'Close Edit' : 'Edit Team'}
      </button>

      <Link
        href={`/teams/${team.id}/stats`}
        className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
      >
        View Stats
      </Link>
    </>
  }
/>

      {/* --------------------------------------------------- */}
      {/* SUMMARY CARDS */}
      {/* --------------------------------------------------- */}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Active Players" value={activePlayers.length} />
        <SummaryCard label="Goalkeepers" value={goalkeepers.length} />
        <SummaryCard label="Home Field" value={team.home_field_name || 'Not set'} />
      </section>

      {/* --------------------------------------------------- */}
      {/* FIELD + ROSTER PREVIEW */}
      {/* --------------------------------------------------- */}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
       {/* ------------------------------------------------- */}
{/* HOME FIELD CARD */}
{/* ------------------------------------------------- */}

<FieldCard
  fieldName={team.home_field_name}
  fieldAddress={team.home_field_address}
/> 



        {/* ------------------------------------------------- */}
        {/* ROSTER PREVIEW */}
        {/* ------------------------------------------------- */}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">Roster Preview</h2>

            <Link
              href={`/teams/${team.id}/roster`}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
            >
              View Full Roster
            </Link>
          </div>

          {activePlayers.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No players added yet.</p>
          ) : (
            <div className="space-y-3">
              {activePlayers.slice(0, 8).map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {[player.first_name, player.last_name].filter(Boolean).join(' ') ||
                        'Unnamed Player'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {player.position || 'No position'}
                    </p>
                  </div>

                  <div className="text-sm font-bold text-slate-700">
                    {player.jersey_number ? `#${player.jersey_number}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* --------------------------------------------------- */}
      {/* RECENT MATCHES */}
      {/* --------------------------------------------------- */}

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Recent Matches</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {recentMatches.length} shown
          </span>
        </div>

        {recentMatches.length === 0 ? (
          <p className="text-sm text-slate-500">No matches found yet.</p>
        ) : (
          <div className="space-y-3">
            {recentMatches.map((match) => {
              const result = resultLabel(match);

              return (
                <div
                  key={match.id}
                  className="grid items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 md:grid-cols-[90px_1fr_auto_auto]"
                >
                  {/* ------------------------------------------- */}
                  {/* STATUS */}
                  {/* ------------------------------------------- */}

                  <div>
                    {match.status === 'final' ? (
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          result === 'W'
                            ? 'bg-emerald-100 text-emerald-700'
                            : result === 'L'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {result}
                      </span>
                    ) : match.status === 'live' ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                        Scheduled
                      </span>
                    )}
                  </div>

                  {/* ------------------------------------------- */}
                  {/* MATCH INFO */}
                  {/* ------------------------------------------- */}

                  <div>
                    <p className="font-semibold text-slate-900">
                      vs {opponentName(match)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {match.match_date
                        ? new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }).format(new Date(match.match_date))
                        : 'Date TBD'}
                    </p>
                  </div>

                  {/* ------------------------------------------- */}
                  {/* SCORE */}
                  {/* ------------------------------------------- */}

                  <div className="text-lg font-black tabular-nums text-slate-900">
                    {scoreLine(match)}
                  </div>

                  {/* ------------------------------------------- */}
                  {/* ACTION */}
                  {/* ------------------------------------------- */}

                  <div>
                    {match.status === 'final' && match.public_slug ? (
                      <Link
                        href={`/public/${match.public_slug}`}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        View Recap
                      </Link>
                    ) : match.status === 'live' && match.public_slug ? (
                      <Link
                        href={`/public/${match.public_slug}`}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
                      >
                        Follow Live
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* --------------------------------------------------- */}
      {/* EDIT TEAM FORM */}
      {/* --------------------------------------------------- */}

      {editing ? (
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">Edit Team</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {team.name}
            </span>
          </div>

          {/* ----------------------------------------------- */}
          {/* EDIT FIELDS */}
          {/* ----------------------------------------------- */}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Team Name">
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label="Club Name">
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>

            <Field label="Logo URL">
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="https://..."
              />
            </Field>

            <Field label="Home Field Name">
              <input
                value={homeFieldName}
                onChange={(e) => setHomeFieldName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="James Park"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Home Field Address">
                <input
                  value={homeFieldAddress}
                  onChange={(e) => setHomeFieldAddress(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="123 Main St, Evanston, IL"
                />
              </Field>
            </div>

            <Field label="Primary Color">
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="#0f172a"
              />
            </Field>

            <Field label="Secondary Color">
              <input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="#7f1d1d"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Banner URL">
                <input
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="https://..."
                />
              </Field>
            </div>
          </div>

          {/* ----------------------------------------------- */}
          {/* SAVE ERROR */}
          {/* ----------------------------------------------- */}

          {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}

          {/* ----------------------------------------------- */}
          {/* EDIT ACTIONS */}
          {/* ----------------------------------------------- */}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveTeam}
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setTeamName(team.name || '');
                setClubName(team.club_name || '');
                setLogoUrl(team.logo_url || '');
                setHomeFieldName(team.home_field_name || '');
                setHomeFieldAddress(team.home_field_address || '');
                setPrimaryColor(team.primary_color || '');
                setSecondaryColor(team.secondary_color || '');
                setBannerUrl(team.banner_url || '');
              }}
              className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-800 ring-1 ring-slate-200"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}

// ---------------------------------------------------
// SUMMARY CARD
// ---------------------------------------------------

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------
// FIELD WRAPPER
// ---------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}