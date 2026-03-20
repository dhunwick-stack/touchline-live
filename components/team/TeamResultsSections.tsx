'use client';

import Link from 'next/link';
import type { Match, MatchEvent, Team } from '@/lib/types';

export type TeamResultsMatchRow = Match & {
  home_team: Team | null;
  away_team: Team | null;
};

export type TeamResultsGroup = {
  label: string;
  matches: TeamResultsMatchRow[];
};

type ResultsMode = 'public' | 'admin';

export function LatestTeamResultHero({
  match,
  teamId,
  mode,
  onDeleteMatch,
  deletingMatchId,
}: {
  match: TeamResultsMatchRow;
  teamId: string;
  mode: ResultsMode;
  onDeleteMatch?: (match: TeamResultsMatchRow) => void;
  deletingMatchId?: string | null;
}) {
  const isHomeTeam = match.home_team_id === teamId;
  const result =
    (isHomeTeam ? match.home_score : match.away_score) >
    (isHomeTeam ? match.away_score : match.home_score)
      ? 'W'
      : (isHomeTeam ? match.home_score : match.away_score) <
          (isHomeTeam ? match.away_score : match.home_score)
        ? 'L'
        : 'D';

  return (
    <section className="mb-8 rounded-3xl bg-slate-900 p-6 text-white shadow-sm ring-1 ring-slate-800">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Latest Result
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight">
            {match.home_team?.name || 'Home Team'} vs {match.away_team?.name || 'Away Team'}
          </h2>

          <p className="mt-2 text-slate-300">
            {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
            {match.venue ? ` • ${match.venue}` : ''}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
            result === 'W'
              ? 'bg-emerald-100 text-emerald-700'
              : result === 'L'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-amber-100 text-amber-700'
          }`}
        >
          {result}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Home</p>
          <div className="mt-2 flex items-center gap-3">
            {match.home_team?.logo_url ? (
              <img
                src={match.home_team.logo_url}
                alt={`${match.home_team.name} logo`}
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
              />
            ) : null}

            <h3 className="truncate text-2xl font-black text-white">
              {match.home_team?.name || 'Home Team'}
            </h3>
          </div>
        </div>

        <div className="rounded-2xl bg-white/10 px-5 py-4 text-center ring-1 ring-white/10">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            Final
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {match.home_score} - {match.away_score}
          </div>
        </div>

        <div className="min-w-0 md:text-right">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Away</p>
          <div className="mt-2 flex items-center justify-end gap-3">
            <h3 className="truncate text-2xl font-black text-white">
              {match.away_team?.name || 'Away Team'}
            </h3>

            {match.away_team?.logo_url ? (
              <img
                src={match.away_team.logo_url}
                alt={`${match.away_team.name} logo`}
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/20"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {mode === 'admin' ? (
          <>
            <Link
              href={`/live/${match.id}`}
              className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Manage Match
            </Link>

            {onDeleteMatch ? (
              <button
                type="button"
                onClick={() => onDeleteMatch(match)}
                disabled={deletingMatchId === match.id}
                className="inline-flex items-center justify-center rounded-2xl bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-50"
              >
                {deletingMatchId === match.id ? 'Deleting...' : 'Delete Match'}
              </button>
            ) : null}
          </>
        ) : null}

        {match.public_slug ? (
          <Link
            href={`/public/${match.public_slug}`}
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Match Recap
          </Link>
        ) : (
          <span className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white/70 ring-1 ring-white/10">
            Public link coming soon
          </span>
        )}
      </div>
    </section>
  );
}

export function TeamResultsArchive({
  title,
  subtitle,
  count,
  groups,
  teamId,
  events,
  mode,
  rightSlot,
  emptyText,
  onDeleteMatch,
  deletingMatchId,
}: {
  title: string;
  subtitle: string;
  count: number;
  groups: TeamResultsGroup[];
  teamId: string;
  events: MatchEvent[];
  mode: ResultsMode;
  rightSlot?: React.ReactNode;
  emptyText: string;
  onDeleteMatch?: (match: TeamResultsMatchRow) => void;
  deletingMatchId?: string | null;
}) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {count}
          </span>
          {rightSlot}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-4 flex items-center gap-3 border-b border-slate-200 pb-2">
                <h3 className="text-lg font-bold text-slate-900">{group.label}</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {group.matches.length}
                </span>
              </div>

              <div className="space-y-4">
                {group.matches.map((match) => (
                  <TeamResultScoreCard
                    key={match.id}
                    match={match}
                    teamId={teamId}
                    events={events.filter((event) => event.match_id === match.id)}
                    mode={mode}
                    onDeleteMatch={onDeleteMatch}
                    deletingMatchId={deletingMatchId}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TeamResultScoreCard({
  match,
  teamId,
  events,
  mode,
  onDeleteMatch,
  deletingMatchId,
}: {
  match: TeamResultsMatchRow;
  teamId: string;
  events: MatchEvent[];
  mode: ResultsMode;
  onDeleteMatch?: (match: TeamResultsMatchRow) => void;
  deletingMatchId?: string | null;
}) {
  const isHomeTeam = match.home_team_id === teamId;
  const teamSide = isHomeTeam ? match.home_team : match.away_team;
  const opponent = isHomeTeam ? match.away_team : match.home_team;

  const teamGoals = isHomeTeam ? match.home_score : match.away_score;
  const opponentGoals = isHomeTeam ? match.away_score : match.home_score;
  const result = teamGoals > opponentGoals ? 'W' : teamGoals < opponentGoals ? 'L' : 'D';

  const teamScorers = buildScorerList(events, isHomeTeam ? match.home_team_id : match.away_team_id);
  const opponentScorers = buildScorerList(
    events,
    isHomeTeam ? match.away_team_id : match.home_team_id,
  );

  return (
    <div className="overflow-hidden rounded-3xl bg-slate-50 ring-1 ring-slate-200">
      <div className="border-b border-slate-200 bg-white/70 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              result === 'W'
                ? 'bg-emerald-100 text-emerald-700'
                : result === 'L'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {result}
          </span>

          <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Final
          </span>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
          </span>

          {match.venue ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {match.venue}
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr] md:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Team</p>
            <div className="mt-1 flex items-center gap-3">
              {teamSide?.logo_url ? (
                <img
                  src={teamSide.logo_url}
                  alt={`${teamSide.name} logo`}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                />
              ) : null}
              <h3 className="truncate text-xl font-black text-slate-900">
                {teamSide?.name || 'Team'}
              </h3>
            </div>
          </div>

          <div className="min-w-0 md:text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Opponent
            </p>
            <div className="mt-1 flex items-center justify-end gap-3">
              <h3 className="truncate text-xl font-black text-slate-900">
                {opponent?.name || 'Opponent'}
              </h3>
              {opponent?.logo_url ? (
                <img
                  src={opponent.logo_url}
                  alt={`${opponent.name} logo`}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                />
              ) : null}
            </div>
          </div>
        </div>

        {(teamScorers.length > 0 || opponentScorers.length > 0) && (
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <ScorerPanel title="Team Scorers" items={teamScorers} />

            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-center text-white shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Score
              </div>
              <div className="mt-1 text-4xl font-black tabular-nums">
                {teamGoals} - {opponentGoals}
              </div>
            </div>

            <ScorerPanel title="Opponent Scorers" items={opponentScorers} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {mode === 'admin' ? (
            <>
              <Link
                href={`/live/${match.id}`}
                className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Manage Match
              </Link>

              {onDeleteMatch ? (
                <button
                  type="button"
                  onClick={() => onDeleteMatch(match)}
                  disabled={deletingMatchId === match.id}
                  className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-50"
                >
                  {deletingMatchId === match.id ? 'Deleting...' : 'Delete Match'}
                </button>
              ) : null}
            </>
          ) : null}

          {match.public_slug ? (
            <Link
              href={`/public/${match.public_slug}`}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Match Recap
            </Link>
          ) : (
            <span className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">
              No recap yet
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ScorerPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No scorers recorded</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buildScorerList(events: MatchEvent[], teamId: string | null | undefined) {
  if (!teamId) return [];

  return events
    .filter((event) => event.team_id === teamId && event.event_type === 'goal')
    .map((event) => {
      const name = event.player_name_override?.trim() || 'Goal';
      return `${name}${event.minute !== null && event.minute !== undefined ? ` ${event.minute}'` : ''}`;
    });
}

function formatMatchDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
