'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import type { ReactNode } from 'react';

// ---------------------------------------------------
// PROPS
// ---------------------------------------------------

type Props = {
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
};

// ---------------------------------------------------
// COMPONENT
// ---------------------------------------------------

export default function LiveEventEntryCard({
  title,
  subtitle,
  badge,
  children,
}: Props) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {/* --------------------------------------------------- */}
      {/* HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>

        {badge ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            {badge}
          </span>
        ) : null}
      </div>

      {/* --------------------------------------------------- */}
      {/* BODY */}
      {/* --------------------------------------------------- */}

      <div className="space-y-4">{children}</div>
    </section>
  );
}