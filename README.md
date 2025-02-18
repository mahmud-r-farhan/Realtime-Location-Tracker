# Real-Time Location Tracking and Monitoring with Communication (Version 3)

## Overview
The **Real-Time Location Tracker** is an advanced web application designed to monitor and track real-time locations of connected devices. It is powered by **Leaflet** for interactive map visualization, **WebSockets** for instant communication, and **WebRTC** for real-time audio communication. The application is perfect for use cases such as fleet management, delivery tracking, team coordination, and personal location sharing.

With the ability to switch seamlessly between online and offline map modes, the application ensures uninterrupted functionality even in areas with limited or no internet connectivity. The fully responsive design guarantees an intuitive and consistent user experience across desktops, tablets, and smartphones.

---

## Features
- **Real-Time Tracking:** Track device locations with continuous real-time updates.
- **Smart Device Identification:** Recognizes and categorizes devices based on user agent strings.
- **Device Connection Panel:** View a list of connected devices and their active status.
- **Customizable Icons:** Unique icons for different device types.
- **Offline Map Support:** Intelligent switching between online and offline map modes.
- **Responsive Design:** Optimized for all devices.
- **Interactive Popups:** View details of connected devices.
- **Personalized User Authentication:** Assign custom names or use default device names.
-   **Activity Logs:** A comprehensive log system that tracks server notifications, connection events, and disconnections.
- **Audio Communication (WebRTC):** Real-time voice communication between connected devices.
- **Live Chat Messaging:** Send instant text messages using WebSockets.



## **Version Release**

### **Initial Release**

-   **Real-Time Location Tracker** is a web application designed for seamless, real-time device tracking.
-   **Lightweight & Optimized** for minimal server load, ensuring efficient performance.

----------

### **Version 2.0** – **Major Enhancements & New Features**

-   **Real-Time Tracking:** Continuously updates device locations on the map as they move.
-   **Smart Device Identification:** Automatically detects and categorizes devices based on their user agent (Android, iOS, Windows, Mac, etc.).
-   **Device Connection Panel:** Displays a dynamic list of all connected devices with real-time count and allows instant location viewing.
-   **Customizable Icons:** Unique icons for different device types for better visualization.
-   **Offline Map Support:** Automatically switches between online and offline map modes based on internet availability.
-   **Fully Responsive Design:** Optimized layouts for desktops, tablets, and mobile screens.
-   **Interactive Popups:** Click on a device marker to view detailed information, including device name and user identification.
-   **Personalized User Authentication:** Users can assign custom device names or use default names for identification.
-   **Audio Communication:** Real-time voice communication between connected devices using WebRTC.

 >     Recommended Version: 2.4.2

----------

### **Version 3.0 (Latest Update)** – **Advanced Features & Performance Upgrades**

-   **Enhanced Interactive Popups:** Now includes real-time device details such as battery status, connection type, and more.
-   **Activity Logs:** A comprehensive log system that tracks server notifications, connection events, and disconnections.
-   **Live Chat Messaging:** Instant text communication between connected devices via WebSockets.

This latest version introduces **enhanced real-time tracking, better device insights, and improved communication tools**, making the app more versatile and powerful.

 >     Recommended Version: 3.5.7

## Folder Structure
```
realtime-location-tracker/
├── public/
│   ├── assets/
│   ├── css/
│   ├── js/
│── views/
│   └── index.ejs
├── app.js
├── package.json
└── README.md
```
### Folder Details:
- **public/assets/**: Stores static files such as images and fonts.
- **public/css/**: Contains all CSS files for styling.
- **public/js/**: Holds JavaScript files for frontend logic.
- **views/index.ejs**: Main view template.
- **app.js**: Initializes the server and routes.
- **package.json**: Contains project metadata and dependencies.
- **README.md**: Project documentation.

---

## Installation
1. **Clone the Repository:**
   ```bash
   git clone https://github.com/mahmud-r-farhan/realtime-location-tracker.git
   ```
   ```bash
   cd realtime-location-tracker
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Configure Offline Support(optional):**
   - Download Leaflet library and place CSS/JS files in `public/leaflet/`.
   - Generate offline map tiles and place them in `public/tiles/offline-map-tiles/`.
4. **Set Up WebRTC for Audio Communication(optional):**
   ```javascript
   const createPeerConnection = (peerId) => {
       const configuration = {
           iceServers: [
               { urls: 'stun:stun.l.google.com:19302' },
               { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' }
           ]
       };
       return new RTCPeerConnection(configuration);
   };
   ```
5. **Run the Application:**
   ```bash
   npm start
   ```

---

## Usage
1. Open `http://localhost:3007` in a browser.
2. Grant location access.
3. View real-time locations on the map.
4. Click on markers to view device details.
5. Initiate audio communication with connected devices.
6. Send messages through the WebSocket-based chat system.

---

## Security Policy

### Supported Versions
| Version | Supported |
|---------|-----------|
| 3.x     | ✅         |
| 2.x     | ✅         |
| 1.x     | ❌        |

---

## Live Test
- Live: [Render Deployment](https://realtime-location-tracker-v9ow.onrender.com/)
- Invite multiple users to test tracking and communication features.

---

## Contributing
1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b user-update
   ```
3. Make changes and commit:
   ```bash
   git commit -m "Add new feature"
   ```
4. Push to branch:
   ```bash
   git push origin user-update
   ```
5. Open a pull request.

---

## License
This project is licensed under the Personal Use License. See the LICENSE file for details.

---

## Contact
- **Email:** [GMAIL](mailto:farhanstack.dev@gmail.com)
- **GitHub:** [GitHub](https://github.com/mahmud-r-farhan)