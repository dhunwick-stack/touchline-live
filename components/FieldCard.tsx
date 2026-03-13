'use client';

type FieldCardProps = {
  // ---------------------------------------------------
  // FIELD DATA
  // ---------------------------------------------------

  fieldName?: string | null;
  fieldAddress?: string | null;
  fieldLat?: number | null;
  fieldLng?: number | null;

  // ---------------------------------------------------
  // OPTIONAL MATCH / WEATHER DATA
  // ---------------------------------------------------

  matchDate?: string | null;
  weatherSummary?: string | null;
  weatherTemp?: string | number | null;
};

export default function FieldCard({
  fieldName,
  fieldAddress,
  fieldLat,
  fieldLng,
  matchDate,
  weatherSummary,
  weatherTemp,
}: FieldCardProps) {



  // ---------------------------------------------------
  // APPLE MAPS LINK
  // ---------------------------------------------------

  const mapsUrl = fieldAddress
    ? `https://maps.apple.com/?q=${encodeURIComponent(fieldAddress)}`
    : null;

  // ---------------------------------------------------
  // MAPBOX CONFIG
  // ---------------------------------------------------

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  console.log('MAPBOX TOKEN:', mapboxToken);


  const lat = fieldLat ?? null;
  const lng = fieldLng ?? null;

  const satelliteImageUrl =
    mapboxToken && lat !== null && lng !== null
      ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},17/800x500?access_token=${mapboxToken}`
      : null;

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

      {/* --------------------------------------------------- */}
      {/* HEADER */}
      {/* --------------------------------------------------- */}

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">
          Home Field
        </h2>

        {matchDate ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Match Day Ready
          </span>
        ) : null}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">

        {/* ------------------------------------------------- */}
        {/* SATELLITE MAP PREVIEW */}
        {/* ------------------------------------------------- */}

        <div className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">

          {fieldAddress && mapsUrl ? (

            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="block"
            >

              <div className="relative aspect-[16/10]">

                {satelliteImageUrl ? (
                  <img
                    src={satelliteImageUrl}
                    alt={`${fieldName || 'Field'} satellite view`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-200 text-sm font-medium text-slate-500">
                    Map preview unavailable
                  </div>
                )}

                {/* LOCATION PIN */}

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-4 ring-white/60">
                    📍
                  </div>
                </div>

                {/* OPEN MAP BUTTON */}

                <div className="absolute bottom-4 right-4">
                  <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow">
                    Open in Maps
                  </span>
                </div>

              </div>

            </a>

          ) : (

            <div className="flex aspect-[16/10] items-center justify-center text-sm text-slate-500">
              No field address available
            </div>

          )}

        </div>

        {/* ------------------------------------------------- */}
        {/* FIELD DETAILS */}
        {/* ------------------------------------------------- */}

        <div className="space-y-4">

          {/* FIELD NAME */}

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Field Name
            </p>

            <p className="mt-2 text-lg font-semibold text-slate-900">
              {fieldName || 'Not set'}
            </p>
          </div>

          {/* ADDRESS */}

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Address
            </p>

            <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
              {fieldAddress || 'Not set'}
            </p>
          </div>

          {/* ------------------------------------------------- */}
          {/* WEATHER PANEL */}
          {/* ------------------------------------------------- */}

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">

            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Match Day Weather
            </p>

            {weatherSummary || weatherTemp ? (

              <div className="mt-2 flex items-center justify-between gap-4">

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {weatherSummary || 'Forecast available'}
                  </p>

                  {matchDate ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(matchDate).toLocaleString()}
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="text-2xl font-black tracking-tight text-slate-900">
                    {weatherTemp ?? '—'}
                    {weatherTemp !== null && weatherTemp !== undefined ? '°' : ''}
                  </p>
                </div>

              </div>

            ) : (

              <p className="mt-2 text-sm text-slate-500">
                Weather will appear here when match-day forecast is connected.
              </p>

            )}

          </div>

          {/* ------------------------------------------------- */}
          {/* ACTIONS */}
          {/* ------------------------------------------------- */}

          <div className="flex flex-wrap gap-3">

            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
              >
                Open in Maps
              </a>
            ) : null}

          </div>

        </div>

      </div>

    </section>
  );
}