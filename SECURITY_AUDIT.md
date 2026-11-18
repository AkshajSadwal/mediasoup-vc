# Security and privacy review

**Review date:** 19 November 2026  
**Scope:** Source files, local configuration, Nginx examples, meeting authorization, Socket.IO signaling, account management, browser-facing data handling, and project documentation in this repository snapshot.

## Summary

This is a source-code review and a set of focused regression checks, **not** a penetration test or certification. The application checks bearer-token identity, meeting admission, participant roles, media transport ownership, and room membership on the server. The review also found access and operational issues that have been corrected in this version. Production deployment still needs the controls and testing described below.

## Changes in this review

| Area | Finding | Change |
| --- | --- | --- |
| Private meeting metadata | `GET /api/meetings/:roomId` returned the title, host name, and schedule to any signed-in account with the room ID. | Accounts awaiting approval receive only the minimal admission-page fields. Full meeting details require admission. |
| Calendar authorization | `POST /api/meetings/:roomId/calendar` let any signed-in account add a private meeting, and prior calendar subscribers could retain private metadata after visibility changed. | Private meetings require approval before calendar enrollment; meeting lists omit private meetings for accounts without access. |
| Visibility validation | Scheduled meeting creation treated unexpected visibility values as public. | Only `public` or `private` is accepted. |
| Internal Google bridge | Proxy configurations exposed the server-to-server Google provisioning endpoint publicly. | Public Nginx/Next.js forwarding to `/api/auth/google` was removed; the backend endpoint still requires a private shared secret, checked in constant time, and validates profile fields. |
| Resource exhaustion | Authentication attempts and repeated storage changes could generate significant process or disk work. | Add bounded per-process authentication, account-operation and cross-socket join rate limiting; reduce JSON request limits outside avatar uploads; restrict meeting ID syntax. |
| Account and meeting files | Local JSON files contained sensitive profile, approval, and token-hash data with default file permissions. | Set restrictive POSIX file permissions for current local stores and newly written temporary files. |
| Profile uploads | Old images remained on disk and were cacheable long after replacement; image validation checked only the initial bytes. | Delete superseded images, avoid local image caching, and validate basic PNG/JPEG dimensions and size. This does **not** replace full image decoding and normalization. |
| Repository hygiene | A second, stale frontend source ZIP and obsolete run-result claims could cause confusion. | Remove the redundant archive, provide project-specific setup documentation, and retain only reproducible verification instructions. |

## Security properties checked in the source

- Backend HTTP routes authenticate requests using a signed bearer token; endpoint mutations derive the acting account from the token, not an arbitrary request body user ID (`backend/src/http/authMiddleware.js`, `backend/src/meetings/meetingStore.js`).
- Socket.IO verifies bearer credentials on `/mediasoup`; active events require the current room token. Transport, producer and consumer operations verify connection ownership and room affiliation (`backend/src/socket/index.js`, `backend/src/socket/events/`).
- Host-only administrative changes and moderator restrictions are checked by server-side role logic (`backend/src/live/controller.js`, `backend/src/socket/events/admin.events.js`).
- Persisted scheduled meetings use random IDs; ad hoc room codes can be user-supplied. Team invitation secrets are hashed in local meeting storage; reissuing a link revokes the previous token, and a team link cannot override private meeting approval (`backend/src/meetings/configuration.js`, `backend/src/meetings/meetingStore.js`).
- Whiteboard operations have bounded coordinates/size and author ownership. Chat text has length checks; file transfers have room-scoped, recipient-accepted channels, size bounds and per-chunk integrity checks (`backend/src/live/collaboration.js`, `backend/src/live/files.js`).
- Local recording is performed by the browser UI; there is no application endpoint for uploading saved meeting recordings. This does **not** prevent users from recording independently.

## Remaining risks and deployment requirements

1. **TLS must be configured.** The example container Nginx config listens on HTTP; the Oracle runbook relies on Certbot. Do not expose sign-in, API traffic, Socket.IO, or the app interface without a properly configured HTTPS edge. Keep backend port 4000 and the Google bridge off the public internet.
2. **Browser-readable access tokens.** The NextAuth session currently exposes a backend bearer token to frontend JavaScript. A successful script injection or malicious browser extension could use it until expiry. Apply a restrictive, tested Content Security Policy, review dependencies, prevent script injection, and consider moving API authorization behind server-side session proxies. Tokens currently expire after seven days and there is no immediate bearer-token revocation list.
3. **This is not end-to-end-encrypted conferencing.** WebRTC transport encryption protects packets in transit, but MediaSoup terminates transport encryption and forwards the media. Do not advertise end-to-end encryption without a separate implementation and audit.
4. **Captions have privacy implications.** Server transcription can decode the microphone audio of speakers when another participant requests captions; browser speech recognition can send audio to an external speech service. Provide accurate consent, disclosure and retention notices. The current application does not persist caption transcripts to a server database.
5. **Public avatar URLs.** Active profile-image URLs are publicly fetchable by anyone who knows them. Deleted URLs are removed from the origin, but copies already saved by recipients or intermediaries cannot be recalled. A private-avatar feature would require authenticated delivery rather than public static hosting.
6. **File-based persistence is a development architecture.** User and meeting files are not encrypted by the application; local system access, backups, and concurrent processes must be controlled. The current JSON writers are not safe for multiple replicas or concurrent processes. Migrate to an access-controlled production database with backups, shared transactional policies, and appropriate encryption-at-rest controls.
7. **Rate limits are not distributed.** Current account and IP limits are stored per process. Add load-balancer/WAF controls, a shared store when scaling, login abuse detection, signup protections and capacity controls; do not rely solely on application rate limiting to prevent denial-of-service attacks.
8. **Uploaded files are untrusted.** The avatar metadata checks do not fully decode, normalize or malware-scan an image. Participant file transfers are intentionally relayed but not scanned by the server. Use a hardened image decoder/re-encoder and a clear recipient safety policy before production.
9. **Dependency and media validation is incomplete.** Run dependency vulnerability scanning, frontend lint/build, native MediaSoup tests, real WebRTC browser tests, tests of forged HTTP/socket payloads, and an independent security assessment after installing the full dependencies.

## Verification in this review

The following targeted test command completed with **14 passing tests**:

```bash
node --test backend/test/account-rate.test.js backend/test/image-dimensions.test.js backend/test/meeting-access.test.js backend/test/team-links.test.js backend/test/whiteboard-operations.test.js
```

The complete backend `npm test` command was attempted but could not finish because the `mediasoup` package was not installed in the review environment. Frontend lint was attempted but `eslint` was not installed. Backend JavaScript source syntax checks passed for the modified files. No live browser, TLS configuration, network penetration test, or real multi-party media test was performed here. **Do not interpret these limitations as a clean security test result.**

Run the full repository checks and end-to-end tests after dependency installation and again in the actual deployment environment.
