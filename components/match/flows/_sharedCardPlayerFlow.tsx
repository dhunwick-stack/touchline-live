'use client';

import { useMemo, useState } from 'react';
import { playerDisplayName } from '@/components/live/liveMatchPageShared';
import type { Player, TeamSide } from '@/lib/types';

type FlowType = 'yellow_card' | 'red_card';

type Props = {
  teamOptions: { side: TeamSide; label: string }[];
  getPlayersForSide: (side: TeamSide) => Player[];
  onCancel: () => void;
  onConfirm: (params: {
    type: FlowType;
    side: TeamSide;
    playerId: string;
  }) => Promise<void>;
  saving: boolean;
};

export default function createCardPlayerFlow(type: FlowType, title: string) {
  return function CardPlayerFlow({
    teamOptions,
    getPlayersForSide,
    onCancel,
    onConfirm,
    saving,
  }: Props) {
    const [side, setSide] = useState<TeamSide | null>(null);
    const players = useMemo(() => (side ? getPlayersForSide(side) : []), [getPlayersForSide, side]);

    if (!side) {
      return (
        <div className="grid gap-3">
          <p className="text-sm text-slate-500">Step 1. Select team.</p>
          {teamOptions.map((team) => (
            <button
              key={team.side}
              type="button"
              onClick={() => setSide(team.side)}
              className="min-h-[72px] rounded-3xl bg-slate-100 px-5 py-4 text-left text-lg font-black text-slate-900 ring-1 ring-slate-200"
            >
              {team.label}
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Step 2. Select player for {title.toLowerCase()}.</p>
        <div className="grid max-h-[50vh] gap-3 overflow-y-auto">
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onConfirm({ type, side, playerId: player.id })}
              disabled={saving}
              className="min-h-[64px] rounded-3xl bg-slate-100 px-5 py-4 text-left text-base font-semibold text-slate-900 ring-1 ring-slate-200 disabled:opacity-50"
            >
              {playerDisplayName(player)}
            </button>
          ))}
        </div>
        <div className="flex justify-between gap-3">
          <button type="button" onClick={() => setSide(null)} className="text-sm font-semibold text-slate-500">
            Back
          </button>
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-500">
            Cancel
          </button>
        </div>
      </div>
    );
  };
}
