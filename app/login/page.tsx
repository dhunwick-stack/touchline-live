'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------
// PAGE SHELL
// ---------------------------------------------------

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
          <div className="w-full rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-200">
            Loading login...
          </div>
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

// ---------------------------------------------------
// INNER PAGE
// ---------------------------------------------------

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = searchParams.get('next') || '/';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function getSignupRedirectUrl() {
    if (typeof window === 'undefined') return undefined;

    const safeNext = next.startsWith('/') ? next : '/';
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const baseUrl = configuredSiteUrl
      ? configuredSiteUrl.replace(/\/+$/, '')
      : window.location.origin;

    return `${baseUrl}${safeNext}`;
  }

  // ---------------------------------------------------
  // SIGN IN
  // ---------------------------------------------------

  async function resolvePostLoginDestination(userId: string) {
    if (next && next !== '/') {
      return next;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('team_users')
      .select('team_id')
      .eq('user_id', userId);

    if (membershipError) {
      return next;
    }

    const teamMemberships = memberships ?? [];

    if (teamMemberships.length === 1 && teamMemberships[0]?.team_id) {
      return `/teams/${teamMemberships[0].team_id}`;
    }

    if (teamMemberships.length > 1) {
      return '/teams?mine=1';
    }

    return next;
  }

  async function handleLogin() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const destination = await resolvePostLoginDestination(data.user.id);

    router.push(destination);
    router.refresh();
  }

  // ---------------------------------------------------
  // SIGN UP
  // ---------------------------------------------------

  async function handleSignup() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getSignupRedirectUrl(),
        data: {
          organization_name: organizationName.trim() || null,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const requestPayload = {
      user_id: data.user?.id || null,
      email: email.trim(),
      organization_name: organizationName.trim() || null,
      status: 'pending' as const,
    };

    const { error: requestError } = await supabase
      .from('team_access_requests')
      .insert(requestPayload);

    if (requestError) {
      setError(`Account created, but access request intake failed: ${requestError.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push(
      `/login?next=${encodeURIComponent(next)}&signup=check-email`,
    );
  }

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-200">
        {searchParams.get('signup') === 'check-email' ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Check your email to confirm your account. If the link still points to localhost,
            update your Supabase Auth Site URL and Redirect URLs to your live domain.
          </div>
        ) : null}

        <h1 className="text-2xl font-black">
          {mode === 'signin' ? 'Sign in to Touchline' : 'Create your Touchline account'}
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-2">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              mode === 'signin'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            Existing User
          </button>

          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              mode === 'signup'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            New User
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border px-4 py-3"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-4 py-3"
          />

          {mode === 'signup' ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Org / Club / School"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              />
              <p className="text-xs font-medium text-slate-500">
                This helps identify which club, school, or organization is requesting access.
              </p>
            </div>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          {mode === 'signin' ? (
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="flex-1 rounded-xl bg-slate-900 py-3 text-white disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="flex-1 rounded-xl border py-3 disabled:opacity-60"
            >
              {loading ? 'Working...' : 'Sign Up'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
