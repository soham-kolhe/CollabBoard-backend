import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { socketHandler } from "./sockets/socketHandler.js";
import authRoutes from "./routes/auth.js";
import boardRoutes from "./routes/boards.js";

dotenv.config();

const app = express();

// ─── Middleware ───────────────────────────────────────────
app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));
app.use(express.json({ limit: "10mb" })); // allow large tldraw JSON payloads

// ─── REST Routes ──────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/boards", boardRoutes);

// ─── HTTP + Socket.io Server ──────────────────────────────
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ─── Socket Event Handling ────────────────────────────────
socketHandler(io);

// ─── Database & Start ─────────────────────────────────────
const startServer = async () => {
  await connectDB();
  
  // Clean up any remaining zombie connections from previous run
  const { default: ActiveUser } = await import('./models/ActiveUser.js');
  await ActiveUser.deleteMany({});
  
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
};

startServer();
