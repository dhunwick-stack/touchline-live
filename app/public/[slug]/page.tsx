'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import Link from 'next/link';
import usePublicMatchPage from '@/components/public/usePublicMatchPage';
import { ChevronDown, ChevronUp, CircleDot, Pause, Shield, Trophy } from 'lucide-react';
import TimelineEventCard from '@/components/live/TimelineEventCard';
import type { Match, Player, Team } from '@/lib/types';
import {
  formatMatchDate,
  getAppleMapsUrl,
  getVenueAddress,
  getVenueName,
  playerDisplayName,
  prettyStatus,
} from '@/components/public/publicMatchPageShared';

// ---------------------------------------------------
// PAGE
// ---------------------------------------------------

export default function PublicMatchPage() {
  const {
    match,
    loading,
    error,
    connectionNotice,
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
    finalRecap,
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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
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

      <section className="relative left-1/2 right-1/2 -mx-[50vw] w-screen overflow-hidden bg-gradient-to-b from-red-900 to-[#7f1d1d] text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:px-10 lg:px-14">
          <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)_minmax(0,1fr)] md:gap-6">
            <div className="order-1 min-w-0 text-center md:order-none md:text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
                Home
              </p>

              <PublicScoreboardTeamLink
                team={match.home_team}
                href={match.home_team ? `/public/team/${match.home_team.id}` : '#'}
                align="left"
              />
            </div>

            <div className="order-2 min-w-0 text-center md:order-none">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <StatusPill status={match.status} />
                <PeriodPill
                  status={match.status}
                  clockRunning={match.clock_running}
                  secondsElapsed={secondsElapsed}
                />
              </div>

              <div className="mt-4 inline-flex w-full max-w-[220px] flex-col items-center self-center rounded-[24px] border border-white/15 bg-white/10 px-4 py-3 shadow-2xl backdrop-blur-md sm:mt-5 sm:max-w-[280px] sm:px-6 sm:py-5 md:max-w-[320px] md:rounded-[28px] md:px-8 md:py-6">
                <div className="text-[2.5rem] font-black tracking-tight tabular-nums text-white sm:text-6xl md:text-7xl">
                  {match.home_score} - {match.away_score}
                </div>

                <div className="mt-1.5 text-base font-semibold tabular-nums text-white/90 sm:mt-3 sm:text-2xl md:text-3xl">
                  {formattedClock}
                </div>
              </div>

              <div className="mt-3 space-y-1 sm:mt-4">
                <div className="break-words text-sm font-medium text-white/90">
                  {match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}
                </div>
                <div className="break-words text-sm text-white/75">{getVenueName(match)}</div>
              </div>
            </div>

            <div className="order-3 min-w-0 text-center md:order-none md:text-right">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
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

      <div className="mt-6 space-y-6 overflow-x-hidden">
        {connectionNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {connectionNotice}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-800 to-red-900 p-[1px] shadow-sm">
          <div className="rounded-[calc(1.5rem-1px)] bg-gradient-to-b from-slate-50 via-white to-red-50 p-4 ring-1 ring-white/70 sm:p-6">
            <div className="flex flex-wrap items-start gap-2 text-sm text-slate-600">
              <InlineStat label="Status" value={prettyStatus(match.status)} />
              <InlineStat label="Clock" value={formattedClock} mono />
              <InlineStat
                label="Date"
                value={match.match_date ? formatMatchDate(match.match_date) : 'TBD'}
              />
              <InlineStat label="Venue" value={getVenueName(match)} />
              {getVenueAddress(match) ? (
                <a
                  href={getAppleMapsUrl(getVenueAddress(match)!)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
                >
                  Get Directions
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="min-w-0 flex flex-col gap-6 self-start">
          {/* ----------------------------------------------- */}
          {/* FINAL RECAP SUMMARY */}
          {/* ----------------------------------------------- */}

          {isFinal ? (
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Match Story</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    A written recap of the result, key moments, discipline, and final record
                    impact.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                  Final
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                {finalRecap ? (
                  <div className="space-y-5">
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <p className="text-base font-black leading-8 text-slate-950 md:text-lg">
                          {finalRecap.headline}
                        </p>
                      </div>
                    </div>

                    {finalRecap.sections.map((section, sectionIndex) => (
                      <div
                        key={section.title}
                        className={sectionIndex === 0 ? '' : 'border-t border-slate-200 pt-5'}
                      >
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-slate-200 p-2 text-slate-700">
                            {section.title === 'Score Recap' ? (
                              <CircleDot className="h-4 w-4" />
                            ) : section.title === 'Delays' ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </div>
                          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                            {section.title}
                          </h4>
                        </div>

                        <div className="mt-4 space-y-3">
                          {section.items.map((item, index) => (
                            <p key={`${section.title}-${index}`} className="text-sm leading-7 text-slate-700">
                              {renderRecapItem(item)}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    This match has ended. The recap above summarizes the final score,
                    goal events, cards, and full timeline.
                  </p>
                )}
              </div>
            </div>
          ) : null}

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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
        </div>

        <div className="min-w-0 flex flex-col gap-6 self-start">
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
          {/* STARTING LINEUPS */}
          {/* ----------------------------------------------- */}

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
            <div className="flex flex-wrap items-start justify-between gap-3">
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
                    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
                      <dt className="font-semibold text-slate-500">Record</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-900">
                        {teamSnapshots.home.record}
                      </dd>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
                      <dt className="font-semibold text-slate-500">Top Scorer</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-900">
                        {teamSnapshots.home.topScorerGoals > 0
                          ? `${teamSnapshots.home.topScorerName} (${teamSnapshots.home.topScorerGoals})`
                          : teamSnapshots.home.topScorerName}
                      </dd>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
                      <dt className="font-semibold text-slate-500">Recent Form</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-900">
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
                    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
                      <dt className="font-semibold text-slate-500">Record</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-900">
                        {teamSnapshots.away.record}
                      </dd>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
                      <dt className="font-semibold text-slate-500">Top Scorer</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-900">
                        {teamSnapshots.away.topScorerGoals > 0
                          ? `${teamSnapshots.away.topScorerName} (${teamSnapshots.away.topScorerGoals})`
                          : teamSnapshots.away.topScorerName}
                      </dd>
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
                      <dt className="font-semibold text-slate-500">Recent Form</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-900">
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
            {isFinal ? (
              <p className="mt-3 text-sm text-slate-600">
                The written recap now appears at the top of the post-match timeline, with
                goals, cards, and the full event log below it.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Leave this page open to follow the score, clock, and timeline as the
                match progresses.
              </p>
            )}
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}

function InlineStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full bg-white/80 px-3 py-1 text-xs ring-1 ring-slate-200">
      <span className="font-semibold text-slate-500">{label}:</span>
      <span className={`min-w-0 break-words font-bold text-slate-900 ${mono ? 'tabular-nums' : ''}`}>
        {value}
      </span>
    </span>
  );
}

function renderRecapItem(value: string) {
  const parts = value.split(/(\d+'|\d+-\d+)/g).filter(Boolean);

  return parts.map((part, index) =>
    /^\d+'$|^\d+-\d+$/.test(part) ? <strong key={`${part}-${index}`}>{part}</strong> : part,
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
        className="mt-2 flex w-full min-w-0 flex-col items-center gap-2 rounded-2xl text-center transition hover:opacity-90 md:flex-row md:items-start md:justify-end md:gap-3 md:text-right"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black leading-tight text-white sm:text-xl md:text-2xl">
            {team.name}
          </h2>
          <p className="mt-1 text-sm text-white/75">{team.club_name || ''}</p>
        </div>

        {team.logo_url ? (
          <img
            src={team.logo_url}
            alt={`${team.name} logo`}
            className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/20 sm:h-16 sm:w-16"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-red-100 ring-1 ring-white/15 sm:h-16 sm:w-16">
            LOGO
          </div>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="mt-2 flex w-full min-w-0 flex-col items-center gap-2 rounded-2xl text-center transition hover:opacity-90 md:flex-row md:items-start md:justify-start md:gap-3 md:text-left"
    >
      {team.logo_url ? (
        <img
          src={team.logo_url}
          alt={`${team.name} logo`}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/20 sm:h-16 sm:w-16"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xs font-bold text-red-100 ring-1 ring-white/15 sm:h-16 sm:w-16">
          LOGO
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-black leading-tight text-white sm:text-xl md:text-2xl">
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
      <span className="inline-flex rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white ring-1 ring-red-500/70">
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
