# Rauma frontend

This directory contains the Next.js 16 and React 19 frontend for the Rauma video-conferencing application. For backend setup, meeting permissions and deployment architecture, see the [project README](../README.md).

## Local development

Use a supported Node.js release (the deployment Dockerfile uses Node.js 24). Start the backend first, then configure the frontend:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

On Windows, use `Copy-Item .env.example .env.local` to create the environment file.

Set `NEXTAUTH_SECRET` to a strong random value and configure `AUTH_BRIDGE_SECRET` to match the backend. The backend requires a different, independently generated `AUTH_SECRET`. The NextAuth Google provider is optional; supply both Google OAuth credentials to enable it. The default local backend is `http://127.0.0.1:4000` and browser signaling can use `http://localhost:4000`.

Visit `http://localhost:3000`. The API routes for account actions and meetings are proxied to the backend by Next.js in development. The Google account-provisioning bridge is used server-to-server and is not exposed through a public Next.js rewrite.

## Validation

```bash
npm run lint
npm run build
```

For production, serve the frontend through HTTPS, use a private backend address in `BACKEND_URL`, set `NEXTAUTH_URL` to the public HTTPS origin, and keep public browser API calls on the same origin. All `NEXT_PUBLIC_*` settings are embedded at build time, so rebuild after changing them. See [Oracle deployment notes](../deploy/oracle/README.md) for a reference topology; that guide is not a production security certification.
