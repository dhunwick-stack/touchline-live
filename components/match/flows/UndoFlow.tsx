'use client';

import type { MatchEvent } from '@/lib/types';

type Props = {
  latestEvent: MatchEvent | undefined;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  undoing: boolean;
};

export default function UndoFlow({ latestEvent, onCancel, onConfirm, undoing }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        This will remove only the most recent event and update the live score if needed.
      </p>

      <div className="rounded-3xl bg-slate-100 p-4 ring-1 ring-slate-200">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Most Recent Event
        </div>
        <div className="mt-2 text-lg font-black text-slate-900">
          {latestEvent
            ? `${latestEvent.event_type.replace('_', ' ')} at ${latestEvent.minute}'`
            : 'No event available'}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!latestEvent || undoing}
          className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {undoing ? 'Undoing…' : 'Confirm Undo'}
        </button>
      </div>
    </div>
  );
}
