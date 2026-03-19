'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import LiveTimeline from '@/components/live/LiveTimeline';
import QuickActionBar from '@/components/live/QuickActionBar';
import PauseMatchModal from '@/components/live/PauseMatchModal';
import LiveMatchHeaderActions from '@/components/live/LiveMatchHeaderActions';
import LiveMatchSidebar from '@/components/live/LiveMatchSidebar';
import { eventTypeOptions } from '@/components/live/liveMatchPageShared';
import MatchHeader from '@/components/match/MatchHeader';
import useLiveMatchPage from '@/components/live/useLiveMatchPage';

// ---------------------------------------------------
// PAGE
// FILE: app/live/[matchId]/page.tsx
// ---------------------------------------------------

export default function LiveMatchPage() {
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

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-7xl px-6 pt-0 pb-32">
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

      {/* --------------------------------------------------- */}
      {/* MAIN CONTENT GRID */}
      {/* --------------------------------------------------- */}

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        {/* --------------------------------------------------- */}
        {/* LEFT COLUMN */}
        {/* --------------------------------------------------- */}

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

        {/* --------------------------------------------------- */}
        {/* RIGHT COLUMN */}
        {/* --------------------------------------------------- */}

        <LiveTimeline
          events={safeEvents}
          match={match}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
        />
      </div>

      {/* --------------------------------------------------- */}
      {/* QUICK ACTION BAR */}
      {/* --------------------------------------------------- */}

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
