"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { useParams } from "next/navigation";

import RoomHeader from "@/components/room/RoomHeader";
import VideoGrid from "@/components/room/VideoGrid";
import BottomControls from "@/components/room/BottomControls";
import ToastMessage from "@/components/room/ToastMessage";

export default function Home() {
  const params = useParams();
  const roomName = params.roomId;
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const participantStatesRef = useRef({});

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [message, setMessage] = useState("");

  const toggleVideo = () => {
    const videoTrack = paramsRef.current.videoTrack;
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setVideoEnabled(videoTrack.enabled);
    socketRef.current.emit("video-state", {
      enabled: videoTrack.enabled,
    });
  };

  const toggleAudio = () => {
    const audioTrack = paramsRef.current.audioTrack;
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setAudioEnabled(audioTrack.enabled);
    socketRef.current.emit("audio-state", {
      enabled: audioTrack.enabled,
    });
  };

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(roomName);
    setMessage("Room code copied!");
    setTimeout(() => {
      setMessage("");
    }, 2000);
  };

  const copyRoomLink = async () => {
    const link = window.location.href;
    await navigator.clipboard.writeText(link);
    setMessage("Room link copied!");
    setTimeout(() => {
      setMessage("");
    }, 2000);
  };

  const shareRoom = async () => {
    const link = window.location.href;

    if (navigator.share) {
      await navigator.share({
        title: "Join my video room",
        text: `Join my room: ${roomName}`,
        url: link,
      });
    } else {
      copyRoomLink();
    }
  };

  const paramsRef = useRef({
    encodings: [
      {
        rid: "r0",
        maxBitrate: 100000,
        scalabilityMode: "S1T3",
      },
      {
        rid: "r1",
        maxBitrate: 300000,
        scalabilityMode: "S1T3",
      },
      {
        rid: "r2",
        maxBitrate: 900000,
        scalabilityMode: "S1T3",
      },
    ],
    codecOptions: {
      videoGoogleStartBitrate: 1000,
    },
  });

  const [remoteStreams, setRemoteStreams] = useState([]);
  const consumerTransports = useRef([]);

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL}/mediasoup`);
    socketRef.current = socket;
    socket.on("connect", () => {
      console.log("connected", socket.id);
      joinRoom();
    });
    socket.on("new-producer", ({ producerId, peerId }) => {
      signalNewConsumerTransport(producerId, peerId);
    });
    socket.on("producer-closed", ({ remoteProducerId }) => {
      setRemoteStreams((prev) =>
        prev.filter((item) => item.producerId !== remoteProducerId),
      );
    });

    socket.on("audio-state", ({ peerId, enabled }) => {
      setRemoteStreams((prev) =>
        prev.map((item) =>
          item.peerId === peerId
            ? {
                ...item,
                audioEnabled: enabled,
              }
            : item,
        ),
      );
    });
    socket.on("video-state", ({ peerId, enabled }) => {
      setRemoteStreams((prev) =>
        prev.map((item) =>
          item.peerId === peerId
            ? {
                ...item,
                videoEnabled: enabled,
              }
            : item,
        ),
      );
    });

    socket.on("participant-state", ({ peerId, audioEnabled, videoEnabled }) => {
      participantStatesRef.current[peerId] = {
        audioEnabled,
        videoEnabled,
      };
      setRemoteStreams((prev) =>
        prev.map((item) =>
          item.peerId === peerId
            ? {
                ...item,
                audioEnabled,
                videoEnabled,
              }
            : item,
        ),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = () => {
    socketRef.current.emit(
      "joinRoom",
      { roomName },
      async ({ rtpCapabilities }) => {
        const device = new mediasoupClient.Device();
        await device.load({
          routerRtpCapabilities: rtpCapabilities,
        });
        deviceRef.current = device;
        await getLocalStream();

        socketRef.current.emit("getProducers", (producers) => {
          producers.forEach(({ producerId, peerId }) =>
            signalNewConsumerTransport(producerId, peerId),
          );
        });
      },
    );
  };

  const getLocalStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: 1280,
        height: 720,
      },
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    paramsRef.current = {
      ...paramsRef.current,
      videoTrack: stream.getVideoTracks()[0],
      audioTrack: stream.getAudioTracks()[0],
    };

    createProducerTransport();
  };
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [remoteStreams]);

  const createProducerTransport = () => {
    socketRef.current.emit(
      "createWebRtcTransport",
      {
        sender: true,
      },
      ({ params }) => {
        const transport = deviceRef.current.createSendTransport(params);
        producerTransportRef.current = transport;

        transport.on("connect", ({ dtlsParameters }, callback) => {
          socketRef.current.emit("transport-connect", { dtlsParameters });
          callback();
        });

        transport.on("produce", (parameters, callback) => {
          socketRef.current.emit(
            "transport-produce",
            {
              kind: parameters.kind,

              rtpParameters: parameters.rtpParameters,
            },
            ({ id }) => {
              callback({
                id,
              });
            },
          );
        });
        produce();
      },
    );
  };

  const produce = async () => {
    const { videoTrack, audioTrack, encodings, codecOptions } =
      paramsRef.current;
    if (videoTrack) {
      await producerTransportRef.current.produce({
        track: videoTrack,
        encodings,
        codecOptions,
      });
    }

    if (audioTrack) {
      await producerTransportRef.current.produce({
        track: audioTrack,
      });
    }
  };
  const signalNewConsumerTransport = (producerId, peerId) => {
    const exists = consumerTransports.current.find(
      (item) => item.producerId === producerId,
    );
    if (exists) return;
    socketRef.current.emit(
      "createWebRtcTransport",
      {
        sender: false,
      },
      ({ params }) => {
        console.log("RECV TRANSPORT PARAMS:", params);

        if (
          !params ||
          !params.id ||
          !params.iceParameters ||
          !params.iceCandidates ||
          !params.dtlsParameters
        ) {
          console.error("INVALID TRANSPORT PARAMS:", params);
          return;
        }

        const consumerTransport = deviceRef.current.createRecvTransport(params);
        consumerTransport.on("connect", ({ dtlsParameters }, callback) => {
          socketRef.current.emit("transport-recv-connect", {
            dtlsParameters,
            serverConsumerTransportId: params.id,
          });
          callback();
        });

        consumerTransports.current.push({
          producerId,
          transport: consumerTransport,
        });

        consume(producerId, peerId, consumerTransport, params.id);
      },
    );
  };

  const consume = (producerId, peerId, transport, transportId) => {
    socketRef.current.emit(
      "consume",
      {
        rtpCapabilities: deviceRef.current.rtpCapabilities,
        remoteProducerId: producerId,
        serverConsumerTransportId: transportId,
      },
      async ({ params }) => {
        const consumer = await transport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });
        setRemoteStreams((prev) => {
          const existing = prev.find((item) => item.peerId === peerId);
          if (existing) {
            existing.stream.addTrack(consumer.track);
            return [...prev];
          }

          const savedState = participantStatesRef.current[peerId] || {
            audioEnabled: true,
            videoEnabled: true,
          };

          return [
            ...prev,
            {
              producerId,
              peerId,
              stream: new MediaStream([consumer.track]),
              audioEnabled: savedState.audioEnabled,
              videoEnabled: savedState.videoEnabled,
            },
          ];
        });

        socketRef.current.emit("consumer-resume", {
          serverConsumerId: params.serverConsumerId,
        });
      },
    );
  };

  return (
    <main
      className="
        min-h-screen
        h-screen
        bg-[#0d0d0d]
        text-white
        flex
        flex-col
        overflow-hidden
        "
    >
      <RoomHeader
        roomName={roomName}
        participantCount={remoteStreams.length + 1}
      />

      <VideoGrid
        remoteStreams={remoteStreams}
        localVideoRef={localVideoRef}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
      />

      <BottomControls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        copyRoomCode={copyRoomCode}
        shareRoom={shareRoom}
      />

      <ToastMessage message={message} />
    </main>
  );
}
