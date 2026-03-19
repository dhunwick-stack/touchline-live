'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { supabase } from '@/lib/supabase';
import {
  deriveCurrentOnField,
  getStartersForSide,
  isRenderableMatchEvent,
  playerDisplayName,
} from '@/components/public/publicMatchPageShared';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { MatchEvent, Player } from '@/lib/types';
import type {
  MatchLineupRow,
  PublicMatchRow,
} from '@/components/public/publicMatchPageShared';

type PageData = {
  match: PublicMatchRow;
  events: MatchEvent[];
  homePlayers: Player[];
  awayPlayers: Player[];
  lineups: MatchLineupRow[];
};

// ---------------------------------------------------
// HOOK
// FILE: components/public/usePublicMatchPage.ts
// ---------------------------------------------------

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  const [showStartingLineups, setShowStartingLineups] = useState(true);
  const [showOnFieldNow, setShowOnFieldNow] = useState(true);

  async function fetchMatchBySlug(currentSlug: string) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:home_team_id (*),
        away_team:away_team_id (*)
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
            const [refreshedMatch, refreshedEvents] = await Promise.all([
              fetchMatchBySlug(slug),
              fetchEvents(match.id),
            ]);

            setMatch(refreshedMatch);
            setEvents(refreshedEvents);
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
        record: 'Record coming next',
        topScorerName,
        topScorerGoals,
        recentForm: 'Form coming next',
      };
    }

    return {
      home: buildSnapshot('home'),
      away: buildSnapshot('away'),
    };
  }, [match, safeEvents, homePlayers, awayPlayers]);

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
  };
}
