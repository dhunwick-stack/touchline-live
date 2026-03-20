'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import type { Dispatch, SetStateAction } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import type { EventType, Player, TeamSide, TrackingMode } from '@/lib/types';

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

type EventTypeOption = {
  value: EventType;
  label: string;
};

type LiveEventEntryCardProps = {
  selectedTeamName: string;
  selectedTrackingMode: TrackingMode;
  editingDisabled: boolean;
  form: EventFormState;
  setForm: Dispatch<SetStateAction<EventFormState>>;
  resetForm: (nextSide?: TeamSide) => void;
  addEvent: () => void;
  saving: boolean;
  error: string | null;
  eventTypeOptions: EventTypeOption[];
  eventSelectablePlayers: Player[];
  eventSelectableSecondaryPlayers: Player[];
  selectedOnFieldPlayers: Player[];
  selectedBenchPlayers: Player[];
  showOnFieldState: boolean;
  setShowOnFieldState: Dispatch<SetStateAction<boolean>>;
  playerDisplayName: (player: Player | undefined) => string;
};

// ---------------------------------------------------
// COMPONENT
// FILE: components/live/LiveEventEntryCard.tsx
// ---------------------------------------------------

export default function LiveEventEntryCard({
  selectedTeamName,
  selectedTrackingMode,
  editingDisabled,
  form,
  setForm,
  resetForm,
  addEvent,
  saving,
  error,
  eventTypeOptions,
  eventSelectablePlayers,
  eventSelectableSecondaryPlayers,
  selectedOnFieldPlayers,
  selectedBenchPlayers,
  showOnFieldState,
  setShowOnFieldState,
  playerDisplayName,
}: LiveEventEntryCardProps) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Roster-Aware Event Entry</h2>
          <p className="text-sm text-slate-600">The form adapts to each side’s tracking mode.</p>
        </div>

        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
          {selectedTeamName}
        </span>
      </div>

      <div className="space-y-4">
        {/* --------------------------------------------------- */}
        {/* TEAM SIDE */}
        {/* --------------------------------------------------- */}

        <Field label="Team Side">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => resetForm('home')}
              disabled={editingDisabled}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-40 ${
                form.side === 'home' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800'
              }`}
            >
              Home
            </button>

            <button
              type="button"
              onClick={() => resetForm('away')}
              disabled={editingDisabled}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-40 ${
                form.side === 'away' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800'
              }`}
            >
              Away
            </button>
          </div>
        </Field>

        {/* --------------------------------------------------- */}
        {/* TRACKING MODE */}
        {/* --------------------------------------------------- */}

        <Field label="Tracking Mode for This Side">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            {selectedTrackingMode === 'full' &&
              'Full tracking — player-based events, substitutions, and detailed logging'}
            {selectedTrackingMode === 'lineups' &&
              'Lineups mode — starting lineup support with simpler event entry'}
            {selectedTrackingMode === 'basic' &&
              'Basic tracking — optional roster player selection with no required lineups'}
          </div>
        </Field>

        {/* --------------------------------------------------- */}
        {/* EVENT TYPE */}
        {/* --------------------------------------------------- */}

        <Field label="Event Type">
          <div className="grid grid-cols-2 gap-3">
            {eventTypeOptions
              .filter(
                (option) =>
                  !(selectedTrackingMode === 'lineups' && option.value === 'substitution'),
              )
              .map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      type: option.value,
                      playerId: '',
                      secondaryPlayerId: '',
                      playerNameOverride: '',
                      secondaryPlayerNameOverride: '',
                    }));
                  }}
                  disabled={editingDisabled}
                  className={getEventTypeButtonClasses(
                    option.value,
                    form.type === option.value,
                    editingDisabled,
                  )}
                >
                  <EventGlyph eventType={option.value} size="button" />
                  <span>{option.label}</span>
                </button>
              ))}
          </div>
        </Field>

        {/* --------------------------------------------------- */}
        {/* BASIC / LINEUPS EVENT ENTRY */}
        {/* --------------------------------------------------- */}

        {(selectedTrackingMode === 'basic' || selectedTrackingMode === 'lineups') &&
          form.type !== 'half_end' &&
          form.type !== 'full_time' && (
            <>
              <Field label="Player (Optional)">
                <select
                  value={form.playerId}
                  onChange={(e) => setForm((prev) => ({ ...prev, playerId: e.target.value }))}
                  disabled={editingDisabled}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                >
                  <option value="">No linked player</option>
                  {eventSelectablePlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {playerDisplayName(player)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Quick Player / Label (Optional)">
                <input
                  value={form.playerNameOverride}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, playerNameOverride: e.target.value }))
                  }
                  disabled={editingDisabled}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                  placeholder="e.g. #10 or Smith"
                />
              </Field>

              {form.type === 'goal' && (
                <>
                  <Field label="Assist Player (Optional)">
                    <select
                      value={form.secondaryPlayerId}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          secondaryPlayerId: e.target.value,
                        }))
                      }
                      disabled={editingDisabled}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                    >
                      <option value="">No linked assist player</option>
                      {eventSelectableSecondaryPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {playerDisplayName(player)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Assist / Secondary Label (Optional)">
                    <input
                      value={form.secondaryPlayerNameOverride}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          secondaryPlayerNameOverride: e.target.value,
                        }))
                      }
                      disabled={editingDisabled}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
                      placeholder="Optional assist"
                    />
                  </Field>
                </>
              )}
            </>
          )}

        {/* --------------------------------------------------- */}
        {/* FULL MODE EVENT ENTRY */}
        {/* --------------------------------------------------- */}

        {selectedTrackingMode === 'full' &&
          form.type !== 'half_end' &&
          form.type !== 'full_time' &&
          form.type !== 'substitution' && (
            <Field label="Player">
              <select
                value={form.playerId}
                onChange={(e) => setForm((prev) => ({ ...prev, playerId: e.target.value }))}
                disabled={editingDisabled}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
              >
                <option value="">Select player</option>
                {eventSelectablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {playerDisplayName(player)}
                  </option>
                ))}
              </select>
            </Field>
          )}

        {selectedTrackingMode === 'full' && form.type === 'goal' && (
          <Field label="Assist Player (Optional)">
            <select
              value={form.secondaryPlayerId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, secondaryPlayerId: e.target.value }))
              }
              disabled={editingDisabled}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
            >
              <option value="">No assist</option>
              {eventSelectableSecondaryPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {playerDisplayName(player)}
                </option>
              ))}
            </select>
          </Field>
        )}

        {selectedTrackingMode === 'full' && form.type === 'substitution' && (
          <>
            <Field label="Outgoing Player">
              <select
                value={form.playerId}
                onChange={(e) => setForm((prev) => ({ ...prev, playerId: e.target.value }))}
                disabled={editingDisabled}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
              >
                <option value="">Select outgoing player</option>
                {eventSelectablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {playerDisplayName(player)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Incoming Player">
              <select
                value={form.secondaryPlayerId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, secondaryPlayerId: e.target.value }))
                }
                disabled={editingDisabled}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
              >
                <option value="">Select incoming player</option>
                {eventSelectableSecondaryPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {playerDisplayName(player)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {/* --------------------------------------------------- */}
        {/* FULL MODE ON-FIELD STATE */}
        {/* --------------------------------------------------- */}

        {selectedTrackingMode === 'full' && form.type === 'substitution' && (
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
        )}

        {/* --------------------------------------------------- */}
        {/* NOTES */}
        {/* --------------------------------------------------- */}

        <Field label="Notes (Optional)">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            disabled={editingDisabled}
            className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:opacity-40"
            placeholder="Sideline note, context, or detail"
          />
        </Field>

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

        <button
          type="button"
          onClick={addEvent}
          disabled={saving || editingDisabled}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving Event...' : 'Add Event'}
        </button>
      </div>
    </section>
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

// ---------------------------------------------------
// EVENT TYPE BUTTON STYLES
// ---------------------------------------------------

function getEventTypeButtonClasses(
  eventType: EventType,
  isActive: boolean,
  disabled: boolean,
) {
  const disabledClass = disabled ? 'opacity-40' : '';

  if (eventType === 'goal') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-300'
        : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100'
    }`;
  }

  if (eventType === 'yellow_card') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-yellow-200 text-yellow-900 ring-2 ring-yellow-400'
        : 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-300 hover:bg-yellow-100'
    }`;
  }

  if (eventType === 'red_card') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-red-200 text-red-900 ring-2 ring-red-400'
        : 'bg-red-50 text-red-800 ring-1 ring-red-300 hover:bg-red-100'
    }`;
  }

  if (eventType === 'substitution') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-violet-100 text-violet-800 ring-2 ring-violet-300'
        : 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100'
    }`;
  }

  if (eventType === 'half_end') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-300'
        : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200'
    }`;
  }

  if (eventType === 'full_time') {
    return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
      isActive
        ? 'bg-slate-800 text-white ring-2 ring-slate-400'
        : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200'
    }`;
  }

  return `flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${disabledClass} ${
    isActive
      ? 'bg-slate-900 text-white ring-2 ring-slate-300'
      : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200'
  }`;
}

// ---------------------------------------------------
// EVENT GLYPH
// ---------------------------------------------------

function EventGlyph({
  eventType,
  size = 'timeline',
}: {
  eventType: EventType;
  size?: 'button' | 'timeline';
}) {
  const iconSize = size === 'button' ? 'h-4 w-4' : 'h-4 w-4';

  if (eventType === 'goal') {
    return <CircleDot className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'substitution') {
    return <ArrowLeftRight className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'match_resumed' || eventType === 'half_start') {
    return <Play className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'match_paused' || eventType === 'half_end') {
    return <Pause className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'full_time') {
    return <Square className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'yellow_card') {
    return <span className="h-4 w-3 rounded-[2px] bg-yellow-400 ring-1 ring-yellow-500/60" />;
  }

  if (eventType === 'red_card') {
    return <span className="h-4 w-3 rounded-[2px] bg-red-500 ring-1 ring-red-600/60" />;
  }

  return <CircleDot className={iconSize} strokeWidth={2.5} />;
}
