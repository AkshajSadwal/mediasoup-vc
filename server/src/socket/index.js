import registerSocketHandlers from "./socketHandlers.js";

const initializeSocket = (io) => {
  const peersNamespace =
    io.of("/mediasoup");

  peersNamespace.on(
    "connection",
    (socket) => {
      registerSocketHandlers(
        socket,
        peersNamespace
      );
    }
  );
};

export default initializeSocket;