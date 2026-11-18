# Live meeting implementation

## Checklist

- Foundation — authenticated meeting membership, account-scoped permissions, room-scoped media and signaling, revisioned snapshots, acknowledged mutations, and reconnect cleanup.
- Room experience — responsive grid and stage, native screen picker, isolated audio playback, hands, reactions, local pins, and room spotlight.
- Collaboration — shared board, durable-in-session ballot cards, and accepted SCTP file offers.
- Local processing — canvas and audio recording, outgoing camera segmentation, and individually subscribed English captions with an opt-in browser fallback.
- Breakouts — host assignments, separate routers, notice and help controls, countdown, and return to main.
- Integration — see the evidence and open checks below.

## Identity, admission, and state

- The scheduled meeting ID stays in the URL. The authenticated account identifies the host, moderators, participant preferences, ballots and per-user overrides. A Socket.IO connection ID identifies one connection and its transports. An opaque room token identifies the current media membership epoch on that connection.
- Scheduled meetings still use the original authentication token, host, schedule and admission checks. The existing meeting HTTP API remains the authority for scheduling, admission, and moderator assignment. Existing unscheduled meeting links retain first-entrant hosting. Joins reserve one slot per account, up to ten connected accounts across the meeting and all breakouts. A new authorized connection supersedes an earlier connection for the same account.
- Parent control state includes permissions, mute holds, speaking policy, assignments, help, and announcements. Live room state includes chat, whiteboard, poll cards, spotlight, and presentation ownership. Room media uses its own router on the existing worker. A room router closes when empty. The parent and its live-room collaboration state survive vacancies while anyone is connected, and expire 15 minutes after the last connection. At most 100 distinct account records are retained for one live session. Closed breakout collaboration state is removed after departure.
- A host disconnect never promotes a new host. A reconnect rechecks admission, restores the server-authorized room and uses a fresh room token, transport set and remote subscription list. Voluntary media state, hands, restrictions, and polls are account-scoped. Meeting configuration, team membership and running breakout deadlines persist in the existing meeting store. Camera and microphone capture can be reused in the same browser on reconnect. Screen sharing requires a new user gesture.
- Stale room tokens are rejected. Old media, participants and collaboration UI are cleared during movement. Media setup checks the membership epoch after async worker calls. File bytes are forwarded only through explicitly accepted and same-router SCTP subscriptions.

## Signaling contract

All client events below carry the current room token and receive an acknowledgement, except the initial join. A failed request returns an error. Server pushes are ordered per socket. Room membership and resource ownership come from the authenticated server connection.

| Event | Payload and authority |
| --- | --- |
| `joinRoom` | Receives the meeting ID. Returns RTP capabilities, local identity, active room token, current-room roster/chat and full live snapshot. |
| `live-snapshot`, `live-state` | Fetch and push personalized versioned state. The host sees parent moderator controls and cross-room assignments. Room-only content is projected for the current room. Board history is included at join or resync. Live board mutations carry a revision and one ordered delta. |
| `createWebRtcTransport`, `transport-connect`, `transport-recv-connect` | One send and receive transport per room epoch, including SCTP parameters. Exact transport ID, owning connection, direction and active room are checked. |
| `transport-produce`, `getProducers`, `consume`, `consumer-resume`, `producer-close` | `microphone` and `screen-audio` are audio. `camera` and `screen-video` are video. Sources are validated, unique per connection, and propagated in discovery and consumption. Remote subscription and resume are scoped by room and ownership. Audio producers start paused and follow server speaking policy. |
| `audio-state`, `video-state`, `chat-message` | Update voluntary mic, camera status, or bounded text chat in the current room. |
| `live-action` | Host policy, permission requests, hands, reactions, recording status, room spotlight, board and poll actions, and breakouts. Roles, targets, operation IDs, field limits, and rates are checked on the server. |
| `file-offer`, `file-accept`, `file-produce`, `file-consume`, `file-ready`, `file-credit`, `file-cancel` | Socket.IO metadata and credits. File payload uses reliable ordered SCTP. Sender and accepting recipient own separate channel endpoints. |
| `room-move-prepare`, `room-move-ready`, `room-move` | An active in-app recorder gets a finalize request before the old router resources are released. The server allows up to eight seconds for acknowledgement. The client joins again with the meeting ID and receives its authorized destination. |

HTTP and Socket.IO authentication are unchanged. Current-room operations are guarded at registration and media/data handlers scope the ownership and associated room independently. Room permits a single presenter with an atomic reservation before asynchronous production. Host and admitted moderators can set spotlight in their current room. A local pin can supersede spotlight, and presentation content takes stage precedence.

## Permissions and collaboration

