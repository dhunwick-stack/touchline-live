'use client';

type StatBadgeColor = 'green' | 'blue' | 'yellow' | 'red' | 'slate';

type StatBadgeProps = {
  // ---------------------------------------------------
  // CONTENT
  // ---------------------------------------------------

  value: number | string;

  // ---------------------------------------------------
  // STYLE
  // ---------------------------------------------------

  color?: StatBadgeColor;
};

export default function StatBadge({
  value,
  color = 'slate',
}: StatBadgeProps) {
  // ---------------------------------------------------
  // COLOR STYLES
  // ---------------------------------------------------

  const colorClasses: Record<StatBadgeColor, string> = {
    green: 'bg-emerald-500 text-white ring-1 ring-emerald-600/20',
    blue: 'bg-blue-500 text-white ring-1 ring-blue-600/20',
    yellow: 'bg-amber-400 text-slate-950 ring-1 ring-amber-500/30',
    red: 'bg-rose-500 text-white ring-1 ring-rose-600/20',
    slate: 'bg-slate-500 text-white ring-1 ring-slate-600/20',
  };

  return (
    <>
      {/* --------------------------------------------------- */}
      {/* STAT BADGE */}
      {/* --------------------------------------------------- */}

      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black shadow-sm ${colorClasses[color]}`}
      >
        {value}
      </span>
    </>
  );
}

