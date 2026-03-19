'use client';

import TimelineEventCard from '@/components/live/TimelineEventCard';
import type { MatchRow } from '@/components/live/liveMatchPageShared';
import type { MatchEvent, Player } from '@/lib/types';

type Props = {
  events: MatchEvent[];
  match: MatchRow;
  homePlayers: Player[];
  awayPlayers: Player[];
};

export default function SidelineRecentEvents({
  events,
  match,
  homePlayers,
  awayPlayers,
}: Props) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Recent Events</h2>
          <p className="mt-1 text-sm text-slate-500">Last five timeline entries.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
          No live events yet.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <TimelineEventCard
              key={event.id}
              event={event}
              match={match}
              homePlayers={homePlayers}
              awayPlayers={awayPlayers}
            />
          ))}
        </div>
      )}
    </section>
  );
}
