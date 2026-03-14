'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import TeamPageIntro from '@/components/TeamPageIntro';
import { supabase } from '@/lib/supabase';
import type { Player, Team } from '@/lib/types';

const POSITION_OPTIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

type EditingPlayerState = Record<
  string,
  {
    first_name: string;
    last_name: string;
    jersey_number: string;
    position: string;
    active: boolean;
  }
>;

export default function TeamRosterPage() {
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
  // PAGE STATE
  // ---------------------------------------------------

  const [authChecked, setAuthChecked] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [editingPlayers, setEditingPlayers] = useState<EditingPlayerState>({});

  // ---------------------------------------------------
  // ADD PLAYER FORM STATE
  // ---------------------------------------------------

  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newJerseyNumber, setNewJerseyNumber] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newActive, setNewActive] = useState(true);

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
  // INITIAL LOAD
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId || !authChecked) return;
    loadRoster();
  }, [teamId, authChecked]);

  // ---------------------------------------------------
  // LOAD ROSTER
  // ---------------------------------------------------

  async function loadRoster() {
    setLoading(true);
    setError('');

    const [{ data: teamData, error: teamError }, { data: playerData, error: playerError }] =
      await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('players')
          .select('*')
          .eq('team_id', teamId)
          .order('active', { ascending: false })
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true }),
      ]);

    if (teamError || playerError) {
      setError(teamError?.message || playerError?.message || 'Failed to load roster.');
      setLoading(false);
      return;
    }

    const loadedTeam = teamData as Team;
    const loadedPlayers = (playerData as Player[]) ?? [];

    setTeam(loadedTeam);
    setPlayers(loadedPlayers);

    const initialEditing: EditingPlayerState = {};
    for (const player of loadedPlayers) {
      initialEditing[player.id] = {
        first_name: player.first_name || '',
        last_name: player.last_name || '',
        jersey_number:
          player.jersey_number !== null && player.jersey_number !== undefined
            ? String(player.jersey_number)
            : '',
        position: player.position || '',
        active: player.active !== false,
      };
    }

    setEditingPlayers(initialEditing);
    setLoading(false);
  }

  // ---------------------------------------------------
  // ADD PLAYER
  // ---------------------------------------------------

  async function handleAddPlayer() {
    if (!teamId) return;

    const first = newFirstName.trim();
    const last = newLastName.trim();

    if (!first && !last) {
      setError('Please add at least a first or last name.');
      return;
    }

    setSaving(true);
    setError('');

    const jerseyValue =
      newJerseyNumber.trim() === '' ? null : Number.parseInt(newJerseyNumber.trim(), 10);

    const { error } = await supabase.from('players').insert({
      team_id: teamId,
      first_name: first || null,
      last_name: last || null,
      jersey_number: Number.isNaN(jerseyValue as number) ? null : jerseyValue,
      position: newPosition || null,
      active: newActive,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setNewFirstName('');
    setNewLastName('');
    setNewJerseyNumber('');
    setNewPosition('');
    setNewActive(true);

    await loadRoster();
    setSaving(false);
  }

  // ---------------------------------------------------
  // EDIT HELPERS
  // ---------------------------------------------------

  function startEditing(player: Player) {
    setEditingIds((prev) => ({ ...prev, [player.id]: true }));
    setEditingPlayers((prev) => ({
      ...prev,
      [player.id]: {
        first_name: player.first_name || '',
        last_name: player.last_name || '',
        jersey_number:
          player.jersey_number !== null && player.jersey_number !== undefined
            ? String(player.jersey_number)
            : '',
        position: player.position || '',
        active: player.active !== false,
      },
    }));
  }

  function cancelEditing(playerId: string) {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    setEditingIds((prev) => ({ ...prev, [playerId]: false }));
    setEditingPlayers((prev) => ({
      ...prev,
      [playerId]: {
        first_name: player.first_name || '',
        last_name: player.last_name || '',
        jersey_number:
          player.jersey_number !== null && player.jersey_number !== undefined
            ? String(player.jersey_number)
            : '',
        position: player.position || '',
        active: player.active !== false,
      },
    }));
  }

  async function savePlayer(playerId: string) {
    const draft = editingPlayers[playerId];
    if (!draft) return;

    setSaving(true);
    setError('');

    const jerseyValue =
      draft.jersey_number.trim() === '' ? null : Number.parseInt(draft.jersey_number.trim(), 10);

    const { error } = await supabase
      .from('players')
      .update({
        first_name: draft.first_name.trim() || null,
        last_name: draft.last_name.trim() || null,
        jersey_number: Number.isNaN(jerseyValue as number) ? null : jerseyValue,
        position: draft.position || null,
        active: draft.active,
      })
      .eq('id', playerId);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setEditingIds((prev) => ({ ...prev, [playerId]: false }));
    await loadRoster();
    setSaving(false);
  }

  // ---------------------------------------------------
  // SUMMARY DATA
  // ---------------------------------------------------

  const activePlayers = useMemo(
    () => players.filter((player) => player.active !== false),
    [players],
  );

  const inactivePlayers = useMemo(
    () => players.filter((player) => player.active === false),
    [players],
  );

  const goalkeepers = useMemo(
    () =>
      players.filter(
        (player) =>
          player.position?.toLowerCase() === 'goalkeeper' ||
          player.position?.toLowerCase() === 'gk',
      ),
    [players],
  );

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading || !authChecked) {
    return <main className="mx-auto max-w-7xl px-6 py-8">Loading roster...</main>;
  }

  if (error && !team) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
        {error}
      </main>
    );
  }

  if (!team) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
        Team not found.
      </main>
    );
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
        eyebrow="Team Roster"
        title="Squad Management"
        description="Manage players, positions, jersey numbers, and active roster status."
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* --------------------------------------------------- */}
        {/* ROSTER DASHBOARD LAYOUT */}
        {/* --------------------------------------------------- */}

        <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          {/* ------------------------------------------------- */}
          {/* LEFT COLUMN - ROSTER */}
          {/* ------------------------------------------------- */}

          <section className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Roster</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Edit player details, adjust status, and keep the squad current.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {players.length} players
              </span>
            </div>

            {players.length === 0 ? (
              <p className="text-sm text-slate-500">No players added yet.</p>
            ) : (
              <div className="space-y-4">
                {players.map((player) => {
                  const isEditing = !!editingIds[player.id];
                  const draft = editingPlayers[player.id];

                  return (
                    <div
                      key={player.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5"
                    >
                      {!isEditing ? (
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-900 ring-1 ring-slate-200">
                              {player.jersey_number ? `#${player.jersey_number}` : '—'}
                            </div>

                            <div>
                              <p className="text-lg font-semibold text-slate-900">
                                {[player.first_name, player.last_name].filter(Boolean).join(' ') ||
                                  'Unnamed Player'}
                              </p>
                              <p className="text-sm text-slate-500">
                                {player.position || 'No position'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                                player.active !== false
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {player.active !== false ? 'Active' : 'Inactive'}
                            </span>

                            <button
                              type="button"
                              onClick={() => startEditing(player)}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="First Name">
                              <input
                                value={draft?.first_name || ''}
                                onChange={(e) =>
                                  setEditingPlayers((prev) => ({
                                    ...prev,
                                    [player.id]: {
                                      ...prev[player.id],
                                      first_name: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                              />
                            </Field>

                            <Field label="Last Name">
                              <input
                                value={draft?.last_name || ''}
                                onChange={(e) =>
                                  setEditingPlayers((prev) => ({
                                    ...prev,
                                    [player.id]: {
                                      ...prev[player.id],
                                      last_name: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                              />
                            </Field>

                            <Field label="Jersey #">
                              <input
                                value={draft?.jersey_number || ''}
                                onChange={(e) =>
                                  setEditingPlayers((prev) => ({
                                    ...prev,
                                    [player.id]: {
                                      ...prev[player.id],
                                      jersey_number: e.target.value.replace(/\D/g, '').slice(0, 2),
                                    },
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-3"
                                inputMode="numeric"
                                maxLength={2}
                                placeholder="10"
                              />
                            </Field>

                            <Field label="Position">
                              <select
                                value={draft?.position || ''}
                                onChange={(e) =>
                                  setEditingPlayers((prev) => ({
                                    ...prev,
                                    [player.id]: {
                                      ...prev[player.id],
                                      position: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                              >
                                <option value="">Select position</option>
                                {POSITION_OPTIONS.map((position) => (
                                  <option key={position} value={position}>
                                    {position}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <div className="md:col-span-2">
                              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <span className="text-sm font-semibold text-slate-700">Active</span>
                                <input
                                  type="checkbox"
                                  checked={draft?.active ?? true}
                                  onChange={(e) =>
                                    setEditingPlayers((prev) => ({
                                      ...prev,
                                      [player.id]: {
                                        ...prev[player.id],
                                        active: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="h-5 w-5 shrink-0"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => savePlayer(player.id)}
                              disabled={saving}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              onClick={() => cancelEditing(player.id)}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ------------------------------------------------- */}
          {/* RIGHT COLUMN */}
          {/* ------------------------------------------------- */}

          <div className="space-y-6">
            {/* ----------------------------------------------- */}
            {/* ADD PLAYER */}
            {/* ----------------------------------------------- */}

            <section className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-slate-900">Add Player</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add a new player to the roster with jersey number, position, and status.
                </p>
              </div>

              <div className="space-y-4">
                <Field label="First Name">
                  <input
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                </Field>

                <Field label="Last Name">
                  <input
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                </Field>

                <Field label="Jersey #">
                  <input
                    value={newJerseyNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 2);
                      setNewJerseyNumber(digitsOnly);
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-3"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="10"
                  />
                </Field>

                <Field label="Position">
                  <select
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <option value="">Select position</option>
                    {POSITION_OPTIONS.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">Active</span>
                  <input
                    type="checkbox"
                    checked={newActive}
                    onChange={(e) => setNewActive(e.target.checked)}
                    className="h-5 w-5 shrink-0"
                  />
                </div>

                {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

                <button
                  type="button"
                  onClick={handleAddPlayer}
                  disabled={saving}
                  className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Add Player'}
                </button>
              </div>
            </section>

            {/* ----------------------------------------------- */}
            {/* ROSTER SUMMARY */}
            {/* ----------------------------------------------- */}

            <section className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Roster Summary</h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <SummaryCard label="Total Players" value={players.length} />
                <SummaryCard label="Active" value={activePlayers.length} />
                <SummaryCard label="Inactive" value={inactivePlayers.length} />
                <SummaryCard label="Goalkeepers" value={goalkeepers.length} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------
// SUMMARY CARD
// ---------------------------------------------------

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
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