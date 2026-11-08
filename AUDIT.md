# Engineering audit and release blockers

This is a prioritized review of the current implementation and hardening work, not a certification or a claim that every path has been exhaustively tested. The original package already declared version 5.0.0. The changes in this branch are an incremental stabilization, **not the requested ground-up v5 rewrite**.

## Critical blockers for public or safety-critical deployment

1. **No authentication or authorization.** A signed cookie is freely obtained from `/`; room identifiers and invite links are merely routing labels. Any visitor can join any room, impersonate a display name, see location and IP data, and send messages and alerts. Origin checks do not protect against non-browser clients. Design accounts, membership, authorization, invitation revocation and abuse controls before a public release.
2. **SOS is best-effort only.** No durable queue, recipient acknowledgement, escalation, delivery guarantee, emergency-service integration or closed-app push. The client now reports relay rather than claiming all users were alerted. GPS fallback can be old; IP-derived city is imprecise. Never present this as emergency response infrastructure.
3. **Transport and scale.** Server data and rate limits are in memory and per socket, so restarts lose state and multiple processes cannot share rooms; reconnecting evades limits. Session tokens have no server-enforced expiry/revocation. No TURN server is configured. HTTP in the production compose file requires TLS termination; trust proxy must be tightly controlled. The server exposes observed IPs and device details and SOS performs third-party IP lookups.
4. **No real-device acceptance testing.** Automated tests with simulated locations cannot validate real GPS hardware, mobile background throttling, NAT traversal, audio autoplay, cross-browser service-worker lifecycle, notifications, accessibility or actual emergency delivery. Physical device/network testing is still required; Docker is exercised in CI.

## Defects addressed in this branch

- Initial public-room sockets were never joined to the Socket.IO room. Application room names are now namespaced to prevent collisions with Socket.IO private socket rooms. Switching rooms carried old coordinates into the new room and left audio peers and old map markers behind. Server transitions now remove old location/audio state and notify the old room; snapshots refresh the client map.
- A stationary device could fail to republish after reconnect. Listeners were installed after joining, URL room changes updated local storage but not in-memory profile, and overlapping GPS requests were possible. These paths have been corrected; pending requests are invalidated on a new join.
- Chat discarded messages from different users sharing a name and optimistically showed rejected messages. It now filters by socket ID and reports acknowledgement failure. The server no longer accepts a per-message sender override.
- WebRTC signaling accepted non-participants and malformed null payloads could throw. Signaling is now limited and requires audio membership. Only existing peers make offers to newcomers, avoiding the prior double-offer race; transient ICE disconnect no longer immediately destroys a peer. The microphone is stopped after a socket disconnect or room change.
- SOS previously announced success before a server response and could represent invalid coordinates as valid. The UI now reports disconnected/timeouts and the server marks invalid coordinates unavailable.
- Browser WebSocket origins are checked on upgrade; forwarded headers are trusted only with explicit configuration. Updated vulnerable production dependency resolutions and added integration regression tests, syntax checks and a Docker CI smoke test.

## Remaining gaps and further audit

- A complete frontend/module, styling, documentation, supply-chain and accessibility audit and real network/device tests are still needed; Chromium end-to-end tests use simulated geolocation and mocked or blocked map tiles. No production-readiness claim can be made from the current suite.
- Audio lacks TURN configuration, negotiation recovery and scale limits; reconnection intentionally requires a fresh join. Location fix age is shown, but there is no stale-marker expiry; real-device denial recovery and network transitions need further testing. Global in-memory room snapshots can become expensive at scale.
- PWA background sync handlers are stubs. No web-push subscription/backend exists; The offline fallback is tested in Chromium, but cache updates and installability still need cross-browser and real-device validation. Third-party tile caching must comply with provider policies.
- SOS records can persist locally and are not filtered by room; IP lookup and device metadata raise consent and retention concerns. Browser notifications, audio, vibration and permissions vary. Activity log is not an auditable history.
- Client-side profiles are not identities, and server rate limits are not global or resistant to reconnects. Configuration, input validation, logging, monitoring, lifecycle management and security review remain incomplete. Existing historical changelog statements may describe intent rather than verified behavior.
