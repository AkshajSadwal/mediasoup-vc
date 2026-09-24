import registerSocketHandlers from "./socketHandlers.js";
import { verifyAuthToken } from "../auth/authStore.js";

const initializeSocket = (io) => {
  const peersNamespace = io.of("/mediasoup");

  peersNamespace.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    socket.user = token ? verifyAuthToken(token) : null;
    next();
  });

  peersNamespace.on("connection", (socket) => {
    registerSocketHandlers(socket, peersNamespace);
  });
};

export default initializeSocket;
