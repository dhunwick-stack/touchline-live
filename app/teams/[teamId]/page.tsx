'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import TeamPageIntro from '@/components/TeamPageIntro';
import FieldCard from '@/components/FieldCard';
import LiveMatchHero from '@/components/LiveMatchHero';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Match, Organization, Player, Team } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

// ---------------------------------------------------
// PAGE
// ---------------------------------------------------

export default function TeamDetailPage() {
  // ---------------------------------------------------
  // ROUTE PARAMS / ROUTER
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

  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasTeamAccess, setHasTeamAccess] = useState(false);

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchRow[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [liveMatch, setLiveMatch] = useState<MatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------------------------------------------------
  // EDIT FORM STATE
  // ---------------------------------------------------

  const [teamName, setTeamName] = useState('');
  const [clubName, setClubName] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [teamLevel, setTeamLevel] = useState('');
  const [gender, setGender] = useState('');
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
    async function checkAccess() {
      if (!teamId) {
        setError('No team id was found in the URL.');
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      // -----------------------------------------------
      // LOAD CURRENT AUTH USER
      // -----------------------------------------------

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message || 'Failed to check sign-in status.');
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      const user = userData.user ?? null;
      setCurrentUser(user);

      // -----------------------------------------------
      // REQUIRE SIGN-IN
      // -----------------------------------------------

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/teams/${teamId}`)}`);
        return;
      }

      // -----------------------------------------------
      // VERIFY TEAM MEMBERSHIP
      // -----------------------------------------------

      const { data: membership, error: membershipError } = await supabase
        .from('team_users')
        .select('id, role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError) {
        setError(membershipError.message || 'Failed to verify team access.');
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      // -----------------------------------------------
      // REDIRECT TO TEAM CODE FLOW IF NOT LINKED
      // -----------------------------------------------

      if (!membership) {
        router.replace(`/team-login?teamId=${teamId}&mode=admin`);
        return;
      }

      setHasTeamAccess(true);
      setAuthChecked(true);
    }

    checkAccess();
  }, [teamId, router]);

  // ---------------------------------------------------
  // INITIAL DATA LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId || !authChecked || !hasTeamAccess) return;
    loadTeamData();
  }, [teamId, authChecked, hasTeamAccess]);

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
      { data: organizationData, error: organizationError },
      { data: liveMatchData, error: liveMatchError },
    ] = await Promise.all([
      supabase
        .from('teams')
        .select(`
          *,
          organization:organization_id (*)
        `)
        .eq('id', teamId)
        .single(),

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

      supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true }),

      supabase
        .from('matches')
        .select(`
          *,
          home_team:home_team_id (*),
          away_team:away_team_id (*)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .in('status', ['live', 'halftime'])
        .order('match_date', { ascending: true, nullsFirst: false })
        .limit(1),
    ]);

    if (
      teamError ||
      playerError ||
      recentMatchError ||
      organizationError ||
      liveMatchError
    ) {
      setError(
        teamError?.message ||
          playerError?.message ||
          recentMatchError?.message ||
          organizationError?.message ||
          liveMatchError?.message ||
          'Failed to load team.',
      );
      setLoading(false);
      return;
    }

    const loadedTeam = teamData as Team;
    const loadedPlayers = (playerData as Player[]) ?? [];
    const loadedRecentMatches = (recentMatchData as MatchRow[]) ?? [];
    const loadedOrganizations = (organizationData as Organization[]) ?? [];
    const loadedLiveMatch = ((liveMatchData as MatchRow[]) ?? [])[0] || null;

    setTeam(loadedTeam);
    setPlayers(loadedPlayers);
    setRecentMatches(loadedRecentMatches);
    setOrganizations(loadedOrganizations);
    setLiveMatch(loadedLiveMatch);

    // -------------------------------------------------
    // PREFILL EDIT FORM
    // -------------------------------------------------

    setTeamName(loadedTeam.name || '');
    setClubName(loadedTeam.club_name || '');
    setOrganizationId(loadedTeam.organization_id || null);
    setTeamLevel(loadedTeam.team_level || '');
    setGender(loadedTeam.gender || '');
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

    const selectedOrganization =
      organizations.find((org) => org.id === organizationId) || null;

    const resolvedClubName = clubName.trim() || selectedOrganization?.name || null;

    const { data, error: saveError } = await supabase
      .from('teams')
      .update({
        name: teamName.trim() || null,
        club_name: resolvedClubName,
        organization_id: organizationId,
        team_level: teamLevel.trim() || null,
        gender: gender.trim() || null,
        logo_url: logoUrl.trim() || null,
        home_field_name: homeFieldName.trim() || null,
        home_field_address: homeFieldAddress.trim() || null,
        primary_color: primaryColor.trim() || null,
        secondary_color: secondaryColor.trim() || null,
        banner_url: bannerUrl.trim() || null,
      })
      .eq('id', team.id)
      .select(`
        *,
        organization:organization_id (*)
      `)
      .single();

    if (saveError) {
      setError(saveError.message);
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
            <div className="mr-2 hidden text-right text-xs text-slate-500 md:block">
              {currentUser?.email ? (
                <>
                  <div className="font-semibold text-slate-700">Signed in</div>
                  <div>{currentUser.email}</div>
                </>
              ) : null}
            </div>

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
      {/* LIVE MATCH ADMIN HERO */}
      {/* --------------------------------------------------- */}

      {liveMatch ? (
        <LiveMatchHero
          match={liveMatch}
          primaryColor={team.primary_color}
          secondaryColor={team.secondary_color}
          mode="admin"
          className="mb-6"
        />
      ) : null}

      {/* --------------------------------------------------- */}
      {/* ADMIN MATCH CONTROL CARD */}
      {/* --------------------------------------------------- */}

      {liveMatch ? (
        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Match Control
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                Live match tools
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Jump straight into live scoring, open the public scoreboard, or
                review the live match record.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/live/${liveMatch.id}`}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Update Match
              </Link>

              {liveMatch.public_slug ? (
                <Link
                  href={`/public/${liveMatch.public_slug}`}
                  target="_blank"
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
                >
                  Public Page
                </Link>
              ) : null}

              <Link
                href="/matches"
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                All Matches
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------- */}
      {/* SUMMARY CARDS */}
      {/* --------------------------------------------------- */}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <SummaryCard label="Active Players" value={activePlayers.length} />
        <SummaryCard label="Goalkeepers" value={goalkeepers.length} />
        <SummaryCard label="Home Field" value={team.home_field_name || 'Not set'} />
      </section>

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
                    ) : match.status === 'halftime' ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
                        Halftime
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
                    ) : match.status === 'live' || match.status === 'halftime' ? (
                      <Link
                        href={`/live/${match.id}`}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Update Match
                      </Link>
                    ) : match.public_slug ? (
                      <Link
                        href={`/public/${match.public_slug}`}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
                      >
                        View Match
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
      {/* ROSTER + FIELD */}
      {/* --------------------------------------------------- */}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
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

        {/* ------------------------------------------------- */}
        {/* HOME FIELD CARD */}
        {/* ------------------------------------------------- */}

        <FieldCard
          fieldName={team.home_field_name}
          fieldAddress={team.home_field_address}
        />
      </div>

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

            <Field label="Organization">
              <select
                value={organizationId ?? ''}
                onChange={(e) => setOrganizationId(e.target.value || null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              >
                <option value="">No organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Club / Display Name (legacy compatibility)">
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Optional fallback display name"
              />
            </Field>

            <Field label="Team Level">
              <input
                value={teamLevel}
                onChange={(e) => setTeamLevel(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Varsity, JV, Premier, Elite..."
              />
            </Field>

            <Field label="Gender">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              >
                <option value="">Not set</option>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="coed">Coed</option>
              </select>
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
                setOrganizationId(team.organization_id || null);
                setTeamLevel(team.team_level || '');
                setGender(team.gender || '');
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}