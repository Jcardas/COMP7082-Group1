import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { deleteAccountApi, syncUserToServer } from '../services/api';

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
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string>('');
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
    setCustomUsername('');
    setCustomEmail('');
    setCustomAvatarUrl('');
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Auth] Error signing out:', error.message);
    }
  }, []);

  const displayName =
    customUsername.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.user_name ||
    (user?.email ? user.email.split('@')[0] : null) ||
    DEFAULT_FALLBACK_USER;

  const avatarUrl =
    customAvatarUrl.trim() ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    '/MCMC.png';

  const userId = user?.id || displayName;
  const email = customEmail.trim() || user?.email || 'crafter@mcmc.local';
  const friendCode = computeFriendCode(userId);
  const isAuthenticated = Boolean(user) || localAuthenticated;

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    void syncUserToServer({
      userId,
      username: displayName,
      friendCode,
      avatarUrl,
    });
  }, [isAuthenticated, userId, displayName, friendCode, avatarUrl]);

  const updateProfile = useCallback(
    async (updates: { username?: string; avatarUrl?: string }) => {
      const nextName = updates.username !== undefined ? updates.username : displayName;
      const nextAvatar = updates.avatarUrl !== undefined ? updates.avatarUrl : avatarUrl;
      if (updates.username !== undefined) setCustomUsername(updates.username);
      if (updates.avatarUrl !== undefined) setCustomAvatarUrl(updates.avatarUrl);
      if (supabase && user) {
        await supabase.auth.updateUser({
          data: {
            full_name: nextName,
            avatar_url: nextAvatar,
          },
        });
      }
      await syncUserToServer({
        userId,
        username: nextName,
        friendCode,
        avatarUrl: nextAvatar,
      });
    },
    [avatarUrl, displayName, friendCode, user, userId]
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
    try {
      await deleteAccountApi(userId);
    } catch (err) {
      console.warn('[Auth] Server account deletion warning:', err);
    }
    await signOut();
  }, [signOut, userId]);

  return {
    session,
    user,
    userId,
    displayName,
    email,
    avatarUrl,
    friendCode,
    isAuthenticated,
    isLoading,
    markAuthenticated,
    signOut,
    updateProfile,
    updateUserEmail,
    updateUserPassword,
    deleteAccount,
  };
}
