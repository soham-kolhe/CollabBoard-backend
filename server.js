// ⚠️  CRITICAL: dotenv MUST be imported AND configured before any other local
// imports in ES Modules. Unlike CommonJS (require), ESM import statements are
// hoisted and ALL modules are evaluated before any code in this file runs.
// This means aiAdvisor.js would read process.env.GEMINI_API_KEY as `undefined`
// if dotenv.config() hasn't been called first.
//
// Fix: Import dotenv synchronously at the top, call .config() immediately,
// then let Node resolve all other local modules with the env already populated.
import dotenv from "dotenv";
dotenv.config();

// ─── Debug: Confirm API key is loaded (remove after verification) ─────────────
const keyPreview = process.env.GEMINI_API_KEY
  ? `${process.env.GEMINI_API_KEY.slice(0, 8)}...`
  : 'NOT FOUND ❌';
console.log(`[ENV CHECK] GEMINI_API_KEY starts with: ${keyPreview}`);

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { socketHandler } from "./sockets/socketHandler.js";
import authRoutes from "./routes/auth.js";
import boardRoutes from "./routes/boards.js";
import aiRoutes from "./routes/ai.js";

const app = express();

// ─── CORS ───────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
];

if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// ─── Middleware ───────────────────────────────────────────
app.use(express.json({ limit: "10mb" })); // allow large tldraw JSON payloads

// ─── REST Routes ──────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/ai", aiRoutes);

// ─── HTTP + Socket.io Server ──────────────────────────────
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
};

startServer();
