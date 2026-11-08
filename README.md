# Real-Time Location Tracker

[![Node.js CI](https://github.com/mahmud-r-farhan/Realtime-Location-Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/mahmud-r-farhan/Realtime-Location-Tracker/actions/workflows/ci.yml)
[![Node Server Health Check](https://github.com/mahmud-r-farhan/Realtime-Location-Tracker/actions/workflows/health-check.yml/badge.svg)](https://github.com/mahmud-r-farhan/Realtime-Location-Tracker/actions/workflows/health-check.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

A high-performance, real-time geolocation tracker and communication platform built with Node.js, Express, Socket.IO, Leaflet.js, and WebRTC. Supports room-based private/public tracking, live group chat, peer-to-peer WebRTC voice calling, device fleet battery monitoring, emergency SOS broadcast relays, and Progressive Web App (PWA) offline support.

---

[![clean-browser-mockup.jpg](https://i.postimg.cc/C53q0ZWm/clean-browser-mockup.jpg)](https://postimg.cc/T5cwqP2D)
[![clean-browser-mockup-(1).jpg](https://i.postimg.cc/8CZf5X2r/clean-browser-mockup-(1).jpg)](https://postimg.cc/QBWdYmxX)


> [!IMPORTANT]
> **Safety and Privacy Notice:**
> - **Not an Emergency Service:** The built-in SOS feature relays alerts strictly across connected members within the same room. Server acknowledgement confirms broadcast receipt only; it is **not** connected to 911/emergency dispatch services. In real emergencies, always contact local emergency responders directly.
> - **Room Access Boundaries:** Room names function as routing channels, not secret passwords. Any visitor who knows or enters a room name can join and view real-time locations, battery levels, and shared messages. Do not use unauthenticated public deployments for confidential fleet or sensitive personal tracking.

---

## Key Features

- **Real-Time Geolocation Tracking:**
  - Continuous GPS updates mapped with Leaflet.js.
  - Accelerometer-assisted battery optimization: dynamically scales polling between active movement (2s) and stationary idle mode (30s).
  - Minimum distance threshold (8m) filters GPS jitter and redundant WebSocket traffic.
  - Instant **Pause / Resume** location sharing toggles with persistent browser preference.
  - Visual accuracy radii and fix age timestamps.
  - Automatic bounds fitting (**Show all on map**) and antimeridian-safe coordinate wrapping.

- **Multiple Map Styles & Base Layers:**
  - Fast layer switching: Esri Satellite, OpenStreetMap, CartoDB Dark Mode, Light Mode, Voyager, OpenTopoMap, CyclOSM, and Esri Street Map.
  - Automatic batch failure detection and user-friendly tile retry recovery.

- **Room-Scoped Communication:**
  - Instant room partitioning (defaults to `public`) with 1-click invite link copying (`?room=name`).
  - Real-time text chat with message timestamps and sender identification.
  - Click any chat message to immediately zoom and center on that user's map marker pin.

- **Peer-to-Peer Voice Calling (WebRTC):**
  - Mesh audio communication with hardware echo cancellation, noise suppression, and auto gain control.
  - One-click microphone mute/unmute and speaker toggles.
  - Room audio invite announcements (`request-join-call`) with ringtone alerts.

- **Fleet Power & Battery Monitoring:**
  - Inspect connected devices' live battery percentages and charging states.
  - Automated threshold alerts for Low Battery (<=20%) and Critical Battery (<=10%).
  - Dedicated Fleet Battery Status panel accessible directly from the Devices sidebar.

- **Emergency SOS Alert Relay:**
  - Hold-to-trigger (2-second hold) mechanism prevents accidental emergency broadcasts.
  - Multi-tier location resolution fallback (fresh GPS fix -> cached fix -> last shared position -> emergency alert without coordinates).
  - Distinct delivery states: Sending, Relayed to Room, Delivery Unconfirmed, and Not Sent (Offline).
  - High-visibility map marker pin, full-screen alert overlay, and audible alarm pattern.

- **Progressive Web App (PWA):**
  - Installable on desktop (Chrome/Edge) and mobile (iOS/Android).
  - High-resolution PNG icons and Apple Touch Icons.
  - Service worker asset precaching and honest offline fallback notice page.
  - Responsive design with touch drag-handles and dark/light theme switching.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────────┐
                      │            Browser Client (PWA)           │
                      │  - Leaflet Map Canvas                     │
                      │  - Geolocation & Accelerometer Poller     │
                      │  - WebRTC Audio Mesh                      │
                      │  - LocalStorage & Service Worker Cache    │
                      └─────────────────────┬─────────────────────┘
                                            │
                     HTTP GET / (Session Issue) │ WebSocket Upgrade (HMAC Auth)
                                            ▼
                      ┌───────────────────────────────────────────┐
                      │          Node.js / Express Server         │
                      ├───────────────────────────────────────────┤
                      │  - Helmet Security (CSP & HSTS)           │
                      │  - Gzip Compression                      │
                      │  - Rate Limiting (HTTP & Sockets)         │
                      │  - HMAC Session Verification              │
                      │  - In-Memory Room Channel Routing         │
                      └─────────────────────┬─────────────────────┘
                                            │
                  ┌─────────────────────────┴─────────────────────────┐
                  ▼                                                   ▼
      ┌───────────────────────┐                           ┌───────────────────────┐
      │  Peer Client (Room A) │                           │  Peer Client (Room A) │
      │  - Receives Locations │                           │  - WebRTC Audio Mesh  │
      │  - Live Room Chat     │                           │  - SOS Emergency Pin  │
      └───────────────────────┘                           └───────────────────────┘
```

---

## Quick Start (Local Development)

### Prerequisites

- **Node.js**: v18.x, v20.x, or v22.x LTS
- **npm**: v9+
- A modern browser with geolocation support

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/mahmud-r-farhan/Realtime-Location-Tracker.git
   cd Realtime-Location-Tracker
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Run syntax verification (cross-platform):
   ```bash
   npm run check
   ```

4. Run unit and integration tests:
   ```bash
   npm test
   ```

5. Run responsive browser interaction tests:
   ```bash
   # Automatically detects Google Chrome or Microsoft Edge installed on your system.
   # Alternatively install Playwright's headless Chromium shell:
   # npx playwright-core install chromium
   npm run test:browser
   ```

6. Start the local server:
   ```bash
   npm start
   # or development mode with file watching:
   npm run dev
   ```

7. Open [http://localhost:3007](http://localhost:3007) in your browser.

---

## Production Deployment Guide

### Security & Protocol Requirements

Modern browsers restrict the **HTML5 Geolocation API**, **WebRTC MediaDevices (Microphone)**, and **Service Workers** to **Secure Contexts (`https://`)** only (with `http://localhost` as the sole exception for local development).

For production deployment:
1. **Terminate TLS/SSL** at your reverse proxy (Nginx, Caddy, Cloudflare, Traefik, AWS ALB).
2. Ensure your reverse proxy passes WebSocket upgrade headers (`Upgrade`, `Connection`).
3. Set `NODE_ENV=production` so session cookies receive the `Secure` flag and strict origin rules apply.
4. Set a strong `SESSION_SECRET` environment variable across server restarts.

### Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3007` | Port number the HTTP server listens on. |
| `NODE_ENV` | `development` | Set to `production` in live environments (enforces HTTPS secure session cookies and production error masking). |
| `SESSION_SECRET` | Random 32-byte hex | Cryptographic secret for signing `sid` session cookies with HMAC-SHA256. Set a persistent string to preserve sessions across restarts. |
| `TRUST_PROXY` | `unset` | Set to `1` when running behind a trusted reverse proxy (e.g., Nginx, Cloudflare) that correctly manages `X-Forwarded-For`. |
| `ALLOWED_ORIGINS` | `unset` | Comma-separated list of additional trusted origins allowed to connect via WebSocket. Same-origin is always permitted by default. |

### Docker Deployment

A lightweight, multi-stage, rootless Dockerfile is included:

```bash
# Build and run using Docker Compose
docker compose up -d --build

# Inspect running container health
docker compose ps
curl http://localhost:3007/health
```

### Reverse Proxy Configuration Examples

#### Nginx
```nginx
server {
    listen 443 ssl http2;
    server_name tracker.example.com;

    ssl_certificate /etc/letsencrypt/live/tracker.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tracker.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3007;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

#### Caddy
```caddy
tracker.example.com {
    reverse_proxy 127.0.0.1:3007
}
```

---

## Testing & Quality Assurance

The codebase includes an automated test suite executed in CI:

- **Unit & Integration Tests (`tests/*.test.js`)**:
  - Validates HTTP endpoints (`/health`, `/`, `/developer`, 404 handler).
  - Validates HMAC session token creation, verification, and tampering rejection.
  - Verifies Socket.IO connection authentication, room joining, snapshot sync, late packet protection, HTML sanitization, rate limiting, and emergency SOS acknowledgements.
- **Browser Interaction Suite (`tests/browser/*.test.js`)**:
  - Exercises full user flows across desktop (`1440x900`), mobile (`390x844`), narrow phone (`320x568`), and landscape (`740x360`) viewports using Playwright.
  - Tests Leaflet layer switching, map gestures, location pause/resume, permission denial recovery, activity log dragging, offline service worker fallback, and two-peer WebRTC audio negotiation.

Run tests locally:
```bash
npm run check          # JavaScript syntax check (27 files)
npm test               # 33 unit and integration tests
npm run test:browser   # 29 browser automation tests
```

---

## Community & Contributing

- **Code of Conduct:** Please review our [Code of Conduct](CODE_OF_CONDUCT.md).
- **Contributing Guide:** See [CONTRIBUTING.md](CONTRIBUTING.md) for code standards and pull request workflows.
- **Security Policy:** To report vulnerabilities, refer to [SECURITY.md](SECURITY.md).
- **Engineering Audit:** Review [AUDIT.md](AUDIT.md) for detailed architecture considerations and known limitations.
- **Changelog:** Detailed history of version updates and fixes is maintained in [Changelog](Changelog).

---

## License

This project is licensed under the [ISC License](LICENSE).
