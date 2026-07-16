const createWebRtcTransport = async (router) => {
  const transport =
    await router.createWebRtcTransport({
      listenIps: [
        {
        ip: process.env.MEDIASOUP_LISTEN_IP,
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null,
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