import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const DEFAULT_FALLBACK_USER = `Crafter_${Math.floor(100 + Math.random() * 900)}`;

function computeFriendCode(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const num = 1000 + (Math.abs(hash) % 9000);
  return `MCMC-${num}`;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [localAuthenticated, setLocalAuthenticated] = useState<boolean>(false);
  const [customUsername, setCustomUsername] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('/MCMC.png');
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('[Auth] Session fetch error:', err);
        if (isMounted) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const markAuthenticated = useCallback(() => {
    setLocalAuthenticated(true);
  }, []);

  const signOut = useCallback(async () => {
    setLocalAuthenticated(false);
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Auth] Error signing out:', error.message);
    }
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'discord' | 'github' | 'google') => {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithPassword = useCallback(async (emailInput: string, passwordInput: string) => {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (emailInput: string, passwordInput: string) => {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase.auth.signUp({
      email: emailInput,
      password: passwordInput,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const resetPasswordForEmail = useCallback(async (emailInput: string) => {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase.auth.resetPasswordForEmail(emailInput, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }, []);

  const displayName =
    customUsername.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.user_name ||
    (user?.email ? user.email.split('@')[0] : null) ||
    DEFAULT_FALLBACK_USER;

  const userId = user?.id || displayName;
  const email = customEmail.trim() || user?.email || 'crafter@mcmc.local';
  const friendCode = computeFriendCode(userId);

  const updateProfile = useCallback(
    async (updates: { username?: string; avatarUrl?: string }) => {
      if (updates.username !== undefined) setCustomUsername(updates.username);
      if (updates.avatarUrl !== undefined) setAvatarUrl(updates.avatarUrl);
      if (supabase && user) {
        await supabase.auth.updateUser({
          data: {
            full_name: updates.username ?? displayName,
            avatar_url: updates.avatarUrl ?? avatarUrl,
          },
        });
      }
    },
    [avatarUrl, displayName, user]
  );

  const updateUserEmail = useCallback(
    async (newEmail: string) => {
      setCustomEmail(newEmail);
      if (supabase && user) {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
      }
    },
    [user]
  );

  const updateUserPassword = useCallback(
    async (newPassword: string) => {
      if (supabase && user) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
    },
    [user]
  );

  const deleteAccount = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return {
    session,
    user,
    userId,
    displayName,
    email,
    avatarUrl,
    friendCode,
    isAuthenticated: Boolean(user) || localAuthenticated,
    isLoading,
    markAuthenticated,
    signOut,
    signInWithOAuth,
    signInWithPassword,
    signUp,
    resetPasswordForEmail,
    updateProfile,
    updateUserEmail,
    updateUserPassword,
    deleteAccount,
  };
}
