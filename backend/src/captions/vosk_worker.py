"""Read bounded NDJSON commands. Decode Opus and stream Vosk results over stdout."""
import base64
import json
import sys

import av
from vosk import KaldiRecognizer, Model, SetLogLevel

SetLogLevel(-1)
SPEAKERS = {}


def respond(**message):
    print(json.dumps(message, ensure_ascii=True, separators=(",", ":")), flush=True)


class Speaker:
    def __init__(self, model, channels):
        self.codec = av.CodecContext.create("opus", "r")
        # OpusHead explicitly describes the RTP channel mapping and 48 kHz clock.
        self.codec.extradata = b"OpusHead" + bytes((1, channels)) + b"\x00\x00\x80\xbb\x00\x00\x00\x00\x00"
        self.resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
        self.recognizer = KaldiRecognizer(model, 16000)
        self.previous = ""

    def audio(self, payload):
        for output in self.codec.decode(av.Packet(payload)):
            output.pts = None
            for pcm in self.resampler.resample(output):
                if self.recognizer.AcceptWaveform(bytes(pcm.planes[0])[:pcm.samples * 2]):
                    text = json.loads(self.recognizer.Result()).get("text", "")
                    if text or self.previous:
                        yield True, text
                    self.previous = ""
                else:
                    text = json.loads(self.recognizer.PartialResult()).get("partial", "")
                    if text != self.previous:
                        self.previous = text
                        yield False, text


def main():
    try:
        model = Model(sys.argv[1])
    except Exception:
        respond(type="unavailable")
        return 1
    respond(type="ready")
    limit = int(sys.argv[2])
    for line in sys.stdin.buffer:
        if len(line) > 6000:
            continue
        key = None
        try:
            data = json.loads(line)
            key = data["id"]
            kind = data["type"]
            if kind == "stop":
                SPEAKERS.pop(key, None)
            elif kind == "start":
                if len(SPEAKERS) >= limit:
                    respond(type="error", id=key)
                    continue
                SPEAKERS[key] = Speaker(model, data["channels"])
            elif kind == "audio":
                speaker = SPEAKERS.get(key)
                if speaker:
                    for final, text in speaker.audio(base64.b64decode(data["packet"], validate=True)):
                        respond(type="result", id=key, final=final, text=text[:500])
                respond(type="credit", id=key)
        except (MemoryError, KeyboardInterrupt):
            raise
        except Exception:
            if key:
                SPEAKERS.pop(key, None)
                respond(type="error", id=key)
    return 0


if __name__ == "__main__":
    sys.exit(main())
