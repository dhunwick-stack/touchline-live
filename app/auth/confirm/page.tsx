'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
          <div className="w-full rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-200">
            Loading confirmation...
          </div>
        </main>
      }
    >
      <AuthConfirmPageInner />
    </Suspense>
  );
}

function AuthConfirmPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash') || '';
  const typeParam = searchParams.get('type') || 'email';
  const nextParam = searchParams.get('next') || '/';
  const errorCode = searchParams.get('error_code') || '';
  const [message, setMessage] = useState('Confirming your account...');
  const [error, setError] = useState('');

  const sanitizeNextPath = useCallback((rawNext: string) => {
    if (!rawNext) return '/';

    try {
      const candidateUrl = new URL(rawNext, window.location.origin);
      if (candidateUrl.origin !== window.location.origin) return '/';

      return `${candidateUrl.pathname}${candidateUrl.search}${candidateUrl.hash}` || '/';
    } catch {
      return rawNext.startsWith('/') ? rawNext : '/';
    }
  }, []);

  const resolvePostConfirmDestination = useCallback(async (fallbackNext: string) => {
    const safeNext = sanitizeNextPath(fallbackNext);

    if (safeNext && safeNext !== '/' && safeNext !== '/auth/confirm') {
      return safeNext;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return '/';
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('team_users')
      .select('team_id')
      .eq('user_id', user.id);

    if (membershipError) {
      return '/';
    }

    const teamMemberships = memberships ?? [];

    if (teamMemberships.length === 1 && teamMemberships[0]?.team_id) {
      return `/teams/${teamMemberships[0].team_id}`;
    }

    if (teamMemberships.length > 1) {
      return '/teams?mine=1';
    }

    return '/';
  }, [sanitizeNextPath]);

  useEffect(() => {
    let cancelled = false;

    async function confirmAccount() {
      if (errorCode) {
        if (!cancelled) {
          setError('This confirmation link is invalid or has expired. Request a new one and try again.');
        }
        return;
      }

      if (!tokenHash) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const destination = await resolvePostConfirmDestination(nextParam);

          if (!cancelled) {
            setMessage('Account confirmed. Redirecting...');
          }

          window.setTimeout(() => {
            router.replace(destination);
            router.refresh();
          }, 600);
          return;
        }

        if (!cancelled) {
          setError('This confirmation link is invalid or incomplete. Request a new confirmation email and try again.');
        }
        return;
      }

      const verificationType = typeParam as EmailOtpType;
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: verificationType,
      });

      if (verifyError) {
        if (!cancelled) {
          setError('This confirmation link is invalid or has expired. Request a new confirmation email and try again.');
        }
        return;
      }

      const destination =
        verificationType === 'recovery'
          ? '/reset-password'
          : await resolvePostConfirmDestination(nextParam);

      if (!cancelled) {
        setMessage(
          verificationType === 'recovery'
            ? 'Recovery verified. Redirecting you to reset your password...'
            : 'Account confirmed. Redirecting...',
        );
      }

      window.setTimeout(() => {
        router.replace(destination);
        router.refresh();
      }, 600);
    }

    void confirmAccount();

    return () => {
      cancelled = true;
    };
  }, [errorCode, nextParam, resolvePostConfirmDestination, router, tokenHash, typeParam]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="mt-2 text-2xl font-black">Confirm your account</h1>
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
