'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTeamAccessGuard } from '@/lib/useTeamAccessGuard';
import TeamPageIntro from '@/components/TeamPageIntro';
import { supabase } from '@/lib/supabase';
import type { Player, Team } from '@/lib/types';

const POSITION_OPTIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
const SCHOOL_YEAR_OPTIONS = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
  'Postgrad',
] as const;

type EditingPlayerState = Record<
  string,
  {
    first_name: string;
    last_name: string;
    jersey_number: string;
    position: string;
    school_year: string;
    active: boolean;
  }
>;

type OrganizationPlayerCandidate = Pick<
  Player,
  'id' | 'first_name' | 'last_name' | 'jersey_number' | 'position' | 'school_year' | 'active'
> & {
  team_name: string;
  team_id: string;
};

type CsvImportRow = {
  first_name: string;
  last_name: string;
  jersey_number: string;
  position: string;
  school_year: string;
  active: boolean;
  errors: string[];
};

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

 const {
  authChecked,
  error: accessError,
  loading: accessLoading,
} = useTeamAccessGuard({
  teamId,
  nextPath: `/teams/${teamId}/roster`,
});
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [editingPlayers, setEditingPlayers] = useState<EditingPlayerState>({});
  const [organizationPlayerSearch, setOrganizationPlayerSearch] = useState('');
  const [organizationPlayerCandidates, setOrganizationPlayerCandidates] = useState<
    OrganizationPlayerCandidate[]
  >([]);
  const [csvImportRows, setCsvImportRows] = useState<CsvImportRow[]>([]);
  const [csvImportFileName, setCsvImportFileName] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);

  // ---------------------------------------------------
  // ADD PLAYER FORM STATE
  // ---------------------------------------------------

  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newJerseyNumber, setNewJerseyNumber] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newSchoolYear, setNewSchoolYear] = useState('');
  const [newActive, setNewActive] = useState(true);

  // ---------------------------------------------------
  // TEAM AUTH GUARD
  // ---------------------------------------------------


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
        school_year: player.school_year || '',
        active: player.active !== false,
      };
    }

    setEditingPlayers(initialEditing);

    if (loadedTeam.organization_id) {
      const { data: organizationTeams, error: organizationTeamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', loadedTeam.organization_id)
        .neq('id', teamId)
        .order('name', { ascending: true });

      if (organizationTeamsError) {
        setError(organizationTeamsError.message);
        setLoading(false);
        return;
      }

      const relatedTeams = organizationTeams ?? [];

      if (relatedTeams.length > 0) {
        const relatedTeamIds = relatedTeams.map((relatedTeam) => relatedTeam.id);
        const teamNamesById = new Map(
          relatedTeams.map((relatedTeam) => [relatedTeam.id, relatedTeam.name || 'Other Team']),
        );

        const { data: organizationPlayers, error: organizationPlayersError } = await supabase
          .from('players')
          .select('id, team_id, first_name, last_name, jersey_number, position, school_year, active')
          .in('team_id', relatedTeamIds)
          .order('first_name', { ascending: true })
          .order('last_name', { ascending: true, nullsFirst: false });

        if (organizationPlayersError) {
          setError(organizationPlayersError.message);
          setLoading(false);
          return;
        }

        setOrganizationPlayerCandidates(
          ((organizationPlayers as Player[]) ?? []).map((player) => ({
            id: player.id,
            team_id: player.team_id,
            first_name: player.first_name,
            last_name: player.last_name,
            jersey_number: player.jersey_number,
            position: player.position,
            school_year: player.school_year,
            active: player.active,
            team_name: teamNamesById.get(player.team_id) || 'Other Team',
          })),
        );
      } else {
        setOrganizationPlayerCandidates([]);
      }
    } else {
      setOrganizationPlayerCandidates([]);
    }

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
      school_year: newSchoolYear || null,
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
    setNewSchoolYear('');
    setNewActive(true);

    await loadRoster();
    setSaving(false);
  }

  async function handleQuickAddOrganizationPlayer(candidate: OrganizationPlayerCandidate) {
    if (!teamId) return;

    setSaving(true);
    setError('');

    const { error: insertError } = await supabase.from('players').insert({
      team_id: teamId,
      first_name: candidate.first_name || null,
      last_name: candidate.last_name || null,
      jersey_number: candidate.jersey_number,
      position: candidate.position || null,
      school_year: candidate.school_year || null,
      active: candidate.active !== false,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setOrganizationPlayerSearch('');
    await loadRoster();
    setSaving(false);
  }

  // ---------------------------------------------------
  // CSV IMPORT
  // ---------------------------------------------------

  function parseCsvLine(line: string) {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];

      if (character === '"') {
        const nextCharacter = line[index + 1];

        if (inQuotes && nextCharacter === '"') {
          current += '"';
          index += 1;
          continue;
        }

        inQuotes = !inQuotes;
        continue;
      }

      if (character === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += character;
    }

    cells.push(current.trim());
    return cells;
  }

  function normalizeCsvBoolean(value: string) {
    const normalized = value.trim().toLowerCase();

    if (!normalized) return true;
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;

    return true;
  }

  function parseCsvImportText(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return [] as CsvImportRow[];
    }

    const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
    const headerIndex = new Map(headers.map((header, index) => [header, index]));

    return lines.slice(1).map((line) => {
      const cells = parseCsvLine(line);

      const firstName = cells[headerIndex.get('first_name') ?? -1] || '';
      const lastName = cells[headerIndex.get('last_name') ?? -1] || '';
      const jerseyNumber = cells[headerIndex.get('jersey_number') ?? -1] || '';
      const position = cells[headerIndex.get('position') ?? -1] || '';
      const schoolYear = cells[headerIndex.get('school_year') ?? -1] || '';
      const activeValue = cells[headerIndex.get('active') ?? -1] || '';
      const errors: string[] = [];

      if (!firstName.trim() && !lastName.trim()) {
        errors.push('Missing player name');
      }

      if (jerseyNumber.trim() && Number.isNaN(Number.parseInt(jerseyNumber.trim(), 10))) {
        errors.push('Invalid jersey number');
      }

      return {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        jersey_number: jerseyNumber.trim(),
        position: position.trim(),
        school_year: schoolYear.trim(),
        active: normalizeCsvBoolean(activeValue),
        errors,
      };
    });
  }

  async function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      setCsvImportRows([]);
      setCsvImportFileName('');
      return;
    }

    const text = await file.text();
    const parsedRows = parseCsvImportText(text);

    setCsvImportFileName(file.name);
    setCsvImportRows(parsedRows);
    setError('');
  }

  async function handleImportCsv() {
    if (!teamId || csvImportRows.length === 0) return;

    const validRows = csvImportRows.filter((row) => row.errors.length === 0);

    if (validRows.length === 0) {
      setError('CSV import has no valid rows to add.');
      return;
    }

    setImportingCsv(true);
    setError('');

    const payload = validRows.map((row) => ({
      team_id: teamId,
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      jersey_number: row.jersey_number ? Number.parseInt(row.jersey_number, 10) : null,
      position: row.position || null,
      school_year: row.school_year || null,
      active: row.active,
    }));

    const { error } = await supabase.from('players').insert(payload);

    if (error) {
      setError(error.message);
      setImportingCsv(false);
      return;
    }

    setCsvImportRows([]);
    setCsvImportFileName('');
    await loadRoster();
    setImportingCsv(false);
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
        school_year: player.school_year || '',
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
        school_year: player.school_year || '',
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
        school_year: draft.school_year || null,
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

  const isHighSchoolTeam = useMemo(() => {
    if (!team) return false;

    const combined = [team.team_level, team.age_group, team.name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return (
      combined.includes('varsity') ||
      combined.includes('jv') ||
      combined.includes('junior varsity') ||
      combined.includes('freshman') ||
      combined.includes('sophomore')
    );
  }, [team]);

  const filteredOrganizationPlayerCandidates = useMemo(() => {
    const query = organizationPlayerSearch.trim().toLowerCase();

    if (!query) {
      return organizationPlayerCandidates.slice(0, 5);
    }

    return organizationPlayerCandidates
      .filter((candidate) => {
        const fullName = [candidate.first_name, candidate.last_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return (
          fullName.includes(query) ||
          (candidate.team_name || '').toLowerCase().includes(query) ||
          (candidate.position || '').toLowerCase().includes(query) ||
          String(candidate.jersey_number || '').includes(query)
        );
      })
      .slice(0, 5);
  }, [organizationPlayerCandidates, organizationPlayerSearch]);

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

 if (loading || accessLoading || !authChecked) {
  return <main className="mx-auto max-w-7xl px-6 py-8">Loading roster...</main>;
}

if ((accessError || error) && !team) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-red-600">
      {accessError || error}
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
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-5"
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
                                {[player.position, isHighSchoolTeam ? player.school_year : null]
                                  .filter(Boolean)
                                  .join(' • ') || 'No position'}
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

                            {isHighSchoolTeam ? (
                              <Field label="School Year">
                                <select
                                  value={draft?.school_year || ''}
                                  onChange={(e) =>
                                    setEditingPlayers((prev) => ({
                                      ...prev,
                                      [player.id]: {
                                        ...prev[player.id],
                                        school_year: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                                >
                                  <option value="">Select school year</option>
                                  {SCHOOL_YEAR_OPTIONS.map((schoolYear) => (
                                    <option key={schoolYear} value={schoolYear}>
                                      {schoolYear}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                            ) : null}

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
                {team.organization_id ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-slate-900">Quick Add From Organization</h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Search players from other teams in this organization and clone them into this roster.
                      </p>
                    </div>

                    <Field label="Search Player">
                      <input
                        value={organizationPlayerSearch}
                        onChange={(e) => setOrganizationPlayerSearch(e.target.value)}
                        placeholder="Search by name, team, position, or jersey"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      />
                    </Field>

                    <div className="mt-3 space-y-2">
                      {filteredOrganizationPlayerCandidates.length > 0 ? (
                        filteredOrganizationPlayerCandidates.map((candidate) => (
                          <div
                            key={candidate.id}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {[candidate.first_name, candidate.last_name].filter(Boolean).join(' ') ||
                                  'Unnamed Player'}
                              </p>
                              <p className="text-xs font-medium text-slate-500">
                                {[
                                  candidate.team_name,
                                  candidate.position,
                                  candidate.jersey_number ? `#${candidate.jersey_number}` : null,
                                  isHighSchoolTeam ? candidate.school_year : null,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleQuickAddOrganizationPlayer(candidate)}
                              disabled={saving}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                            >
                              Quick Add
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                          {organizationPlayerCandidates.length === 0
                            ? 'No players found on other teams in this organization yet.'
                            : 'No organization players match that search.'}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Import Roster CSV</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Columns: <code>first_name,last_name,jersey_number,position,school_year,active</code>
                    </p>
                  </div>

                  <Field label="CSV File">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileChange}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    />
                  </Field>

                  {csvImportFileName ? (
                    <p className="mt-3 text-xs font-medium text-slate-500">
                      Loaded: {csvImportFileName}
                    </p>
                  ) : null}

                  {csvImportRows.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        {csvImportRows.filter((row) => row.errors.length === 0).length} valid row
                        {csvImportRows.filter((row) => row.errors.length === 0).length === 1 ? '' : 's'}{' '}
                        ready to import out of {csvImportRows.length}.
                      </div>

                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {csvImportRows.map((row, index) => (
                          <div
                            key={`${row.first_name}-${row.last_name}-${index}`}
                            className={`rounded-2xl border px-4 py-3 text-sm ${
                              row.errors.length > 0
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            <p className="font-semibold">
                              {[row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed Player'}
                            </p>
                            <p className="mt-1 text-xs font-medium">
                              {[
                                row.jersey_number ? `#${row.jersey_number}` : null,
                                row.position || null,
                                isHighSchoolTeam ? row.school_year || null : null,
                                row.active ? 'Active' : 'Inactive',
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                            {row.errors.length > 0 ? (
                              <p className="mt-2 text-xs font-semibold">{row.errors.join(' • ')}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleImportCsv}
                        disabled={saving || importingCsv}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                      >
                        {importingCsv ? 'Importing...' : 'Import Valid Rows'}
                      </button>
                    </div>
                  ) : null}
                </div>

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

                {isHighSchoolTeam ? (
                  <Field label="School Year">
                    <select
                      value={newSchoolYear}
                      onChange={(e) => setNewSchoolYear(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <option value="">Select school year</option>
                      {SCHOOL_YEAR_OPTIONS.map((schoolYear) => (
                        <option key={schoolYear} value={schoolYear}>
                          {schoolYear}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

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
    <div className="w-full rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
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
