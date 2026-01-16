import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import Drawing from "./models/Drawing.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());

const users = {};
const roomAdmins = {};

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const getRoomUsers = (roomId) => {
  return Object.entries(users)
    .filter(([_, u]) => u.roomId === roomId)
    .map(([socketId, u]) => ({
      socketId, // ✅ UNIQUE IDENTIFIER
      name: u.userName, // display only
      role: u.role,
      canDraw: u.canDraw,
    }));
};

io.on("connection", (socket) => {
  socket.on("join-room", async ({ userName, roomId }) => {
    // 1. Check for duplicate names in the same room
    const isDuplicate = Object.values(users).some(
      (u) =>
        u.roomId === roomId &&
        u.userName.toLowerCase() === userName.toLowerCase()
    );

    if (isDuplicate) {
      socket.emit("error", "Username already taken in this room.");
      return;
    }

    socket.join(roomId);

    const drawing = await Drawing.findOne({ roomId });

    if (drawing && drawing.snapshot) {
      socket.emit("load-canvas", drawing.snapshot);
    }

    // 2. Assign Admin role to the first person
    let role = "User";
    if (!roomAdmins[roomId]) {
      roomAdmins[roomId] = socket.id;
      role = "Admin";
    }

    users[socket.id] = { userName, roomId, role, canDraw: true };

    socket.emit("joined", {
      role,
      userName,
      roomId,
    });

    // 3. Send structured objects to the client
    io.to(roomId).emit("user_list", getRoomUsers(roomId));
  });

  socket.on("toggle-permission", ({ targetSocketId, roomId }) => {
    const admin = users[socket.id];

    if (!admin || admin.role !== "Admin") return;

    const targetUser = users[targetSocketId];
    if (!targetUser || targetUser.roomId !== roomId) return;

    // Toggle permission
    targetUser.canDraw = !targetUser.canDraw;

    // Notify target user
    io.to(targetSocketId).emit("permission-changed", targetUser.canDraw);

    // Update everyone
    io.to(roomId).emit("user_list", getRoomUsers(roomId));
  });

  socket.on("save-snapshot", async ({ roomId, snapshot }) => {
    await Drawing.findOneAndUpdate(
      { roomId },
      {
        snapshot,
        updatedAt: new Date(),
      },
      { upsert: true }
    );
  });

  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      const { roomId, role } = user;
      delete users[socket.id];

      // Reassign Admin if creator left
      if (role === "Admin" && roomAdmins[roomId] === socket.id) {
        delete roomAdmins[roomId];
        const nextAdminId = Object.keys(users).find(
          (id) => users[id].roomId === roomId
        );
        if (nextAdminId) {
          roomAdmins[roomId] = nextAdminId;
          users[nextAdminId].role = "Admin";
        }
      }

      io.to(roomId).emit("user_list", getRoomUsers(roomId));
    }
  });

  socket.on("draw", (data) => {
    socket.to(data.roomId).emit("draw", data);
  });

  socket.on("draw_shape", (data) =>
    socket.to(data.roomId).emit("draw_shape", data)
  );

  socket.on("draw_text", (data) => {
    socket.to(data.roomId).emit("draw_text", data);
  });

  socket.on("cursor-move", ({ x, y, roomId }) => {
    const user = users[socket.id];
    if (!user) return;

    // send cursor position to everyone else
    socket.to(roomId).emit("cursor-update", {
      socketId: socket.id,
      x,
      y,
    });
  });

  socket.on("clear_canvas", async ({ roomId }) => {
    const user = users[socket.id];
    if (!user || user.role !== "Admin") return;

    // Clear snapshot in DB
    await Drawing.findOneAndUpdate(
      { roomId },
      { snapshot: null, updatedAt: new Date() },
      { upsert: true }
    );

    io.to(roomId).emit("clear_canvas");
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
