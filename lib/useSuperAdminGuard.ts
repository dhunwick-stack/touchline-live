'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type UseSuperAdminGuardOptions = {
  nextPath: string;
};

type UseSuperAdminGuardResult = {
  authChecked: boolean;
  currentUser: User | null;
  hasSuperAccess: boolean;
  error: string;
  loading: boolean;
};

export function useSuperAdminGuard({
  nextPath,
}: UseSuperAdminGuardOptions): UseSuperAdminGuardResult {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasSuperAccess, setHasSuperAccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message || 'Failed to check sign-in status.');
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const user = session?.user ?? null;
      setCurrentUser(user);

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      const { data: superAdmin, error: superAdminError } = await supabase
        .from('super_admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (superAdminError) {
        setError(superAdminError.message || 'Failed to verify super admin access.');
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setHasSuperAccess(!!superAdmin);
      setAuthChecked(true);
      setLoading(false);
    }

    checkAccess();
  }, [nextPath, router]);

  return {
    authChecked,
    currentUser,
    hasSuperAccess,
    error,
    loading,
  };
}
