'use client';

import TimelineEventCard from '@/components/live/TimelineEventCard';
import SidelineFlowModal from '@/components/match/SidelineFlowModal';
import QuickEntryGoalFlow from '@/components/match/QuickEntryGoalFlow';
import QuickEntryHeader from '@/components/match/QuickEntryHeader';
import useQuickEntryMode from '@/hooks/matches/useQuickEntryMode';
import useLiveMatchPage from '@/components/live/useLiveMatchPage';

type LiveMatchController = ReturnType<typeof useLiveMatchPage>;

type Props = {
  live: LiveMatchController;
  modeSwitcher: React.ReactNode;
};

export default function QuickEntryMode({ live, modeSwitcher }: Props) {
  const quick = useQuickEntryMode(live);
  const goalTeamName =
    quick.goalSide === 'home'
      ? live.match?.home_team?.name || 'Home Team'
      : live.match?.away_team?.name || 'Away Team';

  return (
    <>
      <div className="space-y-6 pt-6">
        <QuickEntryHeader match={live.match!} formattedClock={live.formattedClock} />

        {modeSwitcher}

        {live.connectionNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {live.connectionNotice}
          </div>
        ) : null}

        {live.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {live.error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4">
              <h2 className="text-2xl font-black text-slate-900">Quick Goals</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fast scoring with optional player attribution.
              </p>
            </div>

            <div className="grid gap-4">
              <button
                type="button"
                onClick={() => quick.openGoalFlow('home')}
                disabled={!quick.canWrite || live.saving}
                className="min-h-[96px] rounded-3xl bg-slate-900 px-6 py-6 text-left text-2xl font-black text-white disabled:opacity-50"
              >
                + Goal Home
              </button>

              <button
                type="button"
                onClick={() => quick.openGoalFlow('away')}
                disabled={!quick.canWrite || live.saving}
                className="min-h-[96px] rounded-3xl bg-emerald-600 px-6 py-6 text-left text-2xl font-black text-white disabled:opacity-50"
              >
                + Goal Away
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={quick.handlePrimaryClockAction}
                disabled={!quick.canWrite}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 disabled:opacity-50"
              >
                {quick.primaryClockLabel}
              </button>
              <button
                type="button"
                onClick={() => window.confirm('Undo the most recent match event?') && live.undoLastEvent()}
                disabled={!quick.canWrite || live.undoing || live.safeEvents.length === 0}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 disabled:opacity-50"
              >
                {live.undoing ? 'Undoing…' : 'Undo'}
              </button>
              <button
                type="button"
                onClick={() =>
                  window.confirm('End this match and mark it as final?') && quick.confirmEndMatch()
                }
                disabled={!quick.canWrite || live.saving}
                className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 disabled:opacity-50"
              >
                End Match
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Recent Goals</h2>
                <p className="mt-1 text-sm text-slate-500">Latest scoring events only.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {quick.recentGoals.length}
              </span>
            </div>

            {quick.recentGoals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                No goals recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {quick.recentGoals.map((event) => (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    match={live.match!}
                    homePlayers={live.homePlayers}
                    awayPlayers={live.awayPlayers}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <SidelineFlowModal
        open={quick.showGoalFlow}
        title={quick.goalSide === 'home' ? 'Home Goal' : 'Away Goal'}
        onClose={quick.closeGoalFlow}
      >
        <QuickEntryGoalFlow
          side={quick.goalSide || 'home'}
          teamName={goalTeamName}
          players={quick.availablePlayers}
          onSkip={() => quick.submitGoal()}
          onCancel={quick.closeGoalFlow}
          onConfirm={quick.submitGoal}
          saving={live.saving}
        />
      </SidelineFlowModal>
    </>
  );
}
