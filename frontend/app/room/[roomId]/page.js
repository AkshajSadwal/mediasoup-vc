"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import RoomHeader from "@/components/room/RoomHeader";
import VideoGrid from "@/components/room/VideoGrid";
import BottomControls from "@/components/room/BottomControls";
import ToastMessage from "@/components/room/ToastMessage";
import MeetingPanel from "@/components/room/MeetingPanel";

export default function Home() {
  const params = useParams();
  const roomName = params.roomId;
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

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

  const upsertParticipant = (participant) => {
    if (!participant?.peerId) return;

    // The local participant is rendered separately from the remote list.
    // Ignore self state broadcasts so moderation/status updates never add
    // the current user as an extra participant.
    if (socketRef.current?.id && participant.peerId === socketRef.current.id) {
      return;
    }

    participantStatesRef.current[participant.peerId] = {
      audioEnabled: participant.audioEnabled ?? true,
      videoEnabled: participant.videoEnabled ?? true,
      connected: participant.connected ?? true,
      name: participant.name || participant.username || `Guest ${participant.peerId.slice(0, 6)}`,
      username: participant.username || null,
      isAdmin: Boolean(participant.isAdmin),
      adminMuted: Boolean(participant.adminMuted),
    };

    setParticipants((prev) => {
      const existing = prev.find((item) => item.peerId === participant.peerId);

      if (existing) {
        return prev.map((item) =>
          item.peerId === participant.peerId
            ? { ...item, ...participant }
            : item,
        );
      }

      return [...prev, {
        peerId: participant.peerId,
        username: participant.username || null,
        name: participant.name || participant.username || `Guest ${participant.peerId.slice(0, 6)}`,
        audioEnabled: participant.audioEnabled ?? true,
        videoEnabled: participant.videoEnabled ?? true,
        connected: participant.connected ?? true,
        isAdmin: Boolean(participant.isAdmin),
        adminMuted: Boolean(participant.adminMuted),
      }];
    });
  };

  const removeParticipant = (peerId) => {
    delete participantStatesRef.current[peerId];

    setParticipants((prev) =>
      prev.filter((item) => item.peerId !== peerId),
    );
  };

  const getCurrentSession = () => ({
    generation: connectionGenerationRef.current,
    socketId: socketRef.current?.id,
  });

  const isCurrentSession = (generation, socketId) =>
    mountedRef.current &&
    connectionGenerationRef.current === generation &&
    socketRef.current?.id === socketId;
  const consumerSetupRef = useRef(new Set());
  const pendingProducerSignalsRef = useRef(new Map());
  const closedProducerIdsRef = useRef(new Set());
  const mountedRef = useRef(false);
  const connectionGenerationRef = useRef(0);
  const joinInProgressRef = useRef(false);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("chat");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [adminBusyPeerId, setAdminBusyPeerId] = useState(null);
  const [localParticipantInfo, setLocalParticipantInfo] = useState(null);
  const [adminMuted, setAdminMuted] = useState(false);

  const localName = session?.user?.username || session?.user?.name || "You";
  const localPeerId = socketRef.current?.id || null;
  const localIsAdmin = Boolean(localParticipantInfo?.isAdmin);

  const openPanel = (tab = "chat") => {
    setPanelTab(tab);
    setPanelOpen(true);
  };

  const sendChatMessage = (event) => {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text || !socketRef.current?.connected) return;

    socketRef.current.emit("chat-message", { text }, (response) => {
      if (response?.error) {
        showMessage(response.error);
        return;
      }
      setChatDraft("");
    });
  };

  const adminMuteParticipant = (targetPeerId, muted) => {
    if (!socketRef.current || !localIsAdmin) return;
    setAdminBusyPeerId(targetPeerId);
    socketRef.current.emit("admin-mute-participant", { targetPeerId, muted }, (response) => {
      setAdminBusyPeerId(null);
      if (response?.error) showMessage(response.error);
    });
  };

  const adminRemoveParticipant = (targetPeerId) => {
    if (!socketRef.current || !localIsAdmin) return;
    setAdminBusyPeerId(targetPeerId);
    socketRef.current.emit("admin-remove-participant", { targetPeerId }, (response) => {
      setAdminBusyPeerId(null);
      if (response?.error) showMessage(response.error);
      else showMessage("Participant removed");
    });
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
    setLocalParticipantInfo((prev) => ({
      ...(prev || {}),
      videoEnabled: videoTrack.enabled,
    }));

    socketRef.current.emit("video-state", {
      enabled: videoTrack.enabled,
    });
  };

  const toggleAudio = () => {
    const audioTrack = paramsRef.current.audioTrack;
    if (!audioTrack || !socketRef.current) return;

    const nextEnabled = !audioTrack.enabled;
    if (adminMuted && nextEnabled) {
      showMessage("The admin has muted your microphone.");
      return;
    }

    audioTrack.enabled = nextEnabled;
    setAudioEnabled(nextEnabled);
    setLocalParticipantInfo((prev) => ({
      ...(prev || {}),
      audioEnabled: nextEnabled,
      adminMuted,
    }));

    socketRef.current.emit("audio-state", {
      enabled: nextEnabled,
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

  const createProducerTransport = (generation, socketId) => {
    return new Promise((resolve, reject) => {
      if (!isCurrentSession(generation, socketId)) {
        return reject(new Error("Connection changed while creating transport."));
      }

      socketRef.current.emit(
        "createWebRtcTransport",
        { sender: true },
        ({ params }) => {
          if (!isCurrentSession(generation, socketId)) {
            return reject(new Error("Connection changed while creating transport."));
          }

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

  const createConsumerTransport = (generation, socketId) => {
    return new Promise((resolve, reject) => {
      if (!isCurrentSession(generation, socketId)) {
        return reject(new Error("Connection changed while creating transport."));
      }

      socketRef.current.emit(
        "createWebRtcTransport",
        { sender: false },
        ({ params }) => {
          if (!isCurrentSession(generation, socketId)) {
            return reject(new Error("Connection changed while creating transport."));
          }

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
    generation,
    socketId,
  ) => {
    try {
      await new Promise((resolve, reject) => {
        if (!isCurrentSession(generation, socketId)) {
          return reject(new Error("Connection changed while consuming media."));
        }

        socketRef.current.emit(
          "consume",
          {
            rtpCapabilities: deviceRef.current.rtpCapabilities,
            remoteProducerId: producerId,
            serverConsumerTransportId: transportId,
          },
          async ({ params }) => {
            if (!isCurrentSession(generation, socketId)) {
              return reject(new Error("Connection changed while consuming media."));
            }

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

              if (!isCurrentSession(generation, socketId)) {
                consumer.close();
                consumersRef.current.delete(producerId);
                return resolve();
              }

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

    const { generation, socketId } = getCurrentSession();

    consume(
      producerId,
      peerId,
      consumerTransportRef.current,
      consumerTransportRef.current.id,
      generation,
      socketId,
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

  const getLocalStream = async (generation, socketId, forcedAdminMuted = false) => {
    let stream = localStreamRef.current;

    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: 1280,
          height: 720,
        },
      });
    }

    if (!isCurrentSession(generation, socketId)) {
      if (stream !== localStreamRef.current) {
        stream.getTracks().forEach((track) => track.stop());
      }
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    // Preserve the user's current media choices across a reconnect, but let
    // the server-authoritative admin mute override microphone state.
    if (audioTrack && forcedAdminMuted) {
      audioTrack.enabled = false;
    }

    paramsRef.current = {
      ...paramsRef.current,
      videoTrack,
      audioTrack,
    };

    setAudioEnabled(audioTrack ? audioTrack.enabled : false);
    setVideoEnabled(videoTrack ? videoTrack.enabled : false);
    setLocalParticipantInfo((prev) => ({
      ...(prev || {}),
      audioEnabled: audioTrack ? audioTrack.enabled : false,
      videoEnabled: videoTrack ? videoTrack.enabled : false,
      adminMuted: forcedAdminMuted,
    }));

    await createProducerTransport(generation, socketId);
    await produce();
  };

  const cleanupMedia = ({ stopLocalTracks = true } = {}) => {
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

    if (stopLocalTracks && localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());
      localStreamRef.current = null;
      paramsRef.current.videoTrack = null;
      paramsRef.current.audioTrack = null;
    }
  };

  const joinRoom = () => {
    if (!socketRef.current || joinInProgressRef.current) return;

    const { generation, socketId } = getCurrentSession();
    joinInProgressRef.current = true;

    socketRef.current.emit(
      "joinRoom",
      { roomName },
      async (response) => {
        try {
          if (!isCurrentSession(generation, socketId)) return;

          if (response?.error) {
            if (response.error === "AUTH_REQUIRED") {
              router.replace(`/login?callbackUrl=${encodeURIComponent(`/room/${roomName}`)}`);
              return;
            }
            if (response.error === "WAITING_ROOM") {
              router.replace(`/waiting/${roomName}`);
              return;
            }
            throw new Error(response.error);
          }

          if (!response?.rtpCapabilities) {
            throw new Error("Room did not return RTP capabilities.");
          }

          setLocalParticipantInfo(response.self || null);
          setAdminMuted(Boolean(response.self?.adminMuted));

          setParticipants(
            Array.isArray(response.participants)
              ? response.participants
              : [],
          );

          participantStatesRef.current = {};
          for (const participant of response.participants || []) {
            participantStatesRef.current[participant.peerId] = {
              audioEnabled: participant.audioEnabled ?? true,
              videoEnabled: participant.videoEnabled ?? true,
              connected: true,
              name: participant.name || participant.username || `Guest ${participant.peerId.slice(0, 6)}`,
              username: participant.username || null,
              isAdmin: Boolean(participant.isAdmin),
              adminMuted: Boolean(participant.adminMuted),
            };
          }

          const device = new mediasoupClient.Device();
          await device.load({
            routerRtpCapabilities: response.rtpCapabilities,
          });

          if (!isCurrentSession(generation, socketId)) return;
          deviceRef.current = device;

          await createConsumerTransport(generation, socketId);
          if (!isCurrentSession(generation, socketId)) return;

          flushPendingProducerSignals();
          await getLocalStream(
            generation,
            socketId,
            Boolean(response.self?.adminMuted),
          );
          if (!isCurrentSession(generation, socketId)) return;

          requestExistingProducers();
          flushPendingProducerSignals();

          // Re-announce the local media state because a reconnect creates a
          // brand-new server-side peer.
          if (socketRef.current?.connected) {
            socketRef.current.emit("audio-state", {
              enabled: paramsRef.current.audioTrack?.enabled ?? true,
            });
            socketRef.current.emit("video-state", {
              enabled: paramsRef.current.videoTrack?.enabled ?? true,
            });
          }
        } catch (error) {
          if (!isCurrentSession(generation, socketId)) return;
          console.error("JOIN ROOM FAILED", error);
          showMessage(error.message || "Could not join room");
          cleanupMedia({ stopLocalTracks: false });
          deviceRef.current = null;
          setParticipants([]);
        } finally {
          if (connectionGenerationRef.current === generation) {
            joinInProgressRef.current = false;
          }
        }
      },
    );
  };

  useEffect(() => {
    if (sessionStatus === "loading") return;

    let cancelled = false;
    let socket = null;

    const begin = async () => {
      if (!session?.backendToken) {
        router.replace(`/login?callbackUrl=${encodeURIComponent(`/room/${roomName}`)}`);
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"}/api/meetings/${roomName}`, {
          headers: { Authorization: `Bearer ${session.backendToken}` },
        });

        if (response.ok) {
          const meeting = await response.json();
          if (!meeting.open) {
            router.replace(`/waiting/${roomName}`);
            return;
          }
        } else if (response.status !== 404) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Meeting check failed (${response.status}).`);
        }
      } catch (error) {
        console.error("MEETING CHECK FAILED", error);
        showMessage(error.message || "Could not check meeting.");
        return;
      }

      if (cancelled) return;

      mountedRef.current = true;
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
      socket = io(`${socketUrl}/mediasoup`, {
        path: "/socket.io",
        reconnection: true,
        auth: { token: session.backendToken },
      });

      socketRef.current = socket;

    socket.on("connect", () => {
      connectionGenerationRef.current += 1;
      joinInProgressRef.current = false;

      console.log("connected", socket.id);
      joinRoom();
    });

    socket.on("disconnect", (reason) => {
      if (!mountedRef.current) return;

      console.warn("SOCKET DISCONNECTED", reason);
      connectionGenerationRef.current += 1;
      joinInProgressRef.current = false;
      deviceRef.current = null;
      pendingProducerSignalsRef.current.clear();
      closedProducerIdsRef.current.clear();

      // Keep camera/microphone permission and tracks alive so a reconnect can
      // reuse them without asking the user again. Recreate mediasoup transports
      // when Socket.IO connects again.
      cleanupMedia({ stopLocalTracks: false });
      setRemoteStreams([]);
      setParticipants([]);
      setMessage("Connection lost. Reconnecting...");
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

    socket.on("participant-joined", (participant) => {
      upsertParticipant(participant);
    });

    socket.on("participant-left", ({ peerId }) => {
      removeParticipant(peerId);

      // Mark both active and pending media from this peer as closed. An
      // in-flight consume will then discard its consumer when it resolves.
      for (const [producerId, pendingPeerId] of pendingProducerSignalsRef.current) {
        if (pendingPeerId === peerId) {
          closedProducerIdsRef.current.add(producerId);
          pendingProducerSignalsRef.current.delete(producerId);
        }
      }

      for (const [producerId, data] of consumersRef.current.entries()) {
        if (data.peerId === peerId) {
          closedProducerIdsRef.current.add(producerId);
          removeRemoteProducer(producerId);
        }
      }
    });

    socket.on("participant-state", (participant) => {
      upsertParticipant(participant);

      setRemoteStreams((prev) =>
        prev.map((item) =>
          item.peerId === participant.peerId
            ? {
                ...item,
                audioEnabled: participant.audioEnabled,
                videoEnabled: participant.videoEnabled,
              }
            : item,
        ),
      );
    });

    socket.on("audio-state", ({ peerId, enabled, mutedByAdmin }) => {
      upsertParticipant({
        peerId,
        audioEnabled: enabled,
        adminMuted: Boolean(mutedByAdmin),
      });

      setRemoteStreams((prev) =>
        prev.map((item) =>
          item.peerId === peerId
            ? { ...item, audioEnabled: enabled }
            : item,
        ),
      );
    });

    socket.on("video-state", ({ peerId, enabled }) => {
      upsertParticipant({
        peerId,
        videoEnabled: enabled,
      });

      setRemoteStreams((prev) =>
        prev.map((item) =>
          item.peerId === peerId
            ? { ...item, videoEnabled: enabled }
            : item,
        ),
      );
    });

    socket.on("chat-history", (messages) => {
      setChatMessages(Array.isArray(messages) ? messages : []);
    });

    socket.on("chat-message", (chatMessage) => {
      if (!chatMessage?.id) return;
      setChatMessages((prev) => {
        if (prev.some((item) => item.id === chatMessage.id)) return prev;
        return [...prev, chatMessage].slice(-200);
      });
    });

    socket.on("admin-audio-state", ({ enabled, mutedByAdmin }) => {
      const track = paramsRef.current.audioTrack;
      if (track) track.enabled = Boolean(enabled);
      setAudioEnabled(Boolean(enabled));
      setAdminMuted(Boolean(mutedByAdmin));
      setLocalParticipantInfo((prev) => ({
        ...(prev || {}),
        peerId: socket.id,
        audioEnabled: Boolean(enabled),
        adminMuted: Boolean(mutedByAdmin),
      }));
      if (mutedByAdmin) showMessage("The admin muted your microphone.");
      else showMessage("The admin allowed your microphone.");
    });

    socket.on("admin-removed", ({ reason }) => {
      showMessage(reason || "You were removed from the meeting.");
      socket.disconnect();
      setTimeout(() => router.replace("/"), 250);
    });

    };

    begin();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      connectionGenerationRef.current += 1;
      joinInProgressRef.current = false;
      socket?.disconnect();
      socket = null;
      socketRef.current = null;
      cleanupMedia({ stopLocalTracks: true });

      participantStatesRef.current = {};
      setLocalParticipantInfo(null);
      setAdminMuted(false);
      pendingProducerSignalsRef.current.clear();
      closedProducerIdsRef.current.clear();
      setRemoteStreams([]);
      setParticipants([]);
    };
  }, [roomName, router, session?.backendToken, sessionStatus]);

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
        participantCount={participants.length + 1}
        localName={localName}
        localIsAdmin={localIsAdmin}
      />

      <VideoGrid
        remoteStreams={remoteStreams}
        localVideoRef={localVideoRef}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        participants={participants}
        localName={localName}
        localIsAdmin={localIsAdmin}
      />

      <BottomControls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        copyRoomCode={copyRoomCode}
        shareRoom={shareRoom}
        openPanel={openPanel}
      />

      <MeetingPanel
        open={panelOpen}
        tab={panelTab}
        onTabChange={setPanelTab}
        onClose={() => setPanelOpen(false)}
        messages={chatMessages}
        draft={chatDraft}
        setDraft={setChatDraft}
        onSendMessage={sendChatMessage}
        participants={participants}
        localPeerId={localPeerId}
        localName={localName}
        localAudioEnabled={audioEnabled}
        localVideoEnabled={videoEnabled}
        localAdminMuted={adminMuted}
        isAdmin={localIsAdmin}
        onAdminMute={adminMuteParticipant}
        onAdminRemove={adminRemoveParticipant}
        adminBusyPeerId={adminBusyPeerId}
      />

      <ToastMessage message={message} />
    </main>
  );
}
