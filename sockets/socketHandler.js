import jwt from 'jsonwebtoken';
import Board from '../models/Board.js';
import User from '../models/User.js';
import ActiveUser from '../models/ActiveUser.js';
import ContextNote from '../models/ContextNote.js';
const JWT_SECRET = process.env.JWT_SECRET || 'good_being_good';

const getRoomUsers = async (roomId) => {
  const usersList = await ActiveUser.find({ roomId });
  return usersList.map((u) => ({
    socketId: u.socketId,
    name: u.userName,
    role: u.role,
    canDraw: u.canDraw,
  }));
};

export const socketHandler = (io) => {
  // ─── JWT handshake auth ───
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id;
        socket.jwtUserName = decoded.userName;
      } catch {
        // token invalid – allow connection, identity from join-room
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    // ─── Join Room ──────────────────────────────────────────────────
    socket.on('join-room', async ({ userName, roomId }) => {
      try {
        // 1. Basic Validation: Board check
        const board = await Board.findOne({ boardId: roomId });
        if (!board) {
          socket.emit('error', 'Board not found.');
          return;
        }

        const displayName = socket.jwtUserName || userName;
        const isOwner = socket.userId && socket.userId === board.ownerId.toString();

        // 2. Check Admin Presence (If not owner)
        const adminSession = await ActiveUser.findOne({ roomId, role: 'Admin' });
        if (!isOwner && !adminSession) {
          socket.emit('error', 'The admin has not joined the board yet.');
          return;
        }

        // 3. Ghost Session Cleanup (If authenticated user reconnects)
        if (socket.userId) {
          const oldSessions = await ActiveUser.find({ roomId, userId: socket.userId });

          for (const old of oldSessions) {
            // ⬇️ YE LINE ADD KARO: Agar wahi socketId hai jo abhi connect hui hai, toh skip karo
            if (old.socketId === socket.id) continue;

            // Sirf tab kick karo agar socketId alag ho (matlab dusra tab ho)
            io.to(old.socketId).emit('error', 'You joined from another tab or reconnected.');

            const oldSocket = io.sockets.sockets.get(old.socketId);
            if (oldSocket) {
              oldSocket.leave(roomId);
            }

            await ActiveUser.deleteOne({ socketId: old.socketId });
          }
        }

        // 4. ROLE AND UPSERT (Ye main part hai - Do baar create nahi karna)
        const role = isOwner ? 'Admin' : 'User';

        // Ek hi baar update ya create (UPSERT) karein
        await ActiveUser.findOneAndUpdate(
          { socketId: socket.id },
          {
            socketId: socket.id,
            roomId: roomId,
            userId: socket.userId || null,
            userName: displayName,
            role: role,
            canDraw: true,
          },
          { upsert: true, new: true }
        );

        // 5. Join Socket Room
        socket.join(roomId);

        // 6. Track Activity for non-owners
        if (socket.userId && !isOwner) {
          await User.findByIdAndUpdate(socket.userId, { $addToSet: { joinedBoards: roomId } }).catch(err =>
            console.error('Failed to update joined boards:', err)
          );
        }

        // 7. Load State (Tldraw)
        if (board.tldrawState) {
          socket.emit('load-tldraw-state', board.tldrawState);
        }

        // 7b. Load Context Notes for this board
        const existingNotes = await ContextNote.find({ boardId: roomId }).lean();
        socket.emit('note:load', { notes: existingNotes });

        // 8. Success Response
        socket.emit('joined', { role, userName: displayName, roomId });
        io.to(roomId).emit('user_list', await getRoomUsers(roomId));

        console.log(`✅ User ${displayName} (${role}) joined room: ${roomId}`);

      } catch (err) {
        console.error("❌ Socket Join Error:", err);
        socket.emit('error', 'Internal server error during join.');
      }
    });

    // ─── Canvas Real-time Sync ──────────────────────────────────────
    socket.on('draw-action', ({ roomId, action }) => {
      socket.to(roomId).emit('draw-action', { action, fromSocketId: socket.id });
    });

    socket.on('draw_text', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('draw_text', { ...data, fromSocketId: socket.id });
    });

    // ─── Cursors Real-time Sync ─────────────────────────────────────
    socket.on('cursor-move', ({ roomId, x, y }) => {
      socket.to(roomId).emit('cursor-move', { socketId: socket.id, x, y });
    });

    // ─── tldraw Real-time Sync (Legacy Support) ──────────────────────
    socket.on('tldraw-changes', ({ roomId, updates }) => {
      socket.to(roomId).emit('tldraw-changes', { updates, fromSocketId: socket.id });
    });

    // ─── Context Layer: Notes & Code Snippets ───────────────────────
    socket.on('note:create', async ({ boardId, note }) => {
      try {
        const user = await ActiveUser.findOne({ socketId: socket.id });
        const authorName = user?.userName || 'Anonymous';
        const authorId = user?.userId || null;

        const saved = await ContextNote.create({
          boardId,
          type: note.type || 'note',
          content: note.content,
          language: note.language || 'javascript',
          color: note.color || '#fde68a',
          x: note.x ?? 200,
          y: note.y ?? 200,
          width: note.width ?? 280,
          authorName,
          authorId,
        });

        // Broadcast to ALL in room (including sender for consistency)
        io.to(boardId).emit('note:created', saved.toObject());
      } catch (err) {
        console.error('note:create error:', err);
      }
    });

    socket.on('note:update', async ({ boardId, noteId, partial }) => {
      try {
        const user = await ActiveUser.findOne({ socketId: socket.id });
        const note = await ContextNote.findOne({ noteId, boardId });
        if (!note) return;

        // Only author or Admin can update
        const isAdmin = user?.role === 'Admin';
        const isAuthor = user?.userId && String(note.authorId) === String(user.userId);
        if (!isAdmin && !isAuthor) return;

        const allowed = ['content', 'x', 'y', 'width', 'color', 'language'];
        for (const key of allowed) {
          if (partial[key] !== undefined) note[key] = partial[key];
        }
        note.updatedAt = new Date();
        await note.save();

        io.to(boardId).emit('note:updated', { noteId, partial });
      } catch (err) {
        console.error('note:update error:', err);
      }
    });

    socket.on('note:delete', async ({ boardId, noteId }) => {
      try {
        const user = await ActiveUser.findOne({ socketId: socket.id });
        const note = await ContextNote.findOne({ noteId, boardId });
        if (!note) return;

        const isAdmin = user?.role === 'Admin';
        const isAuthor = user?.userId && String(note.authorId) === String(user.userId);
        if (!isAdmin && !isAuthor) return;

        await ContextNote.deleteOne({ noteId, boardId });
        io.to(boardId).emit('note:deleted', { noteId });
      } catch (err) {
        console.error('note:delete error:', err);
      }
    });



    // ─── Save tldraw State (Legacy Persistence) ─────────────────────
    socket.on('save-tldraw-state', async ({ roomId, state }) => {
      try {
        await Board.findOneAndUpdate(
          { boardId: roomId },
          { tldrawState: state },
          { upsert: false }
        );
      } catch (err) {
        console.error('tldraw state save failed:', err);
      }
    });

    // ─── Permission Toggle (Admin only) ────────────────────────────
    socket.on('toggle-permission', async ({ targetSocketId, roomId }) => {
      const admin = await ActiveUser.findOne({ socketId: socket.id });
      if (!admin || admin.role !== 'Admin') return;

      const targetUser = await ActiveUser.findOne({ socketId: targetSocketId, roomId });
      if (!targetUser) return;

      targetUser.canDraw = !targetUser.canDraw;
      await targetUser.save();

      io.to(targetSocketId).emit('permission-changed', targetUser.canDraw);
      io.to(roomId).emit('user_list', await getRoomUsers(roomId));
    });

    // ─── Clear Canvas (Admin only) ──────────────────────────────────
    socket.on('clear_canvas', async ({ roomId }) => {
      const user = await ActiveUser.findOne({ socketId: socket.id });
      if (!user || user.role !== 'Admin') return;

      try {
        await Board.findOneAndUpdate({ boardId: roomId }, { tldrawState: null });
        io.to(roomId).emit('clear_canvas');
      } catch (err) { console.error('Clear canvas error:', err); }
    });

    // ─── Disconnect or Leave Room ──────────────────────────────────
    const handleLeave = async (socketId, explicitRoomId = null) => {
      const user = await ActiveUser.findOne({ socketId });
      if (!user) return;

      const roomId = explicitRoomId || user.roomId;
      const role = user.role;

      await ActiveUser.deleteOne({ socketId });

      if (role === 'Admin') {
        const stillAdmin = await ActiveUser.findOne({ roomId, role: 'Admin' });
        if (!stillAdmin) {
          io.to(roomId).emit('admin-left');
        }
      }

      io.to(roomId).emit('user_list', await getRoomUsers(roomId));
    };

    socket.on('leave-room', async ({ roomId }) => {
      socket.leave(roomId);
      await handleLeave(socket.id, roomId);
    });

    socket.on("disconnect", async () => {
      try {
        await handleLeave(socket.id);
        console.log("User disconnected and removed from DB");
      } catch (err) {
        console.error("Disconnect Error:", err);
      }
    });
  });
};
