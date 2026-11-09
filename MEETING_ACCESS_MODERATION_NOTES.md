# Meeting privacy and moderator changes

## Implemented

- Meetings now store `visibility` (`public` or `private`), approved user IDs, pending join requests, and moderator user IDs. Existing records default to public.
- Hosts can choose visibility while scheduling and can change it from the waiting room before the meeting starts or from the in-meeting Settings panel.
- A private meeting rejects a participant at the MediaSoup `joinRoom` boundary unless they are the host, an approved user, or a moderator.
- Authenticated users can request access. Hosts and moderators can approve or deny requests from the waiting room or in-meeting Settings panel.
- Hosts can promote a participant who is currently in the room to moderator, and can revoke the role. Role changes are persisted and propagated to the live socket peer.
- Moderators can mute/remove ordinary participants and approve join requests. They cannot mute/remove the host or another moderator, and cannot change privacy or appoint moderators. The host can moderate moderators, but cannot moderate themselves.
- Instant meetings are now created as persisted meeting records, so privacy and moderation rules also apply to instant rooms.
- Static interface text uses the default pointer rather than the text-selection I-beam; input fields retain a text caret so users can still type normally.

## Validation performed

- `node --check` passed for all backend JavaScript source files.
- Meeting-store behavior test passed for private denial, access request, approval, moderator access, and switching to public.
- Frontend production build could not be run in this environment because the local `frontend/node_modules/.bin/next` executable is missing (`npm run build` reports `next: not found`). Run `npm ci` in `frontend/`, then `npm run build` before deployment.
- Full browser testing and two-user WebRTC testing have not been performed.

## Important deployment notes

- The meeting store is a JSON file. This implementation is suitable for a single backend process, but concurrent writes and multiple backend replicas need a transactional database/shared store before production scaling.
- Join requests are persisted, but this change does not add request throttling. Add per-user/IP rate limiting before exposing this publicly.
- If you use an older live meeting created before this change without a meeting record, it will not have persisted privacy/moderator settings. New instant meetings create a meeting record automatically.
