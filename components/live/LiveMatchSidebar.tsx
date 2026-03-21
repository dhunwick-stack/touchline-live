'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import MatchActionsCard from '@/components/MatchActionsCard';
import LineupSnapshotStatusCard from '@/components/live/LineupSnapshotStatusCard';
import LiveEventEntryCard from '@/components/live/LiveEventEntryCard';
import MinutesPlayedCard from '@/components/live/MinutesPlayedCard';
import StartingLineupSelector from '@/components/live/StartingLineupSelector';
import type {
  EventFormState,
  EventTypeOption,
  LineupRow,
  MatchRow,
  MinutesPlayedRow,
  SnapshotStatusRow,
} from '@/components/live/liveMatchPageShared';
import type { Dispatch, SetStateAction } from 'react';
import type { ReactNode } from 'react';
import type { Player, TeamSide, TrackingMode } from '@/lib/types';

type LiveMatchSidebarProps = {
  match: MatchRow;
  selectedTeamName: string;
  selectedTrackingMode: TrackingMode;
  editingDisabled: boolean;
  lineupEditingDisabled: boolean;
  form: EventFormState;
  setForm: Dispatch<SetStateAction<EventFormState>>;
  resetForm: (nextSide?: TeamSide) => void;
  addEvent: () => void;
  saving: boolean;
  error: string | null;
  eventTypeOptions: EventTypeOption[];
  eventSelectablePlayers: Player[];
  eventSelectableSecondaryPlayers: Player[];
  selectedOnFieldPlayers: Player[];
  selectedBenchPlayers: Player[];
  showOnFieldState: boolean;
  setShowOnFieldState: Dispatch<SetStateAction<boolean>>;
  playerDisplayName: (player: Player | undefined) => string;
  loadingLineups: boolean;
  showLineupSnapshotStatus: boolean;
  setShowLineupSnapshotStatus: Dispatch<SetStateAction<boolean>>;
  homeSnapshotRow: SnapshotStatusRow;
  awaySnapshotRow: SnapshotStatusRow;
  homeSupportsLineups: boolean;
  awaySupportsLineups: boolean;
  homeLineupRows: LineupRow[];
  awayLineupRows: LineupRow[];
  selectedHomeStarterIds: string[];
  selectedAwayStarterIds: string[];
  toggleHomeStarter: (playerId: string) => void;
  toggleAwayStarter: (playerId: string) => void;
  usePreviousHomeLineup: () => void;
  usePreviousAwayLineup: () => void;
  handleSaveHomeLineup: () => void;
  handleSaveAwayLineup: () => void;
  savingHomeLineup: boolean;
  savingAwayLineup: boolean;
  showHomeLineupCard: boolean;
  showAwayLineupCard: boolean;
  setShowHomeLineupCard: Dispatch<SetStateAction<boolean>>;
  setShowAwayLineupCard: Dispatch<SetStateAction<boolean>>;
  homeMinutesPlayedRows: MinutesPlayedRow[];
  awayMinutesPlayedRows: MinutesPlayedRow[];
  showHomeMinutesCard: boolean;
  showAwayMinutesCard: boolean;
  setShowHomeMinutesCard: Dispatch<SetStateAction<boolean>>;
  setShowAwayMinutesCard: Dispatch<SetStateAction<boolean>>;
  setMatch: Dispatch<SetStateAction<MatchRow | null>>;
  mobileAfterEventEntry?: ReactNode;
};

// ---------------------------------------------------
// COMPONENT
// FILE: components/live/LiveMatchSidebar.tsx
// ---------------------------------------------------

