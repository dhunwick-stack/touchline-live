'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import type { Dispatch, SetStateAction } from 'react';
import { CircleDot, Pause, Play, RotateCcw } from 'lucide-react';
import type { EventType, Match, TeamSide } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type EventFormState = {
  type: EventType;
  side: TeamSide;
  playerId: string;
  secondaryPlayerId: string;
  playerNameOverride: string;
  secondaryPlayerNameOverride: string;
  notes: string;
};

type QuickActionBarProps = {
  editingDisabled: boolean;
  undoing: boolean;
  eventsCount: number;
  match: Match;
  openPauseModal: () => void;
  startLivePeriod: () => void;
  undoLastEvent: () => void;
  setForm: Dispatch<SetStateAction<EventFormState>>;
};

// ---------------------------------------------------
// COMPONENT
// FILE: components/live/QuickActionBar.tsx
// ---------------------------------------------------

export default function QuickActionBar({
  editingDisabled,
  undoing,
  eventsCount,
  match,
  openPauseModal,
  startLivePeriod,
  undoLastEvent,
  setForm,
}: QuickActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              side: 'home',
              type: 'goal',
              playerId: '',
              secondaryPlayerId: '',
            }))
          }
          disabled={editingDisabled}
          className="flex items-center justify-center gap-2 rounded-2xl bg-sky-100 py-4 text-base font-bold text-sky-800 ring-1 ring-sky-300 disabled:opacity-40"
        >
          <CircleDot className="h-5 w-5" />
          <span>Home Goal</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              side: 'away',
              type: 'goal',
              playerId: '',
              secondaryPlayerId: '',
            }))
          }
          disabled={editingDisabled}
          className="flex items-center justify-center gap-2 rounded-2xl bg-sky-100 py-4 text-base font-bold text-sky-800 ring-1 ring-sky-300 disabled:opacity-40"
        >
          <CircleDot className="h-5 w-5" />
          <span>Away Goal</span>
        </button>

        <button
          type="button"
          onClick={undoLastEvent}
          disabled={undoing || eventsCount === 0 || editingDisabled}
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 py-4 text-base font-bold text-white disabled:opacity-40"
        >
          <RotateCcw className="h-5 w-5" />
          <span>{undoing ? 'Undoing…' : 'Undo'}</span>
        </button>

        <button
          type="button"
          onClick={match.clock_running ? openPauseModal : startLivePeriod}
          disabled={editingDisabled}
          className="flex items-center justify-center gap-2 rounded-2xl bg-amber-100 py-4 text-base font-bold text-amber-900 ring-1 ring-amber-300 disabled:opacity-40"
        >
          {match.clock_running ? (
            <>
              <Pause className="h-5 w-5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              <span>
                {match.status === 'not_started'
                  ? 'Start'
                  : match.status === 'halftime'
                    ? 'Start 2nd Half'
                    : 'Resume'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}