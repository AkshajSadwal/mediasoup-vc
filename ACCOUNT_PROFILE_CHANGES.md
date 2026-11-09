# Account profile changes

This patch adds persistent account display names and profile pictures.

## Included
- Profile dropdown with Account and Log Out actions.
- Account settings modal over the home page.
- Display-name editing (1–40 characters; not unique).
- PNG/JPEG avatar upload, validated by MIME and file signature, max 5 MB.
- Avatar files stored under `data/profile-pictures/`.
- Authenticated backend endpoints: `GET /api/auth/me` and `PATCH /api/auth/profile`.
- Updated NextAuth session refresh so saved profile data appears immediately and persists after reload/sign-in.
- Display name and avatar propagated to meeting headers, participant lists, and camera-off tiles.
- Text caret and I-beam cursor only appear in focused editable fields.
- Nginx routes for profile endpoints and uploaded pictures.

## Apply
1. Back up your repository.
2. Extract this ZIP at the project root, preserving the `backend/`, `frontend/`, and `nginx/` paths.
3. Allow files to overwrite matching files.
4. Restart backend and frontend; rebuild/redeploy the Nginx image if using Docker/Kubernetes.
5. Ensure the backend's `data/` directory is writable and persistent. In Kubernetes, mount a persistent volume at the backend data directory used by the auth store (`/data` in the backend container).

## Validation
- Backend JavaScript syntax checks passed.
- Frontend JSX/JavaScript transpile diagnostics passed.
- Profile persistence store test passed.
- A full Next.js production build was not completed in this environment because the local `next` executable was unavailable.
