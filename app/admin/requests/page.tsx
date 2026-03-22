'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Organization, Team } from '@/lib/types';
import { useSuperAdminGuard } from '@/lib/useSuperAdminGuard';

type TeamAccessRequest = {
  id: string;
  user_id: string | null;
  email: string;
  organization_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_team_id: string | null;
  approved_at: string | null;
  created_at: string;
};

type TeamRow = Team & {
  organization: Organization | null;
};

export default function AdminRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [requests, setRequests] = useState<TeamAccessRequest[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [actingRequestId, setActingRequestId] = useState('');
  const { authChecked, currentUser, hasSuperAccess, loading: accessLoading } = useSuperAdminGuard({
    nextPath: '/admin/requests',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage('');

    const [
      { data: requestData, error: requestError },
      { data: teamData, error: teamError },
    ] = await Promise.all([
      supabase
        .from('team_access_requests')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('teams')
        .select(`
          *,
          organization:organization_id (*)
        `)
        .order('name', { ascending: true }),
    ]);

    if (requestError || teamError) {
      setMessage(requestError?.message || teamError?.message || 'Failed to load requests.');
      setLoading(false);
      return;
    }

    setRequests((requestData as TeamAccessRequest[]) ?? []);
    setTeams((teamData as TeamRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authChecked || !hasSuperAccess) return;

    const loadTimer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, [authChecked, hasSuperAccess, loadData]);

  async function approveRequest(request: TeamAccessRequest, teamId: string) {
    setActingRequestId(request.id);
    setMessage('');

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setMessage('You must be signed in as a super admin to approve requests.');
      setActingRequestId('');
      return;
    }

    const response = await fetch('/api/access-requests/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        requestId: request.id,
        teamId,
      }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(body?.error || 'Failed to approve access request.');
      setActingRequestId('');
      return;
    }

    await loadData();
    setActingRequestId('');
  }

  async function rejectRequest(requestId: string) {
    setActingRequestId(requestId);
    setMessage('');

    const { error } = await supabase
      .from('team_access_requests')
      .update({
        status: 'rejected',
      })
      .eq('id', requestId);

    if (error) {
      setMessage(error.message || 'Failed to reject request.');
      setActingRequestId('');
      return;
    }

    await loadData();
    setActingRequestId('');
  }

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests],
  );

  function getSuggestedTeams(request: TeamAccessRequest) {
    const query = (request.organization_name || '').trim().toLowerCase();
    if (!query) return teams.slice(0, 5);

    return teams
      .filter((team) => {
        const haystack = [
          team.name,
          team.club_name,
          team.organization?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 5);
  }

  if (!authChecked || accessLoading) {
    return <main className="mx-auto max-w-6xl px-6 py-10">Loading admin...</main>;
  }

  if (!hasSuperAccess) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Super Admin Access Required
          </h1>
          <p className="mt-3 text-slate-600">
            {currentUser?.email || 'This account'} does not currently have permission to review
            access requests.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Access Requests
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Review signup requests, match them to likely teams, and approve access without sharing
          team codes.
        </p>
      </div>

      {message ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {message}
        </div>
      ) : null}

      <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Pending Requests</h2>
            <p className="mt-1 text-sm text-slate-500">
              Suggestions are based on the signup org / club / school field.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {pendingRequests.length}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading requests...</p>
        ) : pendingRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No pending requests right now.</p>
        ) : (
          <div className="space-y-5">
            {pendingRequests.map((request) => {
              const suggestions = getSuggestedTeams(request);

              return (
                <div
                  key={request.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{request.email}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {request.organization_name || 'No organization entered'}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Requested {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        }).format(new Date(request.created_at))}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => rejectRequest(request.id)}
                      disabled={actingRequestId === request.id}
                      className="rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>

                  <div className="mt-5">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Suggested Teams
                    </p>

                    {suggestions.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                        No likely team matches found.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {suggestions.map((team) => (
                          <div
                            key={team.id}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-semibold text-slate-900">{team.name}</p>
                              <p className="text-sm text-slate-500">
                                {[team.club_name, team.organization?.name].filter(Boolean).join(' • ') ||
                                  'No organization'}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => approveRequest(request, team.id)}
                              disabled={actingRequestId === request.id}
                              className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Approve for Team
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
