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

- Enter a name and room (default `public`); share the room name or invite URL to join. Map updates use browser geolocation and require permission. Markers disappear on disconnect; coordinates and accuracy are estimates, can be stale, and stop when the browser suspends the page. A device count represents devices with location fixes, not everyone connected. Device classification and battery information are best-effort browser hints.
- Chat reaches connected room members only; messages are not persisted by the server. Click a message to focus its sender's current marker, if available. Acknowledgements confirm relay only.
- Audio is peer-to-peer and requires microphone permission. The default configuration has public STUN servers but **no TURN relay**. Calls can fail behind restrictive NAT/firewalls, and the mesh design does not scale to large rooms. Audio is stopped on disconnect or a room change and must be joined again.
- Hold SOS to relay an alert to connected room members. GPS may be unavailable or old; an alert can be sent without it. Notifications and sound depend on browser permissions and autoplay rules. Offline alerts are not delivered or queued. There is no server push subscription or delivery to closed applications. SOS IP enrichment sends the observed IP to ipapi.co; IP geolocation is approximate, not a GPS fallback. Be aware that device/IP details are shared with room participants.
- The service worker caches assets and some previously viewed tiles; offline availability is best effort and dependent on browser caches and tile providers. Real-time tracking, messaging, audio and SOS require a connection. Respect tile provider terms and do not rely on this as an offline navigation product.
- Profile and some alerts/settings are stored locally in the browser. Server state is volatile and lost on restart. Activity notifications are local, bounded UI messages, not an audit log.

## Development and community

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [Changelog](Changelog), and [AUDIT.md](AUDIT.md). The automated suite exercises HTTP and Socket.IO server behavior, not real mobile GPS, microphone hardware, restrictive networks, browser service workers, or end-to-end emergency delivery. Verify those separately on real devices before considering a release.

Licensed under the terms in [LICENSE](LICENSE).
