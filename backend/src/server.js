import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

import { initializeWorker, getWorker } from "./mediasoup/workers/workerManager.js";
import { closeAllConsumers } from "./mediasoup/consumers/consumerManager.js";
import { closeAllProducers } from "./mediasoup/producers/producerManager.js";
import { closeAllTransports } from "./mediasoup/transports/transportManager.js";
import { closeAllRooms } from "./mediasoup/rooms/roomManager.js";
import initializeSocket from "./socket/index.js";
import authRoutes from "./http/authRoutes.js";
import meetingRoutes from "./http/meetingRoutes.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

const PORT = process.env.PORT || 4000;

await initializeWorker();
initializeSocket(io);

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Shutting down server (${signal})...`);
  io.close();

  try {
    closeAllConsumers();
    closeAllProducers();
    closeAllTransports();
    closeAllRooms();
  } catch (error) {
    console.error("RESOURCE CLEANUP FAILED", error);
  }

  try {
    const worker = getWorker();
    if (worker && !worker.closed) await worker.close();
  } catch (error) {
    console.error("WORKER CLOSE FAILED", error);
  }

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing backend before starting another one.`);
  } else {
    console.error("SERVER ERROR", error);
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
