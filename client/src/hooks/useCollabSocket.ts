import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../services/socket';
import type { ModComment, ModItem, UserPresence } from '../types';

export interface CollabUser {
  username: string;
  color?: string;
}

export interface CollabSocketHandlers {
  onModAdded?: (mod: ModItem, user: string) => void;
  onModRemoved?: (modId: string, user: string) => void;
  onModVoted?: (modId: string, vote: 'yes' | 'no', user: string) => void;
  onModCommented?: (modId: string, comment: ModComment) => void;
}

const DEFAULT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];

function getColorForUser(username: string, explicitColor?: string): string {
  if (explicitColor) return explicitColor;
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

export function useCollabSocket(
  modpackId: string,
  user: string | CollabUser,
  handlers: CollabSocketHandlers = {}
) {
  const username = typeof user === 'string' ? user : user.username;
  const userColor = getColorForUser(
    username,
    typeof user === 'string' ? undefined : user.color
  );

  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef<CollabSocketHandlers>(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
    }, 3500);
  }, []);

  useEffect(() => {
    socket.emit('join_room', {
      modpackId,
      username,
      color: userColor,
    });

    const handleRoomUsers = (users: UserPresence[]) => {
      setActiveUsers(users);
    };

    const handleModAdded = ({ mod, user: actor }: { mod: ModItem; user: string }) => {
      handlersRef.current.onModAdded?.(mod, actor);
      showNotification(`${actor} addedadded "${mod.name}"`);
    };

    const handleModRemoved = ({ modId, user: actor }: { modId: string; user: string }) => {
      handlersRef.current.onModRemoved?.(modId, actor);
      showNotification(`${actor} removed a mod`);
    };

    const handleModVoted = ({
      modId,
      vote,
      user: actor,
    }: {
      modId: string;
      vote: 'yes' | 'no';
      user: string;
    }) => {
      handlersRef.current.onModVoted?.(modId, vote, actor);
      showNotification(`${actor} voted ${vote.toUpperCase()}`);
    };

    const handleModCommented = ({
      modId,
      comment,
    }: {
      modId: string;
      comment: ModComment;
    }) => {
      handlersRef.current.onModCommented?.(modId, comment);
      showNotification(`${comment.user} commented`);
    };

    socket.on('room_users', handleRoomUsers);
    socket.on('mod_added', handleModAdded);
    socket.on('mod_removed', handleModRemoved);
    socket.on('mod_voted', handleModVoted);
    socket.on('mod_commented', handleModCommented);

    return () => {
      socket.off('room_users', handleRoomUsers);
      socket.off('mod_added', handleModAdded);
      socket.off('mod_removed', handleModRemoved);
      socket.off('mod_voted', handleModVoted);
      socket.off('mod_commented', handleModCommented);

      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, [modpackId, username, userColor, showNotification]);

  return {
    activeUsers,
    notification,
    showNotification,
  };
}
