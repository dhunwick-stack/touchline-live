'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Match, MatchLineup, Player, Team } from '@/lib/types';

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type Props = {
  match: MatchRow;
  homePlayers: Player[];
  awayPlayers: Player[];
  onSaved?: (lineups: MatchLineup[]) => void;
};

export default function MatchLineupCard({
  match,
  homePlayers,
  awayPlayers,
  onSaved,
}: Props) {
  const [lineups, setLineups] = useState<MatchLineup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [homeStarterIds, setHomeStarterIds] = useState<string[]>([]);
  const [awayStarterIds, setAwayStarterIds] = useState<string[]>([]);

  useEffect(() => {
    if (!match?.id) return;

    async function loadLineups() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('match_lineups')
        .select('*')
        .eq('match_id', match.id)
        .order('lineup_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const rows = (data as MatchLineup[]) ?? [];
      setLineups(rows);

      setHomeStarterIds(
        rows
          .filter((row) => row.team_side === 'home' && row.is_starter)
          .map((row) => row.player_id),
      );

      setAwayStarterIds(
        rows
          .filter((row) => row.team_side === 'away' && row.is_starter)
          .map((row) => row.player_id),
      );

      setLoading(false);
    }

    loadLineups();
  }, [match?.id]);

  const homeStarterCount = homeStarterIds.length;
  const awayStarterCount = awayStarterIds.length;

  const homeComplete = homeStarterCount === 11;
  const awayComplete = awayStarterCount === 11;
  const bothComplete = homeComplete && awayComplete;

  const editingDisabled =
    match.is_locked === true ||
    match.status === 'cancelled' ||
    match.status === 'postponed' ||
    match.status === 'live' ||
    match.status === 'halftime' ||
    match.status === 'final';

  const homeSelectedPlayers = useMemo(
    () => homePlayers.filter((player) => homeStarterIds.includes(player.id)),
    [homePlayers, homeStarterIds],
  );

  const awaySelectedPlayers = useMemo(
    () => awayPlayers.filter((player) => awayStarterIds.includes(player.id)),
    [awayPlayers, awayStarterIds],
  );

  function playerDisplayName(player: Player) {
    const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
    return player.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
  }

  function toggleStarter(side: 'home' | 'away', playerId: string) {
    if (editingDisabled) return;

    if (side === 'home') {
      setHomeStarterIds((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : prev.length >= 11
            ? prev
            : [...prev, playerId],
      );
      return;
    }

    setAwayStarterIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : prev.length >= 11
          ? prev
          : [...prev, playerId],
    );
  }

  function autoFill(side: 'home' | 'away') {
    if (editingDisabled) return;

    if (side === 'home') {
      setHomeStarterIds(homePlayers.slice(0, 11).map((player) => player.id));
      return;
    }

    setAwayStarterIds(awayPlayers.slice(0, 11).map((player) => player.id));
  }

  function clearSide(side: 'home' | 'away') {
    if (editingDisabled) return;

    if (side === 'home') {
      setHomeStarterIds([]);
      return;
    }

    setAwayStarterIds([]);
  }

  async function saveLineups() {
    if (editingDisabled) {
      setError('Lineups cannot be edited after the match has started or in this match state.');
      return;
    }

    if (!match.home_team_id || !match.away_team_id) {
      setError('Match teams are not fully loaded.');
      return;
    }

    if (homeStarterIds.length !== 11 || awayStarterIds.length !== 11) {
      setError('Each team must have exactly 11 starters.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = [
      ...homeStarterIds.map((playerId, index) => ({
        match_id: match.id,
        team_id: match.home_team_id,
        player_id: playerId,
        team_side: 'home' as const,
        is_starter: true,
        is_bench: false,
        lineup_order: index + 1,
      })),
      ...awayStarterIds.map((playerId, index) => ({
        match_id: match.id,
        team_id: match.away_team_id,
        player_id: playerId,
        team_side: 'away' as const,
        is_starter: true,
        is_bench: false,
        lineup_order: index + 1,
      })),
    ];

    const { error: deleteError } = await supabase
      .from('match_lineups')
      .delete()
      .eq('match_id', match.id);

    if (deleteError) {
      setSaving(false);
      setError(deleteError.message);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('match_lineups')
      .insert(payload)
      .select('*');

    if (insertError) {
      setSaving(false);
      setError(insertError.message);
      return;
    }

    const savedRows = (inserted as MatchLineup[]) ?? [];
    setLineups(savedRows);
    setSaving(false);

    if (onSaved) {
      onSaved(savedRows);
    }
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Starting Lineups</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select exactly 11 starters for each team before kickoff.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveLineups}
            disabled={saving || editingDisabled}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Lineups'}
          </button>
        </div>
      </div>

      {editingDisabled ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Lineups can only be edited before the match starts.
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200">
          Loading saved lineups...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <LineupSideCard
            title={match.home_team?.name || 'Home Team'}
            side="home"
            players={homePlayers}
            selectedIds={homeStarterIds}
            selectedCount={homeStarterCount}
            onToggle={toggleStarter}
            onAutoFill={autoFill}
            onClear={clearSide}
            playerDisplayName={playerDisplayName}
            complete={homeComplete}
            disabled={editingDisabled}
            selectedPlayers={homeSelectedPlayers}
          />

          <LineupSideCard
            title={match.away_team?.name || 'Away Team'}
            side="away"
            players={awayPlayers}
            selectedIds={awayStarterIds}
            selectedCount={awayStarterCount}
            onToggle={toggleStarter}
            onAutoFill={autoFill}
            onClear={clearSide}
            playerDisplayName={playerDisplayName}
            complete={awayComplete}
            disabled={editingDisabled}
            selectedPlayers={awaySelectedPlayers}
          />
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
        <span className="font-semibold text-slate-900">Status:</span>{' '}
        <span className={bothComplete ? 'text-emerald-700' : 'text-slate-600'}>
          {bothComplete
            ? 'Both starting lineups are complete.'
            : 'Each side needs exactly 11 starters.'}
        </span>
      </div>
    </section>
  );
}

function LineupSideCard({
  title,
  side,
  players,
  selectedIds,
  selectedCount,
  onToggle,
  onAutoFill,
  onClear,
  playerDisplayName,
  complete,
  disabled,
  selectedPlayers,
}: {
  title: string;
  side: 'home' | 'away';
  players: Player[];
  selectedIds: string[];
  selectedCount: number;
  onToggle: (side: 'home' | 'away', playerId: string) => void;
  onAutoFill: (side: 'home' | 'away') => void;
  onClear: (side: 'home' | 'away') => void;
  playerDisplayName: (player: Player) => string;
  complete: boolean;
  disabled: boolean;
  selectedPlayers: Player[];
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">Select 11 starters.</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {selectedCount}/11
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAutoFill(side)}
          disabled={disabled}
          className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 disabled:opacity-50"
        >
          Auto-fill First 11
        </button>

        <button
          type="button"
          onClick={() => onClear(side)}
          disabled={disabled}
          className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {selectedPlayers.length > 0 ? (
        <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Starting XI
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedPlayers.map((player) => (
              <span
                key={player.id}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {playerDisplayName(player)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {players.length === 0 ? (
          <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
            No players found.
          </div>
        ) : (
          players.map((player) => {
            const selected = selectedIds.includes(player.id);

            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onToggle(side, player.id)}
                disabled={disabled}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-1 transition disabled:opacity-50 ${
                  selected
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="truncate font-medium">{playerDisplayName(player)}</span>
                <span
                  className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {selected ? 'Starter' : 'Select'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
