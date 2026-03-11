'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Player, Team } from '@/lib/types';

const positionOptions = [
  'Goalkeeper',
  'Defender',
  'Midfielder',
  'Forward',
  'Wingback',
  'Utility',
];

type EditingPlayerState = {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: string;
  position: string;
};

export default function TeamDetailPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params.teamId;
  const [homeFieldName, setHomeFieldName] = useState('');
  const [homeFieldAddress, setHomeFieldAddress] = useState('');
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [isEditingTeam, setIsEditingTeam] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<EditingPlayerState | null>(null);

  const [teamName, setTeamName] = useState('');
  const [clubName, setClubName] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [position, setPosition] = useState('');

  async function loadTeamData() {
    setLoading(true);
    setMessage('');

    const [{ data: teamData, error: teamError }, { data: playerData, error: playerError }] =
      await Promise.all([
        supabase.from('teams').select('*').eq('id', teamId).single(),
        supabase
          .from('players')
          .select('*')
          .eq('team_id', teamId)
          .order('jersey_number', { ascending: true, nullsFirst: false })
          .order('first_name', { ascending: true }),
      ]);

    if (teamError) {
      setMessage(`Team load error: ${teamError.message}`);
      setLoading(false);
      return;
    }

    if (playerError) {
      setMessage(`Player load error: ${playerError.message}`);
      setLoading(false);
      return;
    }

    const loadedTeam = (teamData as Team) ?? null;
    setTeam(loadedTeam);
    setPlayers((playerData as Player[]) ?? []);

    setTeamName(loadedTeam?.name || '');
    setClubName(loadedTeam?.club_name || '');
    setAgeGroup(loadedTeam?.age_group || '');
    setLogoUrl(loadedTeam?.logo_url || '');

    setLoading(false);
  }

  useEffect(() => {
    if (!teamId) return;
    loadTeamData();
  }, [teamId]);

  function resetTeamEditForm() {
    setTeamName(team?.name || '');
    setClubName(team?.club_name || '');
    setAgeGroup(team?.age_group || '');
    setLogoUrl(team?.logo_url || '');
  }

  function startEditingPlayer(player: Player) {
    setEditingPlayer({
      id: player.id,
      first_name: player.first_name,
      last_name: player.last_name || '',
      jersey_number: player.jersey_number?.toString() || '',
      position: player.position || '',
    });
    setMessage('');
  }

  function cancelEditingPlayer() {
    setEditingPlayer(null);
  }

  async function handleSaveTeam(e: FormEvent) {
    e.preventDefault();
    if (!teamId || !teamName.trim()) return;

    setSavingTeam(true);
    setMessage('');

    const { data, error } = await supabase
      .from('teams')
      .update({
  name: teamName.trim(),
  club_name: clubName.trim() || null,
  age_group: ageGroup.trim() || null,
  logo_url: logoUrl.trim() || null,
  home_field_name: homeFieldName || null,
  home_field_address: homeFieldAddress || null,
})
      .eq('id', teamId)
      .select('*')
      .single();

    if (error) {
      setMessage(`Team save error: ${error.message}`);
      setSavingTeam(false);
      return;
    }

    setTeam(data as Team);
    setIsEditingTeam(false);
    setSavingTeam(false);
    setMessage('Team updated.');
  }

  async function handleAddPlayer(e: FormEvent) {
    e.preventDefault();
    if (!teamId || !firstName.trim()) return;

    setSaving(true);
    setMessage('');

    const parsedNumber = jerseyNumber.trim() ? Number(jerseyNumber) : null;

    if (jerseyNumber.trim() && Number.isNaN(parsedNumber)) {
      setMessage('Jersey number must be numeric.');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('players').insert({
      team_id: teamId,
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      jersey_number: parsedNumber,
      position: position || null,
      active: true,
    });

    if (error) {
      setMessage(`Save error: ${error.message}`);
      setSaving(false);
      return;
    }

    setFirstName('');
    setLastName('');
    setJerseyNumber('');
    setPosition('');
    setMessage('Player added.');
    setSaving(false);
    await loadTeamData();setHomeFieldName(loadedTeam?.home_field_name || '');
setHomeFieldAddress(loadedTeam?.home_field_address || '');
  }

  async function handleSavePlayer() {
    if (!editingPlayer) return;

    setSavingPlayerId(editingPlayer.id);
    setMessage('');

    const parsedNumber = editingPlayer.jersey_number.trim()
      ? Number(editingPlayer.jersey_number)
      : null;

    if (editingPlayer.jersey_number.trim() && Number.isNaN(parsedNumber)) {
      setMessage('Jersey number must be numeric.');
      setSavingPlayerId(null);
      return;
    }

    if (!editingPlayer.first_name.trim()) {
      setMessage('First name is required.');
      setSavingPlayerId(null);
      return;
    }

    const { error } = await supabase
      .from('players')
      .update({
        first_name: editingPlayer.first_name.trim(),
        last_name: editingPlayer.last_name.trim() || null,
        jersey_number: parsedNumber,
        position: editingPlayer.position || null,
      })
      .eq('id', editingPlayer.id);

    if (error) {
      setMessage(`Player save error: ${error.message}`);
      setSavingPlayerId(null);
      return;
    }

    setMessage('Player updated.');
    setSavingPlayerId(null);
    setEditingPlayer(null);
    await loadTeamData();
  }

  async function togglePlayerActive(player: Player) {
    const { error } = await supabase
      .from('players')
      .update({ active: !player.active })
      .eq('id', player.id);

    if (error) {
      setMessage(`Update error: ${error.message}`);
      return;
    }

    await loadTeamData();
  }

  async function deletePlayer(playerId: string) {
    const { error } = await supabase.from('players').delete().eq('id', playerId);

    if (error) {
      setMessage(`Delete error: ${error.message}`);
      return;
    }

    if (editingPlayer?.id === playerId) {
      setEditingPlayer(null);
    }

    await loadTeamData();
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-6 py-8">Loading team...</main>;
  }

  if (!team) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8 text-red-600">
        {message || 'Team not found.'}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {logoUrl || team.logo_url ? (
            <img
              src={logoUrl || team.logo_url || ''}
              alt={`${team.name} logo`}
              className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
              LOGO
            </div>
          )}

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Touchline Live
            </p>
            <h1 className="text-3xl font-black tracking-tight">{team.name}</h1>
            <p className="mt-2 text-slate-600">
              {team.club_name || 'No club name'}
              {team.age_group ? ` • ${team.age_group}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              resetTeamEditForm();
              setIsEditingTeam((prev) => !prev);
            }}
            className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            {isEditingTeam ? 'Close Edit' : 'Edit Team'}
          </button>

          <Link
            href="/teams"
            className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 ring-1 ring-slate-200"
          >
            Back to Teams
          </Link>
        </div>
      </div>

      {message ? (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
          {message}
        </div>
      ) : null}

      {isEditingTeam && (
        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Edit Team</h2>
            <p className="text-sm text-slate-600">
              Update team details, branding, and display info.
            </p>
          </div>

          <form onSubmit={handleSaveTeam} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Team Name">
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Evanston FC U14"
                />
              </Field>

              <Field label="Club Name">
                <input
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Evanston FC"
                />
              </Field>

              <Field label="Age Group">
                <input
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="U14"
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
    placeholder="James Park Field 2"
  />
</Field>

<Field label="Home Field Address">
  <input
    value={homeFieldAddress}
    onChange={(e) => setHomeFieldAddress(e.target.value)}
    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
    placeholder="2430 Oakton St, Evanston, IL"
  />
</Field>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savingTeam}
                className="rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {savingTeam ? 'Saving Team...' : 'Save Team'}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetTeamEditForm();
                  setIsEditingTeam(false);
                }}
                className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-900 ring-1 ring-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">Add Player</h2>
          <p className="mt-2 text-sm text-slate-600">
            Build the reusable roster so live scoring can track goals, assists, cards, and
            positions.
          </p>

          <form onSubmit={handleAddPlayer} className="mt-5 space-y-4">
            <Field label="First Name">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Leo"
              />
            </Field>

            <Field label="Last Name">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="Optional"
              />
            </Field>

            <Field label="Jersey Number">
              <input
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                placeholder="9"
                inputMode="numeric"
              />
            </Field>

            <Field label="Position">
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              >
                <option value="">Select position</option>
                {positionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Add Player'}
            </button>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Roster</h2>
              <p className="text-sm text-slate-600">Active and inactive players for this team.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {players.length} players
            </span>
          </div>

          {players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
              No players yet. Add your first player on the left.
            </div>
          ) : (
            <div className="space-y-3">
              {players.map((player) => {
                const isEditing = editingPlayer?.id === player.id;

                return (
                  <div
                    key={player.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="First Name">
                            <input
                              value={editingPlayer.first_name}
                              onChange={(e) =>
                                setEditingPlayer((prev) =>
                                  prev ? { ...prev, first_name: e.target.value } : prev,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                            />
                          </Field>

                          <Field label="Last Name">
                            <input
                              value={editingPlayer.last_name}
                              onChange={(e) =>
                                setEditingPlayer((prev) =>
                                  prev ? { ...prev, last_name: e.target.value } : prev,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                            />
                          </Field>

                          <Field label="Jersey Number">
                            <input
                              value={editingPlayer.jersey_number}
                              onChange={(e) =>
                                setEditingPlayer((prev) =>
                                  prev ? { ...prev, jersey_number: e.target.value } : prev,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                              inputMode="numeric"
                            />
                          </Field>

                          <Field label="Position">
                            <select
                              value={editingPlayer.position}
                              onChange={(e) =>
                                setEditingPlayer((prev) =>
                                  prev ? { ...prev, position: e.target.value } : prev,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                            >
                              <option value="">Select position</option>
                              {positionOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={handleSavePlayer}
                            disabled={savingPlayerId === player.id}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {savingPlayerId === player.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingPlayer}
                            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white">
                            {player.jersey_number ?? '—'}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">
                              {player.first_name} {player.last_name || ''}
                            </h3>
                            <p className="text-sm text-slate-600">
                              {player.position || 'No position set'} •{' '}
                              {player.active ? 'Active roster player' : 'Inactive roster player'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => startEditingPlayer(player)}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePlayerActive(player)}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                              player.active
                                ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                                : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                            }`}
                          >
                            {player.active ? 'Set Inactive' : 'Set Active'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePlayer(player.id)}
                            className="rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200"
                          >
                            Delete
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
      </div>
    </main>
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