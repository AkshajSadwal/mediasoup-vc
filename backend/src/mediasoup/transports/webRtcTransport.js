const createWebRtcTransport = async (router) => {
  // Local-development mode: when no announced IP is configured, bind to
  // loopback so the ICE candidate is directly usable by localhost clients.
  // For LAN/public deployment, set MEDIASOUP_LISTEN_IP/ANNOUNCED_IP explicitly.
  const listenIp =
    process.env.MEDIASOUP_ANNOUNCED_IP
      ? process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0"
      : "127.0.0.1";
  const announcedIp =
    process.env.MEDIASOUP_ANNOUNCED_IP || undefined;

  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        ip: listenIp,
        announcedIp,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transport.on("dtlsstatechange", (state) => {
    console.log("DTLS STATE", transport.id, state);
    if (state === "closed") {
      transport.close();
    }
  });

  transport.on("icestatechange", (state) => {
    console.log("ICE STATE", transport.id, state);
  });

  transport.on("close", () => {
    console.log("transport closed:", transport.id);
  });

  console.log("WEBRTC TRANSPORT READY", transport.id, {
    listenIp,
    announcedIp: announcedIp || null,
    iceCandidates: transport.iceCandidates,
  });

  return transport;
};

export default createWebRtcTransport;
