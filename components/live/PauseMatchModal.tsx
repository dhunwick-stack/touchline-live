'use client';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type PauseMatchModalProps = {
  open: boolean;
  pauseNote: string;
  setPauseNote: (value: string) => void;
  closePauseModal: () => void;
  pauseClock: (note?: string) => void;
  applyPauseReason: (reason: string) => void;
};

// ---------------------------------------------------
// QUICK REASONS
// ---------------------------------------------------

const quickPauseReasons = [
  'Injury delay',
  'Weather delay',
  'Official timeout',
  'Field issue',
  'Equipment issue',
  'Crowd / safety issue',
];

// ---------------------------------------------------
// COMPONENT
// FILE: components/live/PauseMatchModal.tsx
// ---------------------------------------------------

export default function PauseMatchModal({
  open,
  pauseNote,
  setPauseNote,
  closePauseModal,
  pauseClock,
  applyPauseReason,
}: PauseMatchModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        {/* --------------------------------------------------- */}
        {/* MODAL HEADER */}
        {/* --------------------------------------------------- */}

        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pause Match
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
            Add an optional pause note
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Save context for why the match was paused. This will appear in the timeline.
          </p>
        </div>

        {/* --------------------------------------------------- */}
        {/* QUICK REASON BUTTONS */}
        {/* --------------------------------------------------- */}

        <div className="mb-4 flex flex-wrap gap-2">
          {quickPauseReasons.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => applyPauseReason(reason)}
              className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200"
            >
              {reason}
            </button>
          ))}
        </div>

        {/* --------------------------------------------------- */}
        {/* NOTE FIELD */}
        {/* --------------------------------------------------- */}

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-700">Pause Note</span>
          <textarea
            value={pauseNote}
            onChange={(e) => setPauseNote(e.target.value)}
            placeholder="Optional note such as injury, lightning, field repair, or referee stoppage"
            className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-0 transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
          />
        </label>

        {/* --------------------------------------------------- */}
        {/* MODAL ACTIONS */}
        {/* --------------------------------------------------- */}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={closePauseModal}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => pauseClock()}
            className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-900"
          >
            Pause Without Note
          </button>

          <button
            type="button"
            onClick={() => pauseClock(pauseNote)}
            className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white"
          >
            Pause Match
          </button>
        </div>
      </div>
    </div>
  );
}