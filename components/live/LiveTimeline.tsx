'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useMemo } from 'react';
import TimelineEventCard from '@/components/live/TimelineEventCard';
import type { Match, MatchEvent, Player, Team } from '@/lib/types';

// ---------------------------------------------------
// LOCAL TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type Props = {
  events: MatchEvent[];
  match: MatchRow;
  homePlayers: Player[];
  awayPlayers: Player[];
};

// ---------------------------------------------------
// COMPONENT
// ---------------------------------------------------

export default function LiveTimeline({
  events,
  match,
  homePlayers,
  awayPlayers,
}: Props) {
  // ---------------------------------------------------
  // DERIVED STATS
  // ---------------------------------------------------

  const goalCount = useMemo(
    () => events.filter((event) => event.event_type === 'goal').length,
    [events],
  );

  const cardCount = useMemo(
    () =>
      events.filter(
        (event) =>
          event.event_type === 'yellow_card' ||
          event.event_type === 'red_card',
      ).length,
    [events],
  );

  const substitutionCount = useMemo(
    () => events.filter((event) => event.event_type === 'substitution').length,
    [events],
  );

  // ---------------------------------------------------
  // RENDER
  // ---------------------------------------------------

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {/* --------------------------------------------------- */}
      {/* HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Live Timeline</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
          {events.length} events
        </span>
      </div>

      {/* --------------------------------------------------- */}
      {/* SUMMARY BADGES */}
      {/* --------------------------------------------------- */}

      <div className="mb-4 flex flex-wrap gap-3">
        <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
          Goals: {goalCount}
        </span>

        <span className="rounded-full bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-700">
          Cards: {cardCount}
        </span>

        <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">
          Subs: {substitutionCount}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
          Status: {match.status}
        </span>
      </div>

      {/* --------------------------------------------------- */}
      {/* EMPTY / EVENT LIST */}
      {/* --------------------------------------------------- */}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
          No events yet. Start the match and add the first event.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <TimelineEventCard
              key={event?.id ?? `timeline-event-${index}`}
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
