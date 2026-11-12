// Socket.io server setup for collaborative modpack editing
//
// Handles tracking active users in a modpack room and broadcasting updates to all users in that room.
//

import { Server, Socket } from 'socket.io';
import { ModComment, ModItem, UserPresence } from '../types/consts.js'; // Import the types.

/**
* - <Key= ModpackId, Value= Map<SocketId, UserPresence> >
*
* Tracks which users are in which modpack rooms. Used to broadcast updates to all users in a room.
*/
const roomUsers = new Map<string, Map<string, UserPresence>>();

/**
 * The server handles the following events:
 * - `join_room`: A user joins a modpack room.
 * - `mod_add`: A mod gets added to the active modpack
 * - `mod_remove`: A mod gets removed from the active modpack
 * - `mod_vote`: A vote gets cast on a
 * - `mod_comment`: A comment gets added to a mod in the active modpack
 * - `disconnect`: A user disconnects from the server
 * @param io
 */
export function setupCollaborationSockets(io: Server) {

  // Handle client connections and events.
  io.on('connection', (socket: Socket) => {
    console.log(`⚡ [Socket.io] Client connected: ${socket.id}`); // Log the id of the socket that just connected to the server

    // Join collaborative modpack room
    socket.on('join_room', ({ modpackId, username, color }) => {
      const roomKey = `modpack:${modpackId}`;
      socket.join(roomKey);

      // Create room users map if it does not exist.
      if (!roomUsers.has(roomKey)) {
        roomUsers.set(roomKey, new Map());
      }

      // Create user presence object and add to room users map.
      const user: UserPresence = {
        socketId: socket.id,
        username: username || `UNKNOWN_USER`,
        color: color || '#10b981',
      };

      // Update room users map with new user.
      roomUsers.get(roomKey)!.set(socket.id, user);

      // Notify room of updated users list
      const activeUsers = Array.from(roomUsers.get(roomKey)!.values());
      io.to(roomKey).emit('room_users', activeUsers); // Tell room of new user list.
      socket.to(roomKey).emit('user_joined', user); // Notify other users of other user in room.

      console.log(`👥 [Socket.io] ${user.username} joined room ${roomKey}`);
    });

    // Mod added by a collaborator
    socket.on(
      'mod_add',
      ({ modpackId, mod, user }: { modpackId: string; mod: ModItem; user: string }) => {
        const roomKey = `modpack:${modpackId}`;
        const modWithInitState: ModItem = {
          ...mod,
          addedBy: user, // Store who added the mod
          votes: mod.votes || { yes: [user], no: [] }, // Store votes (Yes's and No's)
          comments: mod.comments || [], // Store comments by other users
        };
        console.log(`📦 [Socket.io] Mod added to ${roomKey}: ${mod.name} by ${user}`);
        socket
          .to(roomKey)
          .emit('mod_added', { mod: modWithInitState, user, timestamp: new Date().toISOString() });
      }
    );

    // Mod removed by a collaborator
    socket.on(
      'mod_remove',
      ({ modpackId, modId, user }: { modpackId: string; modId: string; user: string }) => {
        const roomKey = `modpack:${modpackId}`;
        console.log(`🗑️  [Socket.io] Mod removed from ${roomKey}: ${modId} by ${user}`);
        socket
          .to(roomKey)
          .emit('mod_removed', { modId, user, timestamp: new Date().toISOString() });
      }
    );

    // Mod voting (Yes or No)
    socket.on(
      'mod_vote',
      ({
        modpackId,
        modId,
        vote,
        user,
      }: {
        modpackId: string;
        modId: string;
        vote: 'yes' | 'no';
        user: string;
      }) => {
        const roomKey = `modpack:${modpackId}`;
        console.log(`🗳️  [Socket.io] Mod vote on ${modId} in ${roomKey}: ${vote} by ${user}`);
        io.to(roomKey).emit('mod_voted', {
          modId,
          vote,
          user,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // Mod comment added by a collaborator
    socket.on(
      'mod_comment',
      ({
        modpackId, // Which room wer'e in
        modId, // What specific mod this comment will be on
        comment: incomingComment, // Incoming comment object from client
      }: {
        modpackId: string;
        modId: string;
        comment?: ModComment;
        }) => {
        // Check to make sure the comment isnt blank, otherwise ignore it.
        if (!incomingComment?.text?.trim())
        {
          return
        }

        const roomKey = `modpack:${modpackId}`;
        const comment: ModComment = incomingComment;

        console.log(
          `💬 [Socket.io] Mod comment on ${modId} in ${roomKey} by ${comment.user}: "${comment.text}"`
        );
        io.to(roomKey).emit('mod_commented', { modId, comment });
      }
    );

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

    // The difference between this and disconnecting is that disconnecting is
    // called when the client is about to be disconnected, but disconnect is
    // called when the client has been disconnected.
    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
    });
  });
}
