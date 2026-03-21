import { calculateMinutesPlayed } from '@/lib/matchStats';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Match, MatchEvent, Player } from '@/lib/types';
import {
  buildRecentForm,
  buildTeamRecordSummary,
  formatEventMinute,
  formatMatchDate,
  formatTeamRecord,
  getAppleMapsUrl,
  getVenueAddress,
  getVenueName,
  playerDisplayName,
  type MatchLineupRow,
  type PublicMatchRow,
} from '@/components/public/publicMatchPageShared';

type FinalRecapSection = {
  title: string;
  items: string[];
};

type FinalRecap = {
  headline: string;
  sections: FinalRecapSection[];
};

type MinutesRow = {
  player: Player;
  minutes: number;
};

type EmailPayload = {
  match: PublicMatchRow;
  finalRecap: FinalRecap;
  homeMinutes: MinutesRow[];
  awayMinutes: MinutesRow[];
  recipientEmails: string[];
  publicUrl: string | null;
  adminUrl: string;
};

const PUBLIC_MATCH_TEAM_RELATION_SELECT = `
  home_team:home_team_id (*),
  away_team:away_team_id (*)
`;

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
  if (wins <= 0) return `${teamName} beat ${opponentName} ${score}.`;
  return `${ordinalWord(wins)} win for ${teamName}, beating ${opponentName} ${score}.`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function getRecipientEmails(match: Match) {
  const supabaseAdmin = getSupabaseAdmin();
  const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];

  const [{ data: teamUsers }, { data: superAdmins }] = await Promise.all([
    teamIds.length
      ? supabaseAdmin.from('team_users').select('user_id').in('team_id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('super_admin_users').select('user_id'),
  ]);

  const userIds = Array.from(
    new Set([...(teamUsers ?? []), ...(superAdmins ?? [])].map((row) => row.user_id).filter(Boolean)),
  );

  const emails = new Set<string>();

  for (const userId of userIds) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!error && data.user.email) {
      emails.add(data.user.email.toLowerCase());
    }
  }

  return Array.from(emails);
}

function buildFinalRecap(params: {
  match: PublicMatchRow;
  events: MatchEvent[];
  homePlayers: Player[];
  awayPlayers: Player[];
  teamFinalMatches: Match[];
}) {
  const { match, events, homePlayers, awayPlayers, teamFinalMatches } = params;
  const safeEvents = events.filter((event) => Boolean(event?.event_type));
  const goalEvents = safeEvents
    .filter((event) => event.event_type === 'goal')
    .slice()
    .reverse();
  const cardEvents = safeEvents
    .filter((event) => event.event_type === 'yellow_card' || event.event_type === 'red_card')
    .slice()
    .reverse();

  function buildSnapshot(side: 'home' | 'away') {
    const team = side === 'home' ? match.home_team : match.away_team;
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
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
      if (count <= topScorerGoals) continue;
      topScorerGoals = count;
      if (key.startsWith('override:')) {
        topScorerName = key.replace('override:', '') || 'Unknown';
      } else {
        const roster = side === 'home' ? homePlayers : awayPlayers;
        topScorerName = playerDisplayName(roster.find((player) => player.id === key)) || 'Unknown';
      }
    }

    return {
      team,
      recordSummary,
      record: formatTeamRecord(recordSummary),
      recentForm: recentForm.length > 0 ? recentForm.join(' ') : 'No final matches yet',
      topScorerName,
      topScorerGoals,
    };
  }

  const teamSnapshots = {
    home: buildSnapshot('home'),
    away: buildSnapshot('away'),
  };

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
    summaryItems.push(`${homeTeamName} and ${awayTeamName} finished level at ${match.home_score}-${match.away_score}.`);
  }

  if (goalEvents.length > 0) {
    summaryItems.push(
      ...goalEvents.map((event) => {
        const roster = event.team_side === 'home' ? homePlayers : awayPlayers;
        const player = roster.find((candidate) => candidate.id === event.player_id);
        const teamName = event.team_side === 'home' ? homeTeamName : awayTeamName;
        const scorerName = event.player_name_override || playerDisplayName(player) || teamName;
        return `${teamName} at ${formatEventMinute(event.minute)} by ${scorerName}`;
      }),
    );
  } else {
    summaryItems.push('No goals were recorded.');
  }

  if (winningSnapshot?.recordSummary) {
    summaryItems.push(`${winningSnapshot.team.name} now sits at ${formatTeamRecord(winningSnapshot.recordSummary)}.`);
  }

  const disciplineItems =
    cardEvents.length > 0
      ? cardEvents.map((event) => {
          const roster = event.team_side === 'home' ? homePlayers : awayPlayers;
          const player = roster.find((candidate) => candidate.id === event.player_id);
          const teamName = event.team_side === 'home' ? homeTeamName : awayTeamName;
          const label = event.event_type === 'red_card' ? 'Red card' : 'Yellow card';
          const playerName = event.player_name_override || playerDisplayName(player) || teamName;
          return `${label} for ${teamName} at ${formatEventMinute(event.minute)} to ${playerName}.`;
        })
      : ['No cards were recorded.'];

  let headline = `${homeTeamName} and ${awayTeamName} finished ${match.home_score}-${match.away_score}.`;

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

  return {
    finalRecap: {
      headline,
      sections: [
        { title: 'Score Recap', items: summaryItems },
        { title: 'Discipline', items: disciplineItems },
      ],
    },
    teamSnapshots,
    safeEvents,
  };
}

