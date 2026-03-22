import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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

    const user = authData.user;
    const body = (await request.json().catch(() => null)) as { token?: string } | null;
    const inviteToken = body?.token?.trim() || '';

    if (!inviteToken) {
      return NextResponse.json({ error: 'Invite token is required.' }, { status: 400 });
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('team_admin_invites')
      .select('id, team_id, email, accepted_at, expires_at, role')
      .eq('invite_token', inviteToken)
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json({ error: inviteError?.message || 'Invite not found.' }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json({ ok: true, alreadyAccepted: true, teamId: invite.team_id });
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This invite has expired.' }, { status: 400 });
    }

    if ((user.email || '').toLowerCase() !== String(invite.email).toLowerCase()) {
      return NextResponse.json({ error: 'This invite was sent to a different email address.' }, { status: 403 });
    }

    const { error: membershipError } = await supabaseAdmin
      .from('team_users')
      .upsert(
        {
          team_id: invite.team_id,
          user_id: user.id,
          role: invite.role || 'team_admin',
        },
        {
          onConflict: 'team_id,user_id',
        },
      );

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message || 'Failed to grant team access.' }, { status: 400 });
    }

    const { error: inviteUpdateError } = await supabaseAdmin
      .from('team_admin_invites')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_user_id: user.id,
      })
      .eq('id', invite.id);

    if (inviteUpdateError) {
      return NextResponse.json({ error: inviteUpdateError.message || 'Access granted, but invite status failed to update.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, teamId: invite.team_id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to accept invite.' },
      { status: 500 },
    );
  }
}
