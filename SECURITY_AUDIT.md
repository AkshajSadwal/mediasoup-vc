# Rauma security review

Review scope: uploaded source snapshot (frontend Next.js app and backend Express/Socket.IO/MediaSoup). This is a source-code review, not a penetration test or production certification.

## Changes made in this pass

- Socket.IO `/mediasoup` namespace now rejects missing/invalid backend auth tokens before a socket can connect.
- Room join handler independently checks authenticated socket identity.
- `GET /api/meetings/:roomId` now requires authentication; meeting metadata is no longer exposed to anonymous callers.
- Auth endpoints have a basic per-IP, in-memory request limiter (30 requests per 15 minutes).
- Google auth bridge fails closed if `AUTH_BRIDGE_SECRET` is missing or shorter than 32 characters.
- JSON request body size is limited to 32 KB.
- Signup no longer returns a backend bearer token that the frontend did not use.
- Login/signup callback destinations are restricted to local paths to reduce open-redirect risk.

## Findings and severity

### High — Meeting privacy depends on possession of the room UUID

The socket join flow allows any authenticated account that knows a live meeting's UUID to join it. The calendar endpoint also lets any authenticated account add a meeting to their calendar by UUID. This is consistent with a shareable-link meeting model, but it is not private/invite-only authorization. If meetings are intended to be private, enforce an attendee/allow-list or signed invitation token in both the HTTP calendar route and Socket.IO join handler.

### Medium — Auth throttling is process-local

The new limiter protects a single backend process only. It resets on restart, can be bypassed across replicas, and its in-memory IP map is not a distributed control. Production should use a shared Redis-backed limiter, proxy-aware IP configuration, and monitoring/temporary account lockout controls.

### Medium — File-based JSON persistence is not safe for concurrent production writes

`users.json` and `meetings.json` are rewritten synchronously without a database transaction or cross-process lock. Concurrent signup/meeting writes or multiple backend replicas can lose updates or corrupt state. Move identity and meeting data to PostgreSQL or another transactional database before production/multi-replica deployment.

### Medium — No per-socket chat/event throttling

Chat messages have a length limit but there is no per-user/per-socket message frequency limit. An authenticated participant can flood a room and increase CPU/network load. Add event-specific rate limits and message moderation/retention policies.

### Medium — Production transport security depends on deployment

The app must be served over HTTPS/WSS in production. Ensure TLS is terminated correctly at the ingress/reverse proxy, secure cookies are enabled, secrets are not committed, and MediaSoup's announced IP/UDP port range is restricted by firewall to the intended public interface. Do not expose the backend auth bridge secret to browser code.

### Low/Medium — Missing defense-in-depth HTTP headers

The Express server does not currently set a security-header policy (for example Helmet/CSP). Add a reviewed CSP and standard security headers after validating Next.js and Socket.IO requirements.

## Existing positive controls observed

- Passwords are salted and derived with Node.js `scrypt`; comparisons use `timingSafeEqual`.
- Backend bearer tokens are HMAC-signed and have a seven-day expiry.
- Admin moderation checks admin status and same-room membership on the server.
- Transport and consumer lookups are scoped to the owning socket.
- Chat messages are trimmed and length-limited; React renders chat text as text rather than raw HTML.

## Not verified

No live deployment, dependency vulnerability scan, browser test, automated test suite, load test, or external penetration test was run. Dependency versions should be audited with `npm audit` and updated deliberately before deployment.
