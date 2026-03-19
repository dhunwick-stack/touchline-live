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
  const {
    match,
    setMatch,
    loading,
    authChecked,
    hasMatchAccess,
    error,
    formattedClock,
    safeEvents,
    homePlayers,
    awayPlayers,
    loadingLineups,
    saving,
    savingHomeLineup,
    savingAwayLineup,
    undoing,
    lineupNotice,
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
  } = useLiveMatchPage();

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

  const live = {
    match,
    setMatch,
    loading,
    authChecked,
    hasMatchAccess,
    error,
    formattedClock,
    safeEvents,
    homePlayers,
    awayPlayers,
    loadingLineups,
    saving,
    savingHomeLineup,
    savingAwayLineup,
    undoing,
    lineupNotice,
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
  };

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

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
        </>
      ) : null}

      <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
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
              lineupNotice={lineupNotice}
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
            />

            <LiveTimeline
              events={safeEvents}
              match={match}
              homePlayers={homePlayers}
              awayPlayers={awayPlayers}
            />
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

      {mode === 'sideline' ? <SidelineMode live={live} /> : null}

      {mode === 'quick' ? <QuickEntryMode live={live} /> : null}

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
