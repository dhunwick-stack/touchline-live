'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import type { Match } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type LiveMatchHeaderActionsProps = {
  match: Match;
  editingDisabled: boolean;
  undoing: boolean;
  eventsCount: number;
  startLivePeriod: () => void;
  openPauseModal: () => void;
  undoLastEvent: () => void;
};

// ---------------------------------------------------
// COMPONENT
// FILE: components/live/LiveMatchHeaderActions.tsx
// ---------------------------------------------------

export default function LiveMatchHeaderActions({
  match,
  editingDisabled,
  undoing,
  eventsCount,
  startLivePeriod,
  openPauseModal,
  undoLastEvent,
}: LiveMatchHeaderActionsProps) {
  return (
    <>
      {(match.status === 'not_started' ||
        match.status === 'scheduled' ||
        match.status === 'halftime') && (
        <button
          onClick={startLivePeriod}
          disabled={editingDisabled}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {match.status === 'halftime' ? 'Start 2nd Half' : 'Start Match'}
        </button>
      )}

      {match.status === 'live' && match.clock_running && (
        <button
          onClick={openPauseModal}
          disabled={editingDisabled}
          className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Pause
        </button>
      )}

      {match.status === 'live' && !match.clock_running && (
        <button
          onClick={startLivePeriod}
          disabled={editingDisabled}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Resume
        </button>
      )}

      <button
        onClick={undoLastEvent}
        disabled={undoing || eventsCount === 0 || editingDisabled}
        className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 disabled:opacity-40"
      >
        {undoing ? 'Undoing…' : 'Undo'}
      </button>

      {match.public_slug && (
        <Link
          href={`/public/${match.public_slug}`}
          target="_blank"
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-white/20"
          style={{ color: '#0f172a' }}
        >
          Public Scoreboard
        </Link>
      )}
    </>
  );
}
