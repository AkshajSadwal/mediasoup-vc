import mediasoup from "mediasoup";

let worker;

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

export const initializeWorker = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: Number(process.env.MEDIASOUP_RTC_MIN_PORT),
    rtcMaxPort: Number(process.env.MEDIASOUP_RTC_MAX_PORT),
  });

  console.log(`worker pid ${worker.pid}`);

  worker.on("died", () => {
    console.error("mediasoup worker died");
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
};

export const getWorker = () => worker;

export const getMediaCodecs = () => mediaCodecs;