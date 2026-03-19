'use client';

import { playerDisplayName } from '@/components/live/liveMatchPageShared';
import type { Player, TeamSide } from '@/lib/types';

type Props = {
  side: TeamSide;
  teamName: string;
  players: Player[];
  onSkip: () => Promise<void>;
  onCancel: () => void;
  onConfirm: (playerId?: string) => Promise<void>;
  saving: boolean;
};

export default function QuickEntryGoalFlow({
  side,
  teamName,
  players,
  onSkip,
  onCancel,
  onConfirm,
  saving,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Record a quick {side} goal for {teamName}. Choose a scorer or skip attribution.
      </p>

      <button
        type="button"
        onClick={onSkip}
        disabled={saving}
        className="min-h-[64px] w-full rounded-3xl bg-slate-900 px-5 py-4 text-left text-base font-black text-white disabled:opacity-50"
      >
        Confirm Goal Without Scorer
      </button>

      <div className="grid max-h-[50vh] gap-3 overflow-y-auto">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onConfirm(player.id)}
            disabled={saving}
            className="min-h-[64px] rounded-3xl bg-slate-100 px-5 py-4 text-left text-base font-semibold text-slate-900 ring-1 ring-slate-200 disabled:opacity-50"
          >
            {playerDisplayName(player)}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
