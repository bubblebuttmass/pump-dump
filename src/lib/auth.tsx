import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