- Recording, whiteboard editing, ballot creation, and file sending initially allow participants and moderators. A role default supplies the inherited value. The schema also covers mic and camera publishing, hands, reactions, screen sharing and chat. Start-muted and start-camera-off are initial states distinct from publishing restrictions. A host-only individual rule overrides the default. An individual deny remains effective even when the role default is Allow. A moderator cannot change these rules or lift a host mute. Members can request a restricted feature.
- Individual mute and locked speaking are restrictions. One-shot mute-all sets a hold without enabling a speaking lock. Removing a restriction or allowlisting an account never resumes audio automatically. The account sends an explicit unmute, which clears its hold when allowed. A volunteered microphone mute remains distinct from screen audio. A speaking lock or mute hold suppresses both audio sources.
- Whiteboard enforces permission on each edit. An operation is owned by its author. The server orders and de-duplicates drawing IDs, limits operations to 400 and samples to 96 points per operation, and provides a current-room snapshot on reconnect. Export is local. Under the 400-operation bound, the host can clear the board to continue.
- Polls and votes capture eligible accounts in the current room on creation. The recorder of ballots is the server; deadlines are server time. Final cards remain with the live room. Anonymous cards expose aggregate totals only when configured and the viewer's own submitted flag. Named cards expose display names and choices when results are visible.

## Local data and browser constraints

- File offers are one sender and one recipient, with one in-flight offer or transfer per account. The server enforces 100,000,000 bytes for metadata and accepted packets, verifies byte offset and SHA-256 on 16 KiB payload chunks, and relays through mediasoup direct transports. Eight chunks are credited at a time. Server sends are transient. Disconnect, role revocation, room departure, timeout, or cancel releases channels. The receiver explicitly saves a verified file. A sender who remains available can offer it again. Files have no server storage or persistent download URLs.
- Recording composites the visible stage/grid and displayed board at 1280×720, at up to 15 FPS. Each eligible audio track joins the mix once. Chat and private captions are outside the compositor. The picker can stream incrementally to local disk where supported. The memory path stops at 20 minutes or near 128 MiB. The output MIME is browser-selected from supported formats. App permissions control the Rauma recorder. External screen capture remains possible.
- Camera effects lazy-load MediaPipe and its pinned selfie model. CPU segmentation uses sampled frames plus an adaptive canvas resolution and frame rate. Effects use camera producer `replaceTrack`; the screen track is independent. Overloaded or failed effects return to raw camera. Custom backgrounds are decoded and resized locally, with five images per signed-in account in IndexedDB, a validated 10,000,000-byte input limit, and bounded dimensions. Enabling effects does not persist a camera frame.
- Screen/audio options come from the native browser/OS picker. Available windows, protected surfaces, capture audio, autoplay, local disk streaming, available MediaRecorder formats, and hardware acceleration vary. Serve normal users on HTTPS. Loopback is suitable for development. The existing WebRTC listener and announced address must be reachable through the configured UDP/TCP port range. The selected backend process owns the live meeting and its routers, so multiple backend replicas need explicit session routing and shared admission storage before use.
- Effects fetch the pinned MediaPipe JS/WASM through jsDelivr and the versioned selfie model through Google Cloud Storage. The browser must reach these origins, including CDN redirects.

## Verification

The repository includes Node.js tests for room signaling, team-link rotation, whiteboard operations, private meeting access, and image header limits. Run the test suite after installing the backend dependencies:

```bash
npm --prefix backend ci
npm --prefix backend test
```

Run the frontend static checks and production build after installing its dependencies:

```bash
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run build
```

For browser integration checks, install and configure Playwright and run `node scripts/verify-meeting-browser.mjs`. Consult the script for fixture requirements, ports, and optional switches; native MediaSoup and browser dependencies must be available. Do not treat unit tests as proof of production WebRTC connectivity, load capacity, or media privacy. Verify private access, forged socket event payloads, revoked permissions, file transfer rejection, captions, recorder cleanup, screen sharing, and breakout isolation with multiple real accounts and browsers before deployment.

No browser performance benchmark or cross-browser compatibility guarantee is asserted here; network, operating system, device permissions, and native media support affect results.

## Config meeting and team links

- `POST /api/meetings/config` validates and saves a draft before starting it. The response returns freshly issued team links once. Links put the token in the URL fragment, which the browser strips before logging in, requesting admission, or visiting the waiting room. A tab-local pending token survives those redirects. The authenticated socket submits it for admission.
- A SHA-256 hash of a 32-byte random token is stored with each stable team ID. Admission validates the token again after asynchronous room creation. Private-room approval and role grants are separate. Existing members keep their authorized team when a link is disabled, and ordinary reconnects use the durable membership. A later valid link can explicitly change the member's team.
- The host settings panel uses the same schema as the setup form. Hosts can update defaults, individual rules, teams and the breakout plan. A role rule supplies the inherited value and an individual rule takes precedence. Revocation never starts mic or camera automatically. Chat history survives disabling new messages.
- Timed breakouts persist a server deadline, current rooms, account assignments and team mappings in the meeting file. Starting sets the absolute deadline and uses the saved team mapping for that session. Extension persists a later deadline, and ending clears the session. Startup and reconnect reconcile expired deadlines. The server closes transfers, captions, producers, consumers and transports before it authorizes the destination. Recording finalization keeps the existing bounded handshake.

## Optional English ASR

