'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { Check, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { validateStartingLineupCount } from '@/lib/matchLineups';
import type { MatchLineup, Player } from '@/lib/types';

// ---------------------------------------------------
// PROPS
// ---------------------------------------------------

type Props = {
  title: string;
  subtitle: string;
  rows: { row: MatchLineup; player: Player | undefined }[];
  selectedStarterIds: string[];
  onToggleStarter: (playerId: string) => void;
  onSave: () => void;
  saving: boolean;
  loading: boolean;
  accent: 'home' | 'away';
  disabled: boolean;
  open: boolean;
  onToggleOpen: () => void;
  playerDisplayName: (player: Player | undefined) => string;
};

// ---------------------------------------------------
// COMPONENT
// ---------------------------------------------------

export default function StartingLineupSelector({
  title,
  subtitle,
  rows,
  selectedStarterIds,
  onToggleStarter,
  onSave,
  saving,
  loading,
  accent,
  disabled,
  open,
  onToggleOpen,
  playerDisplayName,
}: Props) {
  // ---------------------------------------------------
  // DERIVED STATE
  // ---------------------------------------------------

  const selectedRows = rows.filter(({ row }) => selectedStarterIds.includes(row.player_id));
  const benchRows = rows.filter(({ row }) => !selectedStarterIds.includes(row.player_id));
  const isValid = validateStartingLineupCount(selectedStarterIds);

  const persistedStarterIds = rows
    .filter(({ row }) => row.is_starter)
    .map(({ row }) => row.player_id)
    .sort();

  const currentStarterIds = [...selectedStarterIds].sort();

  const isDirty =
    JSON.stringify(persistedStarterIds) !== JSON.stringify(currentStarterIds);

  const accentBadgeClass =
    accent === 'home' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700';

  const accentActiveClass =
    accent === 'home'
      ? 'border-blue-300 bg-blue-50'
      : 'border-rose-300 bg-rose-50';

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex min-w-0 items-start gap-2 text-left"
        >
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
          <div>
            <h2 className="text-xl font-bold">{title} Starting 11</h2>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${accentBadgeClass}`}>
            {selectedStarterIds.length}/11
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
        loading ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 ring-1 ring-slate-200">
            Loading lineup...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 ring-1 ring-slate-200">
            No lineup snapshot is available for this side yet.
          </div>
        ) : (
          <>
            {/* --------------------------------------------------- */}
            {/* SELECTED STARTERS */}
            {/* --------------------------------------------------- */}

            <div className="mb-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-900">Selected starters</p>
              <p className="mt-1 text-xs text-slate-500">
                Tap a selected starter to remove them. Tap an available player below to add them.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedRows.length === 0 ? (
                  <span className="text-sm text-slate-400">No starters selected yet.</span>
                ) : (
                  selectedRows.map(({ row, player }) => (
                    <button
                      key={row.player_id}
                      type="button"
                      onClick={() => onToggleStarter(row.player_id)}
                      disabled={disabled}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${accentActiveClass}`}
                    >
                      <Check className="h-4 w-4" />
                      <span>{playerDisplayName(player)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* --------------------------------------------------- */}
            {/* AVAILABLE PLAYERS */}
            {/* --------------------------------------------------- */}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Available players (tap to add)
              </h3>

              <div className="space-y-2">
                {benchRows.map(({ row, player }) => {
                  const selected = selectedStarterIds.includes(row.player_id);

                  return (
                    <button
                      key={row.player_id}
                      type="button"
                      onClick={() => onToggleStarter(row.player_id)}
                      disabled={disabled}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? accentActiveClass
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {playerDisplayName(player) ||
                            row.player_name_snapshot ||
                            'Unnamed player'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selected ? 'Starter' : 'Available'}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          selected ? accentBadgeClass : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {selected ? 'Selected' : 'Tap to start'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* --------------------------------------------------- */}
            {/* SAVE ROW */}
            {/* --------------------------------------------------- */}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p
                className={`text-sm font-medium ${
                  disabled
                    ? 'text-slate-500'
                    : !isValid
                      ? 'text-amber-700'
                      : isDirty
                        ? 'text-sky-700'
                        : 'text-emerald-700'
                }`}
              >
                {disabled
                  ? 'Lineups can no longer be edited for this match state.'
                  : !isValid
                    ? 'Select exactly 11 starters before saving.'
                    : isDirty
                      ? 'Starting 11 is ready to save.'
                      : 'Starting 11 is saved.'}
              </p>

              <button
                type="button"
                onClick={onSave}
                disabled={!isValid || saving || disabled || !isDirty}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : isDirty ? 'Save Starting 11' : 'Starting 11 Saved'}
              </button>
            </div>
          </>
        )
      ) : null}
    </section>
  );
}