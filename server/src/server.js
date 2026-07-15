import express from "express";
import http from "http";
import { Server } from "socket.io";

import { initializeWorker } from "./mediasoup/workers/workerManager.js";
import initializeSocket from "./socket/index.js";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

const PORT = 4000;

await initializeWorker();

initializeSocket(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});