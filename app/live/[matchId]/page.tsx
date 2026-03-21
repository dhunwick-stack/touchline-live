'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useState } from 'react';
import LiveTimeline from '@/components/live/LiveTimeline';
import QuickActionBar from '@/components/live/QuickActionBar';
import PauseMatchModal from '@/components/live/PauseMatchModal';
import LiveMatchHeaderActions from '@/components/live/LiveMatchHeaderActions';
import LiveMatchSidebar from '@/components/live/LiveMatchSidebar';
import SidelineMode from '@/components/match/SidelineMode';
import QuickEntryMode from '@/components/match/QuickEntryMode';
import type { MinutesPlayedRow } from '@/components/live/liveMatchPageShared';
import { eventTypeOptions } from '@/components/live/liveMatchPageShared';
import MatchHeader from '@/components/match/MatchHeader';
import useLiveMatchPage from '@/components/live/useLiveMatchPage';

type LiveInterfaceMode = 'full' | 'sideline' | 'quick';

// ---------------------------------------------------
// PAGE
// FILE: app/live/[matchId]/page.tsx
// ---------------------------------------------------

export default function LiveMatchPage() {
  const [mode, setMode] = useState<LiveInterfaceMode>('full');
  const live = useLiveMatchPage();
  const {
    match,
    setMatch,
    loading,
    authChecked,
    hasMatchAccess,
    error,
    connectionNotice,
    formattedClock,
    safeEvents,
    homePlayers,
    awayPlayers,
    loadingLineups,
    saving,
    savingHomeLineup,
    savingAwayLineup,
    undoing,
    selectedTeamName,
    selectedTrackingMode,
    editingDisabled,
    lineupEditingDisabled,
    form,
    setForm,
    resetForm,
    addEvent,
    eventSelectablePlayers,
    eventSelectableSecondaryPlayers,
    selectedOnFieldPlayers,
    selectedBenchPlayers,
    showOnFieldState,
    setShowOnFieldState,
    playerDisplayName,
    showLineupSnapshotStatus,
    setShowLineupSnapshotStatus,
    homeSnapshotRow,
    awaySnapshotRow,
    homeSupportsLineups,
    awaySupportsLineups,
    homeLineupRows,
    awayLineupRows,
    selectedHomeStarterIds,
    selectedAwayStarterIds,
    toggleHomeStarter,
    toggleAwayStarter,
    usePreviousHomeLineup,
    usePreviousAwayLineup,
    handleSaveHomeLineup,
    handleSaveAwayLineup,
    showHomeLineupCard,
    showAwayLineupCard,
    setShowHomeLineupCard,
    setShowAwayLineupCard,
    homeMinutesPlayedRows,
    awayMinutesPlayedRows,
    showHomeMinutesCard,
    showAwayMinutesCard,
    setShowHomeMinutesCard,
    setShowAwayMinutesCard,
    openPauseModal,
    startLivePeriod,
    undoLastEvent,
    showPauseModal,
    pauseNote,
    setPauseNote,
    closePauseModal,
    pauseClock,
    applyPauseReason,
  } = live;

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading || !authChecked || !hasMatchAccess) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-32">Loading match...</main>;
  }

  if (error && !match) {
    return <main className="mx-auto max-w-7xl px-6 pt-0 pb-32 text-red-600">{error}</main>;
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-7xl px-6 pt-0 pb-32 text-red-600">
        Match not found.
      </main>
    );
  }

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  const modeSwitcher = (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap gap-3">
        {[
          { value: 'full', label: 'Full Control' },
          { value: 'sideline', label: 'Sideline' },
          { value: 'quick', label: 'Quick Score' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value as LiveInterfaceMode)}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              mode === option.value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );

  const showCompactMinutesSnapshot =
    ['live', 'halftime', 'final'].includes(match.status) &&
    (homeMinutesPlayedRows.length > 0 || awayMinutesPlayedRows.length > 0);
  const showMobileInlineMatchView = ['live', 'halftime', 'final'].includes(match.status);

  return (
    <main className="mx-auto max-w-7xl px-6 pt-0 pb-32">
      {mode === 'full' ? (
        <>
          {/* --------------------------------------------------- */}
          {/* MATCH HEADER */}
          {/* --------------------------------------------------- */}

          <MatchHeader
            match={match}
            formattedClock={formattedClock}
            mode="admin"
            theme="team"
            actions={
              <LiveMatchHeaderActions
                match={match}
                editingDisabled={editingDisabled}
                undoing={undoing}
                eventsCount={safeEvents.length}
                startLivePeriod={startLivePeriod}
                openPauseModal={openPauseModal}
                undoLastEvent={undoLastEvent}
              />
            }
          />

          <section className="mt-6">{modeSwitcher}</section>

          {connectionNotice ? (
            <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {connectionNotice}
            </section>
          ) : null}
        </>
      ) : null}

      {mode === 'full' ? (
        <>
          {/* --------------------------------------------------- */}
          {/* MAIN CONTENT GRID */}
          {/* --------------------------------------------------- */}

          <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
            <LiveMatchSidebar
              match={match}
              selectedTeamName={selectedTeamName}
              selectedTrackingMode={selectedTrackingMode}
              editingDisabled={editingDisabled}
              lineupEditingDisabled={lineupEditingDisabled}
              form={form}
              setForm={setForm}
              resetForm={resetForm}
              addEvent={addEvent}
              saving={saving}
              error={error}
              eventTypeOptions={eventTypeOptions}
              eventSelectablePlayers={eventSelectablePlayers}
              eventSelectableSecondaryPlayers={eventSelectableSecondaryPlayers}
              selectedOnFieldPlayers={selectedOnFieldPlayers}
              selectedBenchPlayers={selectedBenchPlayers}
              showOnFieldState={showOnFieldState}
              setShowOnFieldState={setShowOnFieldState}
              playerDisplayName={playerDisplayName}
              loadingLineups={loadingLineups}
              showLineupSnapshotStatus={showLineupSnapshotStatus}
              setShowLineupSnapshotStatus={setShowLineupSnapshotStatus}
              homeSnapshotRow={homeSnapshotRow}
              awaySnapshotRow={awaySnapshotRow}
              homeSupportsLineups={homeSupportsLineups}
              awaySupportsLineups={awaySupportsLineups}
              homeLineupRows={homeLineupRows}
              awayLineupRows={awayLineupRows}
              selectedHomeStarterIds={selectedHomeStarterIds}
              selectedAwayStarterIds={selectedAwayStarterIds}
              toggleHomeStarter={toggleHomeStarter}
              toggleAwayStarter={toggleAwayStarter}
              usePreviousHomeLineup={usePreviousHomeLineup}
              usePreviousAwayLineup={usePreviousAwayLineup}
              handleSaveHomeLineup={handleSaveHomeLineup}
              handleSaveAwayLineup={handleSaveAwayLineup}
              savingHomeLineup={savingHomeLineup}
              savingAwayLineup={savingAwayLineup}
              showHomeLineupCard={showHomeLineupCard}
              showAwayLineupCard={showAwayLineupCard}
              setShowHomeLineupCard={setShowHomeLineupCard}
              setShowAwayLineupCard={setShowAwayLineupCard}
              homeMinutesPlayedRows={homeMinutesPlayedRows}
              awayMinutesPlayedRows={awayMinutesPlayedRows}
              showHomeMinutesCard={showHomeMinutesCard}
              showAwayMinutesCard={showAwayMinutesCard}
              setShowHomeMinutesCard={setShowHomeMinutesCard}
              setShowAwayMinutesCard={setShowAwayMinutesCard}
              setMatch={setMatch}
              mobileAfterEventEntry={
                showMobileInlineMatchView ? (
                  <div className="space-y-6">
                    {showCompactMinutesSnapshot ? (
                      <CompactMinutesSnapshot
                        homeTeamName={match.home_team?.name || 'Home Team'}
                        awayTeamName={match.away_team?.name || 'Away Team'}
                        homeRows={homeMinutesPlayedRows}
                        awayRows={awayMinutesPlayedRows}
                      />
                    ) : null}

                    <LiveTimeline
                      events={safeEvents}
                      match={match}
                      homePlayers={homePlayers}
                      awayPlayers={awayPlayers}
                    />
                  </div>
                ) : null
              }
            />

            <div className={showMobileInlineMatchView ? 'hidden space-y-6 xl:block' : 'space-y-6'}>
              {showCompactMinutesSnapshot ? (
                <CompactMinutesSnapshot
                  homeTeamName={match.home_team?.name || 'Home Team'}
                  awayTeamName={match.away_team?.name || 'Away Team'}
                  homeRows={homeMinutesPlayedRows}
                  awayRows={awayMinutesPlayedRows}
                />
              ) : null}

              <LiveTimeline
                events={safeEvents}
                match={match}
                homePlayers={homePlayers}
                awayPlayers={awayPlayers}
              />
            </div>
          </div>

          <QuickActionBar
            editingDisabled={editingDisabled}
            undoing={undoing}
            eventsCount={safeEvents.length}
            match={match}
            openPauseModal={openPauseModal}
            startLivePeriod={startLivePeriod}
            undoLastEvent={undoLastEvent}
            setForm={setForm}
          />
        </>
      ) : null}

      {mode === 'sideline' ? <SidelineMode live={live} modeSwitcher={modeSwitcher} /> : null}

      {mode === 'quick' ? <QuickEntryMode live={live} modeSwitcher={modeSwitcher} /> : null}

      {/* --------------------------------------------------- */}
      {/* PAUSE MATCH MODAL */}
      {/* --------------------------------------------------- */}

      <PauseMatchModal
        open={showPauseModal}
        pauseNote={pauseNote}
        setPauseNote={setPauseNote}
        closePauseModal={closePauseModal}
        pauseClock={pauseClock}
        applyPauseReason={applyPauseReason}
      />
    </main>
  );
}

function CompactMinutesSnapshot({
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

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Minutes On Field</h2>
          <p className="mt-1 text-xs text-slate-500">
            Full-control glance view once the match is underway.
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {homeLeaders.length + awayLeaders.length}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CompactMinutesColumn title={homeTeamName} rows={homeLeaders} accent="home" />
        <CompactMinutesColumn title={awayTeamName} rows={awayLeaders} accent="away" />
      </div>
    </section>
  );
}

function CompactMinutesColumn({
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
    <div className="rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${badgeClass}`}>
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No minutes tracked yet.</p>
      ) : (
        <div
          className="rounded-2xl bg-slate-100/80 p-2"
          style={{
            height: '220px',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {rows.map((row) => (
            <div
              key={row.player.id}
              className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200 last:mb-0"
              style={{ minHeight: '2.75rem' }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {row.player.jersey_number !== null && row.player.jersey_number !== undefined
                    ? `#${row.player.jersey_number} `
                    : ''}
                  {[row.player.first_name, row.player.last_name].filter(Boolean).join(' ')}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {row.player.position || 'No position'}
                </p>
              </div>

              <div className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${getMinutesPillClasses(row.minutes)}`}>
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
