'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { supabase } from '@/lib/supabase';
import {
  buildRecentForm,
  buildTeamRecordSummary,
  deriveCurrentOnField,
  formatEventMinute,
  formatTeamRecord,
  getStartersForSide,
  isRenderableMatchEvent,
  playerDisplayName,
} from '@/components/public/publicMatchPageShared';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Match, MatchEvent, Player } from '@/lib/types';
import type {
  MatchLineupRow,
  PublicMatchRow,
} from '@/components/public/publicMatchPageShared';
import { PUBLIC_MATCH_TEAM_RELATION_SELECT } from '@/lib/team-selects';

type PageData = {
  match: PublicMatchRow;
  events: MatchEvent[];
  homePlayers: Player[];
  awayPlayers: Player[];
  lineups: MatchLineupRow[];
};

type FinalRecapSection = {
  title: string;
  items: string[];
};

type FinalRecap = {
  headline: string;
  sections: FinalRecapSection[];
};

// ---------------------------------------------------
// HOOK
// FILE: components/public/usePublicMatchPage.ts
// ---------------------------------------------------

function ordinalWord(value: number) {
  const map: Record<number, string> = {
    1: 'First',
    2: 'Second',
    3: 'Third',
    4: 'Fourth',
    5: 'Fifth',
    6: 'Sixth',
    7: 'Seventh',
    8: 'Eighth',
    9: 'Ninth',
    10: 'Tenth',
  };

  if (map[value]) return map[value];

  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
}

function buildWinHeadline(teamName: string, wins: number, opponentName: string, score: string) {
  if (wins <= 0) {
    return `${teamName} beat ${opponentName} ${score}.`;
  }

  return `${ordinalWord(wins)} win for ${teamName}, beating ${opponentName} ${score}.`;
}

