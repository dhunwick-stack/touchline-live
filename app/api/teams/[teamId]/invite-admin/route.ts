import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type Params = {
  params: Promise<{
    teamId: string;
  }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderInviteEmail(params: {
  teamName: string;
  inviterEmail: string;
  acceptUrl: string;
}) {
  const { teamName, inviterEmail, acceptUrl } = params;

  const html = `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:32px;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ef;border-radius:24px;overflow:hidden;">
        <div style="padding:28px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);">Touchline Live</p>
          <h1 style="margin:0;font-size:30px;line-height:1.1;">You’ve been invited</h1>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:rgba(255,255,255,.9);">
            ${escapeHtml(inviterEmail)} invited you to manage ${escapeHtml(teamName)} in Touchline Live.
          </p>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#334155;">
            Accept this invite to get access to the team admin tools for ${escapeHtml(teamName)}.
          </p>
          <p style="margin:0 0 22px;">
            <a href="${acceptUrl}" style="display:inline-block;padding:14px 22px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;">
              Accept Invite
            </a>
          </p>
          <p style="margin:0 0 10px;font-size:14px;color:#64748b;">If the button does not work, open this link:</p>
          <p style="margin:0;word-break:break-word;"><a href="${acceptUrl}" style="color:#0f766e;">${acceptUrl}</a></p>
        </div>
      </div>
    </div>
  `;

  const text = [
    'Touchline Live',
    `You have been invited by ${inviterEmail} to manage ${teamName}.`,
    '',
    `Accept invite: ${acceptUrl}`,
  ].join('\n');

  return { html, text };
}

export async function POST(request: Request, { params }: Params) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { teamId } = await params;
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Unauthorized.' }, { status: 401 });
    }

    const inviter = authData.user;
    const body = (await request.json().catch(() => null)) as { email?: string } | null;
    const inviteEmail = body?.email?.trim().toLowerCase() || '';

    if (!inviteEmail) {
      return NextResponse.json({ error: 'Invite email is required.' }, { status: 400 });
    }

    const [{ data: superAdmin }, { data: membership }, { data: team, error: teamError }] =
      await Promise.all([
        supabaseAdmin
          .from('super_admin_users')
          .select('user_id')
          .eq('user_id', inviter.id)
          .maybeSingle(),
        supabaseAdmin
          .from('team_users')
          .select('id')
          .eq('team_id', teamId)
          .eq('user_id', inviter.id)
          .maybeSingle(),
        supabaseAdmin.from('teams').select('id, name').eq('id', teamId).single(),
      ]);

    if (teamError || !team) {
      return NextResponse.json({ error: teamError?.message || 'Team not found.' }, { status: 404 });
    }

    if (!superAdmin && !membership) {
      return NextResponse.json({ error: 'You do not have permission to invite admins for this team.' }, { status: 403 });
    }

    const inviteToken = crypto.randomUUID();

    const { error: inviteInsertError } = await supabaseAdmin.from('team_admin_invites').insert({
      team_id: teamId,
      email: inviteEmail,
      role: 'team_admin',
      invite_token: inviteToken,
      invited_by_user_id: inviter.id,
    });

    if (inviteInsertError) {
      return NextResponse.json({ error: inviteInsertError.message || 'Failed to create invite.' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY.' }, { status: 500 });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Touchline Live <recaps@touchline-live.com>';
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://touchline-live.com';
    const acceptUrl = `${appBaseUrl}/accept-invite?token=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(inviteEmail)}`;
    const { html, text } = renderInviteEmail({
      teamName: team.name || 'this team',
      inviterEmail: inviter.email || 'a team admin',
      acceptUrl,
    });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [inviteEmail],
        subject: `You’ve been invited to manage ${team.name || 'a team'} on Touchline Live`,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      return NextResponse.json({ error: resendError || 'Failed to send invite email.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send invite.' },
      { status: 500 },
    );
  }
}