export default function LiveMatchSidebar({
  match,
  selectedTeamName,
  selectedTrackingMode,
  editingDisabled,
  lineupEditingDisabled,
  form,
  setForm,
  resetForm,
  addEvent,
  saving,
  error,
  eventTypeOptions,
  eventSelectablePlayers,
  eventSelectableSecondaryPlayers,
  selectedOnFieldPlayers,
  selectedBenchPlayers,
  showOnFieldState,
  setShowOnFieldState,
  playerDisplayName,
  loadingLineups,
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
  savingHomeLineup,
  savingAwayLineup,
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
  setMatch,
  mobileAfterEventEntry,
}: LiveMatchSidebarProps) {
  return (
    <div className="space-y-6">
      {/* --------------------------------------------------- */}
      {/* EVENT ENTRY CARD */}
      {/* --------------------------------------------------- */}

      <LiveEventEntryCard
        selectedTeamName={selectedTeamName}
        selectedTrackingMode={selectedTrackingMode}
        editingDisabled={editingDisabled}
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
      />

      {mobileAfterEventEntry ? <div className="xl:hidden">{mobileAfterEventEntry}</div> : null}

      {/* --------------------------------------------------- */}
      {/* LINEUP SNAPSHOT STATUS */}
      {/* --------------------------------------------------- */}

      <LineupSnapshotStatusCard
        loadingLineups={loadingLineups}
        open={showLineupSnapshotStatus}
        onToggleOpen={() => setShowLineupSnapshotStatus((prev) => !prev)}
        homeRow={homeSnapshotRow}
        awayRow={awaySnapshotRow}
      />

      {/* --------------------------------------------------- */}
      {/* HOME LINEUP CARD */}
      {/* --------------------------------------------------- */}

      {homeSupportsLineups && (
        <StartingLineupSelector
          title={match.home_team?.name || 'Home Team'}
          subtitle="Choose exactly 11 starters."
          rows={homeLineupRows}
          selectedStarterIds={selectedHomeStarterIds}
          onToggleStarter={toggleHomeStarter}
          onUsePreviousLineup={usePreviousHomeLineup}
          onSave={handleSaveHomeLineup}
          saving={savingHomeLineup}
          loading={loadingLineups}
          accent="home"
          disabled={lineupEditingDisabled}
          open={showHomeLineupCard}
          onToggleOpen={() => setShowHomeLineupCard((prev) => !prev)}
          playerDisplayName={playerDisplayName}
        />
      )}

      {/* --------------------------------------------------- */}
      {/* AWAY LINEUP CARD */}
      {/* --------------------------------------------------- */}

      {awaySupportsLineups && (
        <StartingLineupSelector
          title={match.away_team?.name || 'Away Team'}
          subtitle="Choose exactly 11 starters."
          rows={awayLineupRows}
          selectedStarterIds={selectedAwayStarterIds}
          onToggleStarter={toggleAwayStarter}
          onUsePreviousLineup={usePreviousAwayLineup}
          onSave={handleSaveAwayLineup}
          saving={savingAwayLineup}
          loading={loadingLineups}
          accent="away"
          disabled={lineupEditingDisabled}
          open={showAwayLineupCard}
          onToggleOpen={() => setShowAwayLineupCard((prev) => !prev)}
          playerDisplayName={playerDisplayName}
        />
      )}

      {/* --------------------------------------------------- */}
      {/* HOME MINUTES PLAYED */}
      {/* --------------------------------------------------- */}

      {match.home_tracking_mode === 'full' && (
        <MinutesPlayedCard
          title={`${match.home_team?.name || 'Home Team'} Minutes`}
          subtitle="Estimated minutes played based on starters, substitutions, and current match state."
          rows={homeMinutesPlayedRows}
          accent="home"
          emptyText="No home minutes available yet."
          open={showHomeMinutesCard}
          onToggleOpen={() => setShowHomeMinutesCard((prev) => !prev)}
        />
      )}

      {/* --------------------------------------------------- */}
      {/* AWAY MINUTES PLAYED */}
      {/* --------------------------------------------------- */}

      {match.away_tracking_mode === 'full' && (
        <MinutesPlayedCard
          title={`${match.away_team?.name || 'Away Team'} Minutes`}
          subtitle="Estimated minutes played based on starters, substitutions, and current match state."
          rows={awayMinutesPlayedRows}
          accent="away"
          emptyText="No away minutes available yet."
          open={showAwayMinutesCard}
          onToggleOpen={() => setShowAwayMinutesCard((prev) => !prev)}
        />
      )}

      {/* --------------------------------------------------- */}
      {/* MATCH ACTIONS */}
      {/* --------------------------------------------------- */}

      <MatchActionsCard
        match={match}
        onUpdated={(updatedMatch) =>
          setMatch((prev) =>
            prev
              ? {
                  ...prev,
                  ...updatedMatch,
                }
              : (updatedMatch as MatchRow)
          )
        }
      />
    </div>
  );
}
