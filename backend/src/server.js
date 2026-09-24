import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import { initializeWorker, getWorker } from "./mediasoup/workers/workerManager.js";
import { closeAllConsumers } from "./mediasoup/consumers/consumerManager.js";
import { closeAllProducers } from "./mediasoup/producers/producerManager.js";
import { closeAllTransports } from "./mediasoup/transports/transportManager.js";
import { closeAllRooms } from "./mediasoup/rooms/roomManager.js";
import initializeSocket from "./socket/index.js";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
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
    if (worker && !worker.closed) {
      await worker.close();
    }
  } catch (error) {
    console.error("WORKER CLOSE FAILED", error);
  }

  server.close(() => {
    process.exit(0);
  });

  // Do not let a stuck socket prevent Ctrl+C from returning to the shell.
  setTimeout(() => process.exit(0), 1500).unref();
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