export default function usePublicMatchPage() {
  const params = useParams();

  const slug =
    typeof params?.slug === 'string'
      ? params.slug
      : Array.isArray(params?.slug)
        ? params.slug[0]
        : '';

  const [match, setMatch] = useState<PublicMatchRow | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [lineups, setLineups] = useState<MatchLineupRow[]>([]);
  const [teamFinalMatches, setTeamFinalMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  const [showStartingLineups, setShowStartingLineups] = useState(false);
  const [showOnFieldNow, setShowOnFieldNow] = useState(false);

  async function fetchMatchBySlug(currentSlug: string) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        ${PUBLIC_MATCH_TEAM_RELATION_SELECT}
      `)
      .eq('public_slug', currentSlug)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Match not found.');
    }

    return data as PublicMatchRow;
  }

  async function fetchEvents(matchId: string) {
    const { data, error } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as MatchEvent[]) ?? [];
  }

  async function fetchPlayers(matchRow: PublicMatchRow) {
    const homePlayersResult =
      matchRow.home_team_id && matchRow.home_team_id !== 'undefined'
        ? await supabase
            .from('players')
            .select('*')
            .eq('team_id', matchRow.home_team_id)
            .order('jersey_number', { ascending: true, nullsFirst: false })
            .order('first_name', { ascending: true })
        : { data: [], error: null };

    const awayPlayersResult =
      matchRow.away_team_id && matchRow.away_team_id !== 'undefined'
        ? await supabase
            .from('players')
            .select('*')
            .eq('team_id', matchRow.away_team_id)
            .order('jersey_number', { ascending: true, nullsFirst: false })
            .order('first_name', { ascending: true })
        : { data: [], error: null };

    if (homePlayersResult.error || awayPlayersResult.error) {
      throw new Error(
        homePlayersResult.error?.message ||
          awayPlayersResult.error?.message ||
          'Failed to load players.',
      );
    }

    return {
      homePlayers: (homePlayersResult.data as Player[]) ?? [],
      awayPlayers: (awayPlayersResult.data as Player[]) ?? [],
    };
  }

  async function fetchLineups(matchId: string) {
    const { data } = await supabase
      .from('match_lineups')
      .select(`
        *,
        player:player_id (*)
      `)
      .eq('match_id', matchId);

    return (data as MatchLineupRow[]) ?? [];
  }

  async function fetchTeamFinalMatches(matchRow: PublicMatchRow) {
    const teamIds = [matchRow.home_team_id, matchRow.away_team_id].filter(
      (teamId): teamId is string => Boolean(teamId && teamId !== 'undefined'),
    );

    if (teamIds.length === 0) {
      return [];
    }

    const orFilter = teamIds
      .flatMap((teamId) => [`home_team_id.eq.${teamId}`, `away_team_id.eq.${teamId}`])
      .join(',');

    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(orFilter)
      .eq('status', 'final')
      .order('match_date', { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as Match[]) ?? [];
  }

  async function loadPageData(currentSlug: string): Promise<PageData> {
    const match = await fetchMatchBySlug(currentSlug);
    const [events, players, lineups] = await Promise.all([
      fetchEvents(match.id),
      fetchPlayers(match),
      fetchLineups(match.id),
    ]);

    return {
      match,
      events,
      homePlayers: players.homePlayers,
      awayPlayers: players.awayPlayers,
      lineups,
    };
  }

  function applyPageData(data: PageData) {
    setMatch(data.match);
    setEvents(data.events);
    setHomePlayers(data.homePlayers);
    setAwayPlayers(data.awayPlayers);
    setLineups(data.lineups);
  }

  useEffect(() => {
    let mounted = true;

    async function initialLoad() {
      if (!slug) {
        if (mounted) {
          setError('No public match slug was found in the URL.');
          setLoading(false);
        }
        return;
      }

      try {
        if (mounted) {
          setError('');
          setLoading(true);
        }

        const data = await loadPageData(slug);

        if (!mounted) return;

        applyPageData(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load scoreboard.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialLoad();

    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamFinalMatches() {
      if (!match?.id || !match.home_team_id || !match.away_team_id) {
        if (!cancelled) {
          setTeamFinalMatches([]);
        }
        return;
      }

      try {
        const finalMatches = await fetchTeamFinalMatches(match);

        if (!cancelled) {
          setTeamFinalMatches(finalMatches);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load team records.');
        }
      }
    }

    loadTeamFinalMatches();

    return () => {
      cancelled = true;
    };
  }, [match?.id, match?.home_team_id, match?.away_team_id]);

  useEffect(() => {
    if (!match?.id || !slug) return;

    const channel = supabase
      .channel(`public-match-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`,
        },
        async () => {
          try {
            const refreshedMatch = await fetchMatchBySlug(slug);
            const teamsChanged =
              refreshedMatch.home_team_id !== match.home_team_id ||
              refreshedMatch.away_team_id !== match.away_team_id;

            setMatch(refreshedMatch);

            if (teamsChanged) {
              const [players, refreshedLineups] = await Promise.all([
                fetchPlayers(refreshedMatch),
                fetchLineups(refreshedMatch.id),
              ]);

              setHomePlayers(players.homePlayers);
              setAwayPlayers(players.awayPlayers);
              setLineups(refreshedLineups);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Realtime refresh failed.');
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${match.id}`,
        },
        async () => {
          try {
            const data = await loadPageData(slug);
            applyPageData(data);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Realtime refresh failed.');
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_lineups',
          filter: `match_id=eq.${match.id}`,
        },
        async () => {
          try {
            const refreshedLineups = await fetchLineups(match.id);
            setLineups(refreshedLineups);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Realtime refresh failed.');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match?.id, slug]);

  useEffect(() => {
    if (!match?.clock_running) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [match?.clock_running]);

  useEffect(() => {
    if (!match?.id || !slug) return;
    if (match.status !== 'live' && match.status !== 'halftime') return;

    let cancelled = false;

    const poller = window.setInterval(async () => {
      if (document.visibilityState === 'hidden') return;

      try {
        const data = await loadPageData(slug);
        if (!cancelled) {
          applyPageData(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Polling refresh failed.');
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [match?.id, match?.status, slug]);

  const secondsElapsed = useMemo(() => {
    if (!match) return 0;

    const base = match.elapsed_seconds || 0;

    if (!match.clock_running || !match.period_started_at) {
      return base;
    }

    const startedMs = new Date(match.period_started_at).getTime();
    const deltaSeconds = Math.max(0, Math.floor((nowMs - startedMs) / 1000));

    return base + deltaSeconds;
  }, [match, nowMs]);

  const formattedClock = useMemo(() => {
    const mins = Math.floor(secondsElapsed / 60)
      .toString()
      .padStart(2, '0');
    const secs = (secondsElapsed % 60).toString().padStart(2, '0');

    return `${mins}:${secs}`;
  }, [secondsElapsed]);

  const safeEvents = useMemo(() => {
    return events.filter(isRenderableMatchEvent);
  }, [events]);

  const goalEvents = useMemo(
    () => safeEvents.filter((event) => event.event_type === 'goal').slice().reverse(),
    [safeEvents],
  );

  const cardEvents = useMemo(
    () =>
      safeEvents
        .filter(
          (event) => event.event_type === 'yellow_card' || event.event_type === 'red_card',
        )
        .slice()
        .reverse(),
    [safeEvents],
  );

  const homeStarters = useMemo(
    () => (match ? getStartersForSide({ lineups, side: 'home', match }) : []),
    [lineups, match],
  );

  const awayStarters = useMemo(
    () => (match ? getStartersForSide({ lineups, side: 'away', match }) : []),
    [lineups, match],
  );

  const hasStartingLineups = homeStarters.length > 0 || awayStarters.length > 0;

  const currentOnField = useMemo(() => {
    if (!match) {
      return { home: [] as Player[], away: [] as Player[] };
    }

    return {
      home: deriveCurrentOnField({
        side: 'home',
        lineups,
        events: safeEvents,
        roster: homePlayers,
        match,
      }),
      away: deriveCurrentOnField({
        side: 'away',
        lineups,
        events: safeEvents,
        roster: awayPlayers,
        match,
      }),
    };
  }, [lineups, safeEvents, homePlayers, awayPlayers, match]);

  const hasOnFieldView =
    currentOnField.home.length > 0 || currentOnField.away.length > 0;

  const teamSnapshots = useMemo(() => {
    function buildSnapshot(side: 'home' | 'away') {
      const team = side === 'home' ? match?.home_team : match?.away_team;
      const teamId = side === 'home' ? match?.home_team_id : match?.away_team_id;

      if (!team || !teamId) return null;

      const teamGoalEvents = safeEvents.filter(
        (event) => event.team_id === teamId && event.event_type === 'goal',
      );

      const scorerCounts = new Map<string, number>();

      for (const event of teamGoalEvents) {
        const key = event.player_id || `override:${event.player_name_override || 'unknown'}`;
        scorerCounts.set(key, (scorerCounts.get(key) || 0) + 1);
      }

      let topScorerName = 'No scorer yet';
      let topScorerGoals = 0;
      const recordSummary = buildTeamRecordSummary(teamFinalMatches, teamId);
      const recentForm = buildRecentForm(teamFinalMatches, teamId);

      for (const [key, count] of scorerCounts.entries()) {
        if (count > topScorerGoals) {
          topScorerGoals = count;

          if (key.startsWith('override:')) {
            topScorerName = key.replace('override:', '') || 'Unknown';
          } else {
            const roster = side === 'home' ? homePlayers : awayPlayers;
            const player = roster.find((p) => p.id === key);
            topScorerName = playerDisplayName(player) || 'Unknown';
          }
        }
      }

      return {
        side,
        team,
        record: formatTeamRecord(recordSummary),
        recordSummary,
        topScorerName,
        topScorerGoals,
        recentForm: recentForm.length > 0 ? recentForm.join(' ') : 'No final matches yet',
      };
    }

    return {
      home: buildSnapshot('home'),
      away: buildSnapshot('away'),
    };
  }, [match, safeEvents, homePlayers, awayPlayers, teamFinalMatches]);

  const finalRecap = useMemo<FinalRecap | null>(() => {
    if (!match || match.status !== 'final') return null;

    const homeTeamName = match.home_team?.name || 'Home';
    const awayTeamName = match.away_team?.name || 'Away';
    const homeWon = match.home_score > match.away_score;
    const awayWon = match.away_score > match.home_score;
    const winningSnapshot = homeWon ? teamSnapshots.home : awayWon ? teamSnapshots.away : null;
    const summaryItems: string[] = [];

    if (homeWon) {
      summaryItems.push(`${homeTeamName} finished with a ${match.home_score}-${match.away_score} result.`);
    } else if (awayWon) {
      summaryItems.push(`${awayTeamName} finished with a ${match.away_score}-${match.home_score} result.`);
    } else {
      summaryItems.push(
        `${homeTeamName} and ${awayTeamName} finished level at ${match.home_score}-${match.away_score}.`,
      );
    }

    if (goalEvents.length > 0) {
      const goalDetails = goalEvents.map((event) => {
        const roster = event.team_side === 'home' ? homePlayers : awayPlayers;
        const player = roster.find((candidate) => candidate.id === event.player_id);
        const teamName = event.team_side === 'home' ? homeTeamName : awayTeamName;
        const scorerName =
          event.player_name_override ||
          playerDisplayName(player) ||
          teamName;

        return `${teamName} at ${formatEventMinute(event.minute)} by ${scorerName}`;
      });

      summaryItems.push(...goalDetails);
    } else {
      summaryItems.push('No goals were recorded.');
    }

    if (winningSnapshot?.recordSummary) {
      summaryItems.push(
        `${winningSnapshot.team.name} now sits at ${formatTeamRecord(winningSnapshot.recordSummary)}.`,
      );
    }

    const chronologicalEvents = safeEvents.slice().reverse();
    const delayDetails: string[] = [];

    for (let index = 0; index < chronologicalEvents.length; index += 1) {
      const event = chronologicalEvents[index];

      if (event.event_type !== 'match_paused') continue;

      const resumedEvent = chronologicalEvents
        .slice(index + 1)
        .find((candidate) => candidate.event_type === 'match_resumed');

      const hasDuration =
        Number.isFinite(event.minute) && Number.isFinite(resumedEvent?.minute);
      const duration = hasDuration ? Math.max(0, (resumedEvent?.minute || 0) - event.minute) : null;
      const detail =
        duration && duration > 0
          ? `a ${duration}-minute delay at ${formatEventMinute(event.minute)}`
          : `a delay at ${formatEventMinute(event.minute)}`;

      delayDetails.push(event.notes ? `${detail} (${event.notes})` : detail);
    }

    const disciplineDetails = cardEvents.map((event) => {
      const roster = event.team_side === 'home' ? homePlayers : awayPlayers;
      const player = roster.find((candidate) => candidate.id === event.player_id);
      const teamName = event.team_side === 'home' ? homeTeamName : awayTeamName;
      const playerName =
        event.player_name_override || playerDisplayName(player) || teamName;
      const cardLabel = event.event_type === 'yellow_card' ? 'Yellow card' : 'Red card';

      return `${cardLabel} to ${playerName} of ${teamName} at ${formatEventMinute(event.minute)}`;
    });

    let headline = `${homeTeamName} and ${awayTeamName} played to a ${match.home_score}-${match.away_score} draw.`;

    if (homeWon && winningSnapshot?.recordSummary) {
      headline = buildWinHeadline(
        homeTeamName,
        winningSnapshot.recordSummary.wins,
        awayTeamName,
        `${match.home_score}-${match.away_score}`,
      );
    } else if (awayWon && winningSnapshot?.recordSummary) {
      headline = buildWinHeadline(
        awayTeamName,
        winningSnapshot.recordSummary.wins,
        homeTeamName,
        `${match.away_score}-${match.home_score}`,
      );
    }

    const sections: FinalRecapSection[] = [
      {
        title: 'Score Recap',
        items: summaryItems,
      },
    ];

    if (delayDetails.length > 0) {
      sections.push({
        title: 'Delays',
        items: delayDetails,
      });
    }

    if (disciplineDetails.length > 0) {
      sections.push({
        title: 'Discipline',
        items: disciplineDetails,
      });
    }

    return {
      headline,
      sections,
    };
  }, [cardEvents, goalEvents, homePlayers, awayPlayers, match, safeEvents, teamSnapshots]);

  return {
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
    finalRecap,
  };
}
