'use client';

import { useMemo, useState } from 'react';
import { playerDisplayName } from '@/components/live/liveMatchPageShared';
import type { Player, TeamSide, TrackingMode } from '@/lib/types';

type Props = {
  teamOptions: { side: TeamSide; label: string }[];
  getPlayersForSide: (side: TeamSide) => Player[];
  getTrackingModeForSide: (side: TeamSide) => TrackingMode;
  onCancel: () => void;
  onConfirm: (params: {
    side: TeamSide;
    playerId?: string;
    assistPlayerId?: string;
  }) => Promise<void>;
  saving: boolean;
};

export default function GoalFlow({
  teamOptions,
  getPlayersForSide,
  getTrackingModeForSide,
  onCancel,
  onConfirm,
  saving,
}: Props) {
  const [side, setSide] = useState<TeamSide | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [assistPlayerId, setAssistPlayerId] = useState('');

  const players = useMemo(() => (side ? getPlayersForSide(side) : []), [getPlayersForSide, side]);
  const allowPlayerSkip = !!side && (getTrackingModeForSide(side) === 'basic' || players.length === 0);

  if (!side) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-slate-500">Step 1. Select the scoring team.</p>
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

  if (!playerId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Step 2. Select the scorer.</p>
        {allowPlayerSkip ? (
          <button
            type="button"
            onClick={() => onConfirm({ side })}
            disabled={saving}
            className="min-h-[64px] rounded-3xl bg-slate-900 px-5 py-4 text-left text-base font-black text-white disabled:opacity-50"
          >
            Confirm Goal Without Player
          </button>
        ) : null}
        <div className="grid max-h-[50vh] gap-3 overflow-y-auto">
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => setPlayerId(player.id)}
              className="min-h-[64px] rounded-3xl bg-slate-100 px-5 py-4 text-left text-base font-semibold text-slate-900 ring-1 ring-slate-200"
            >
              {playerDisplayName(player)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setSide(null)} className="text-sm font-semibold text-slate-500">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Step 3. Optional assist, then confirm.</p>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => onConfirm({ side, playerId })}
          disabled={saving}
          className="min-h-[64px] rounded-3xl bg-slate-900 px-5 py-4 text-left text-base font-black text-white disabled:opacity-50"
        >
          Confirm Goal Without Assist
        </button>
        <div className="grid max-h-[50vh] gap-3 overflow-y-auto">
          {players
            .filter((player) => player.id !== playerId)
            .map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  setAssistPlayerId(player.id);
                  onConfirm({ side, playerId, assistPlayerId: player.id });
                }}
                disabled={saving}
                className={`min-h-[64px] rounded-3xl px-5 py-4 text-left text-base font-semibold ring-1 ${
                  assistPlayerId === player.id
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-slate-100 text-slate-900 ring-slate-200'
                }`}
              >
                Assist: {playerDisplayName(player)}
              </button>
            ))}
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <button type="button" onClick={() => setPlayerId('')} className="text-sm font-semibold text-slate-500">
          Back
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
