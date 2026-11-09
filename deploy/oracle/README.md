# Oracle Cloud HTTPS setup for Rauma

This runbook configures **host Nginx + Let's Encrypt/Certbot** on an Ubuntu Oracle Cloud VM. It is intentionally separate from the repository's Kubernetes manifests: the `VM.Standard.E2.1.Micro` (1 GB RAM, 1/8 OCPU baseline) is not a suitable Kubernetes control-plane host.

## What you need before starting

1. An Oracle Cloud VM with Ubuntu and a **reserved public IPv4 address**.
2. A domain you control, such as `meet.example.com`.
3. DNS A record `meet.example.com` -> the VM's reserved public IPv4 address.
4. DNS must have propagated and the VM must be reachable from the public internet on TCP 80 and 443.
5. Do not publish an AAAA record unless IPv6 is configured and reachable on the VM.

Use a real domain, not a bare public IP. Google OAuth web redirect URIs do not permit raw IP addresses as hosts. When Google sign-in is configured later, the callback URI will be:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

## 1. Configure Oracle networking

In the VM's VCN Security List or Network Security Group, add inbound rules:

| Protocol | Destination port | Source | Purpose |
|---|---:|---|---|
| TCP | 22 | Your current public IP only | SSH administration |
| TCP | 80 | `0.0.0.0/0` | ACME validation / HTTP redirect |
| TCP | 443 | `0.0.0.0/0` | HTTPS and secure Socket.IO |
| UDP | 2000–2100 | `0.0.0.0/0` initially | MediaSoup WebRTC media |
| TCP | 2000–2100 | `0.0.0.0/0` initially | MediaSoup TCP fallback |

For IPv6-enabled networks, add equivalent IPv6 rules only when you have configured IPv6 end to end. Restrict the RTC range further where feasible after testing.

**Do not expose TCP 3000 or TCP 4000 publicly.** Nginx is the only public web entry point. The backend will bind to `127.0.0.1:4000`; the Next.js process should bind to `127.0.0.1:3000`.

The UDP/TCP media port range is not HTTP and is not encrypted by the Nginx TLS certificate. MediaSoup uses its own DTLS-SRTP/WebRTC security. Keep the range limited to the configured ports.

## 2. Point the domain at the VM

At your DNS provider, create:

```text
Type: A
Name: meet (or @ for the root domain)
Value: <ORACLE_RESERVED_PUBLIC_IPV4>
TTL: 300 (or provider default)
```

Check from your computer:

```bash
nslookup YOUR_DOMAIN
```

The returned IPv4 address must equal the VM's reserved public IP.

## 3. Install Nginx and Certbot

SSH into the VM:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /etc/nginx/snippets
sudo mkdir -p /var/www/html
```

Copy the repository configuration files to Nginx:

```bash
sudo cp deploy/oracle/rauma-common-proxy.conf /etc/nginx/snippets/rauma-common-proxy.conf
sudo cp deploy/oracle/rauma-backend-proxy.conf /etc/nginx/snippets/rauma-backend-proxy.conf
sudo cp deploy/oracle/rauma.nginx.conf /etc/nginx/sites-available/rauma
```

Edit the domain placeholder:

```bash
sudo nano /etc/nginx/sites-available/rauma
```

Replace `YOUR_DOMAIN` with the real domain, for example `meet.example.com`.

Enable the site and disable the default site:

```bash
sudo ln -s /etc/nginx/sites-available/rauma /etc/nginx/sites-enabled/rauma
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

At this stage, the app upstreams may not be running yet. Nginx can still start; requests will return a gateway error until the frontend and backend processes are running. ACME validation can still work.

## 4. Issue the TLS certificate

Run Certbot:

```bash
sudo certbot --nginx --redirect -d YOUR_DOMAIN
```

Enter an email address and accept the Let's Encrypt terms. Certbot will validate domain ownership, issue the certificate, update the Nginx site for TLS, and configure HTTP-to-HTTPS redirection.

Test renewal:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

Certbot's systemd timer should handle renewal automatically. Do not manually copy certificate files into the repository.

Verify:

```bash
curl -I https://YOUR_DOMAIN
```

The response should be served over HTTPS. Also test:

```text
https://YOUR_DOMAIN
```

in a browser and confirm the certificate has no warning.

## 5. Configure the application for HTTPS

Copy the deployment environment examples:

```bash
cp deploy/oracle/backend.env.example backend/.env
cp deploy/oracle/frontend.env.example frontend/.env.production
```

