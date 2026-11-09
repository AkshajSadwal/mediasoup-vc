# Rauma — Real-Time Video Conferencing

Rauma is a browser-based video conferencing application built with **WebRTC and MediaSoup SFU**. It combines real-time audio/video communication with meeting scheduling, public and private room access, participant moderation, and account profiles.

> **Status:** Active development. Local development and container/Kubernetes configuration are included. A production deployment still requires durable external storage, HTTPS, public WebRTC network configuration, and deployment validation.

## Features

- **Real-time audio/video:** WebRTC media transport using MediaSoup's Selective Forwarding Unit (SFU) architecture.
- **Meeting lifecycle:** Create instant meetings, schedule meetings, and join through a meeting link or room code.
- **Private meetings:** Require participants to request access; the host or a moderator can approve or deny requests.
- **Participant roles:** Host and moderator controls for participant moderation, with protections preventing moderators from removing the host or other moderators.
- **Authentication:** Username/password sign-in and optional Google OAuth through NextAuth.
- **Account profiles:** Editable display names and PNG/JPEG profile pictures.
- **Meeting experience:** Participant list, chat, camera/microphone controls, meeting settings, waiting-room flow, and responsive interface.
- **Deployment assets:** Dockerfiles, Nginx reverse-proxy configuration, and Kubernetes manifests.

## Architecture

```text
                          Browser clients
                         /               \
        HTTPS / Socket.IO signaling       WebRTC media (UDP/TCP)
                       /                     \
                      v                       v
              Nginx reverse proxy        MediaSoup SFU
                 /          \             Worker / Router
                v            v            Transports
          Next.js UI     Express API      Producers / Consumers
                             |
                       Authentication
                       Meeting metadata
```

HTTP requests and Socket.IO carry application traffic and WebRTC signaling. Audio/video packets use separate WebRTC transports to reach the MediaSoup SFU; they do not travel through Nginx's normal HTTP proxy route.

### Technology stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Authentication | NextAuth, credentials provider, Google OAuth |
| Backend | Node.js, Express |
| Signaling | Socket.IO |
| Real-time media | WebRTC, MediaSoup, mediasoup-client |
| Reverse proxy | Nginx |
| Deployment | Docker, Kubernetes manifests |

## Repository structure

```text
.
├── backend/
│   ├── src/
│   │   ├── auth/              # Authentication and user profile store
│   │   ├── http/              # Authentication and meeting API routes
│   │   ├── mediasoup/         # Workers, rooms, peers, transports, producers/consumers
│   │   ├── meetings/          # Meeting persistence and access rules
│   │   └── socket/            # Socket.IO signaling and room events
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── app/                   # Next.js routes and pages
│   ├── components/            # Home, account, and meeting UI
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/                       # Kubernetes deployment/service manifests
└── SECURITY_AUDIT.md
```

## Run locally

### Prerequisites

- Node.js 24 (the Dockerfiles use Node 24)
- npm
- A modern browser with camera and microphone access
- For tests across devices: a network-reachable MediaSoup address and open RTC ports

### 1. Configure and start the backend

```bash
cd backend
npm ci
```

Copy the example environment file:

**Linux/macOS**
```bash
cp .env.example .env
```

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```

Set the values in `backend/.env`:

| Variable | Purpose |
|---|---|
| `PORT` | Backend HTTP and Socket.IO port; defaults to `4000` |
| `FRONTEND_URL` | Browser-facing frontend origin allowed by CORS |
| `AUTH_SECRET` | Random backend token-signing secret; at least 32 characters |
| `AUTH_BRIDGE_SECRET` | Shared secret for the NextAuth-to-backend Google account bridge |
| `MEDIASOUP_LISTEN_IP` | Local interface on which MediaSoup listens |
| `MEDIASOUP_ANNOUNCED_IP` | Reachable public/LAN IP advertised to remote WebRTC clients |
| `MEDIASOUP_RTC_MIN_PORT` | First port in the MediaSoup RTC range |
| `MEDIASOUP_RTC_MAX_PORT` | Last port in the MediaSoup RTC range |

Generate separate random secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

For localhost-only testing, the example loopback configuration can be used. For LAN or internet participants, configure a reachable announced IP and allow the configured RTC port range through the host firewall and cloud network security rules.

Start the backend:

```bash
npm start
```

The backend health endpoint is `http://localhost:4000/api/health`.

### 2. Configure and start the frontend

Open a second terminal:

```bash
cd frontend
npm ci
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
BACKEND_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<a-separate-random-secret>
AUTH_BRIDGE_SECRET=<same-value-as-backend>
GOOGLE_CLIENT_ID=<optional-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<optional-google-oauth-client-secret>
```

Google OAuth is optional for local username/password testing. To enable it, create OAuth credentials and configure the exact callback URL in Google Cloud Console.

Start Next.js:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Verify a meeting