function buildMinutesRows(params: {
  match: Match;
  side: 'home' | 'away';
  players: Player[];
  lineups: MatchLineupRow[];
  events: MatchEvent[];
}) {
  const { match, side, players, lineups, events } = params;
  const trackingMode = side === 'home' ? match.home_tracking_mode : match.away_tracking_mode;
  if (trackingMode !== 'full') return [];

  const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
  const starterIds = lineups
    .filter((lineup) => lineup.team_id === teamId && lineup.is_starter)
    .map((lineup) => lineup.player_id);

  return players
    .map((player) => ({
      player,
      minutes: calculateMinutesPlayed({
        match,
        events,
        playerId: player.id,
        teamSide: side,
        startingPlayerIds: starterIds,
      }),
    }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => {
      if (b.minutes !== a.minutes) return b.minutes - a.minutes;
      const aNumber = a.player.jersey_number ?? 999;
      const bNumber = b.player.jersey_number ?? 999;
      if (aNumber !== bNumber) return aNumber - bNumber;
      return playerDisplayName(a.player).localeCompare(playerDisplayName(b.player));
    });
}

export async function buildFinalRecapEmailPayload(matchId: string): Promise<EmailPayload> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: matchData, error: matchError } = await supabaseAdmin
    .from('matches')
    .select(`*, ${PUBLIC_MATCH_TEAM_RELATION_SELECT}`)
    .eq('id', matchId)
    .single();

  if (matchError || !matchData) {
    throw new Error(matchError?.message || 'Match not found.');
  }

  const match = matchData as PublicMatchRow;

  const [eventsResult, lineupsResult, homePlayersResult, awayPlayersResult, finalMatchesResult] =
    await Promise.all([
      supabaseAdmin.from('match_events').select('*').eq('match_id', match.id).order('created_at', { ascending: false }),
      supabaseAdmin.from('match_lineups').select(`*, player:player_id (*)`).eq('match_id', match.id),
      match.home_team_id
        ? supabaseAdmin.from('players').select('*').eq('team_id', match.home_team_id)
        : Promise.resolve({ data: [], error: null }),
      match.away_team_id
        ? supabaseAdmin.from('players').select('*').eq('team_id', match.away_team_id)
        : Promise.resolve({ data: [], error: null }),
      (() => {
        const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];
        if (teamIds.length === 0) return Promise.resolve({ data: [], error: null });
        const orFilter = teamIds.flatMap((teamId) => [`home_team_id.eq.${teamId}`, `away_team_id.eq.${teamId}`]).join(',');
        return supabaseAdmin
          .from('matches')
          .select('*')
          .or(orFilter)
          .eq('status', 'final')
          .order('match_date', { ascending: false, nullsFirst: false });
      })(),
    ]);

  const error =
    eventsResult.error ||
    lineupsResult.error ||
    homePlayersResult.error ||
    awayPlayersResult.error ||
    finalMatchesResult.error;

  if (error) {
    throw new Error(error.message || 'Failed to load final recap email data.');
  }

  const events = (eventsResult.data as MatchEvent[]) ?? [];
  const lineups = (lineupsResult.data as MatchLineupRow[]) ?? [];
  const homePlayers = (homePlayersResult.data as Player[]) ?? [];
  const awayPlayers = (awayPlayersResult.data as Player[]) ?? [];
  const teamFinalMatches = (finalMatchesResult.data as Match[]) ?? [];

  const { finalRecap, safeEvents } = buildFinalRecap({
    match,
    events,
    homePlayers,
    awayPlayers,
    teamFinalMatches,
  });

  const homeMinutes = buildMinutesRows({
    match,
    side: 'home',
    players: homePlayers,
    lineups,
    events: safeEvents,
  });
  const awayMinutes = buildMinutesRows({
    match,
    side: 'away',
    players: awayPlayers,
    lineups,
    events: safeEvents,
  });

  const recipientEmails = await getRecipientEmails(match);
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://touchline-live.com';

  return {
    match,
    finalRecap,
    homeMinutes,
    awayMinutes,
    recipientEmails,
    publicUrl: match.public_slug ? `${appBaseUrl}/public/${match.public_slug}` : null,
    adminUrl: `${appBaseUrl}/matches/${match.id}/edit`,
  };
}

