'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { Player } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type OnFieldStatePanelProps = {
  showOnFieldState: boolean;
  setShowOnFieldState: Dispatch<SetStateAction<boolean>>;
  selectedOnFieldPlayers: Player[];
  selectedBenchPlayers: Player[];
  playerDisplayName: (player: Player | undefined) => string;
};

// ---------------------------------------------------
// COMPONENT
// FILE: components/live/OnFieldStatePanel.tsx
// ---------------------------------------------------

export default function OnFieldStatePanel({
  showOnFieldState,
  setShowOnFieldState,
  selectedOnFieldPlayers,
  selectedBenchPlayers,
  playerDisplayName,
}: OnFieldStatePanelProps) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <button
        type="button"
        onClick={() => setShowOnFieldState((prev) => !prev)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">Current on-field state</p>
          <p className="mt-1 text-xs text-slate-500">
            Expand to review active players and bench players.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {showOnFieldState ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Hide
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show
            </>
          )}
        </span>
      </button>

      {showOnFieldState ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              On Field
            </p>

            <div className="flex flex-wrap gap-2">
              {selectedOnFieldPlayers.length === 0 ? (
                <span className="text-sm text-slate-400">No active players found.</span>
              ) : (
                selectedOnFieldPlayers.map((player) => (
                  <span
                    key={player.id}
                    className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                  >
                    {playerDisplayName(player)}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bench
            </p>

            <div className="flex flex-wrap gap-2">
              {selectedBenchPlayers.length === 0 ? (
                <span className="text-sm text-slate-400">No bench players found.</span>
              ) : (
                selectedBenchPlayers.map((player) => (
                  <span
                    key={player.id}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {playerDisplayName(player)}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
