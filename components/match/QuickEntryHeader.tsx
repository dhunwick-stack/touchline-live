'use client';

import type { MatchRow } from '@/components/live/liveMatchPageShared';

type Props = {
  match: MatchRow;
  formattedClock: string;
};

export default function QuickEntryHeader({ match, formattedClock }: Props) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        Quick Score Mode
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Home</div>
          <div className="text-2xl font-black text-slate-900">
            {match.home_team?.name || 'Home Team'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            {prettyStatus(match.status)}
          </div>
          <div className="mt-2 text-6xl font-black tracking-tight text-slate-900">
            {match.home_score} - {match.away_score}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-700">{formattedClock}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Away</div>
          <div className="text-2xl font-black text-slate-900">
            {match.away_team?.name || 'Away Team'}
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
