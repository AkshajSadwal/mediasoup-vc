# Rauma persistence plan: MongoDB Atlas + OCI Object Storage

This is the target design for the next implementation phase. The current code still uses JSON files and local profile-image files; this document does not claim that the migration has been completed.

## Service choices

- **MongoDB Atlas Free cluster** for users, meeting metadata, join requests, moderator roles, schedules, and (if enabled) persisted chat metadata.
- **Oracle Cloud Infrastructure Object Storage** for profile pictures and future binary uploads.
- **MediaSoup process memory** for live workers, routers, transports, producers, consumers, peers, and active room state. Do not send RTP/WebRTC media to MongoDB or object storage.

## Suggested collections

### `users`
- `_id` (UUID or ObjectId)
- `usernameNormalized` (unique index)
- `emailNormalized` (sparse unique index when present)
- `displayName`
- `passwordSalt`, `passwordHash` (credentials accounts only; continue using a slow password KDF)
- `provider`, `providerAccountId` (unique compound index for provider accounts)
- `avatarObjectKey`
- `createdAt`, `updatedAt`

### `meetings`
- `_id` / `roomId` (unique)
- `hostUserId`
- `title`, `scheduledAt`, `startedAt`, `status`
- `visibility`
- `attendeeUserIds`, `approvedUserIds`, `moderatorUserIds`
- `joinRequests` (or a separate collection if request volume grows)
- `createdAt`, `updatedAt`

### `meeting_messages` (optional)
- `meetingId`, `senderUserId`, `message`, `createdAt`
- Add an index on `(meetingId, createdAt)`.
- Decide retention before persisting chat; do not retain messages indefinitely by accident.

## OCI Object Storage design

- Create a private bucket in the same OCI region as the VM.
- Store keys such as `profile-images/<userId>/<random-uuid>.jpg`; never use a user-supplied filename as an object key.
- Store only `avatarObjectKey`, MIME type, and size in MongoDB.
- Prefer OCI Instance Principals from the VM using a narrowly scoped Dynamic Group and IAM policy. Do not bake API signing keys into source or container images.
- Keep the bucket private. Serve images through an authenticated backend endpoint or short-lived pre-authenticated URLs with appropriate expiry.
- Validate magic bytes, MIME type, and size before upload; enforce a 5 MB profile-image limit and delete replaced orphaned objects.

## MongoDB Atlas connectivity

- Use Atlas M0 only for a small demo/prototype. Current Free cluster limits include 0.5 GB storage, capped throughput and data transfer, and automatic pause after 30 days without connections. See MongoDB's live documentation.
- Select the nearest supported Atlas region; Atlas Free regions are a subset of AWS, Google Cloud, and Azure regions.
- Add the Oracle VM's reserved public IP to the Atlas Network Access IP Access List. Avoid `0.0.0.0/0`.
- Create a dedicated least-privilege database user and put the `mongodb+srv://` URI in a server-only environment variable.
- Enable TLS (Atlas connection strings do this by default) and never expose the URI through `NEXT_PUBLIC_*`.

## Migration sequence

1. Add the official `mongodb` Node driver and a single shared connection module with connection reuse.
2. Create unique indexes before enabling production traffic.
3. Migrate user reads/writes and preserve existing password hashes to avoid forcing password resets.
4. Migrate meeting reads/writes, private admission checks, and moderator authorization to database-backed operations.
5. Migrate profile uploads to OCI Object Storage, then update the user document with the object key.
6. Import `data/users.json` and `data/meetings.json` once, verify record counts, then disable JSON writes.
7. Back up data and test restore before deleting legacy files.

Avoid running JSON-file and MongoDB writes as two independent sources of truth for an extended period. Use a controlled one-time import or a clearly defined dual-write migration with reconciliation.
