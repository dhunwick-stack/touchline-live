'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [message, setMessage] = useState('Checking your invite...');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function acceptInvite() {
      if (!token) {
        if (!cancelled) setError('Invite token missing.');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        const next = `/accept-invite?token=${encodeURIComponent(token)}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
        router.replace(`/login?next=${encodeURIComponent(next)}${email ? `&email=${encodeURIComponent(email)}` : ''}`);
        return;
      }

      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string; teamId?: string } | null;

      if (!response.ok) {
        if (!cancelled) setError(body?.error || 'Failed to accept invite.');
        return;
      }

      if (!cancelled) {
        setMessage('Invite accepted. Redirecting to your team...');
      }

      window.setTimeout(() => {
        router.replace(body?.teamId ? `/teams/${body.teamId}` : '/teams?mine=1');
        router.refresh();
      }, 800);
    }

    void acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [email, router, token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="mt-2 text-2xl font-black">Accept Team Invite</h1>
        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
