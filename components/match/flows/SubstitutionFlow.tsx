'use client';

import { useMemo, useState } from 'react';
import { playerDisplayName } from '@/components/live/liveMatchPageShared';
import type { Player, TeamSide } from '@/lib/types';

type QueuedSubstitution = {
  id: string;
  outgoingPlayerId: string;
  incomingPlayerId: string;
};

type Props = {
  teamOptions: { side: TeamSide; label: string }[];
  getOnFieldPlayersForSide: (side: TeamSide) => Player[];
  getBenchPlayersForSide: (side: TeamSide) => Player[];
  currentMinute: number;
  currentClockLabel: string;
  onCancel: () => void;
  onConfirm: (params: {
    side: TeamSide;
    substitutions: {
      outgoingPlayerId: string;
      incomingPlayerId: string;
    }[];
  }) => Promise<void>;
  saving: boolean;
};

function buildPlayerMap(players: Player[]) {
  return new Map(players.map((player) => [player.id, player]));
}

export default function SubstitutionFlow({
  teamOptions,
  getOnFieldPlayersForSide,
  getBenchPlayersForSide,
  currentMinute,
  currentClockLabel,
  onCancel,
  onConfirm,
  saving,
}: Props) {
  const [side, setSide] = useState<TeamSide | null>(null);
  const [queuedSubs, setQueuedSubs] = useState<QueuedSubstitution[]>([]);
  const [outgoingPlayerId, setOutgoingPlayerId] = useState('');
  const [incomingPlayerId, setIncomingPlayerId] = useState('');
  const [localError, setLocalError] = useState('');

  const sidePlayers = useMemo(() => {
    if (!side) return [] as Player[];

    const onField = getOnFieldPlayersForSide(side);
    const bench = getBenchPlayersForSide(side);
    const seenIds = new Set<string>();
    const combined: Player[] = [];

    for (const player of [...onField, ...bench]) {
      if (!seenIds.has(player.id)) {
        seenIds.add(player.id);
        combined.push(player);
      }
    }

    return combined;
  }, [getBenchPlayersForSide, getOnFieldPlayersForSide, side]);

  const playerMap = useMemo(() => buildPlayerMap(sidePlayers), [sidePlayers]);

  const simulatedAvailability = useMemo(() => {
    if (!side) {
      return {
        onFieldPlayers: [] as Player[],
        benchPlayers: [] as Player[],
      };
    }

    const activeIds = new Set(getOnFieldPlayersForSide(side).map((player) => player.id));
    const benchIds = new Set(getBenchPlayersForSide(side).map((player) => player.id));

    for (const queuedSub of queuedSubs) {
      activeIds.delete(queuedSub.outgoingPlayerId);
      activeIds.add(queuedSub.incomingPlayerId);
      benchIds.delete(queuedSub.incomingPlayerId);
      benchIds.add(queuedSub.outgoingPlayerId);
    }

    return {
      onFieldPlayers: sidePlayers.filter((player) => activeIds.has(player.id)),
      benchPlayers: sidePlayers.filter((player) => benchIds.has(player.id)),
    };
  }, [getBenchPlayersForSide, getOnFieldPlayersForSide, queuedSubs, side, sidePlayers]);

  const selectedOutgoingPlayer = outgoingPlayerId ? playerMap.get(outgoingPlayerId) : undefined;
  const selectedIncomingPlayer = incomingPlayerId ? playerMap.get(incomingPlayerId) : undefined;
  const visibleOnFieldPlayers = useMemo(
    () =>
      selectedOutgoingPlayer
        ? simulatedAvailability.onFieldPlayers.filter((player) => player.id !== selectedOutgoingPlayer.id)
        : simulatedAvailability.onFieldPlayers,
    [selectedOutgoingPlayer, simulatedAvailability.onFieldPlayers],
  );
  const visibleBenchPlayers = useMemo(
    () =>
      selectedIncomingPlayer
        ? simulatedAvailability.benchPlayers.filter((player) => player.id !== selectedIncomingPlayer.id)
        : simulatedAvailability.benchPlayers,
    [selectedIncomingPlayer, simulatedAvailability.benchPlayers],
  );

  function resetDraft() {
    setOutgoingPlayerId('');
    setIncomingPlayerId('');
    setLocalError('');
  }

  function resetTeamSelection() {
    setSide(null);
    setQueuedSubs([]);
    resetDraft();
  }

  function validateDraft(nextOutgoingPlayerId: string, nextIncomingPlayerId: string) {
    if (!nextOutgoingPlayerId) {
      return 'Choose the player coming off.';
    }

    if (!nextIncomingPlayerId) {
      return 'Choose the player coming on.';
    }

    if (nextOutgoingPlayerId === nextIncomingPlayerId) {
      return 'Outgoing and incoming players must be different.';
    }

    const outgoingAvailable = simulatedAvailability.onFieldPlayers.some(
      (player) => player.id === nextOutgoingPlayerId,
    );

    if (!outgoingAvailable) {
      return `${playerDisplayName(playerMap.get(nextOutgoingPlayerId))} is not currently on the field.`;
    }

    const incomingAvailable = simulatedAvailability.benchPlayers.some(
      (player) => player.id === nextIncomingPlayerId,
    );

    if (!incomingAvailable) {
      return `${playerDisplayName(playerMap.get(nextIncomingPlayerId))} is not currently available from the bench.`;
    }

    return '';
  }

  function handleQueueCurrentSub() {
    const draftError = validateDraft(outgoingPlayerId, incomingPlayerId);

    if (draftError) {
      setLocalError(draftError);
      return;
    }

    setQueuedSubs((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        outgoingPlayerId,
        incomingPlayerId,
      },
    ]);
    resetDraft();
  }

  function removeQueuedSub(id: string) {
    setQueuedSubs((current) => current.filter((sub) => sub.id !== id));
    setLocalError('');
  }

  async function handleSubmit(recordCurrentDraft: boolean) {
    if (!side) return;

    const substitutions = [...queuedSubs];

    if (recordCurrentDraft) {
      const draftError = validateDraft(outgoingPlayerId, incomingPlayerId);

      if (draftError) {
        setLocalError(draftError);
        return;
      }

      substitutions.push({
        id: 'draft',
        outgoingPlayerId,
        incomingPlayerId,
      });
    }

    if (substitutions.length === 0) {
      setLocalError('Add at least one substitution to submit.');
      return;
    }

    setLocalError('');

    await onConfirm({
      side,
      substitutions: substitutions.map((sub) => ({
        outgoingPlayerId: sub.outgoingPlayerId,
        incomingPlayerId: sub.incomingPlayerId,
      })),
    });
  }

  if (!side) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-slate-500">Step 1. Select team.</p>
        {teamOptions.map((team) => (
          <button
            key={team.side}
            type="button"
            onClick={() => {
              setSide(team.side);
              setQueuedSubs([]);
              resetDraft();
            }}
            className="min-h-[72px] rounded-3xl bg-slate-100 px-5 py-4 text-left text-lg font-black text-slate-900 ring-1 ring-slate-200"
          >
            {team.label}
          </button>
        ))}
      </div>
    );
  }

  const hasDraftReady = Boolean(outgoingPlayerId && incomingPlayerId);
  const queuedCount = queuedSubs.length;
  const totalIfSubmitted = queuedCount + (hasDraftReady ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Step 2. Build substitutions
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-900">
              {teamOptions.find((team) => team.side === side)?.label || 'Team'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Queue multiple swaps for one team, or record a single sub right away.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            Game clock: {currentClockLabel || `${Math.max(0, currentMinute)}:00`}
          </div>
        </div>
      </div>

      {queuedSubs.length > 0 ? (
        <div className="rounded-3xl bg-violet-50 p-4 ring-1 ring-violet-200">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Queued Substitutions
            </h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-200">
              {queuedSubs.length}
            </span>
          </div>

          <div className="space-y-3">
            {queuedSubs.map((substitution, index) => (
              <div
                key={substitution.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-violet-100"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    Sub {index + 1}: {playerDisplayName(playerMap.get(substitution.outgoingPlayerId))}{' '}
                    off, {playerDisplayName(playerMap.get(substitution.incomingPlayerId))} on
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeQueuedSub(substitution.id)}
                  className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="min-w-0 text-sm font-semibold text-slate-900">
              Choose player coming off
            </h3>
            {selectedOutgoingPlayer ? (
              <button
                type="button"
                onClick={() => {
                  setOutgoingPlayerId('');
                  setIncomingPlayerId('');
                  setLocalError('');
                }}
                className="text-sm font-semibold text-slate-500"
              >
                Clear
              </button>
            ) : null}
          </div>

          {selectedOutgoingPlayer ? (
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/20">
              {playerDisplayName(selectedOutgoingPlayer)}
            </div>
          ) : null}

          <div className="grid max-h-[32vh] gap-2 overflow-y-auto pr-1">
            {visibleOnFieldPlayers.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
                No on-field players available.
              </p>
            ) : (
              visibleOnFieldPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    setOutgoingPlayerId(player.id);
                    setIncomingPlayerId('');
                    setLocalError('');
                  }}
                  className={`min-h-[56px] rounded-2xl px-4 py-3 text-left text-base font-semibold transition-colors ring-1 ${
                    outgoingPlayerId === player.id
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-slate-100 text-slate-900 ring-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {playerDisplayName(player)}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="min-w-0 text-sm font-semibold text-slate-900">
              Choose player coming on
            </h3>
            {selectedIncomingPlayer ? (
              <button
                type="button"
                onClick={() => {
                  setIncomingPlayerId('');
                  setLocalError('');
                }}
                className="text-sm font-semibold text-slate-500"
              >
                Clear
              </button>
            ) : null}
          </div>

          {selectedIncomingPlayer ? (
            <div className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/10">
              {playerDisplayName(selectedIncomingPlayer)}
            </div>
          ) : null}

          <div className="grid max-h-[32vh] gap-2 overflow-y-auto pr-1">
            {!outgoingPlayerId ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
                Pick the outgoing player first.
              </p>
            ) : visibleBenchPlayers.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
                No bench players available.
              </p>
            ) : (
              visibleBenchPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    setIncomingPlayerId(player.id);
                    setLocalError('');
                  }}
                  className={`min-h-[56px] rounded-2xl px-4 py-3 text-left text-base font-semibold transition-colors ring-1 ${
                    incomingPlayerId === player.id
                      ? 'bg-emerald-600 text-white ring-emerald-600'
                      : 'bg-slate-100 text-slate-900 ring-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {playerDisplayName(player)}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {localError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {localError}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={resetTeamSelection}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            Change Team
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            Cancel
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleQueueCurrentSub}
            disabled={saving || !hasDraftReady}
            className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 ring-1 ring-violet-200 disabled:opacity-50"
          >
            Add Another
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(hasDraftReady)}
            disabled={saving || totalIfSubmitted === 0}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : queuedCount === 0
                ? 'Record Substitution'
                : hasDraftReady
                  ? `Submit All ${totalIfSubmitted} Subs`
                  : `Submit All ${queuedCount} Subs`}
          </button>
        </div>
      </div>
    </div>
  );
}
