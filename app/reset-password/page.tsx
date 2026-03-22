'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;

    async function initializeRecoverySession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        setError(error.message);
        return;
      }

      if (data.session) {
        setReady(true);
        return;
      }

      setError('This password reset link is invalid or has expired. Request a new reset email.');
    }

    void initializeRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setError('');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleResetPassword() {
    if (!password.trim()) {
      setError('Enter a new password.');
      return;
    }

    if (password.length < 8) {
      setError('Use at least 8 characters for the new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setNotice('Password updated. Redirecting you to sign in...');
    setLoading(false);

    window.setTimeout(() => {
      router.push('/login');
      router.refresh();
    }, 1000);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="w-full rounded-3xl bg-white p-8 shadow-md ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>
        <h1 className="mt-2 text-2xl font-black">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose a new password to finish recovering your account.
        </p>

        {notice ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-4 py-3"
            disabled={!ready || loading}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border px-4 py-3"
            disabled={!ready || loading}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={!ready || loading}
            className="flex-1 rounded-xl bg-slate-900 py-3 text-white disabled:opacity-60"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </main>
  );
}
