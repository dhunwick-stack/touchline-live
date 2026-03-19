'use client';

import type { MatchRow } from '@/components/live/liveMatchPageShared';

type Props = {
  match: MatchRow;
  formattedClock: string;
};

export default function SidelineHeader({ match, formattedClock }: Props) {
  return (
    <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm ring-1 ring-slate-800">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
            Sideline Mode
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/75">
              {prettyStatus(match.status)}
            </span>
            {match.is_locked ? (
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                Locked
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-center">
          <div className="text-sm uppercase tracking-[0.25em] text-white/60">Score</div>
          <div className="mt-2 text-6xl font-black tracking-tight">
            {match.home_score} - {match.away_score}
          </div>
          <div className="mt-2 text-2xl font-semibold text-white/85">{formattedClock}</div>
        </div>

        <div className="grid gap-3 text-right">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Home</div>
            <div className="text-xl font-black">{match.home_team?.name || 'Home Team'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Away</div>
            <div className="text-xl font-black">{match.away_team?.name || 'Away Team'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function prettyStatus(status: MatchRow['status']) {
  if (status === 'not_started') return 'Not Started';
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'live') return 'Live';
  if (status === 'halftime') return 'Halftime';
  if (status === 'final') return 'Final';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'postponed') return 'Postponed';
  return status;
}
