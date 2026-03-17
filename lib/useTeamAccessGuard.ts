'use client';

// ---------------------------------------------------
// IMPORTS
// ---------------------------------------------------

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------
// TYPES
// ---------------------------------------------------

type UseTeamAccessGuardOptions = {
  teamId: string;
  nextPath: string;
};

type UseTeamAccessGuardResult = {
  authChecked: boolean;
  currentUser: User | null;
  hasTeamAccess: boolean;
  error: string;
  loading: boolean;
};

// ---------------------------------------------------
// HOOK
// ---------------------------------------------------

export function useTeamAccessGuard({
  teamId,
  nextPath,
}: UseTeamAccessGuardOptions): UseTeamAccessGuardResult {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasTeamAccess, setHasTeamAccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // -------------------------------------------------
  // ACCESS CHECK
  // -------------------------------------------------

  useEffect(() => {
    async function checkAccess() {
      if (!teamId) {
        setError('No team id was found in the URL.');
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message || 'Failed to check sign-in status.');
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      const user = session?.user ?? null;
      setCurrentUser(user);

      // ---------------------------------------------
      // REQUIRE SIGN-IN
      // ---------------------------------------------

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      // ---------------------------------------------
      // VERIFY TEAM MEMBERSHIP
      // ---------------------------------------------

      const { data: membership, error: membershipError } = await supabase
        .from('team_users')
        .select('id, role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError) {
        setError(membershipError.message || 'Failed to verify team access.');
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      // ---------------------------------------------
      // REDIRECT TO TEAM CODE FLOW IF NOT LINKED
      // ---------------------------------------------

      if (!membership) {
        router.replace(`/team-login?teamId=${teamId}&mode=admin`);
        return;
      }

      setHasTeamAccess(true);
      setAuthChecked(true);
      setLoading(false);
    }

    checkAccess();
  }, [teamId, nextPath, router]);

  return {
    authChecked,
    currentUser,
    hasTeamAccess,
    error,
    loading,
  };
}
