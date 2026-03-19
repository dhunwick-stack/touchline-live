'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { ChevronDown, ChevronUp } from 'lucide-react';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type TeamSnapshotRow = {
  teamName: string;
  modeLabel: string;
  playersSnappedLabel: string;
  startersSelectedLabel: string | null;
};

type LineupSnapshotStatusCardProps = {
  loadingLineups: boolean;
  open: boolean;
  onToggleOpen: () => void;
  homeRow: TeamSnapshotRow;
  awayRow: TeamSnapshotRow;
};

// ---------------------------------------------------
// COMPONENT
// FILE: components/live/LineupSnapshotStatusCard.tsx
// ---------------------------------------------------

export default function LineupSnapshotStatusCard({
  loadingLineups,
  open,
  onToggleOpen,
  homeRow,
  awayRow,
}: LineupSnapshotStatusCardProps) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Lineup Snapshot Status</h2>
          <p className="text-sm text-slate-600">
            Match-day roster snapshots load automatically for teams using lineups or full tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {loadingLineups ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              Loading...
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              Ready
            </span>
          )}

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
        <div className="mt-4 space-y-3">
          <SnapshotTeamRow row={homeRow} />
          <SnapshotTeamRow row={awayRow} />
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------
// SUBCOMPONENT
// ---------------------------------------------------

function SnapshotTeamRow({ row }: { row: TeamSnapshotRow }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{row.teamName}</p>
          <p className="text-xs text-slate-500">Mode: {row.modeLabel}</p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">{row.playersSnappedLabel}</p>

          {row.startersSelectedLabel ? (
            <p className="text-xs text-slate-500">{row.startersSelectedLabel}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}