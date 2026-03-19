'use client';

type ActionItem = {
  label: string;
  tone?: 'default' | 'danger' | 'success';
  disabled?: boolean;
  onClick: () => void;
};

type Props = {
  actions: ActionItem[];
};

export default function SidelineActionGrid({ actions }: Props) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4">
        <h2 className="text-2xl font-black text-slate-900">Match Actions</h2>
        <p className="mt-1 text-sm text-slate-500">
          Large touch controls for the most common live events.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={`min-h-[88px] rounded-3xl px-5 py-5 text-left text-lg font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              action.tone === 'danger'
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                : action.tone === 'success'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-slate-100 text-slate-900 ring-1 ring-slate-200'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
