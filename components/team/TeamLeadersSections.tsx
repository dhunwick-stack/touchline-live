'use client';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

export type PlayerLeaderRow = {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
};

type LeaderStatKey = 'goals' | 'assists' | 'yellowCards' | 'redCards';

type LeaderboardConfig = {
  title: string;
  statLabel: string;
  rows: PlayerLeaderRow[];
  valueKey: LeaderStatKey;
  emptyText: string;
};

// ---------------------------------------------------
// SUMMARY STRIP
// ---------------------------------------------------

export function TeamLeadersSummaryCards({
  matchesCount,
  playersWithStats,
  totalGoals,
  totalAssists,
}: {
  matchesCount: number;
  playersWithStats: number;
  totalGoals: number;
  totalAssists: number;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-4">
      <SummaryCard label="Final Matches Counted" value={matchesCount} />
      <SummaryCard label="Players With Stats" value={playersWithStats} />
      <SummaryCard label="Goals Logged" value={totalGoals} />
      <SummaryCard label="Assists Logged" value={totalAssists} />
    </section>
  );
}

// ---------------------------------------------------
// LEADERBOARDS GRID
// ---------------------------------------------------

export function TeamLeadersGrid({
  goalsLeaders,
  assistsLeaders,
  yellowCardLeaders,
  redCardLeaders,
}: {
  goalsLeaders: PlayerLeaderRow[];
  assistsLeaders: PlayerLeaderRow[];
  yellowCardLeaders: PlayerLeaderRow[];
  redCardLeaders: PlayerLeaderRow[];
}) {
  return (
    <div className="grid items-start gap-6 pb-6 xl:grid-cols-2">
      <div className="flex flex-col gap-6 self-start">
        <LeaderboardTable
          title="Goals Leaders"
          statLabel="Goals"
          rows={goalsLeaders}
          valueKey="goals"
          emptyText="No goals recorded yet."
        />

        <LeaderboardTable
          title="Yellow Card Leaders"
          statLabel="Yellow Cards"
          rows={yellowCardLeaders}
          valueKey="yellowCards"
          emptyText="No yellow cards recorded yet."
        />
      </div>

      <div className="flex flex-col gap-6 self-start">
        <LeaderboardTable
          title="Assists Leaders"
          statLabel="Assists"
          rows={assistsLeaders}
          valueKey="assists"
          emptyText="No assists recorded yet."
        />

        <LeaderboardTable
          title="Red Card Leaders"
          statLabel="Red Cards"
          rows={redCardLeaders}
          valueKey="redCards"
          emptyText="No red cards recorded yet."
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------
// SUMMARY CARD
// ---------------------------------------------------

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-slate-200">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------
// LEADERBOARD TABLE
// ---------------------------------------------------

function LeaderboardTable({
  title,
  statLabel,
  rows,
  valueKey,
  emptyText,
}: LeaderboardConfig) {
  const gradientMap: Record<LeaderStatKey, string> = {
    goals: 'from-green-50 via-white to-white',
    assists: 'from-blue-50 via-white to-white',
    yellowCards: 'from-yellow-50 via-white to-white',
    redCards: 'from-red-50 via-white to-white',
  };

  const pillMap: Record<LeaderStatKey, string> = {
    goals: 'bg-emerald-500 text-white',
    assists: 'bg-blue-500 text-white',
    yellowCards: 'bg-amber-400 text-slate-950',
    redCards: 'bg-red-500 text-white',
  };

  const gradientClass = gradientMap[valueKey];
  const statPillClass = pillMap[valueKey];
  const tableColumnClass = 'grid-cols-[88px_minmax(0,1fr)_112px]';
  const displayRows = rows.slice(0, 5);
  const fillerCount = Math.max(0, 5 - displayRows.length);

  return (
    <section
      className={`flex flex-col rounded-3xl bg-gradient-to-b ${gradientClass} p-6 shadow-md ring-1 ring-slate-200`}
    >
      <div className="flex h-16 items-start justify-between gap-4 pb-4">
        <div className="min-w-0 self-start">
          <h2 className="text-3xl font-black leading-none tracking-tight text-slate-900">
            {title}
          </h2>
        </div>

        <span className="shrink-0 self-start rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
          {rows.length} players
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90">
        <div
          className={`grid ${tableColumnClass} bg-slate-50 px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500`}
        >
          <div>Rank</div>
          <div>Player</div>
          <div className="text-right">{statLabel}</div>
        </div>

        {rows.length === 0 ? (
          <div className="flex h-[164px] items-center px-6 text-sm text-slate-500">
            {emptyText}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {displayRows.map((row, index) => (
              <div
                key={row.playerId}
                className={`grid min-h-[72px] ${tableColumnClass} items-center px-6 py-4`}
              >
                <div className="text-sm font-black text-slate-900">#{index + 1}</div>

                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {row.jerseyNumber || '—'}
                    </span>

                    <p className="truncate text-lg font-bold text-slate-900">{row.playerName}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <span
                    className={`inline-flex min-w-[56px] items-center justify-center rounded-xl px-3 py-2 text-xl font-black shadow-sm ${statPillClass}`}
                  >
                    {row[valueKey]}
                  </span>
                </div>
              </div>
            ))}

            {Array.from({ length: fillerCount }).map((_, index) => (
              <div
                key={`filler-${title}-${index}`}
                className={`grid min-h-[72px] ${tableColumnClass} items-center px-6 py-4`}
              >
                <div className="text-sm font-black text-slate-300">—</div>

                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-300">
                      —
                    </span>

                    <p className="truncate text-lg font-bold text-slate-300">
                      No additional player
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <span className="inline-flex min-w-[56px] items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-xl font-black text-slate-300">
                    —
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
