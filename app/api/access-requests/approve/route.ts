import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderApprovalEmail(params: { teamName: string; loginUrl: string }) {
  const { teamName, loginUrl } = params;

  const html = `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:32px;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ef;border-radius:24px;overflow:hidden;">
        <div style="padding:28px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);">Touchline Live</p>
          <h1 style="margin:0;font-size:30px;line-height:1.1;">Team access approved</h1>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:rgba(255,255,255,.9);">
            You can now administer ${escapeHtml(teamName)} in Touchline Live.
          </p>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#334155;">
            Your team admin access is active. Sign in to manage rosters, schedules, matches, and more.
          </p>
          <p style="margin:0 0 22px;">
            <a href="${loginUrl}" style="display:inline-block;padding:14px 22px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;">
              Sign In to Touchline Live
            </a>
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">
            If you were not expecting this email, you can safely ignore it.
          </p>
        </div>
      </div>
    </div>
  `;

  const text = [
    'Touchline Live',
    `Your team admin access for ${teamName} has been approved.`,
    '',
    `Sign in: ${loginUrl}`,
  ].join('\n');

  return { html, text };
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Unauthorized.' }, { status: 401 });
    }

    const approver = authData.user;

    const { data: superAdmin } = await supabaseAdmin
      .from('super_admin_users')
      .select('user_id')
      .eq('user_id', approver.id)
      .maybeSingle();

    if (!superAdmin) {
      return NextResponse.json({ error: 'Super admin access required.' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as
      | { requestId?: string; teamId?: string }
      | null;

    const requestId = body?.requestId?.trim() || '';
    const teamId = body?.teamId?.trim() || '';

    if (!requestId || !teamId) {
      return NextResponse.json({ error: 'Request id and team id are required.' }, { status: 400 });
    }

    const [{ data: accessRequest, error: requestError }, { data: team, error: teamError }] =
      await Promise.all([
        supabaseAdmin
          .from('team_access_requests')
          .select('id, user_id, email, status')
          .eq('id', requestId)
          .maybeSingle(),
        supabaseAdmin.from('teams').select('id, name').eq('id', teamId).maybeSingle(),
      ]);

    if (requestError || !accessRequest) {
      return NextResponse.json({ error: requestError?.message || 'Access request not found.' }, { status: 404 });
    }

    if (teamError || !team) {
      return NextResponse.json({ error: teamError?.message || 'Team not found.' }, { status: 404 });
    }

    if (!accessRequest.user_id) {
      return NextResponse.json(
        { error: 'This request has no user id attached. The user may need to sign up again.' },
        { status: 400 },
      );
    }

    const { error: membershipError } = await supabaseAdmin
      .from('team_users')
      .upsert(
        {
          team_id: teamId,
          user_id: accessRequest.user_id,
          role: 'team_admin',
        },
        {
          onConflict: 'team_id,user_id',
        },
      );

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message || 'Failed to grant team access.' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('team_access_requests')
      .update({
        status: 'approved',
        approved_team_id: teamId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Access granted, but request status failed to update.' },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Touchline Live <recaps@touchline-live.com>';
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://touchline-live.com';

    if (resendApiKey && accessRequest.email) {
      const loginUrl = `${appBaseUrl}/login`;
      const { html, text } = renderApprovalEmail({
        teamName: team.name || 'your team',
        loginUrl,
      });

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [accessRequest.email],
          subject: `Your access to ${team.name || 'your team'} is approved`,
          html,
          text,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve access request.' },
      { status: 500 },
    );
  }
}
