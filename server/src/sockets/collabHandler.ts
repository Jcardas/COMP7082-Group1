import { Server, Socket } from 'socket.io';
import { ModComment, ModItem, UserPresence } from '../types/index.js';

// In-memory presence and room state store (backed by database when active)
const roomUsers = new Map<string, Map<string, UserPresence>>();

export function setupCollaborationSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`⚡ [Socket.io] Client connected: ${socket.id}`);

    // Join collaborative modpack room
    socket.on('join_room', ({ modpackId, username, color }) => {
      const roomKey = `modpack:${modpackId}`;
      socket.join(roomKey);

      if (!roomUsers.has(roomKey)) {
        roomUsers.set(roomKey, new Map());
      }

      const user: UserPresence = {
        socketId: socket.id,
        username: username || `Crafter_${socket.id.substring(0, 4)}`,
        color: color || '#10b981',
      };

      roomUsers.get(roomKey)!.set(socket.id, user);

      // Notify room of updated users list
      const activeUsers = Array.from(roomUsers.get(roomKey)!.values());
      io.to(roomKey).emit('room_users', activeUsers);
      socket.to(roomKey).emit('user_joined', user);

      console.log(`👥 [Socket.io] ${user.username} joined room ${roomKey}`);
    });

    // Mod added by a collaborator
    socket.on('mod_add', ({ modpackId, mod, user }: { modpackId: string; mod: ModItem; user: string }) => {
      const roomKey = `modpack:${modpackId}`;
      const modWithInitState: ModItem = {
        ...mod,
        addedBy: user,
        votes: mod.votes || { yes: [user], no: [] }, // Auto-vote yes by proposer
        comments: mod.comments || [],
      };
      console.log(`📦 [Socket.io] Mod added to ${roomKey}: ${mod.name} by ${user}`);
      socket.to(roomKey).emit('mod_added', { mod: modWithInitState, user, timestamp: new Date().toISOString() });
    });

    // Mod removed by a collaborator
    socket.on('mod_remove', ({ modpackId, modId, user }: { modpackId: string; modId: string; user: string }) => {
      const roomKey = `modpack:${modpackId}`;
      console.log(`🗑️  [Socket.io] Mod removed from ${roomKey}: ${modId} by ${user}`);
      socket.to(roomKey).emit('mod_removed', { modId, user, timestamp: new Date().toISOString() });
    });

    // Mod voting (Yes or No)
    socket.on('mod_vote', ({ modpackId, modId, vote, user }: { modpackId: string; modId: string; vote: 'yes' | 'no'; user: string }) => {
      const roomKey = `modpack:${modpackId}`;
      console.log(`🗳️  [Socket.io] Mod vote on ${modId} in ${roomKey}: ${vote} by ${user}`);
      io.to(roomKey).emit('mod_voted', { modId, vote, user, timestamp: new Date().toISOString() });
    });

    // Mod comment added by a collaborator
    socket.on('mod_comment', ({ modpackId, modId, text, user }: { modpackId: string; modId: string; text: string; user: string }) => {
      const roomKey = `modpack:${modpackId}`;
      const comment: ModComment = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user,
        text,
        createdAt: new Date().toISOString(),
      };
      console.log(`💬 [Socket.io] Mod comment on ${modId} in ${roomKey} by ${user}: "${text}"`);
      io.to(roomKey).emit('mod_commented', { modId, comment });
    });

    // Cursor / activity update for real-time multiplayer feel
    socket.on('cursor_move', ({ modpackId, x, y, user }) => {
      const roomKey = `modpack:${modpackId}`;
      socket.to(roomKey).emit('user_cursor', { socketId: socket.id, x, y, user });
    });

    // Collaborative team chat / notes
    socket.on('chat_message', ({ modpackId, text, user }) => {
      const roomKey = `modpack:${modpackId}`;
      const msg = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        user,
        timestamp: new Date().toISOString(),
      };
      io.to(roomKey).emit('chat_message', msg);
    });

    // Handle disconnect
    socket.on('disconnecting', () => {
      for (const roomKey of socket.rooms) {
        if (roomUsers.has(roomKey)) {
          const user = roomUsers.get(roomKey)!.get(socket.id);
          roomUsers.get(roomKey)!.delete(socket.id);

          if (user) {
            socket.to(roomKey).emit('user_left', user);
            const remaining = Array.from(roomUsers.get(roomKey)!.values());
            socket.to(roomKey).emit('room_users', remaining);
          }
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
    });
  });
}
