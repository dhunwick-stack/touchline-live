'use client';

import SidelineActionGrid from '@/components/match/SidelineActionGrid';
import SidelineFlowModal from '@/components/match/SidelineFlowModal';
import SidelineRecentEvents from '@/components/match/SidelineRecentEvents';
import GoalFlow from '@/components/match/flows/GoalFlow';
import SubstitutionFlow from '@/components/match/flows/SubstitutionFlow';
import YellowCardFlow from '@/components/match/flows/YellowCardFlow';
import RedCardFlow from '@/components/match/flows/RedCardFlow';
import UndoFlow from '@/components/match/flows/UndoFlow';
import useSidelineMode from '@/hooks/matches/useSidelineMode';
import useLiveMatchPage from '@/components/live/useLiveMatchPage';
import MatchHeader from '@/components/match/MatchHeader';
import type { MinutesPlayedRow } from '@/components/live/liveMatchPageShared';

type LiveMatchController = ReturnType<typeof useLiveMatchPage>;

type Props = {
  live: LiveMatchController;
  modeSwitcher: React.ReactNode;
};

export default function SidelineMode({ live, modeSwitcher }: Props) {
  const sideline = useSidelineMode(live);
  const visibleClockMinute = Number.parseInt((live.formattedClock || '0:00').split(':')[0] || '0', 10);

  const actions = [
    {
      label: 'Goal',
      onClick: () => sideline.setActiveFlow('goal'),
      disabled: !sideline.canWrite || live.saving,
      tone: 'success' as const,
    },
    {
      label: 'Substitution',
      onClick: () => sideline.setActiveFlow('substitution'),
      disabled: !sideline.canWrite || live.saving,
    },
    {
      label: 'Yellow Card',
      onClick: () => sideline.setActiveFlow('yellow_card'),
      disabled: !sideline.canWrite || live.saving,
      tone: 'warning' as const,
    },
    {
      label: 'Red Card',
      onClick: () => sideline.setActiveFlow('red_card'),
      disabled: !sideline.canWrite || live.saving,
      tone: 'danger' as const,
    },
    ...(!live.match?.clock_running
      ? [
          {
            label: sideline.primaryClockLabel,
            onClick: sideline.handlePrimaryClockAction,
            disabled: !sideline.canWrite,
          },
        ]
      : []),
    ...(live.match?.status === 'live' && live.match?.clock_running
      ? [
          {
            label: 'Pause Match',
            onClick: sideline.handlePauseAction,
            disabled: !sideline.canWrite,
          },
        ]
      : []),
    ...(live.match?.status === 'live'
      ? [
          {
            label: 'Halftime',
            onClick: () => sideline.setActiveFlow('halftime' as const),
            disabled: !sideline.canWrite || live.saving,
          },
        ]
      : []),
    {
      label: 'End Match',
      onClick: () => sideline.setActiveFlow('end'),
      disabled: !sideline.canWrite || live.saving,
      tone: 'danger' as const,
    },
    {
      label: 'Undo Last Action',
      onClick: () => sideline.setActiveFlow('undo'),
      disabled: !sideline.canWrite || live.undoing || live.safeEvents.length === 0,
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <MatchHeader
          match={live.match!}
          formattedClock={live.formattedClock}
          mode="admin"
          theme="team"
        />

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
          <SidelineActionGrid actions={actions} />
          <div className="space-y-6">
            <SidelineMinutesSnapshot
              homeTeamName={live.match?.home_team?.name || 'Home Team'}
              awayTeamName={live.match?.away_team?.name || 'Away Team'}
              homeRows={live.homeMinutesPlayedRows}
              awayRows={live.awayMinutesPlayedRows}
            />
            <SidelineRecentEvents
              events={sideline.recentEvents}
              match={live.match!}
              homePlayers={live.homePlayers}
              awayPlayers={live.awayPlayers}
            />
          </div>
        </div>
      </div>

      <SidelineFlowModal
        open={sideline.activeFlow === 'goal'}
        title="Record Goal"
        onClose={() => sideline.setActiveFlow(null)}
      >
        <GoalFlow
          teamOptions={sideline.teamOptions}
          getPlayersForSide={sideline.getPlayersForSide}
          getTrackingModeForSide={sideline.getTrackingModeForSide}
          onCancel={() => sideline.setActiveFlow(null)}
          onConfirm={sideline.submitGoal}
          saving={live.saving}
        />
      </SidelineFlowModal>

      <SidelineFlowModal
        open={sideline.activeFlow === 'substitution'}
        title="Record Substitution"
        onClose={() => sideline.setActiveFlow(null)}
      >
        <SubstitutionFlow
          teamOptions={sideline.teamOptions}
          getOnFieldPlayersForSide={sideline.getOnFieldPlayersForSide}
          getBenchPlayersForSide={sideline.getBenchPlayersForSide}
          currentMinute={Number.isNaN(visibleClockMinute) ? 0 : visibleClockMinute}
          currentClockLabel={live.formattedClock}
          onCancel={() => sideline.setActiveFlow(null)}
          onConfirm={sideline.submitSubstitution}
          saving={live.saving}
        />
      </SidelineFlowModal>

      <SidelineFlowModal
        open={sideline.activeFlow === 'yellow_card'}
        title="Record Yellow Card"
        onClose={() => sideline.setActiveFlow(null)}
      >
        <YellowCardFlow
          teamOptions={sideline.teamOptions}
          getPlayersForSide={sideline.getPlayersForSide}
          getTrackingModeForSide={sideline.getTrackingModeForSide}
          onCancel={() => sideline.setActiveFlow(null)}
          onConfirm={sideline.submitCard}
          saving={live.saving}
        />
      </SidelineFlowModal>

      <SidelineFlowModal
        open={sideline.activeFlow === 'red_card'}
        title="Record Red Card"
        onClose={() => sideline.setActiveFlow(null)}
      >
        <RedCardFlow
          teamOptions={sideline.teamOptions}
          getPlayersForSide={sideline.getPlayersForSide}
          getTrackingModeForSide={sideline.getTrackingModeForSide}
          onCancel={() => sideline.setActiveFlow(null)}
          onConfirm={sideline.submitCard}
          saving={live.saving}
        />
      </SidelineFlowModal>

      <SidelineFlowModal
        open={sideline.activeFlow === 'undo'}
        title="Undo Last Action"
        onClose={() => sideline.setActiveFlow(null)}
      >
        <UndoFlow
          latestEvent={live.safeEvents[0]}
          onCancel={() => sideline.setActiveFlow(null)}
          onConfirm={sideline.confirmUndo}
          undoing={live.undoing}
        />
      </SidelineFlowModal>

      <SidelineFlowModal
        open={sideline.activeFlow === 'halftime'}
        title="Halftime"
        onClose={() => sideline.setActiveFlow(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            This will stop the clock and mark the match as halftime. Use this when the first half
            has ended.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => sideline.setActiveFlow(null)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={sideline.confirmHalftime}
              disabled={!sideline.canWrite || live.saving}
              className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirm Halftime
            </button>
          </div>
        </div>
      </SidelineFlowModal>

      <SidelineFlowModal
        open={sideline.activeFlow === 'end'}
        title="End Match"
        onClose={() => sideline.setActiveFlow(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            This will mark the match as final and stop the live clock. This action should only be
            used when the match has ended.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => sideline.setActiveFlow(null)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={sideline.confirmEndMatch}
              disabled={!sideline.canWrite || live.saving}
              className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirm Full Time
            </button>
          </div>
        </div>
      </SidelineFlowModal>
    </>
  );
}

function SidelineMinutesSnapshot({
  homeTeamName,
  awayTeamName,
  homeRows,
  awayRows,
}: {
  homeTeamName: string;
  awayTeamName: string;
  homeRows: MinutesPlayedRow[];
  awayRows: MinutesPlayedRow[];
}) {
  const homeLeaders = homeRows.slice(0, 11);
  const awayLeaders = awayRows.slice(0, 11);

  if (homeLeaders.length === 0 && awayLeaders.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Minutes On Field</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quick sideline view of estimated minutes played.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
          {homeLeaders.length + awayLeaders.length}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MinutesMiniColumn title={homeTeamName} rows={homeLeaders} accent="home" />
        <MinutesMiniColumn title={awayTeamName} rows={awayLeaders} accent="away" />
      </div>
    </section>
  );
}

function MinutesMiniColumn({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: MinutesPlayedRow[];
  accent: 'home' | 'away';
}) {
  const badgeClass =
    accent === 'home'
      ? 'bg-blue-50 text-blue-700 ring-blue-200'
      : 'bg-rose-50 text-rose-700 ring-rose-200';

  return (
    <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${badgeClass}`}>
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No minutes tracked yet.</p>
      ) : (
        <div className="h-56 space-y-2 overflow-y-scroll pr-1">
          {rows.map((row) => (
            <div
              key={row.player.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-200"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {row.player.jersey_number !== null && row.player.jersey_number !== undefined
                    ? `#${row.player.jersey_number} `
                    : ''}
                  {[row.player.first_name, row.player.last_name].filter(Boolean).join(' ')}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {row.player.position || 'No position'}
                </p>
              </div>

              <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${getMinutesPillClasses(row.minutes)}`}>
                {row.minutes} min
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getMinutesPillClasses(minutes: number) {
  if (minutes >= 60) {
    return 'bg-red-100 text-red-700 ring-red-200';
  }

  if (minutes >= 45) {
    return 'bg-amber-100 text-amber-800 ring-amber-200';
  }

  return 'bg-sky-100 text-sky-800 ring-sky-200';
}
