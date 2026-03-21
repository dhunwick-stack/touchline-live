import { NextResponse } from 'next/server';
import { buildFinalRecapEmailPayload, renderFinalRecapEmail } from '@/lib/finalRecapEmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type Params = {
  params: Promise<{
    matchId: string;
  }>;
};

export async function POST(_request: Request, { params }: Params) {
  try {
    const { matchId } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select('id, status, final_recap_emailed_at')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: matchError?.message || 'Match not found.' }, { status: 404 });
    }

    if (match.status !== 'final') {
      return NextResponse.json({ error: 'Match is not final.' }, { status: 400 });
    }

    if (match.final_recap_emailed_at) {
      return NextResponse.json({ ok: true, alreadySent: true });
    }

    const payload = await buildFinalRecapEmailPayload(matchId);

    if (payload.recipientEmails.length === 0) {
      await supabaseAdmin
        .from('matches')
        .update({ final_recap_email_error: 'No admin recipients found for this match.' })
        .eq('id', matchId);

      return NextResponse.json({ error: 'No recipients found.' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY.' }, { status: 500 });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'recaps@touchline-live.com';
    const { html, text } = renderFinalRecapEmail(payload);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: payload.recipientEmails,
        subject: `Final Recap: ${payload.match.home_team?.name || 'Home'} ${payload.match.home_score}-${payload.match.away_score} ${payload.match.away_team?.name || 'Away'}`,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      await supabaseAdmin
        .from('matches')
        .update({ final_recap_email_error: resendError.slice(0, 1000) })
        .eq('id', matchId);

      return NextResponse.json({ error: 'Failed to send final recap email.' }, { status: 502 });
    }

    await supabaseAdmin
      .from('matches')
      .update({
        final_recap_emailed_at: new Date().toISOString(),
        final_recap_email_error: null,
      })
      .eq('id', matchId);

    return NextResponse.json({ ok: true, recipients: payload.recipientEmails.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send final recap email.' },
      { status: 500 },
    );
  }
}
