'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { useParams } from 'next/navigation';


export default function Home() {

  const params = useParams();
  const roomName = params.roomId;
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const deviceRef = useRef(null);
  const producerTransportRef = useRef(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [message, setMessage] = useState('');


  const toggleVideo = () => {
    const videoTrack = paramsRef.current.videoTrack;
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setVideoEnabled(videoTrack.enabled);
  };


  const toggleAudio = () => {
    const audioTrack = paramsRef.current.audioTrack;
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setAudioEnabled(audioTrack.enabled);
  };


  const copyRoomCode = async () => {
  await navigator.clipboard.writeText(roomName);
  setMessage("Room code copied!");
  setTimeout(() => {
    setMessage('');
  }, 2000);
};


  const copyRoomLink = async () => {
  const link = window.location.href;
  await navigator.clipboard.writeText(link);
  setMessage("Room link copied!");
  setTimeout(() => {
    setMessage('');
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
        rid: 'r0',
        maxBitrate: 100000,
        scalabilityMode: 'S1T3',
      },
      {
        rid: 'r1',
        maxBitrate: 300000,
        scalabilityMode: 'S1T3',
      },
      {
        rid: 'r2',
        maxBitrate: 900000,
        scalabilityMode: 'S1T3',
      },
    ],
    codecOptions: {
      videoGoogleStartBitrate: 1000,
    },
  });

  const [remoteStreams, setRemoteStreams] =useState([]);
  const consumerTransports =useRef([]);

  useEffect(() => {
    const socket =
      io(
        'http://localhost:4000/mediasoup'
      );
    socketRef.current = socket;
    socket.on(
      'connect',
      () => {
        console.log('connected',socket.id);
        joinRoom();
      }
    );
    socket.on('new-producer',({ producerId, peerId }) => {
        signalNewConsumerTransport(
          producerId,
          peerId
        );
      }
    );
    socket.on('producer-closed',({ remoteProducerId }) => {
        setRemoteStreams(prev =>
          prev.filter(
            item =>item.producerId !== remoteProducerId
          )
        );
      }
    );

    return () => {
      socket.disconnect();
    }
  }, []);

  const joinRoom = () => {
    socketRef.current.emit(
      'joinRoom',{roomName},async ({
        rtpCapabilities
        }) => {
          const device =new mediasoupClient.Device();
          await device.load({
          routerRtpCapabilities:
            rtpCapabilities
          });
          deviceRef.current =device;
          await getLocalStream();

          socketRef.current.emit('getProducers',producers => {
            producers.forEach(
              ({ producerId, peerId }) =>
                signalNewConsumerTransport(
                  producerId,
                  peerId
                )
              );
            }
          );
        }
    );
  };


  const getLocalStream = async () => {
    const stream =await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            width: 1280,
            height: 720
          }
        });
    localVideoRef.current.srcObject =stream;
    paramsRef.current = {
      ...paramsRef.current,
      videoTrack:
        stream.getVideoTracks()[0],
      audioTrack:
        stream.getAudioTracks()[0]
    };
    createProducerTransport();
  };


  const createProducerTransport =() => {
      socketRef.current.emit('createWebRtcTransport',{
          sender: true
        },
        ({ params }) => {
          const transport =deviceRef.current
              .createSendTransport(
                params
              );
          producerTransportRef.current =transport;

          transport.on('connect',(
              { dtlsParameters },
              callback
            ) => {
              socketRef.current.emit('transport-connect',{dtlsParameters}
              );
              callback();
            }
          );

          transport.on('produce',(
              parameters,
              callback
            ) => {
              socketRef.current.emit('transport-produce',{
                  kind:
                    parameters.kind,

                  rtpParameters:
                    parameters.rtpParameters
                },
                ({ id }) => {
                  callback({
                    id
                  });
                }
              );
            }
          );
          produce();
        }
      );
    };

  const produce = async () => {
    const {
      videoTrack,
      audioTrack,
      encodings,
      codecOptions
    } = paramsRef.current;
    if (videoTrack) {
      await producerTransportRef.current
        .produce({
          track: videoTrack,
          encodings,
          codecOptions
        });
    }

    if (audioTrack) {
      await producerTransportRef.current
        .produce({
          track: audioTrack
        });
    }
  };
  const signalNewConsumerTransport =(producerId, peerId) => {
      const exists =consumerTransports.current
          .find(
            item =>
              item.producerId === producerId
          );
      if (exists)
        return;
      socketRef.current.emit(
        'createWebRtcTransport',
        {
          sender: false
        },
        ({ params }) => {

          console.log('RECV TRANSPORT PARAMS:',params
          );

          if (
            !params ||
            !params.id ||
            !params.iceParameters ||
            !params.iceCandidates ||
            !params.dtlsParameters
          ) {
            console.error('INVALID TRANSPORT PARAMS:',params);
           return;
          }

          const consumerTransport =deviceRef.current
              .createRecvTransport(
                params
              );
          consumerTransport.on(
            'connect',
            (
              { dtlsParameters },
              callback
            ) => {
              socketRef.current.emit(
                'transport-recv-connect',
                {
                  dtlsParameters,
                  serverConsumerTransportId:
                    params.id
                }
              );
              callback();
            }
          );

          consumerTransports.current
            .push({
              producerId,
              transport:consumerTransport
            });

          consume(
            producerId,
            peerId,
            consumerTransport,
            params.id
          );
        }
      );
    };

  const consume =
    (
      producerId,
      peerId,
      transport,
      transportId
    ) => {
      socketRef.current.emit(
        'consume',
        {
          rtpCapabilities:deviceRef.current.rtpCapabilities,
          remoteProducerId:producerId,
          serverConsumerTransportId:transportId
        },
        async ({ params }) => {
          const consumer =await transport.consume({
              id:params.id,
              producerId:params.producerId,
              kind:params.kind,
              rtpParameters:params.rtpParameters
            });
          setRemoteStreams(prev => {
            const existing =prev.find(
                item => item.peerId === peerId
              );
            if (existing) {
              existing.stream.addTrack(
                consumer.track
              );
              return [...prev];
            }

            return [
              ...prev,
              {
                producerId,
                peerId,
                stream: new MediaStream([
                  consumer.track
                ])
              }
            ];
          });

          socketRef.current.emit('consumer-resume',
            {
              serverConsumerId:params.serverConsumerId
            }
          );
        }
      );
    };

  return (
  <div className="container">
    <div className="floating-actions">
            {message && (
                <div className="message">
                {message}
                </div>
            )}

            <button
                className="share-btn"
                onClick={shareRoom}
            >
                 Share
            </button>


            <button
                className="share-btn"
                onClick={copyRoomLink}
            >
                🔗Copy Link
            </button>


            <button
                className="share-btn"
                onClick={copyRoomCode}
            >
                Copy Code
            </button>


            </div>


    <div className="grid">
        <div className="card">
          <h3>You</h3>

          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="video"
          />

          <div className="controls">
            <button
              className="btn"
              onClick={toggleVideo}
            >
              {videoEnabled
                ? '📹 Turn Video Off'
                : '📹 Turn Video On'}
            </button>

            <button
              className="btn"
              onClick={toggleAudio}
            >
              {audioEnabled
                ? '🎤 Mute Mic'
                : '🎤 Unmute Mic'}
            </button>
          </div>
        </div>

        {remoteStreams.map((item) => (
          <div
            key={item.producerId}
            className="card"
          >
            <h3>Remote User</h3>

            <video
              autoPlay
              playsInline
              className="video"
              ref={(video) => {
                if (video) {
                  video.srcObject = item.stream;
                }
              }}
            />
          </div>
        ))}
      </div>

      <style jsx>{`
        .container {
            min-height: 100vh;
            padding: 20px;
            position: relative;
        }
        .floating-actions {
            position: fixed;
            right: 25px;
            bottom: 25px;

            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 10;
        }
        .share-btn {
            width: 140px;
            border: none;
            padding: 12px;

            border-radius: 30px;

            cursor: pointer;
            font-weight: 600;

            background: #2563eb;
            color: white;

            box-shadow: 0 5px 15px rgba(0,0,0,0.25);
        }
        .share-btn:hover {
            background: #1d4ed8;
        }
        .message {
            background: white;
            color: #16a34a;

            padding: 8px 12px;
            border-radius: 20px;

            font-size: 14px;
            text-align: center;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(
            auto-fit,
            minmax(320px, 1fr)
            );
            gap: 20px;
        }
        .card {
            background: #1e1e1e;
            border-radius: 12px;
            padding: 12px;
        }
        .card h3 {
            color: white;
            margin-bottom: 10px;
        }
        .video {
            width: 100%;
            background: black;
            border-radius: 8px;
        }
        .controls {
            display: flex;
            gap: 10px;
            margin-top: 12px;
        }
        .btn {
            border: none;
            padding: 10px 14px;
            border-radius: 8px;

            cursor: pointer;
            font-weight: 600;

            background: #2563eb;
            color: white;
        }
        .btn:hover {
            background: #1d4ed8;
        }
`}</style>
    </div>
  );
}