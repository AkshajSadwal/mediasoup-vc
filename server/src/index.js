
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mediasoup from "mediasoup";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

const PORT = 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const peersNamespace = io.of("/mediasoup");

let worker;

const rooms = {};
const peers = {};

let transports = [];
let producers = [];
let consumers = [];


const mediaCodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
];

const createWorker = async () => {
  const worker = await mediasoup.createWorker({
    rtcMinPort: 2000,
    rtcMaxPort: 2020,
  });

  console.log(`worker pid ${worker.pid}`);

  worker.on("died", () => {
    console.error("mediasoup worker died");
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
};

worker = await createWorker();

const createRoom = async (roomName, socketId) => {
  let router;

  const room = rooms[roomName];

  if (room) {
    router = room.router;

    room.peers.push(socketId);
  } else {
    router = await worker.createRouter({
      mediaCodecs,
    });

    rooms[roomName] = {
      router,
      peers: [socketId],
    };
  }

  return router;
};

const addTransport = ({
  transport,
  roomName,
  socketId,
  consumer,
}) => {
  transports.push({
    transport,
    roomName,
    socketId,
    consumer,
  });

  peers[socketId].transports.push(transport.id);
};

const addProducer = ({
  producer,
  roomName,
  socketId,
}) => {
  producers.push({
    producer,
    roomName,
    socketId,
  });

  peers[socketId].producers.push(producer.id);
};

const addConsumer = ({
  consumer,
  roomName,
  socketId,
}) => {
  consumers.push({
    consumer,
    roomName,
    socketId,
  });

  peers[socketId].consumers.push(consumer.id);
};

const getTransport = (socketId, consumer = false) => {
  const transportData = transports.find(
    (t) =>
      t.socketId === socketId &&
      t.consumer === consumer
  );

  return transportData?.transport;
};

const createWebRtcTransport = async (router) => {
  const transport =await router.createWebRtcTransport({
      listenIps: [
        {
          ip: "127.0.0.1",
          announcedIp: null,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

  transport.on("dtlsstatechange", (state) => {
    if (state === "closed") {
      transport.close();
    }
  });

  transport.on("close", () => {
    console.log("transport closed");
  });

  return transport;
};

const removeItems = (items, socketId, type) => {
  items.forEach((item) => {
    if (item.socketId === socketId) {
      item[type].close();
    }
  });

  return items.filter(
    (item) => item.socketId !== socketId
  );
};

peersNamespace.on("connection", async (socket) => {
  console.log("connected:", socket.id);

  socket.emit("connection-success", {
    socketId: socket.id,
  });

  socket.on(
  "joinRoom",
  async ({ roomName }, callback) => {

    try {

      socket.join(roomName);


      const router =
        await createRoom(
          roomName,
          socket.id
        );


      peers[socket.id] = {
        socket,
        roomName,
        transports: [],
        producers: [],
        consumers: [],

      };


      callback({
        rtpCapabilities:
        router.rtpCapabilities
      });
    } catch(error){
      console.log(error);
    }
  }
);
  socket.on(
    "createWebRtcTransport",
    async ({ sender }, callback) => {
      try {
        const roomName =peers[socket.id].roomName;
        const router =rooms[roomName].router;
        const transport =await createWebRtcTransport(router);
          console.log(
            "TRANSPORT CREATED:",
            transport.id,
            "sender:",
            sender,
            "socket:",
            socket.id
          );
        addTransport({
          transport,
          roomName,
          socketId: socket.id,
          consumer: !sender,
        });
        callback({
          params: {
            id: transport.id,
            iceParameters:
              transport.iceParameters,
            iceCandidates:
              transport.iceCandidates,
            dtlsParameters:
              transport.dtlsParameters,
          },
        });
      } catch (error) {
          console.error(
            "TRANSPORT CREATE FAILED",
            error
          );
           callback({
            params: {
              error: error.message,
            },
          });
        }
    }
  );
  socket.on(
    "transport-connect",
    async ({ dtlsParameters }) => {
      const transport = getTransport(
        socket.id,
        false
      );
      await transport.connect({
        dtlsParameters,
      });
    }
  );
  socket.on(
    "transport-produce",
    async (
      {
        kind,
        rtpParameters,
      },
      callback
    ) => {
      const transport = getTransport(
        socket.id,
        false
      );

      const producer =
        await transport.produce({
          kind,
          rtpParameters,
        });

      const roomName =
        peers[socket.id].roomName;

      addProducer({
        producer,
        roomName,
        socketId: socket.id,
      });

      producer.on(
        "transportclose",
        () => {
          producer.close();
        }
      );

      socket.to(roomName).emit(
  "new-producer",
  {
    producerId: producer.id,
    peerId: socket.id,
  }
);

      callback({
        id: producer.id,
      });
    }
  );

  socket.on(
    "getProducers",
    (callback) => {
      const roomName =
        peers[socket.id].roomName;

      const producerList =
  producers
    .filter(
      (p) =>
        p.roomName === roomName &&
        p.socketId !== socket.id
    )
    .map(
      (p) => ({
        producerId: p.producer.id,
        peerId: p.socketId,
      })
    );

      callback(producerList);
    }
  );

  socket.on(
    "transport-recv-connect",
    async ({
      dtlsParameters,
      serverConsumerTransportId,
    }) => {
      const transportData =
        transports.find(
          (t) =>
            t.transport.id ===
            serverConsumerTransportId
        );
      await transportData.transport.connect(
        {
          dtlsParameters,
        }
      );
    }
  );

  socket.on(
    "consume",
    async (
      {
        rtpCapabilities,
        remoteProducerId,
        serverConsumerTransportId,
      },
      callback
    ) => {
      try {
        const roomName =peers[socket.id].roomName;
        const router =rooms[roomName].router;
        if (
          !router.canConsume({
            producerId:
              remoteProducerId,
            rtpCapabilities,
          })
        ) {
          return;
        }

        const transportData =transports.find(
            (t) =>
              t.transport.id ===
              serverConsumerTransportId
          );

        const consumer =await transportData.transport.consume(
            {
              producerId:remoteProducerId,
              rtpCapabilities,
              paused: true,
            }
          );

        addConsumer({
          consumer,
          roomName,
          socketId: socket.id,
        });

        consumer.on(
          "transportclose",
          () => {
            console.log("consumer transport closed");
          }
        );

        consumer.on(
          "producerclose",
          () => {
            socket.emit(
              "producer-closed",
              {
                remoteProducerId,
              }
            );

            consumer.close();

            consumers =
              consumers.filter(
                (c) =>
                  c.consumer.id !==
                  consumer.id
              );

            transports =
              transports.filter(
                (t) =>
                  t.transport.id !==
                  transportData
                    .transport.id
              );
          }
        );

        callback({
          params: {
            producerId:
              remoteProducerId,
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters:
              consumer.rtpParameters,
            serverConsumerId:
              consumer.id,
          },
        });
      } catch (error) {
         console.error("CONSUME FAILED",error);

        callback({
          params: {
            error: error.message,
          },
        });
     }
    }
  );

  socket.on(
    "consumer-resume",
    async ({
      serverConsumerId,
    }) => {
      const consumerData =
        consumers.find(
          (c) =>
            c.consumer.id ===
            serverConsumerId
        );
      await consumerData.consumer.resume();
    }
  );


  socket.on("disconnect", () => {
    console.log("peer disconnected",socket.id);

    consumers = removeItems(
      consumers,
      socket.id,
      "consumer"
    );

    producers = removeItems(
      producers,
      socket.id,
      "producer"
    );

    transports = removeItems(
      transports,
      socket.id,
      "transport"
    );

    const peer =peers[socket.id];
    if (peer) {
      const roomName =peer.roomName;
      if (rooms[roomName]) {
        rooms[roomName].peers =rooms[roomName].peers.filter(
            (id) =>
              id !== socket.id
          );

        if (
          rooms[roomName].peers
            .length === 0
        ) {
          delete rooms[roomName];
        }
      }
      delete peers[socket.id];
    }
  });
});

