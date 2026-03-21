'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicTeamPageShell from '@/components/PublicTeamPageShell';
import { supabase } from '@/lib/supabase';
import type { Player, Team } from '@/lib/types';
import { PUBLIC_TEAM_WITH_ORGANIZATION_SELECT } from '@/lib/team-selects';

function playerDisplayName(player: Player) {
  return [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Unnamed Player';
}

function normalizePosition(position?: string | null) {
  const normalized = (position || '').trim();
  return normalized || 'Unassigned';
}

export default function PublicTeamRosterPage() {
  const params = useParams();
  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!teamId) return;

    async function loadData() {
      setLoading(true);
      setMessage('');

      const [{ data: teamData, error: teamError }, { data: playerData, error: playerError }] =
        await Promise.all([
          supabase
            .from('teams')
            .select(PUBLIC_TEAM_WITH_ORGANIZATION_SELECT)
            .eq('id', teamId)
            .single(),
          supabase
            .from('players')
            .select('*')
            .eq('team_id', teamId)
            .eq('active', true)
            .order('position', { ascending: true, nullsFirst: false })
            .order('jersey_number', { ascending: true, nullsFirst: false })
            .order('first_name', { ascending: true }),
        ]);

      if (teamError || playerError) {
        setMessage(teamError?.message || playerError?.message || 'Failed to load team roster.');
        setLoading(false);
        return;
      }

      setTeam(teamData as unknown as Team);
      setPlayers((playerData as Player[]) ?? []);
      setLoading(false);
    }

    loadData();
  }, [teamId]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredPlayers = useMemo(() => {
    if (!normalizedQuery) return players;

    return players.filter((player) => {
      const haystack = [
        player.first_name,
        player.last_name,
        player.position,
        player.school_year,
        player.jersey_number !== null && player.jersey_number !== undefined
          ? String(player.jersey_number)
          : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [players, normalizedQuery]);

  const groupedPlayers = useMemo(() => {
    const groups = new Map<string, Player[]>();

    for (const player of filteredPlayers) {
      const position = normalizePosition(player.position);
      const current = groups.get(position) || [];
      current.push(player);
      groups.set(position, current);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPlayers]);

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

  const jerseyBadgeStyle = useMemo(
    () => ({
      background: team?.primary_color || '#0f172a',
      color: team?.secondary_color || '#ffffff',
    }),
    [team?.primary_color, team?.secondary_color],
  );

  if (loading && !team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8">Loading team roster...</main>;
  }

  if (message && !team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8 text-red-600">{message}</main>;
  }

  if (!team) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-8 text-red-600">Team not found.</main>;
  }

  return (
    <PublicTeamPageShell team={team} teamId={teamId}>
      <div className="space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Roster</h1>
              <p className="mt-2 text-sm text-slate-600">
                Active players for {team.name}, organized for a quick public look.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-3 py-2 text-slate-700 ring-1 ring-slate-200">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-base font-black text-slate-900 shadow-sm ring-1 ring-slate-200">
                  {filteredPlayers.length}
                </span>
                <span className="pr-1 text-sm font-semibold text-slate-700">
                  Player{filteredPlayers.length === 1 ? '' : 's'}
                </span>
              </div>

              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name, number, position..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:w-72"
              />
            </div>
          </div>
        </section>

        {filteredPlayers.length === 0 ? (
          <section className="rounded-3xl bg-white p-10 text-center shadow-md ring-1 ring-slate-200">
            <h2 className="text-xl font-bold text-slate-900">No players found</h2>
            <p className="mt-2 text-sm text-slate-600">
              {players.length === 0
                ? 'This team has no active public roster entries yet.'
                : 'Try a different search to find a player on this roster.'}
            </p>
          </section>
        ) : (
          groupedPlayers.map(([position, positionPlayers]) => (
            <section
              key={position}
              className="overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-slate-200"
            >
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="h-10 w-1 rounded-full bg-slate-900" />
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{position}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {positionPlayers.length === 1
                          ? 'One player listed in this group'
                          : `${positionPlayers.length} players listed in this group`}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-slate-900 px-3 text-sm font-bold text-white shadow-sm">
                    {positionPlayers.length}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                {positionPlayers.map((player) => (
                  <article
                    key={player.id}
                    className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black shadow-sm"
                            style={jerseyBadgeStyle}
                          >
                            {player.jersey_number !== null && player.jersey_number !== undefined
                              ? player.jersey_number
                              : '—'}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-900">
                              {playerDisplayName(player)}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-500">
                              {player.position || 'No position listed'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {isHighSchoolTeam && player.school_year ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                              {player.school_year}
                            </span>
                          ) : null}

                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            {position}
                          </span>

                          {player.height ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                              {player.height}
                            </span>
                          ) : null}

                          {player.weight ? (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                              {player.weight}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                        Active
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-200 pt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                      {player.jersey_number !== null && player.jersey_number !== undefined
                        ? `Jersey #${player.jersey_number}`
                        : 'Jersey not listed'}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </PublicTeamPageShell>
  );
}
