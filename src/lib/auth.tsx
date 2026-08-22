import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  // null while unknown/loading, otherwise whether this account has finished
  // picking a username + photo. Root routing (see app/index.tsx) uses this
  // to send an interrupted signup back to onboarding instead of the feed.
  onboardingComplete: boolean | null;
  // Lets onboarding.tsx flip this to true locally the moment it saves,
  // instead of waiting on a refetch that a fast subsequent navigation could
  // race.
  markOnboardingComplete: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  onboardingComplete: null,
  markOnboardingComplete: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Token refreshes fire this with a new object every ~hour even though
      // the signed-in user hasn't changed. Every screen's useFocusEffect
      // depends on [session], so a fresh reference here silently re-ran
      // every visible screen's fetch mid-session -- visible as flicker with
      // no relation to actual navigation. Keep the same reference when the
      // user is unchanged so React bails out and nothing re-fetches.
      setSession((prev) => (prev?.user?.id === newSession?.user?.id ? prev : newSession));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setOnboardingComplete(null);
      return;
    }
    let cancelled = false;
    setOnboardingComplete(null);
    supabase
      .from('users')
      .select('onboarding_completed_at')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        // Fail open to "complete" rather than trap a user in a redirect
        // loop to onboarding if this lookup errors for an unrelated reason.
        setOnboardingComplete(error ? true : data?.onboarding_completed_at != null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const markOnboardingComplete = useCallback(() => setOnboardingComplete(true), []);

  return (
    <AuthContext.Provider value={{ session, loading, onboardingComplete, markOnboardingComplete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
