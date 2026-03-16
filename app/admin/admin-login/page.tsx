'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || 'touchline-admin';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = searchParams.get('next') || '/admin';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  function setAdminSession() {
    const session = {
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    localStorage.setItem('adminSession', JSON.stringify(session));
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError('');

    if (!code.trim()) {
      setError('Enter the admin code.');
      setChecking(false);
      return;
    }

    if (code.trim() !== ADMIN_CODE) {
      setError('Incorrect admin code.');
      setChecking(false);
      return;
    }

    setAdminSession();
    router.push(next);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-12">
      <form
        onSubmit={handleLogin}
        className="w-full rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Touchline Live
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Admin Login
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Enter the global admin code to continue.
        </p>

        <div className="mt-5">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Admin code"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3"
            autoFocus
          />
        </div>

        {error ? (
          <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={checking}
          className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-12">Loading login...</main>}>
      <AdminLoginForm />
    </Suspense>
  );
}