'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Match } from '@/lib/types';

type MatchActionsCardProps = {
  match: Match;
  onUpdated?: (updatedMatch: Match) => void;
};

export default function MatchActionsCard({
  match,
  onUpdated,
}: MatchActionsCardProps) {
  // ---------------------------------------------------
  // LOCAL STATE
  // ---------------------------------------------------

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState(match.status_note || '');
  const [rescheduleDate, setRescheduleDate] = useState(
    match.match_date ? toLocalInputValue(match.match_date) : '',
  );

  // ---------------------------------------------------
  // HELPERS
  // ---------------------------------------------------

  async function updateMatch(updates: Partial<Match>) {
    setSaving(true);
    setError('');

    const { data, error } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', match.id)
      .select('*')
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onUpdated?.(data as Match);
  }

  async function handleMarkFinal() {
    await updateMatch({
      status: 'final',
      status_note: note.trim() || null,
    });
  }

  async function handlePostpone() {
    await updateMatch({
      status: 'postponed',
      status_note: note.trim() || 'Postponed.',
    });
  }

  async function handleCancel() {
    await updateMatch({
      status: 'cancelled',
      status_note: note.trim() || 'Cancelled.',
    });
  }

  async function handleLockToggle() {
    await updateMatch({
      is_locked: !(match.is_locked === true),
    });
  }

  async function handleReschedule() {
    if (!rescheduleDate) {
      setError('Please choose a new date and time.');
      return;
    }

    await updateMatch({
      status: 'scheduled',
      original_match_date: match.match_date || null,
      match_date: new Date(rescheduleDate).toISOString(),
      status_note: note.trim() || 'Rescheduled.',
    });
  }

  const isLocked = match.is_locked === true;
  const status = match.status || 'scheduled';

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {/* --------------------------------------------------- */}
      {/* HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Match Actions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Update match status, reschedule, cancel, or lock historical records.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill label={statusLabel(status)} />
          {isLocked ? <StatusPill label="Locked" dark /> : null}
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* RESCHEDULE */}
      {/* --------------------------------------------------- */}

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
          Reschedule
        </h3>

        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1fr]">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              New Match Date & Time
            </span>
            <input
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              disabled={saving}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Status Note
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Rescheduled due to weather"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              disabled={saving}
            />
          </label>
        </div>

        {match.original_match_date ? (
          <p className="mt-3 text-sm text-slate-500">
            Original date:{' '}
            {new Date(match.original_match_date).toLocaleString()}
          </p>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleReschedule}
            disabled={saving}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Reschedule Match'}
          </button>
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* STATUS ACTIONS */}
      {/* --------------------------------------------------- */}

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={handlePostpone}
          disabled={saving || isLocked}
          className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 disabled:opacity-60"
        >
          Postpone
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={saving || isLocked}
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 disabled:opacity-60"
        >
          Cancel Match
        </button>

        <button
          type="button"
          onClick={handleMarkFinal}
          disabled={saving || isLocked}
          className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 disabled:opacity-60"
        >
          Mark Final
        </button>

        <button
          type="button"
          onClick={handleLockToggle}
          disabled={saving}
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isLocked ? 'Unlock Match' : 'Lock Match'}
        </button>
      </div>

      {/* --------------------------------------------------- */}
      {/* ERROR / NOTE */}
      {/* --------------------------------------------------- */}

      {error ? (
        <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
      ) : null}

      {match.status_note ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Note
          </p>
          <p className="mt-2 text-sm text-slate-700">{match.status_note}</p>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------
// STATUS PILL
// ---------------------------------------------------

function StatusPill({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
        dark
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-700'
      }`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------
// STATUS LABEL
// ---------------------------------------------------

function statusLabel(status: string) {
  if (status === 'live') return 'Live';
  if (status === 'final') return 'Final';
  if (status === 'postponed') return 'Postponed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Scheduled';
}

// ---------------------------------------------------
// DATETIME HELPER
// ---------------------------------------------------

function toLocalInputValue(isoString: string) {
  const date = new Date(isoString);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}
