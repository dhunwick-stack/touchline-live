'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import {
  ArrowLeftRight,
  CircleDot,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import type {
  EventType,
  Match,
  MatchEvent,
  Player,
  Team,
} from '@/lib/types';

// ---------------------------------------------------
// LOCAL TYPES
// ---------------------------------------------------

type MatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

type Props = {
  event: MatchEvent | null | undefined;
  match: MatchRow;
  homePlayers: Player[];
  awayPlayers: Player[];
};

// ---------------------------------------------------
// EVENT LABELS
// ---------------------------------------------------

const eventLabels: Record<EventType, string> = {
  goal: 'Goal',
  yellow_card: 'Yellow Card',
  red_card: 'Red Card',
  substitution: 'Substitution',
  half_start: 'Half Started',
  match_resumed: 'Match Resumed',
  match_paused: 'Match Paused',
  half_end: 'Halftime',
  full_time: 'Full Time',
};

// ---------------------------------------------------
// COMPONENT
// ---------------------------------------------------

export default function TimelineEventCard({
  event,
  match,
  homePlayers,
  awayPlayers,
}: Props) {
  // ---------------------------------------------------
  // INVALID EVENT GUARD
  // ---------------------------------------------------

  if (!event || !event.event_type) {
    return null;
  }

  const systemEvent = isSystemEvent(event.event_type);
  const styles = getEventCardClasses(event);
  const label = buildPrettyTimelineText(event, match, homePlayers, awayPlayers);
  const minuteLabel = Number.isFinite(event.minute) ? `${event.minute}'` : '—';
  const teamSideClasses =
    event.team_side === 'home'
      ? 'bg-blue-100 text-blue-700'
      : event.team_side === 'away'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-700';

  if (systemEvent) {
    return (
      <div className="relative overflow-hidden pl-14">
        {/* --------------------------------------------------- */}
        {/* TIMELINE RAIL */}
        {/* --------------------------------------------------- */}

        <div className="absolute bottom-0 left-[1rem] top-0 w-px bg-slate-200" />

        {/* --------------------------------------------------- */}
        {/* TIMELINE ICON */}
        {/* --------------------------------------------------- */}

        <div className="absolute left-0 top-4 flex w-8 justify-center">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 ${styles.icon}`}
          >
            <EventGlyph eventType={event.event_type} size="timeline" />
          </div>
        </div>

        {/* --------------------------------------------------- */}
        {/* SYSTEM EVENT CARD */}
        {/* --------------------------------------------------- */}

        <div className={`rounded-2xl border px-4 py-3 ${styles.shell}`}>
          <div className="flex items-center gap-3">
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
              {minuteLabel}
            </span>

            <p className="text-sm font-semibold text-slate-900">{label}</p>
          </div>

          {event.notes ? (
            <p className="mt-2 text-xs text-slate-500">{event.notes}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden pl-14">
      {/* --------------------------------------------------- */}
      {/* TIMELINE RAIL */}
      {/* --------------------------------------------------- */}

      <div className="absolute bottom-0 left-[1rem] top-0 w-px bg-slate-200" />

      {/* --------------------------------------------------- */}
      {/* TIMELINE ICON */}
      {/* --------------------------------------------------- */}

      <div className="absolute left-0 top-4 flex w-8 justify-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 ${styles.icon}`}
        >
          <EventGlyph eventType={event.event_type} size="timeline" />
        </div>
      </div>

      {/* --------------------------------------------------- */}
      {/* STANDARD EVENT CARD */}
      {/* --------------------------------------------------- */}

      <div className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${styles.shell}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
              {minuteLabel}
            </span>

            <p className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-6 text-slate-900">
              {label}
            </p>
          </div>

          <span
            className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${teamSideClasses}`}
          >
            {event.team_side || 'system'}
          </span>
        </div>

        {event.notes ? (
          <p className="mt-2 break-words text-xs text-slate-500">{event.notes}</p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------
// EVENT CLASSIFICATION
// ---------------------------------------------------

function isSystemEvent(eventType: MatchEvent['event_type']) {
  return (
    eventType === 'half_start' ||
    eventType === 'match_resumed' ||
    eventType === 'match_paused' ||
    eventType === 'half_end' ||
    eventType === 'full_time'
  );
}

// ---------------------------------------------------
// EVENT CARD STYLES
// ---------------------------------------------------

function getEventCardClasses(event: MatchEvent) {
  if (event.event_type === 'goal') {
    return {
      shell: 'border-sky-300 bg-sky-50',
      icon: 'bg-sky-100 text-sky-800 ring-sky-300',
    };
  }

  if (event.event_type === 'yellow_card') {
    return {
      shell: 'border-yellow-300 bg-yellow-50',
      icon: 'bg-yellow-100 text-yellow-900 ring-yellow-300',
    };
  }

  if (event.event_type === 'red_card') {
    return {
      shell: 'border-red-300 bg-red-50',
      icon: 'bg-red-100 text-red-900 ring-red-300',
    };
  }

  if (event.event_type === 'substitution') {
    return {
      shell: 'border-violet-200 bg-violet-50',
      icon: 'bg-violet-100 text-violet-800 ring-violet-300',
    };
  }

  return {
    shell: 'border-slate-200 bg-slate-50',
    icon: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
}

// ---------------------------------------------------
// PLAYER DISPLAY NAME
// ---------------------------------------------------

function playerDisplayName(player: Player | undefined) {
  if (!player) return '';

  const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');

  return player?.jersey_number ? `#${player.jersey_number} ${fullName}` : fullName;
}

// ---------------------------------------------------
// TIMELINE LABEL BUILDER
// ---------------------------------------------------

function buildPrettyTimelineText(
  event: MatchEvent,
  matchRow: MatchRow,
  homePlayers: Player[],
  awayPlayers: Player[],
) {
  const roster = event.team_side === 'home' ? homePlayers : awayPlayers;
  const primary = roster.find((player) => player.id === event.player_id);
  const secondary = roster.find((player) => player.id === event.secondary_player_id);

  const teamName =
    event.team_side === 'home'
      ? matchRow.home_team?.name || 'Home'
      : matchRow.away_team?.name || 'Away';

  const primaryName = event.player_name_override || playerDisplayName(primary) || teamName;
  const secondaryName = event.secondary_player_name_override || playerDisplayName(secondary);

  if (event.event_type === 'goal') {
    return secondaryName
      ? `Goal — ${primaryName} (Assist: ${secondaryName})`
      : `Goal — ${primaryName}`;
  }

  if (event.event_type === 'yellow_card') {
    return `Yellow Card — ${primaryName}`;
  }

  if (event.event_type === 'red_card') {
    return `Red Card — ${primaryName}`;
  }

  if (event.event_type === 'substitution') {
    return secondaryName
      ? `Substitution — ${secondaryName} for ${primaryName || 'Player Out'}`
      : `Substitution — ${primaryName || teamName}`;
  }

  if (event.event_type === 'half_start') return 'Half Started';
  if (event.event_type === 'match_resumed') return 'Match Resumed';
  if (event.event_type === 'match_paused') return 'Match Paused';
  if (event.event_type === 'half_end') return 'Halftime';
  if (event.event_type === 'full_time') return 'Full Time';

  return eventLabels[event.event_type] || event.event_type;
}

// ---------------------------------------------------
// EVENT GLYPH
// ---------------------------------------------------

function EventGlyph({
  eventType,
  size = 'timeline',
}: {
  eventType: EventType;
  size?: 'button' | 'timeline';
}) {
  const iconSize = size === 'button' ? 'h-4 w-4' : 'h-4 w-4';

  if (eventType === 'goal') {
    return <CircleDot className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'substitution') {
    return <ArrowLeftRight className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'match_resumed' || eventType === 'half_start') {
    return <Play className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'match_paused' || eventType === 'half_end') {
    return <Pause className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'full_time') {
    return <Square className={iconSize} strokeWidth={2.5} />;
  }

  if (eventType === 'yellow_card') {
    return <span className="h-4 w-3 rounded-[2px] bg-yellow-400 ring-1 ring-yellow-500/60" />;
  }

  if (eventType === 'red_card') {
    return <span className="h-4 w-3 rounded-[2px] bg-red-500 ring-1 ring-red-600/60" />;
  }

  return <CircleDot className={iconSize} strokeWidth={2.5} />;
}
