'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TeamBanner from '@/components/TeamBanner';
import type { Team } from '@/lib/types';

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();

  const teamId =
    typeof params?.teamId === 'string'
      ? params.teamId
      : Array.isArray(params?.teamId)
        ? params.teamId[0]
        : '';

  const [team, setTeam] = useState<Team | null>(null);
  const [editing, setEditing] = useState(false);

  // ---------------------------------------------------
  // LOAD TEAM FOR BANNER
  // ---------------------------------------------------

  useEffect(() => {
    if (!teamId) return;

    async function loadTeam() {
      const { data } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (data) {
        setTeam(data);
      }
    }

    loadTeam();
  }, [teamId]);

  if (!team) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        Loading team...
      </main>
    );
  }

  return (
    <>
      {/* --------------------------------------------------- */}
      {/* TEAM BANNER (GLOBAL FOR TEAM PAGES) */}
      {/* --------------------------------------------------- */}

      <TeamBanner
        team={team}
        teamId={teamId}
        editing={editing}
        setEditing={setEditing}
      />

      {/* --------------------------------------------------- */}
      {/* PAGE CONTENT */}
      {/* --------------------------------------------------- */}

      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </>
  );
}
