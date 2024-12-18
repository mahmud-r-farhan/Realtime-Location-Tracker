# Real-Time Location Tracker

### Overview

The **Real-Time Location Tracker** is an advanced web application designed to monitor and track the real-time locations of connected devices. Powered by **Leaflet** for interactive map visualization and **WebSockets** for instant, real-time communication, this application is ideal for diverse use cases such as fleet management, delivery tracking, team coordination, and personal location sharing.

With its ability to switch seamlessly between online and offline map modes, the application ensures uninterrupted functionality even in areas with limited or no internet connectivity. Its fully responsive design guarantees an intuitive and consistent user experience across a wide range of devices, including desktops, tablets, and smartphones.

---


### Features

-   **Real-Time Tracking:** Seamlessly track device locations as they move, with continuous real-time updates displayed on the map.
-   **Smart Device Identification:** Automatically recognize and categorize devices based on their user agent strings, distinguishing Android, iOS, Windows, Mac, and more.
-   **Device Connection Panel:** View a dynamic list of all connected devices, and click on any device to instantly see its real-time location on the map.
-   **Customizable Icons:** Display unique, visually distinct icons for different device types, enhancing identification and user experience.
-   **Offline Map Support:** Ensure uninterrupted functionality by intelligently switching between online and offline map modes based on internet connectivity.
-   **Fully Responsive Design:** Enjoy a seamless and intuitive experience across all devices, with layouts optimized for desktops, tablets, and mobile screens.
-   **Interactive Popups:** Tap on device markers to reveal detailed information, including the assigned device name, user identification, and the precise timestamp of the last update.
-   **Personalized User Authentication:** Allow users to assign custom names for easy identification, or fall back on the device’s default name for convenience.
---

## Folder Structure

```
realtime-location-tracker/
├── public/
│   ├── assets/
│   ├── css/
│   ├── js/
│   └── views/
│       └── index.ejs
├── app.js
├── package.json
├── package-lock.json
└── README.md
```

### Folder Details:
- **public/assets/**: Stores static files such as images, fonts, or other assets.
- **public/css/**: Contains all CSS files for styling the application.
- **public/js/**: Holds JavaScript files for frontend interactivity and logic.
- **views/index.ejs**: The main view template rendered by the server.
- **app.js**: The main Node.js application file that initializes the server and routes.
- **package.json**: Includes project metadata, scripts, and dependencies.
- **package-lock.json**: Auto-generated file for locking dependency versions.
- **README.md**: Project documentation.

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

3. **Download Leaflet Library:**
   - Download the Leaflet library and place the CSS and JS files in the `public/leaflet/` directory.

4. **Download Map Tiles:**
   - Use tools like [TileMill](https://tilemill-project.github.io/) or [MapTiler](https://www.maptiler.com/) to generate offline map tiles.
   - Place the generated tiles in the `public/tiles/offline-map-tiles/` directory.

5. 

6. **Run the Application:**

    - Start the application normally:
   ```bash
   npm start
   ```

   - Start the application in development mode (with nodemon for auto-reload):
   ```bash
   npm run dev
   ```

---

## Usage

1. **Open the Application:**
   - Navigate to `http://localhost:3000` in your web browser.

2. **Allow Location Access:**
   - Grant the application access to your location to enable tracking.

3. **View Real-Time Locations:**
   - The map will display the real-time locations of all connected devices with custom icons.

4. **Interact with Markers:**
   - Click on a marker to view additional information about the device.

---

## Contributing
We welcome contributions from the community! To contribute:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature-branch
   ```
3. Make your changes and commit them:
   ```bash
   git commit -m "Add new feature"
   ```
4. Push to the branch:
   ```bash
   git push origin feature-branch
   ```
5. Open a pull request.

---

## License

 This project is licensed under the Personal Use License. See the LICENSE file for details.

---

## Contact
For any questions or suggestions, feel free to reach out:

- **Email:** [GMAIL](mailto:farhanstack.dev@gmail.com)
- **GitHub:** [Github](https://github.com/mahmud-r-farhan)
