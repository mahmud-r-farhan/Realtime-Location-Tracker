# Real-Time Location Tracker Documentation

The **Real-Time Location Tracker** is a web application designed to monitor and track the real-time locations of connected devices. It leverages interactive map visualizations (Leaflet), instant communication (WebSockets), and real-time audio communication (WebRTC). The application is suitable for various use cases, including:

- Fleet management
- Delivery tracking
- Team coordination
- Personal location sharing
- **Emergency response with SOS alerts**

The application provides a responsive design for a consistent user experience across desktops, tablets, and smartphones. It also supports offline map functionality and PWA installation.

---

## 🚀 Features

### Core Features
- **Real-Time Tracking:** Track device locations with continuous real-time updates
- **Smart Device Identification:** Recognizes and categorizes devices based on user agent strings
- **Device Connection Panel:** View a list of connected devices and their active status
- **Customizable Icons:** Unique icons for different device types
- **Offline Map Support:** Intelligent switching between online and offline map modes
- **Responsive Design:** Optimized for all devices
- **Interactive Popups:** View details of connected devices

### Communication Features
- **Audio Communication (WebRTC):** Real-time voice communication among connected devices
- **Broadcast Call:** "Megaphone" feature to invite all users to a call
- **Live Chat Messaging:** Send instant text messages using WebSockets
- **Locate via Chat:** Click any message to instantly find the sender on the map
- **Activity Logs:** A comprehensive log system that tracks server notifications, connection events, and disconnections

### 🆘 Emergency SOS Feature (NEW in v4.0)
- **SOS Button:** Hold for 2 seconds to send an emergency alert to ALL connected users
- **Instant Location Sharing:** Your real-time GPS coordinates are immediately shared
- **Device Details:** Includes battery level, connection type, and platform info
- **IP Geolocation:** Shows approximate location based on IP address
- **Audio Alert:** Alarm sound plays on all receiving devices
- **SOS Modal:** View and manage all SOS alerts in one place
- **Browser Notifications:** Push notifications for SOS alerts (when permitted)
- **Vibration Support:** Mobile devices vibrate when receiving SOS

### 📱 Progressive Web App (PWA)
- **Installable:** Install the app on your home screen like a native app
- **Offline Support:** Core functionality works even without internet
- **Push Notifications:** Receive alerts even when the app is closed
- **Auto Updates:** Automatically update to the latest version

---

## Prerequisites

- Node.js: v18 or higher
- npm: v8 or higher

---

## Folder Structure

```
realtime-location-tracker/
├── public/
│   ├── assets/
│   │   ├── icons/              # PWA icons
│   │   ├── android-log.png
│   │   ├── ios-log.png
│   │   ├── windows-log.png
│   │   ├── mac-log.png
│   │   ├── unknown-log.png
│   │   ├── microphone-*.png
│   │   ├── speaker-*.png
│   │   └── favico.png
│   ├── css/
│   │   ├── style.css
│   │   ├── panel.css
│   │   ├── device.css
│   │   ├── chat.css
│   │   ├── audio.css
│   │   ├── notification.css
│   │   ├── popup.css
│   │   ├── responsive.css
│   │   ├── icon.css
│   │   ├── sos.css
│   ├── js/
│   │   ├── main.js             # Main app orchestrator
│   │   ├── config.js           # Configuration constants
│   │   ├── device.js           # Device detection
│   │   ├── map.js              # Leaflet map management
│   │   ├── socket.js           # Socket.IO handlers
│   │   ├── ui.js               # UI components
│   │   ├── notification.js     # Notification system
│   │   ├── chat.js             # Chat functionality
│   │   ├── audio.js            # WebRTC audio
│   │   ├── sos.js              # 🆘 SOS emergency module
│   │   └── pwa.js              # PWA management
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker
│   └── offline.html            # Offline fallback page
├── views/
│   └── index.ejs               # Main view template
├── app.js                      # Express server
├── package.json
├── dockerfile
└── README.md
```

---

## Installation

