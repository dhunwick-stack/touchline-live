'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Player } from '@/lib/types';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type MinutesPlayedRow = {
  player: Player;
  minutes: number;
};

// ---------------------------------------------------
// COMPONENT
// FILE: components/live/MinutesPlayedCard.tsx
// ---------------------------------------------------

export default function MinutesPlayedCard({
  title,
  subtitle,
  rows,
  accent,
  emptyText,
  open,
  onToggleOpen,
}: {
  title: string;
  subtitle: string;
  rows: MinutesPlayedRow[];
  accent: 'home' | 'away';
  emptyText: string;
  open: boolean;
  onToggleOpen: () => void;
}) {
  // ---------------------------------------------------
  // ACCENT STYLES
  // ---------------------------------------------------

  const accentBadgeClass =
    accent === 'home'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-rose-50 text-rose-700';

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${accentBadgeClass}`}>
            {rows.length}
          </span>

          <button
            type="button"
            onClick={onToggleOpen}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            {open ? (
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
          </button>
        </div>
      </div>

      {open ? (
        rows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{emptyText}</p>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map((row) => (
              <div
                key={row.player.id}
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {playerDisplayName(row.player)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {row.player.position || 'No position'}
                  </p>
                </div>

                <div className="ml-4 shrink-0 rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                  {row.minutes} min
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

// ---------------------------------------------------
// PLAYER DISPLAY NAME
// ---------------------------------------------------

function playerDisplayName(player: Player) {
  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
  return player.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
}