function renderMinutesTable(title: string, rows: MinutesRow[], trackingMode: Match['home_tracking_mode']) {
  if (trackingMode !== 'full') {
    return `<h3>${escapeHtml(title)}</h3><p>Minutes played unavailable because this team was not tracked in full mode.</p>`;
  }

  if (rows.length === 0) {
    return `<h3>${escapeHtml(title)}</h3><p>No minutes recorded.</p>`;
  }

  const tableRows = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 10px;border-top:1px solid #e2e8f0;">${escapeHtml(playerDisplayName(row.player) || 'Unknown Player')}</td>
          <td style="padding:8px 10px;border-top:1px solid #e2e8f0;text-align:right;font-weight:700;">${row.minutes}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <h3>${escapeHtml(title)}</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px;text-align:left;">Player</th>
          <th style="padding:10px;text-align:right;">Minutes</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

export function renderFinalRecapEmail(payload: EmailPayload) {
  const { match, finalRecap, homeMinutes, awayMinutes, publicUrl, adminUrl } = payload;
  const homeName = match.home_team?.name || 'Home Team';
  const awayName = match.away_team?.name || 'Away Team';
  const venueName = getVenueName(match);
  const venueAddress = getVenueAddress(match);
  const directionsUrl = venueAddress ? getAppleMapsUrl(venueAddress) : null;

  const sectionHtml = finalRecap.sections
    .map(
      (section) => `
        <section style="margin-top:24px;">
          <h3 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${escapeHtml(section.title)}</h3>
          <ul style="margin:0;padding-left:20px;color:#334155;line-height:1.7;">
            ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </section>
      `,
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#64748b;">Touchline Live Final Recap</p>
        <h1 style="margin:0;font-size:32px;line-height:1.1;">${escapeHtml(homeName)} ${match.home_score}-${match.away_score} ${escapeHtml(awayName)}</h1>
        <p style="margin:16px 0 0;font-size:18px;font-weight:700;color:#1e293b;">${escapeHtml(finalRecap.headline)}</p>

        <div style="margin-top:20px;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
          <p style="margin:0 0 6px;"><strong>Date:</strong> ${escapeHtml(match.match_date ? formatMatchDate(match.match_date) : 'Date TBD')}</p>
          <p style="margin:0 0 6px;"><strong>Venue:</strong> ${escapeHtml(venueName)}</p>
          <p style="margin:0;">
            <strong>Links:</strong>
            ${publicUrl ? `<a href="${publicUrl}" style="color:#0f766e;">Public recap</a>` : 'Public recap unavailable'}
            &nbsp;|&nbsp;
            <a href="${adminUrl}" style="color:#0f766e;">Admin match page</a>
            ${directionsUrl ? `&nbsp;|&nbsp;<a href="${directionsUrl}" style="color:#0f766e;">Directions</a>` : ''}
          </p>
        </div>

        ${sectionHtml}

        <section style="margin-top:28px;">
          <h2 style="margin:0 0 14px;font-size:22px;">Minutes Played</h2>
          <div style="display:grid;gap:16px;">
            ${renderMinutesTable(`${homeName} Minutes`, homeMinutes, match.home_tracking_mode)}
            ${renderMinutesTable(`${awayName} Minutes`, awayMinutes, match.away_tracking_mode)}
          </div>
        </section>
      </div>
    </div>
  `;

  const text = [
    `Touchline Live Final Recap`,
    `${homeName} ${match.home_score}-${match.away_score} ${awayName}`,
    finalRecap.headline,
    '',
    `Date: ${match.match_date ? formatMatchDate(match.match_date) : 'Date TBD'}`,
    `Venue: ${venueName}`,
    publicUrl ? `Public recap: ${publicUrl}` : null,
    `Admin match page: ${adminUrl}`,
    '',
    ...finalRecap.sections.flatMap((section) => [section.title, ...section.items.map((item) => `- ${item}`), '']),
    'Minutes Played',
    match.home_tracking_mode === 'full'
      ? `${homeName}: ${homeMinutes.map((row) => `${playerDisplayName(row.player)} ${row.minutes}`).join(', ')}`
      : `${homeName}: unavailable (not full tracking)`,
    match.away_tracking_mode === 'full'
      ? `${awayName}: ${awayMinutes.map((row) => `${playerDisplayName(row.player)} ${row.minutes}`).join(', ')}`
      : `${awayName}: unavailable (not full tracking)`,
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
}