Edit both files and replace the placeholders.

### Backend

Important values:

```env
PORT=4000
HOST=127.0.0.1
FRONTEND_URL=https://YOUR_DOMAIN

AUTH_SECRET=<random-secret-32-plus-characters>
AUTH_BRIDGE_SECRET=<different-random-secret-32-plus-characters>

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<ORACLE_RESERVED_PUBLIC_IPV4>
MEDIASOUP_RTC_MIN_PORT=2000
MEDIASOUP_RTC_MAX_PORT=2100
```

`HOST=127.0.0.1` keeps the HTTP API private behind host Nginx. MediaSoup independently binds to the network interface specified by `MEDIASOUP_LISTEN_IP` and advertises the public address in `MEDIASOUP_ANNOUNCED_IP`.

### Frontend

Important values:

```env
NODE_ENV=production
NEXTAUTH_URL=https://YOUR_DOMAIN
NEXTAUTH_SECRET=<separate-random-secret>
BACKEND_URL=http://127.0.0.1:4000
NEXT_PUBLIC_BACKEND_URL=
AUTH_BRIDGE_SECRET=<same-value-as-backend>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

An empty `NEXT_PUBLIC_BACKEND_URL` is intentional: browser requests use same-origin paths and Nginx routes them to the backend. `BACKEND_URL` is server-side only and must not use the public domain.

Generate three different secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Never commit environment files or secrets.

## 6. Start the application behind Nginx

The frontend and backend must be running on the same VM and listening only on loopback.

Example commands for a manual smoke test:

Backend terminal:

```bash
cd backend
npm ci
npm start
```

Frontend terminal:

```bash
cd frontend
npm ci
npm run build
npm run start -- --hostname 127.0.0.1
```

The 1 GB E2.1.Micro can run out of memory during dependency installation or `next build`. Prefer building on a larger machine/CI runner and deploying the tested output or a prebuilt container image. Do not run development mode in production.

Check local upstreams on the VM:

```bash
curl -fsS http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:3000
```

Then verify the public HTTPS URL:

```bash
curl -I https://YOUR_DOMAIN
```

Set up systemd services or a process supervisor so the backend and frontend restart after VM reboots. Do not expose their ports in Oracle security rules.

## 7. Google OAuth will be configured later

The project uses NextAuth v4 with the Google provider already wired to the backend account bridge. Google sign-in is now registered only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; the login/signup pages query NextAuth's provider list and hide the Google button until the provider is available.

After creating a Google OAuth **Web application** client, use:

**Authorized JavaScript origin**
```text
https://YOUR_DOMAIN
```

**Authorized redirect URI**
```text
https://YOUR_DOMAIN/api/auth/callback/google
```

Save the client ID and secret only in the frontend server environment (not `NEXT_PUBLIC_*`). Keep `AUTH_BRIDGE_SECRET` set on both frontend and backend, with exactly the same value. Restart the frontend after changing provider credentials.

For local development, add the corresponding localhost origin and callback as separate entries if needed. Google requires HTTPS for non-localhost web origins/redirect URIs and does not accept raw IP addresses as redirect hosts.

## 8. HTTPS and WebRTC validation checklist

- [ ] `http://YOUR_DOMAIN` redirects to `https://YOUR_DOMAIN`.
- [ ] Browser certificate is valid.
- [ ] `NEXTAUTH_URL` is the exact HTTPS origin, without an extra path.
- [ ] `FRONTEND_URL` is the exact HTTPS origin.
- [ ] NextAuth session and login work over HTTPS.
- [ ] TCP 3000 and 4000 are not exposed publicly.
- [ ] MediaSoup announced IP is the VM's public IP.
- [ ] UDP/TCP 2000–2100 are reachable from a second network.
- [ ] Two clients on different networks can connect and exchange media.
- [ ] `certbot renew --dry-run` succeeds.

HTTPS secures the web UI, APIs, and Socket.IO transport. It does not guarantee media connectivity; test WebRTC from a device outside the VM's LAN.

## Notes about the selected free VM

The E2.1.Micro has 1 GB RAM and a 1/8 OCPU baseline. It is a very constrained target for Next.js, Node.js, and a MediaSoup worker together. Use external MongoDB Atlas and OCI Object Storage for persistence, avoid Kubernetes on this VM, and expect only low-volume testing. Even with managed data stores, the live media forwarding still consumes this VM's CPU and network bandwidth.
