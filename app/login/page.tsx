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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function getSignupRedirectUrl() {
    if (typeof window === 'undefined') return undefined;

    const safeNext = next.startsWith('/') ? next : '/';
    return `${window.location.origin}${safeNext}`;
  }

  // ---------------------------------------------------
  // SIGN IN
  // ---------------------------------------------------

  async function handleLogin() {
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  // ---------------------------------------------------
  // SIGN UP
  // ---------------------------------------------------

  async function handleSignup() {
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
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

    router.push(next);
    router.refresh();
  }

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-200">
        <h1 className="text-2xl font-black">Sign in to Touchline</h1>

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

          <div className="space-y-2">
            <input
              type="text"
              placeholder="Org / Club / School"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full rounded-xl border px-4 py-3"
            />
            <p className="text-xs font-medium text-slate-500">
              For new signups only. This helps identify which club, school, or organization is
              requesting access.
            </p>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="flex-1 rounded-xl bg-slate-900 py-3 text-white disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={handleSignup}
            disabled={loading}
            className="flex-1 rounded-xl border py-3 disabled:opacity-60"
          >
            {loading ? 'Working...' : 'Sign Up'}
          </button>
        </div>
      </div>
    </main>
  );
}
