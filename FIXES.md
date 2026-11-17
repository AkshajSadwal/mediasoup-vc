# Rauma meeting reliability fixes

## Changes in this archive

- **HTTP meeting settings:** Uses `/api/meetings` on the frontend origin. Next.js now rewrites meeting/account/profile routes to the backend for local development. Host settings polling backs off on failed requests, avoids polling hidden tabs, and provides a retry message. The backend returns a valid live-room settings snapshot for active unscheduled rooms rather than repeated 404 errors.
- **Socket.IO connection:** The client honors `NEXT_PUBLIC_SOCKET_URL`, falling back to `NEXT_PUBLIC_BACKEND_URL`, and still supports same-origin WebSocket connections through Nginx in production.
- **Host team links:** Host Settings now includes a Team Invite Links panel for any meeting, even a meeting created without the Config meeting wizard. Hosts can create named teams, display and copy links issued in the current browser session, re-enable a disabled team by generating a new link, and rotate an old link when it is lost.
- **Token safety:** Only hashes of team secrets are stored by the backend. Reissuing revokes the old URL. Link revision counters prevent showing a stale token after another browser rotates it; team links do not bypass private meeting approval. Previously issued tokens cannot be recovered on a different device without rotation.
- **Captions:** Keeps the optional Vosk-backed server transcription. If that server model is unavailable, viewers who enable captions may instead opt into browser speech recognition and relay their *own* microphone text to others who also enabled browser captions in the same breakout room. This opt-in mode does not transcribe other participants who have not opted in and is receive-only when the browser lacks speech recognition. Browser recognition may rely on a third-party speech service. No browser caption text is persisted.
- **Additional checks:** Configuration creation validates visibility values. Added examples for local/frontend and captions environment variables.

## Run locally (Windows PowerShell)

1. Extract the ZIP to a new folder. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local` and supply consistent secrets and port settings.
2. In `backend`: `npm ci` then `npm start`. Backend default port is 4000. The mediasoup package may require a supported platform/compiler.
3. In `frontend`: `npm ci` then `npm run dev`. Frontend default port is 3000. In local development set `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`; `NEXT_PUBLIC_SOCKET_URL` can also be set explicitly.
4. Visit `http://localhost:3000`. In a live meeting open **Host settings → Team invite links**. Turn on captions in the **Live captions** panel; Chrome/Edge Web Speech fallback may request microphone permissions.
5. For production behind Nginx, use the same-origin /api and /socket.io reverse proxy paths and set `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_SOCKET_URL` empty. Rebuild the frontend after changing any `NEXT_PUBLIC_` environment variable.

## Checks and limitations

- `node --test backend/test/team-links.test.js` — 3 tests passing.
- TypeScript parser: 80 JavaScript/JSX files parsed with no syntax errors.
- **Not verified in this environment:** Full `npm test`, `npm run lint`, `next build` or live end-to-end browser/media testing. The npm registry could not be accessed during dependency installation (offline `npm ci` reported `ENOTCACHED`). Run these after installing dependencies in a networked environment.
- The Vosk server model is still an optional separate download. See `docs/live-meeting.md` for speech recognition setup and privacy limitations.
