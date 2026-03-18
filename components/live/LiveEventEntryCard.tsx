{/* --------------------------------------------------- */}
        {/* LIVE TIMELINE */}
        {/* --------------------------------------------------- */}

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
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