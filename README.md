# Real-Time Location Tracker

A Node.js and Socket.IO location-sharing application with a Leaflet map, room-scoped chat, WebRTC audio invitations, and an SOS relay. Version 5 is **not yet production-ready**: see [AUDIT.md](AUDIT.md) before deploying or contributing.

> **Safety and privacy:** This is not an emergency service. An SOS is only relayed to currently connected members of the selected room; the server acknowledgement does not mean anyone received or acted on it. Call local emergency services directly. Room names are not passwords, and there is no user authentication or authorization: anyone who knows or guesses a room name can join and see its location and other data. Do not use it for sensitive fleet or personal tracking on a public server.

## Run locally

Requires Node.js 18 or newer and npm. From the repository root:

```sh
npm ci
npm start
# open http://localhost:3007
npm run check
npm test
# Optional browser interaction checks (requires Playwright Chromium)
npx playwright-core install chromium
npm run test:browser
```

For other devices and production, use HTTPS on the same origin (geolocation, microphone access and service workers require a secure context; localhost is a browser exception). Reverse proxies must forward WebSocket upgrades and use a long enough timeout. The app has no HTTPS listener itself. `GET /health` reports process health, not external dependency or end-to-end feature health.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3007` | HTTP listen port |
| `NODE_ENV` | `development` | In production the session cookie has the Secure flag and requires HTTPS |
| `SESSION_SECRET` | random per process | Stable secret for signed anonymous session cookies; set a long random value across restarts |
| `TRUST_PROXY` | unset | Set to `1` only behind exactly one trusted proxy that overwrites forwarded headers; keep the app inaccessible directly |
| `ALLOWED_ORIGINS` | unset | Comma-separated extra browser origins permitted to connect to Socket.IO. Same host is always permitted. Avoid `*`. |

The anonymous signed cookie prevents forged cookie values but **does not authenticate a person**, expire server-side, or restrict access to rooms. Data is held in process memory; use one instance only. Proxy IPs can be inaccurate and must not be treated as identity or location.

### Docker

```sh
docker compose up --build
```

Compose runs in production mode and exposes port 3007 over HTTP. Put a TLS-terminating proxy in front of it and configure `SESSION_SECRET` and (only when appropriate) `TRUST_PROXY`. Without HTTPS the Secure cookie will not work in ordinary remote browsers. Docker's health check only tests `/health`.

## Features and limitations

- Enter a name and room (default `public`); share the room name or invite URL to join. Map updates use browser geolocation and require permission. Use **Pause sharing** in Devices to stop publishing and remove this device’s location from the room; the preference persists in this browser until resumed. A disconnected device may remain visible until the server detects the disconnect, and pausing cannot erase data already seen or saved by others. SOS can still request and share your location while paused.
- The first local location fix centers the map unless you have already interacted with it. Zoom, map styles and **Show all on map** help explore current room markers; live marker updates do not pull an open popup back into view. If an entire tile batch fails, the map shows a retry option; availability depends on the selected third-party provider. Fix age is based on the reporting device’s clock, and the accuracy radius is an estimate, not a guarantee. Stationary devices refresh approximately once a minute while the page is active; background throttling, permission failures and network interruptions can make fixes stale. A device count represents devices with location fixes, not everyone connected. Device classification (including iPadOS and ChromeOS) and battery information are best-effort browser hints and can be missing or wrong. Pins distinguish your device from other devices; activate a pin for details.
- Chat reaches connected room members only; messages are not persisted by the server. Click a message to focus its sender's current marker, if available. The local chat view and draft are cleared when switching rooms. Acknowledgements confirm relay only.
- Audio is peer-to-peer and requires microphone permission. The default configuration has public STUN servers but **no TURN relay**. Calls can fail behind restrictive NAT/firewalls, and the mesh design does not scale to large rooms. Audio is stopped on disconnect or a room change and must be joined again.
- Hold SOS to relay an alert to connected room members. A visible status distinguishes an unsent alert, an unconfirmed acknowledgement and relay to the server; relay is not proof of receipt or response. An alert started in one room is not intentionally sent after a room change or reconnect. Location attempts are time-bounded and fallback fixes are labelled as potentially old. GPS may be unavailable or old; an alert can be sent without it. Browser notifications are optional and requested from the SOS dialog; notifications and sound depend on browser permissions, support and autoplay rules. Offline alerts are not delivered or queued. There is no server push subscription or delivery to closed applications. SOS IP enrichment sends the observed IP to ipapi.co; IP geolocation is approximate, not a GPS fallback. Be aware that device/IP details are shared with room participants.
- The service worker caches assets and some previously viewed tiles; if the server cannot be reached on navigation, it shows an offline notice instead of a live tracker. Offline availability is best effort and dependent on browser caches and tile providers. Real-time tracking, messaging, audio and SOS require a connection. Respect tile provider terms and do not rely on this as an offline navigation product.
- Profile and some alerts/settings are stored locally in the browser; the local SOS history is shared across room changes and is not a room-isolated audit log. Server state is volatile and lost on restart. Activity notifications are local, bounded UI messages, can be cleared, and reset on room changes; they are not an audit log.

## Development and community

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [Changelog](Changelog), and [AUDIT.md](AUDIT.md). The automated suites exercise HTTP and Socket.IO server behavior plus Chromium workspace interactions at several viewport sizes. Most browser tests use simulated geolocation and mock or block third-party tiles; one test exercises the offline service-worker fallback, and an audio test uses simulated microphones in two local browser contexts. They do not validate real mobile GPS or microphone hardware, restrictive networks, cross-browser service-worker behavior, or end-to-end emergency delivery. Verify those separately on real devices before considering a release.

Licensed under the terms in [LICENSE](LICENSE).
