import jwt from 'jsonwebtoken';
import Board from '../models/Board.js';
import User from '../models/User.js';
import ActiveUser from '../models/ActiveUser.js';
import Drawing from '../models/Drawing.js';

const JWT_SECRET = process.env.JWT_SECRET || 'wb_super_secret_key_change_in_prod';

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

        // 7. Load State (Canvas or Tldraw)
        const drawing = await Drawing.findOne({ roomId });
        if (drawing && drawing.snapshot) {
          socket.emit('load-canvas', drawing.snapshot);
        } else if (board.tldrawState) {
          socket.emit('load-tldraw-state', board.tldrawState);
        }

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

    // ─── Save Canvas Snapshot (MongoDB Persistence) ─────────────────
    socket.on('save-snapshot', async ({ roomId, snapshot }) => {
      try {
        await Drawing.findOneAndUpdate(
          { roomId },
          { snapshot, updatedAt: Date.now() },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error('Canvas snapshot save failed:', err);
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
        await Drawing.findOneAndUpdate({ roomId }, { snapshot: null });
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
        await ActiveUser.deleteOne({ socketId: socket.id });
        console.log("User disconnected and removed from DB");
      } catch (err) {
        console.error("Disconnect Error:", err);
      }
    });
  });
};
