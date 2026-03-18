{/* --------------------------------------------------- */}
        {/* LIVE TIMELINE */}
        {/* --------------------------------------------------- */}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Live Timeline</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {events.length} events
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
              Goals: {events.filter((e) => e.event_type === 'goal').length}
            </span>
            <span className="rounded-full bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-700">
              Cards:{' '}
              {
                events.filter(
                  (e) => e.event_type === 'yellow_card' || e.event_type === 'red_card',
                ).length
              }
            </span>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">
              Subs: {events.filter((e) => e.event_type === 'substitution').length}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              Status: {match.status}
            </span>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
              No events yet. Start the match and add the first event.
            </div>
          ) : (
            <div className="space-y-4">
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