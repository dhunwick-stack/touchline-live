'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import usePublicMatchPage from '@/components/public/usePublicMatchPage';
import { ChevronDown, ChevronUp } from 'lucide-react';
import TimelineEventCard from '@/components/live/TimelineEventCard';
import type { Match, MatchEvent, Player, Team } from '@/lib/types';
import {
  formatMatchDate,
  getAppleMapsUrl,
  getVenueAddress,
  getVenueName,
  playerDisplayName,
  prettyStatus,
  type MatchLineupRow,
  type PublicMatchRow,
} from '@/components/public/publicMatchPageShared';

// ---------------------------------------------------
// PAGE
// ---------------------------------------------------

export default function PublicMatchPage() {
  const {
    match,
    loading,
    error,
    formattedClock,
    secondsElapsed,
    safeEvents,
    goalEvents,
    cardEvents,
    homePlayers,
    awayPlayers,
    showStartingLineups,
    setShowStartingLineups,
    showOnFieldNow,
    setShowOnFieldNow,
    homeStarters,
    awayStarters,
    hasStartingLineups,
    currentOnField,
    hasOnFieldView,
    teamSnapshots,
  } = usePublicMatchPage();

  // ---------------------------------------------------
  // LOADING / ERROR STATES
  // ---------------------------------------------------

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          Loading public scoreboard...
        </div>
      </main>
    );
  }

  if (error || !match) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Touchline Live
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Match not found
          </h1>
          <p className="mt-3 text-slate-600">
            {error || 'This public scoreboard link may be invalid or no longer available.'}
          </p>
        </div>
      </main>
    );
  }

  const isFinal = match.status === 'final';

  // ---------------------------------------------------
  // PAGE
  // ---------------------------------------------------

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      {/* --------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          {isFinal ? 'Match Recap' : 'Public Match Center'}
        </h1>
      </div>

      {/* --------------------------------------------------- */}
      {/* HERO SCOREBOARD */}
      {/* --------------------------------------------------- */}

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-gradient-to-b from-red-900 to-[#7f1d1d] text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                Home
              </p>

              <PublicScoreboardTeamLink
                team={match.home_team}
                href={match.home_team ? `/public/team/${match.home_team.id}` : '#'}
                align="left"
              />
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <StatusPill status={match.status} />
                <PeriodPill
                  status={match.status}
                  clockRunning={match.clock_running}
                  secondsElapsed={secondsElapsed}
                />
              </div>

              <div className="mt-5 inline-flex min-w-[260px] flex-col items-center rounded-[28px] border border-white/15 bg-white/10 px-8 py-6 shadow-2xl backdrop-blur-md">
                <div className="text-6xl font-black tracking-tight tabular-nums text-white md:text-7xl">
                  {match.home_score} - {match.away_score}
                </div>

                <div className="mt-3 text-2xl font-semibold tabular-nums text-white/90 md:text-3xl">
                  {formattedClock}
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="text-sm font-medium text-white/90">
                  {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
                </div>
                <div className="text-sm text-white/75">{getVenueName(match)}</div>
              </div>
            </div>

            <div>
              <p className="text-right text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                Away
              </p>

              <PublicScoreboardTeamLink
                team={match.away_team}
                href={match.away_team ? `/public/team/${match.away_team.id}` : '#'}
                align="right"
              />
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- */}
      {/* MAIN GRID */}
      {/* --------------------------------------------------- */}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6">
          {/* ----------------------------------------------- */}
          {/* GOALS / CARDS FOR FINAL */}
          {/* ----------------------------------------------- */}

          {isFinal && (
            <>
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-xl font-bold text-slate-900">Goals</h3>

                {goalEvents.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No goals recorded.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {goalEvents.map((event) => (
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
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-xl font-bold text-slate-900">Cards</h3>

                {cardEvents.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No cards recorded.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {cardEvents.map((event) => (
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
              </div>
            </>
          )}

          {/* ----------------------------------------------- */}
          {/* FULL TIMELINE */}
          {/* ----------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {isFinal ? 'Full Match Timeline' : 'Match Timeline'}
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {safeEvents.length} events
              </span>
            </div>

            {safeEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500">
                No match events yet.
              </div>
            ) : (
              <div className="space-y-4">
                {safeEvents.map((event, index) => (
                  <TimelineEventCard
                    key={event.id || `public-timeline-event-${index}`}
                    event={event}
                    match={match}
                    homePlayers={homePlayers}
                    awayPlayers={awayPlayers}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          {/* ----------------------------------------------- */}
          {/* MATCH DETAILS */}
          {/* ----------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">
              {isFinal ? 'Recap Details' : 'Match Details'}
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Status</dt>
                <dd className="text-right font-medium text-slate-900">
                  {prettyStatus(match.status)}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Clock</dt>
                <dd className="text-right font-medium tabular-nums text-slate-900">
                  {formattedClock}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Date</dt>
                <dd className="text-right font-medium text-slate-900">
                  {match.match_date ? formatMatchDate(match.match_date) : 'TBD'}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">Venue</dt>
                <dd className="text-right font-medium text-slate-900">
                  {getVenueName(match)}
                  {getVenueAddress(match) ? (
                    <div className="mt-2">
                      <a
                        href={getAppleMapsUrl(getVenueAddress(match)!)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                      >
                        Get Directions
                      </a>
                    </div>
                  ) : null}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-4">
                <dt className="font-semibold text-slate-500">
                  {isFinal ? 'Total Goals' : 'Updates'}
                </dt>
                <dd className="text-right font-medium text-slate-900">
                  {isFinal ? goalEvents.length : 'Realtime'}
                </dd>
              </div>
            </dl>
          </div>

          {/* ----------------------------------------------- */}
          {/* STARTING LINEUPS */}
          {/* ----------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Starting Lineups</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Starting groups captured before kickoff when lineup snapshots are available.
                </p>
              </div>

              <CollapsePill
                open={showStartingLineups}
                onClick={() => setShowStartingLineups((prev) => !prev)}
              />
            </div>

            {showStartingLineups ? (
              !hasStartingLineups ? (
                <p className="mt-4 text-sm text-slate-500">
                  No starting lineup snapshot has been published for this match.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  <LineupListCard
                    title={match.home_team?.name || 'Home Team'}
                    subtitle="Home starters"
                    players={homeStarters}
                    accent="blue"
                    emptyText="No home starters published."
                  />

                  <LineupListCard
                    title={match.away_team?.name || 'Away Team'}
                    subtitle="Away starters"
                    players={awayStarters}
                    accent="rose"
                    emptyText="No away starters published."
                  />
                </div>
              )
            ) : null}
          </div>

          {/* ----------------------------------------------- */}
          {/* OPTIONAL ON-FIELD SECTION */}
          {/* ----------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">On Field Now</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Current on-field view based on starters and recorded substitutions.
                </p>
              </div>

              <CollapsePill
                open={showOnFieldNow}
                onClick={() => setShowOnFieldNow((prev) => !prev)}
              />
            </div>

            {showOnFieldNow ? (
              !hasOnFieldView ? (
                <p className="mt-4 text-sm text-slate-500">
                  On-field view is not available yet for this match.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  <LineupListCard
                    title={match.home_team?.name || 'Home Team'}
                    subtitle="Current home players"
                    players={currentOnField.home}
                    accent="blue"
                    emptyText="No current home on-field data."
                  />

                  <LineupListCard
                    title={match.away_team?.name || 'Away Team'}
                    subtitle="Current away players"
                    players={currentOnField.away}
                    accent="rose"
                    emptyText="No current away on-field data."
                  />
                </div>
              )
            ) : null}
          </div>

          {/* ----------------------------------------------- */}
          {/* EXPLORE MORE */}
          {/* ----------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Explore More</h3>
            <p className="mt-2 text-sm text-slate-600">
              View public team pages and season leaders for both sides.
            </p>

            <div className="mt-5 space-y-4">
              {match.home_team ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {match.home_team.logo_url ? (
                      <img
                        src={match.home_team.logo_url}
                        alt={`${match.home_team.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Home Team
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {match.home_team.name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/public/team/${match.home_team.id}`}
                      className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm"
                    >
                      Team Page
                    </Link>

                    <Link
                      href={`/public/team/${match.home_team.id}/leaders`}
                      className="inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                    >
                      Leaders
                    </Link>
                  </div>
                </div>
              ) : null}

              {match.away_team ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {match.away_team.logo_url ? (
                      <img
                        src={match.away_team.logo_url}
                        alt={`${match.away_team.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Away Team
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {match.away_team.name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/public/team/${match.away_team.id}`}
                      className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm"
                    >
                      Team Page
                    </Link>

                    <Link
                      href={`/public/team/${match.away_team.id}/leaders`}
                      className="inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                    >
                      Leaders
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* ----------------------------------------------- */}
          {/* TEAM SNAPSHOT */}
          {/* ----------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">Team Snapshot</h3>
            <p className="mt-2 text-sm text-slate-600">
              Quick team context for both sides in this match.
            </p>

            <div className="mt-5 space-y-4">
              {teamSnapshots.home ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {teamSnapshots.home.team.logo_url ? (
                      <img
                        src={teamSnapshots.home.team.logo_url}
                        alt={`${teamSnapshots.home.team.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Home Snapshot
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {teamSnapshots.home.team.name}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Record</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.home.record}
                      </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Top Scorer</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.home.topScorerGoals > 0
                          ? `${teamSnapshots.home.topScorerName} (${teamSnapshots.home.topScorerGoals})`
                          : teamSnapshots.home.topScorerName}
                      </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Recent Form</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.home.recentForm}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {teamSnapshots.away ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    {teamSnapshots.away.team.logo_url ? (
                      <img
                        src={teamSnapshots.away.team.logo_url}
                        alt={`${teamSnapshots.away.team.name} logo`}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        LOGO
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Away Snapshot
                      </p>
                      <p className="truncate font-semibold text-slate-900">
                        {teamSnapshots.away.team.name}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Record</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.away.record}
                      </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Top Scorer</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.away.topScorerGoals > 0
                          ? `${teamSnapshots.away.topScorerName} (${teamSnapshots.away.topScorerGoals})`
                          : teamSnapshots.away.topScorerName}
                      </dd>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <dt className="font-semibold text-slate-500">Recent Form</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {teamSnapshots.away.recentForm}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>
          </div>

          {/* ----------------------------------------------- */}
          {/* SUMMARY TEXT */}
          {/* ----------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-xl font-bold text-slate-900">
              {isFinal ? 'Final Summary' : 'Live Updates'}
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              {isFinal
                ? 'This match has ended. The recap above summarizes the final score, goal events, cards, and full timeline.'
                : 'Leave this page open to follow the score, clock, and timeline as the match progresses.'}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------
// PUBLIC TEAM LINK
// ---------------------------------------------------

function PublicScoreboardTeamLink({
  team,
  href,
  align,
}: {
  team: Team | null;
  href: string;
  align: 'left' | 'right';
}) {
  if (!team) {
    return (
      <div className={`mt-2 ${align === 'right' ? 'text-right' : ''}`}>
        <h2 className="text-xl font-black leading-tight text-white md:text-2xl">
          {align === 'right' ? 'Away Team' : 'Home Team'}
        </h2>
      </div>
    );
  }

  if (align === 'right') {
    return (
      <Link
        href={href}
        className="mt-2 flex items-center justify-end gap-3 rounded-2xl transition hover:opacity-90"
      >
        <div className="text-right">
          <h2 className="text-xl font-black leading-tight text-white md:text-2xl">
            {team.name}
          </h2>
          <p className="mt-1 text-sm text-white/75">{team.club_name || ''}</p>
        </div>

        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt={`${team.name} logo`}
            className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/20"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-red-100 ring-1 ring-white/15">
            LOGO
          </div>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="mt-2 flex items-center gap-3 rounded-2xl transition hover:opacity-90"
    >
      {team.logo_url ? (
        <img
          src={team.logo_url}
          alt={`${team.name} logo`}
          className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/20"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-red-100 ring-1 ring-white/15">
          LOGO
        </div>
      )}

      <div>
        <h2 className="text-xl font-black leading-tight text-white md:text-2xl">
          {team.name}
        </h2>
        <p className="mt-1 text-sm text-white/75">{team.club_name || ''}</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------
// COLLAPSE PILL
// ---------------------------------------------------

function CollapsePill({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200"
    >
      {open ? (
        <>
          <ChevronUp className="h-4 w-4" />
          Hide
        </>
      ) : (
        <>
          <ChevronDown className="h-4 w-4" />
          Show
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------
// LINEUP LIST CARD
// ---------------------------------------------------

function LineupListCard({
  title,
  subtitle,
  players,
  accent,
  emptyText,
}: {
  title: string;
  subtitle: string;
  players: Player[];
  accent: 'blue' | 'rose';
  emptyText: string;
}) {
  const accentPill =
    accent === 'blue'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-rose-50 text-rose-700';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-slate-900">{title}</h4>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accentPill}`}>
          {players.length}
        </span>
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {playerDisplayName(player) || 'Unnamed Player'}
                </p>
                <p className="text-sm text-slate-500">
                  {player.position || 'No position'}
                </p>
              </div>

              <span className="text-sm font-bold text-slate-700">
                {player.jersey_number ? `#${player.jersey_number}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------
// STATUS PILL
// ---------------------------------------------------

function StatusPill({ status }: { status: Match['status'] }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-400/20">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Live
      </span>
    );
  }

  if (status === 'halftime') {
    return (
      <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300 ring-1 ring-amber-400/20">
        Halftime
      </span>
    );
  }

  if (status === 'final') {
    return (
      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/10">
        Final
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/80 ring-1 ring-white/10">
      Not Started
    </span>
  );
}

// ---------------------------------------------------
// PERIOD PILL
// ---------------------------------------------------

function PeriodPill({
  status,
  clockRunning,
  secondsElapsed,
}: {
  status: Match['status'];
  clockRunning: boolean;
  secondsElapsed: number;
}) {
  if (status === 'final') {
    return (
      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-100/80 ring-1 ring-white/10">
        Recap
      </span>
    );
  }

  if (status === 'halftime') {
    return (
      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-100/80 ring-1 ring-white/10">
        Halftime Break
      </span>
    );
  }

  if (status === 'not_started') {
    return (
      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-100/80 ring-1 ring-white/10">
        Pre-Match
      </span>
    );
  }

  const minute = Math.floor(secondsElapsed / 60);
  const halfLabel = minute >= 45 ? '2nd Half' : '1st Half';

  return (
    <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-100/80 ring-1 ring-white/10">
      {clockRunning ? halfLabel : 'Paused'}
    </span>
  );
}