1. Install a Python version with Vosk and PyAV wheels for the server platform. Install the pinned packages using `python -m pip install -r backend/src/captions/requirements.txt` in a virtual environment.
2. Extract the [English small Vosk model](https://alphacephei.com/vosk/models) `vosk-model-small-en-us-0.15` to a server directory. Set `CAPTIONS_MODEL_PATH` to the extracted model directory and `CAPTIONS_PYTHON` to the virtual environment's Python executable, then start the existing backend. A container running the backend also needs that Python environment and access to the model. A separate HTTP endpoint or FFmpeg executable is unnecessary because PyAV provides the Opus decoder.
3. The small model is approximately 40 MB compressed and Vosk estimates around 300 MB of runtime memory for small models. Reserve additional headroom for ten recognizers, PyAV, and the SFU. Benchmark against the expected overlap of speakers before sizing production. The default is ten simultaneous speaker recognizers per backend process across all meetings. `CAPTIONS_MAX_SPEAKERS` can raise that limit to 30. ASR has its own subprocess, distinct from both the signaling loop and native SFU.

`caption-subscribe` is an acknowledged room-token-scoped mutation. Each subscribed viewer receives `caption-update` containing the room, room token, subscription, speaker account and display name, stream ID, utterance ID, sequence, and interim/final text. Final replaces the current partial. A distinct clear event drops a stopped speaker's visible text. Viewer buffers are discarded on unsubscribe or room epoch change. The server derives permitted microphone producers from current room membership and effective mute state. It ignores screen audio and starts one recognizer per eligible microphone in each room regardless of the viewer count.

The SFU sends bounded Opus payloads to the child, which decodes and resamples audio to 16 kHz mono PCM. No speech data is written to disk or logged. Each speaker may hold up to 12 pending Opus packets, and sustained overload disables that room's captions with an availability message. The last viewer immediately removes the consumers and decoders. The worker may hold the model in memory for another 15 seconds. If the model or Python runtime is absent, opting into captions in a supported browser falls back to Web Speech recognition of **that participant's own unmuted microphone**. Only participants who enable browser captions publish text; other opted-in browser viewers receive it via authenticated, room-scoped Socket.IO messages. This is not a substitute for server-side transcription of all speakers. Some browsers have no SpeechRecognition implementation; those clients may be receive-only. A browser implementation may send microphone audio to a third-party speech provider. Server-backed captions can process the audio of other meeting participants when a viewer subscribes, even if those speakers did not enable captions themselves. Disclose both processing paths in the user-facing privacy notice before deployment. No browser caption transcript is written to server storage. Browser speech recognition fallback does not require a separate downloadable in-browser recognition model.

## Background effects and devices

The background-effects pipeline uses a pinned MediaPipe image-segmentation model and processes video frames in the browser. It handles segmenter failures by falling back to the original camera track. Actual segmentation quality and performance depend on browser, hardware and model availability. [MediaPipe Image Segmenter](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter)

Mic and camera arrows open the device menus. Input switching uses the current producer's `replaceTrack` and releases the previous raw input. A local preview or test while muted is separate from published media. Input choice, quality preference and speaker choice are stored locally. Speaker selection follows browser permission and `setSinkId` support. Browsers with `selectAudioOutput` may require a fresh user gesture to restore a saved device. Native picker and physical routing support depend on the browser, OS and active permission policy. [Audio output selection](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput)

## Local API, team links and troubleshooting

For local development, start the backend on `127.0.0.1:4000` and Next.js on `localhost:3000`. Set `BACKEND_URL=http://127.0.0.1:4000` in the frontend environment; the Next rewrites proxy `/api/meetings/*` and selected account endpoints to the backend, avoiding CORS or mixed-content fetch errors for HTTP requests. Use `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000` (or `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000`) for the development Socket.IO connection. The meeting session now uses this value for its Socket.IO origin rather than accidentally connecting to the unproxied Next dev server. In production behind the bundled Nginx proxy, leave `NEXT_PUBLIC_BACKEND_URL` empty and access Rauma through HTTPS. Do not point production browsers at `http://localhost:4000`. After changing `NEXT_PUBLIC_*`, restart/rebuild Next.js because these values are baked into client bundles.

Unscheduled live rooms may not have a persisted record until the host saves a configuration or issues a team link. The host can issue new team links for any live room (including rooms without a previous Config meeting), or rotate an existing link, through **Host settings → Team invite links**. Link rotation immediately revokes the old URL and re-enables the selected team. For security, the backend stores hashes of token secrets and never returns previously issued secrets. A host can see and copy links issued in that browser tab's session; on another device or after the session is cleared, they must **replace the team link**. A revision counter prevents showing a cached link that has since been replaced. Configured meetings also cache their initial issued links in the creation tab for the subsequent in-meeting view.

Host access and private-meeting approval remain required when using a team URL; possession of the team token does not bypass meeting admission. Team links are not a grant of host or moderator privileges.

HTTP settings now skip polling hidden tabs and back off when the backend/API proxy is unavailable; errors are shown to the host with a manual retry instead of writing the same stack trace every five seconds. If captions display browser receive-only or network errors, use a supported browser and verify its microphone permission, or configure the server Vosk model for coverage of all microphone speakers.
