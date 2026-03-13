'use client';

type TeamPageIntroProps = {
  // ---------------------------------------------------
  // CONTENT
  // ---------------------------------------------------

  eyebrow?: string;
  title: string;
  description: string;

  // ---------------------------------------------------
  // OPTIONAL RIGHT SIDE CONTENT
  // ---------------------------------------------------

  rightSlot?: React.ReactNode;
};

export default function TeamPageIntro({
  eyebrow,
  title,
  description,
  rightSlot,
}: TeamPageIntroProps) {
  return (
    <>
      {/* --------------------------------------------------- */}
      {/* TEAM SUB-PAGE INTRO */}
      {/* --------------------------------------------------- */}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* ------------------------------------------------- */}
          {/* INTRO COPY */}
          {/* ------------------------------------------------- */}

          <div>
            {eyebrow ? (
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {eyebrow}
              </p>
            ) : null}

            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
              {title}
            </h1>

            <p className="mt-2 max-w-3xl text-slate-600">
              {description}
            </p>
          </div>

          {/* ------------------------------------------------- */}
          {/* OPTIONAL RIGHT SIDE ACTIONS / BADGES */}
          {/* ------------------------------------------------- */}

          {rightSlot ? (
            <div className="flex flex-wrap gap-3">
              {rightSlot}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
