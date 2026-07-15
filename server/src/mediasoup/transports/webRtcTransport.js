const createWebRtcTransport = async (router) => {
  const transport =
    await router.createWebRtcTransport({
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

  transport.on(
    "dtlsstatechange",
    (state) => {
      if (state === "closed") {
        transport.close();
      }
    }
  );

  transport.on("close", () => {
    console.log("transport closed");
  });

  return transport;
};

export default createWebRtcTransport;