1. **Clone the Repository:**
```bash
git clone https://github.com/mahmud-r-farhan/realtime-location-tracker.git
cd realtime-location-tracker
```

2. **Install Dependencies:**
```bash
npm install
```

3. **Run the Application:**
```bash
npm start
```

4. **Open in Browser:**
```
http://localhost:3007
```

---

## Usage

1. Open `http://localhost:3007` in a web browser
2. Grant location access when prompted
3. View the real-time locations of connected devices on the map
4. Click on device markers to view detailed information

### Using SOS Emergency Feature

1. **Quick Access:** Look for the red **SOS button** in the top-right corner
2. **Sending SOS:** 
   - Hold the SOS button for **2 seconds** to send an emergency alert
   - The button will show a progress indicator while holding
   - Upon release after 2 seconds, an SOS is sent to ALL connected users
3. **SOS Information Shared:**
   - Your real-time GPS location (latitude, longitude, accuracy)
   - Device information (platform, battery level, connection type)
   - IP address and approximate location
   - Timestamp
4. **Receiving SOS:**
   - An alarm sound will play
   - Mobile devices will vibrate
   - A modal will open showing the SOS details
   - You can click "View on Map" to see the sender's location
5. **Managing SOS Alerts:**
   - Click the SOS button (short press) to open the SOS modal
   - View all recent SOS alerts in the "SOS Alerts" tab
   - Dismiss alerts once addressed

### Installing as PWA

1. **Chrome/Firefox (Desktop):** Click the install icon in the address bar
2. **Chrome (Android):** Tap "Add to Home Screen" from the menu
3. **Safari (iOS):** Tap Share → "Add to Home Screen"

---

## API Events

### Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-room` | Client → Server | Join a specific Organization/Fleet |
| `send-location` | Client → Server | Send device location |
| `receive-location` | Server → Client | Receive location updates (Room Scoped) |
| `sos-alert` | Bidirectional | Emergency SOS broadcast (Room Scoped) |
| `request-join-call` | Client → Server | Broadcast invitation to join call |
| `chat-message` | Bidirectional | Chat messages (Room Scoped) |
| `join-audio` | Client → Server | Join audio channel (Room Scoped) |
| `user-connected` | Server → Client | New user notification |
| `user-disconnect` | Server → Client | User left notification |

---

## Live Demo

- Live: [Render Deployment](https://realtime-location-tracker-v9ow.onrender.com/)
- Invite multiple users to test tracking, chat, and SOS features!

---

## Deployment Options

### Docker Deployment

```bash
# Build the image
docker build -t realtime-location-tracker .

# Run the container
docker run -p 3007:3007 --name tracker -d realtime-location-tracker

# Access at http://localhost:3007
```

### Docker Compose

```bash
docker-compose up -d
```

## Contact

- **Email:** [farhanstack.dev@gmail.com](mailto:farhanstack.dev@gmail.com)
- **GitHub:** [mahmud-r-farhan](https://github.com/mahmud-r-farhan)

---

## FAQ

**Q: How accurate is the GPS?**
A: Depends on device hardware (typically ±5-50 meters).

**Q: Can I use custom map providers?**
A: Yes! Use the new Layer Control to switch between default maps, or edit `map.js` to add more.

**Q: Is the SOS feature secure?**
A: SOS alerts are broadcast to all connected users only. Data is sanitized server-side.

**Q: Does the app work offline?**
A: Yes! The PWA caches assets and shows an offline page when connectivity is lost.

---

## Troubleshooting

- **Location Not Updating:** Ensure geolocation is enabled and the browser has permission
- **WebSocket Errors:** Verify port 3007 is open and not blocked by a firewall
- **SOS Not Working:** Check browser notification permissions and microphone access
- **PWA Not Installing:** Ensure you're accessing via HTTPS or localhost
- **WebRTC Issues:** Check STUN/TURN server configurations and network connectivity

---

Star this project if you find it helpful! ⭐

Checkout: https://github.com/mahmud-js/realtime-tracker (Golang powered!)