1. Create an account and sign in.
2. Start an instant meeting or schedule one.
3. Join from a second browser profile or another device.
4. Grant camera and microphone permissions.
5. Test public and private admission, join-request approval, moderator controls, and chat.

A successful page load does not prove WebRTC connectivity. For remote devices, the backend must advertise an address reachable by those devices and the configured RTC ports must be reachable. Production browser camera/microphone access requires HTTPS.

## Docker and Kubernetes

The repository includes:

- `frontend/Dockerfile` for the Next.js application.
- `nginx/Dockerfile` and `nginx/nginx.conf` for reverse proxying.
- `k8s/` manifests for backend, frontend, and Nginx workloads/services.

The manifests are a starting point, not a production-ready cluster configuration. Before deploying, review container images and pull policies, secrets, persistent volumes, public URLs, TLS, MediaSoup's announced IP, UDP/TCP RTC port exposure, health checks, and storage.

A few repository-specific items need attention before a container deployment:

- The backend deployment expects a `mediasoup-backend:latest` image, but the repository currently has no `backend/Dockerfile`.
- The frontend Dockerfile copies `/app/public`; the repository currently has no `frontend/public/` directory. Add the directory or adjust the Dockerfile if the build fails at that step.
- `k8s/backend-deployment.yaml` currently contains a LAN IP in `MEDIASOUP_ANNOUNCED_IP`. Replace it with the VM's public/reachable address, and update the frontend/backend public origin variables from localhost before production.
- The manifests use local image pull policies and a NodePort intended for a local cluster workflow; they need adapting for the target VM and image registry.

**Small-VM note:** Do not deploy a Kubernetes control plane on a 1 GB VM. For the Oracle `VM.Standard.E2.1.Micro` shape, use a lightweight single-machine deployment (for example, systemd or carefully limited Docker Compose). MediaSoup's CPU and network requirements also limit the number of simultaneous participants this VM can support.

## Persistence: current implementation and production target

### Current repository behavior

- User records are stored in `data/users.json`.
- Meeting metadata is stored in `data/meetings.json`.
- Profile pictures are written to `data/profile-pictures/`.
- Live room, peer, transport, and media state is held in the backend process.

This file-based persistence is useful during development, but it is **not appropriate for concurrent production writes or multiple backend replicas**. Local image files also tie uploads to the VM's disk and backup lifecycle.

### Recommended production storage

Keep relational records and binary files separate:

| Data | Recommended service | What to store |
|---|---|---|
| Users, meeting metadata, join requests, moderator assignments | Managed PostgreSQL (for example, Neon) | Rows, IDs, roles, timestamps, object keys |
| Profile images and future uploaded assets | Object storage (OCI Object Storage or Cloudflare R2) | Image objects; store only the object key and metadata in PostgreSQL |
| Active MediaSoup room/peer state | MediaSoup process (initially one backend/SFU instance) | Ephemeral live state; do not try to store RTP media in PostgreSQL |

The application must be migrated from JSON files to PostgreSQL and from local image writes to an object-storage SDK before this external-storage architecture is in use.

## Oracle Cloud deployment guidance

For the specified `VM.Standard.E2.1.Micro`:

- The Always Free shape has **1 GB RAM and 1/8 OCPU**, with the ability to use additional CPU resources; public internet bandwidth is limited to **up to 50 Mbps** under the Always Free description.
- Run only the application processes needed: Nginx, Next.js, Express/Socket.IO, and one MediaSoup worker.
- Use a managed PostgreSQL service and object storage so database files and profile images do not consume the VM's local disk.
- Expose web traffic through TCP 80/443 and expose only the configured MediaSoup RTC UDP/TCP range. Do not expose the backend API port directly to the public internet.
- Configure `MEDIASOUP_ANNOUNCED_IP` to the VM's public IP and validate ICE connectivity from an external network.
- Use HTTPS, backups, logs, monitoring, secret management, and a restart policy.

This VM is suitable for a constrained demo or low-volume experiment, not a high-concurrency video-conferencing deployment. A MediaSoup SFU forwards media for participants, so network egress and CPU load grow with the number of streams and viewers. Consider OCI's Always Free Ampere A1 allowance (up to 2 OCPUs and 12 GB RAM across eligible instances) if available in your tenancy; validate native dependency/architecture compatibility and test the MediaSoup build before choosing ARM.

Free-tier limits, availability, and terms can change. Check the provider's current limits before relying on a free plan.

## Security

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for source-review findings and production hardening recommendations. That document explicitly identifies its scope; it is not a penetration test or production security certification.

## License

No `LICENSE` file is currently present. Add an appropriate license before inviting others to reuse, modify, or distribute this project.

## Acknowledgements

- [MediaSoup](https://mediasoup.org/)
- [WebRTC](https://webrtc.org/)
- [Next.js](https://nextjs.org/)
- [Socket.IO](https://socket.io/)
