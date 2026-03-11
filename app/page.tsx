import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-12 text-center">
      <p className="mb-3 rounded-full bg-emerald-50 px-4 py-1 text-sm font-semibold text-emerald-700">
        Touchline Live MVP
      </p>
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
        Live scoring for soccer teams, built for iPad.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Start with saved teams, one-off opponents, live event tracking, and a public match page.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link href="/teams" className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white">
          Teams
        </Link>
        <Link href="/matches/new" className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-900 ring-1 ring-slate-200">
          New Match
        </Link>
      </div>
    </main>
  );
}
