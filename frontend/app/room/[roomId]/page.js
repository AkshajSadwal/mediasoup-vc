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
  const consumerTransportRef = useRef(null);
  const participantStatesRef = useRef({});
  const consumersRef = useRef(new Map());
  const remoteMediaStreamsRef = useRef(new Map());

  const getTrackSignature = (stream) =>
    stream
      .getTracks()
      .map((track) => `${track.kind}:${track.id}:${track.readyState}`)
      .sort()
      .join("|");
  const consumerSetupRef = useRef(new Set());
  const pendingProducerSignalsRef = useRef(new Map());
  const closedProducerIdsRef = useRef(new Set());
  const mountedRef = useRef(false);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [remoteStreams, setRemoteStreams] = useState([]);

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

  const showMessage = (text) => {
    if (!mountedRef.current) return;

    setMessage(text);
    window.setTimeout(() => setMessage(""), 2000);
  };

  const toggleVideo = () => {
    const videoTrack = paramsRef.current.videoTrack;
    if (!videoTrack || !socketRef.current) return;

    videoTrack.enabled = !videoTrack.enabled;
    setVideoEnabled(videoTrack.enabled);

    socketRef.current.emit("video-state", {
      enabled: videoTrack.enabled,
    });
  };

  const toggleAudio = () => {
    const audioTrack = paramsRef.current.audioTrack;
    if (!audioTrack || !socketRef.current) return;

    audioTrack.enabled = !audioTrack.enabled;
    setAudioEnabled(audioTrack.enabled);

    socketRef.current.emit("audio-state", {
      enabled: audioTrack.enabled,
    });
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomName);
      showMessage("Room code copied!");
    } catch (error) {
      console.error("ROOM CODE COPY FAILED", error);
      showMessage("Could not copy room code");
    }
  };

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showMessage("Room link copied!");
    } catch (error) {
      console.error("ROOM LINK COPY FAILED", error);
      showMessage("Could not copy room link");
    }
  };

  const shareRoom = async () => {
    try {
      const link = window.location.href;

      if (navigator.share) {
        await navigator.share({
          title: "Join my video room",
          text: `Join my room: ${roomName}`,
          url: link,
        });
      } else {
        await copyRoomLink();
      }
    } catch (error) {
      // Closing the native share dialog is not an application error.
      if (error?.name !== "AbortError") {
        console.error("ROOM SHARE FAILED", error);
      }
    }
  };

  const createProducerTransport = () => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit(
        "createWebRtcTransport",
        { sender: true },
        ({ params }) => {
          if (params?.error) {
            return reject(new Error(params.error));
          }

          if (
            !params?.id ||
            !params?.iceParameters ||
            !params?.iceCandidates ||
            !params?.dtlsParameters
          ) {
            return reject(
              new Error("Invalid producer transport parameters."),
            );
          }

          try {
            const transport = deviceRef.current.createSendTransport(params);
            producerTransportRef.current = transport;

            transport.on(
              "connect",
              ({ dtlsParameters }, callback, errback) => {
                socketRef.current.emit(
                  "transport-connect",
                  { dtlsParameters },
                  (error) => {
                    if (error) {
                      return errback(new Error(error));
                    }
                    callback();
                  },
                );
              },
            );

            transport.on(
              "produce",
              (parameters, callback, errback) => {
                socketRef.current.emit(
                  "transport-produce",
                  {
                    kind: parameters.kind,
                    rtpParameters: parameters.rtpParameters,
                  },
                  ({ id, error }) => {
                    if (error) {
                      return errback(new Error(error));
                    }
                    callback({ id });
                  },
                );
              },
            );

            transport.on(
              "connectionstatechange",
              (state) => {
                if (state === "failed" || state === "closed") {
                  console.error(
                    "PRODUCER TRANSPORT STATE:",
                    state,
                  );
                }
              },
            );

            resolve(transport);
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  };

  const produce = async () => {
    const { videoTrack, audioTrack, encodings, codecOptions } =
      paramsRef.current;
    const transport = producerTransportRef.current;

    if (!transport || transport.closed) {
      throw new Error("Producer transport is not available.");
    }

    if (videoTrack) {
      await transport.produce({
        track: videoTrack,
        encodings,
        codecOptions,
      });
    }

    if (audioTrack) {
      await transport.produce({
        track: audioTrack,
      });
    }
  };

  const createConsumerTransport = () => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit(
        "createWebRtcTransport",
        { sender: false },
        ({ params }) => {
          if (params?.error) {
            return reject(new Error(params.error));
          }

          if (
            !params?.id ||
            !params?.iceParameters ||
            !params?.iceCandidates ||
            !params?.dtlsParameters
          ) {
            return reject(
              new Error("Invalid consumer transport parameters."),
            );
          }

          try {
            const transport = deviceRef.current.createRecvTransport(params);
            consumerTransportRef.current = transport;

            transport.on(
              "connect",
              ({ dtlsParameters }, callback, errback) => {
                socketRef.current.emit(
                  "transport-recv-connect",
                  {
                    dtlsParameters,
                    serverConsumerTransportId: params.id,
                  },
                  (error) => {
                    if (error) {
                      return errback(new Error(error));
                    }
                    callback();
                  },
                );
              },
            );

            transport.on(
              "connectionstatechange",
              (state) => {
                console.log("CONSUMER TRANSPORT STATE:", state);
                if (state === "failed" || state === "closed") {
                  console.error(
                    "CONSUMER TRANSPORT STATE:",
                    state,
                  );
                }
              },
            );

            resolve(transport);
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  };

  const addRemoteConsumer = (
    producerId,
    peerId,
    consumer,
  ) => {
    const savedState = participantStatesRef.current[peerId] || {
      audioEnabled: true,
      videoEnabled: true,
    };

    let stream = remoteMediaStreamsRef.current.get(peerId);

    if (!stream) {
      stream = new MediaStream();
      remoteMediaStreamsRef.current.set(peerId, stream);
    }

    if (!stream.getTracks().some((track) => track.id === consumer.track.id)) {
      stream.addTrack(consumer.track);
    }

    setRemoteStreams((prev) => {
      const existing = prev.find(
        (item) => item.peerId === peerId,
      );

      if (existing) {
        return prev.map((item) =>
          item.peerId === peerId
            ? {
                ...item,
                producerIds: [
                  ...new Set([
                    ...item.producerIds,
                    producerId,
                  ]),
                ],
                // Keep the same MediaStream object for this peer.
                // Replacing it while audio/video consumers arrive can
                // interrupt video.play() with an AbortError.
                stream,
                trackSignature: getTrackSignature(stream),
                audioEnabled: savedState.audioEnabled,
                videoEnabled: savedState.videoEnabled,
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          producerIds: [producerId],
          peerId,
          stream,
          trackSignature: getTrackSignature(stream),
          audioEnabled: savedState.audioEnabled,
          videoEnabled: savedState.videoEnabled,
        },
      ];
    });
  };

  const removeRemoteProducer = (producerId) => {
    closedProducerIdsRef.current.add(producerId);
    pendingProducerSignalsRef.current.delete(producerId);

    const consumerData = consumersRef.current.get(producerId);
    if (consumerData) {
      try {
        consumerData.consumer.close();
      } catch (error) {
        console.error("CONSUMER CLOSE FAILED", error);
      }
      consumersRef.current.delete(producerId);
    }

    setRemoteStreams((prev) =>
      prev.flatMap((item) => {
        if (!item.producerIds.includes(producerId)) {
          return [item];
        }

        const remainingProducerIds = item.producerIds.filter(
          (id) => id !== producerId,
        );
        const removedTrack = consumerData?.consumer?.track;

        if (removedTrack && item.stream.getTracks().includes(removedTrack)) {
          item.stream.removeTrack(removedTrack);
        }

        if (remainingProducerIds.length === 0) {
          remoteMediaStreamsRef.current.delete(item.peerId);
          return [];
        }

        return [
          {
            ...item,
            producerIds: remainingProducerIds,
            // Keep the same stream object; its track list is updated in place.
            // Changing the signature forces RemoteVideo to retry playback after
            // a video/audio track is added or removed.
            stream: item.stream,
            trackSignature: getTrackSignature(item.stream),
          },
        ];
      }),
    );
  };

  const consume = async (
    producerId,
    peerId,
    transport,
    transportId,
  ) => {
    try {
      await new Promise((resolve, reject) => {
        socketRef.current.emit(
          "consume",
          {
            rtpCapabilities: deviceRef.current.rtpCapabilities,
            remoteProducerId: producerId,
            serverConsumerTransportId: transportId,
          },
          async ({ params }) => {
            if (params?.error) {
              return reject(new Error(params.error));
            }

            if (
              !params?.id ||
              !params?.producerId ||
              !params?.kind ||
              !params?.rtpParameters ||
              !params?.serverConsumerId
            ) {
              return reject(
                new Error("Invalid consumer parameters."),
              );
            }

            if (closedProducerIdsRef.current.has(producerId)) {
              return resolve();
            }

            try {
              const consumer = await transport.consume({
                id: params.id,
                producerId: params.producerId,
                kind: params.kind,
                rtpParameters: params.rtpParameters,
                streamId: peerId,
              });

              if (closedProducerIdsRef.current.has(producerId)) {
                consumer.close();
                return resolve();
              }

              consumersRef.current.set(producerId, {
                consumer,
                peerId,
                serverConsumerId: params.serverConsumerId,
              });

              console.log("REMOTE CONSUMER READY", {
                producerId,
                peerId,
                kind: consumer.kind,
                trackId: consumer.track.id,
                trackReadyState: consumer.track.readyState,
                trackMuted: consumer.track.muted,
              });

              consumer.track.addEventListener("ended", () => {
                console.warn("REMOTE TRACK ENDED", {
                  producerId,
                  peerId,
                  kind: consumer.kind,
                });
              });

              consumer.on("transportclose", () => {
                removeRemoteProducer(producerId);
              });

              consumer.on("trackended", () => {
                // The producer can still exist after a track ends.
                // The next producer/transport event will determine its state.
              });

              addRemoteConsumer(
                producerId,
                peerId,
                consumer,
              );

              socketRef.current.emit("consumer-resume", {
                serverConsumerId: params.serverConsumerId,
              });

              resolve();
            } catch (error) {
              reject(error);
            }
          },
        );
      });
    } catch (error) {
      console.error("CONSUME FAILED", error);
      removeRemoteProducer(producerId);
    } finally {
      consumerSetupRef.current.delete(producerId);
      pendingProducerSignalsRef.current.delete(producerId);
    }
  };

  const signalNewConsumerTransport = (
    producerId,
    peerId,
  ) => {
    if (!producerId || closedProducerIdsRef.current.has(producerId)) {
      return;
    }

    if (
      consumersRef.current.has(producerId) ||
      consumerSetupRef.current.has(producerId)
    ) {
      return;
    }

    if (
      !socketRef.current ||
      !deviceRef.current ||
      !consumerTransportRef.current
    ) {
      pendingProducerSignalsRef.current.set(producerId, peerId);
      return;
    }

    if (pendingProducerSignalsRef.current.has(producerId)) {
      peerId = pendingProducerSignalsRef.current.get(producerId) || peerId;
      pendingProducerSignalsRef.current.delete(producerId);
    }

    consumerSetupRef.current.add(producerId);

    consume(
      producerId,
      peerId,
      consumerTransportRef.current,
      consumerTransportRef.current.id,
    );
  };

  const flushPendingProducerSignals = () => {
    const pending = [...pendingProducerSignalsRef.current.entries()];

    pending.forEach(([producerId, peerId]) => {
      if (closedProducerIdsRef.current.has(producerId)) {
        pendingProducerSignalsRef.current.delete(producerId);
        return;
      }

      pendingProducerSignalsRef.current.delete(producerId);
      signalNewConsumerTransport(producerId, peerId);
    });
  };

  const requestExistingProducers = () => {
    socketRef.current.emit("getProducers", (producers) => {
      if (!Array.isArray(producers)) return;

      producers.forEach(({ producerId, peerId }) => {
        signalNewConsumerTransport(producerId, peerId);
      });
    });
  };

  const getLocalStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: 1280,
        height: 720,
      },
    });

    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    paramsRef.current = {
      ...paramsRef.current,
      videoTrack: stream.getVideoTracks()[0],
      audioTrack: stream.getAudioTracks()[0],
    };

    await createProducerTransport();
    await produce();
  };

  const cleanupMedia = () => {
    consumersRef.current.forEach(({ consumer }) => {
      try {
        consumer.close();
      } catch (error) {
        console.error("REMOTE CONSUMER CLEANUP FAILED", error);
      }
    });
    consumersRef.current.clear();
    consumerSetupRef.current.clear();
    remoteMediaStreamsRef.current.clear();

    try {
      producerTransportRef.current?.close();
    } catch (error) {
      console.error("PRODUCER TRANSPORT CLEANUP FAILED", error);
    }
    producerTransportRef.current = null;

    try {
      consumerTransportRef.current?.close();
    } catch (error) {
      console.error("CONSUMER TRANSPORT CLEANUP FAILED", error);
    }
    consumerTransportRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());
    }

    localStreamRef.current = null;
    paramsRef.current.videoTrack = null;
    paramsRef.current.audioTrack = null;
  };

  const joinRoom = () => {
    socketRef.current.emit(
      "joinRoom",
      { roomName },
      async (response) => {
        try {
          if (response?.error) {
            throw new Error(response.error);
          }

          if (!response?.rtpCapabilities) {
            throw new Error("Room did not return RTP capabilities.");
          }

          const device = new mediasoupClient.Device();
          await device.load({
            routerRtpCapabilities: response.rtpCapabilities,
          });
          deviceRef.current = device;

          if (!mountedRef.current) return;

          await createConsumerTransport();
          flushPendingProducerSignals();
          await getLocalStream();
          requestExistingProducers();
          flushPendingProducerSignals();

        } catch (error) {
          console.error("JOIN ROOM FAILED", error);
          showMessage(error.message || "Could not join room");
        }
      },
    );
  };

  useEffect(() => {
    mountedRef.current = true;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    const socket = io(`${socketUrl}/mediasoup`, {
      path: "/socket.io",
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("connected", socket.id);
      joinRoom();
    });

    socket.on("connect_error", (error) => {
      console.error("SOCKET CONNECT ERROR", error);
      showMessage("Server connection failed");
    });

    socket.on("new-producer", ({ producerId, peerId }) => {
      signalNewConsumerTransport(producerId, peerId);
    });

    socket.on("producer-closed", ({ remoteProducerId }) => {
      removeRemoteProducer(remoteProducerId);
    });

    socket.on("audio-state", ({ peerId, enabled }) => {
      participantStatesRef.current[peerId] = {
        ...(participantStatesRef.current[peerId] || {}),
        audioEnabled: enabled,
      };

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
      participantStatesRef.current[peerId] = {
        ...(participantStatesRef.current[peerId] || {}),
        videoEnabled: enabled,
      };

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

    socket.on(
      "participant-state",
      ({ peerId, audioEnabled, videoEnabled }) => {
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
      },
    );

    return () => {
      mountedRef.current = false;
      socket.disconnect();
      cleanupMedia();

      participantStatesRef.current = {};
      pendingProducerSignalsRef.current.clear();
      closedProducerIdsRef.current.clear();
      setRemoteStreams([]);
    };
  }, [roomName]);

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
