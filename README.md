# Real-Time Location Tracker Documentation

The **Real-Time Location Tracker** is a web application designed to monitor and track the real-time locations of connected devices. It leverages interactive map visualizations (Leaflet), instant communication (WebSockets), and real-time audio communication (WebRTC). The application is suitable for various use cases, including:

 

- Fleet management

  

- Delivery tracking

  

- Team coordination

  

- Personal location sharing

  

- Emergency response


The application provides a responsive design for a consistent user experience across desktops, tablets, and smartphones. It also supports offline map functionality.

  

---

  

## Features

-  **Real-Time Tracking:** Track device locations with continuous real-time updates.

-  **Smart Device Identification:** Recognizes and categorizes devices based on user agent strings.

-  **Device Connection Panel:** View a list of connected devices and their active status.

-  **Customizable Icons:** Unique icons for different device types.

-  **Offline Map Support:** Intelligent switching between online and offline map modes.

-  **Responsive Design:** Optimized for all devices.

-  **Interactive Popups:** View details of connected devices.

-  **Personalized User Authentication:** Assign custom names or use default device names.

-  **Activity Logs:** A comprehensive log system that tracks server notifications, connection events, and disconnections.

-  **Audio Communication (WebRTC):** Real-time voice communication between connected devices.

-  **Live Chat Messaging:** Send instant text messages using WebSockets.

## Prerequisites

-   Node.js: v18 or higher
    
-   npm: v8 or higher
    
  

## **Version Release**

  

### **Initial Release**

  

-  **Real-Time Location Tracker** is a web application designed for seamless, real-time device tracking.

-  **Lightweight & Optimized** for minimal server load, ensuring efficient performance.

  

----------

  

### **Version 2.0** – **Major Enhancements & New Features**

  

-  **Real-Time Tracking:** Continuously updates device locations on the map as they move.

-  **Smart Device Identification:** Automatically detects and categorizes devices based on their user agent (Android, iOS, Windows, Mac, etc.).

-  **Device Connection Panel:** Displays a dynamic list of all connected devices with real-time count and allows instant location viewing.

-  **Customizable Icons:** Unique icons for different device types for better visualization.

-  **Offline Map Support:** Automatically switches between online and offline map modes based on internet availability.

-  **Fully Responsive Design:** Optimized layouts for desktops, tablets, and mobile screens.

-  **Interactive Popups:** Click on a device marker to view detailed information, including device name and user identification.

-  **Personalized User Authentication:** Users can assign custom device names or use default names for identification.

-  **Audio Communication:** Real-time voice communication between connected devices using WebRTC.

  

> Recommended Version: 2.4.2

  

----------

  

### **Version 3.0 (Latest Update)** – **Advanced Features & Performance Upgrades**

  

-  **Enhanced Interactive Popups:** Now includes real-time device details such as battery status, connection type, and more.

-  **Activity Logs:** A comprehensive log system that tracks server notifications, connection events, and disconnections. Battery and Connection Status.

-  **Live Chat Messaging:** Instant text communication between connected devices via WebSockets.

  

This latest version introduces **enhanced real-time tracking, better device insights, and improved communication tools**, making the app more versatile and powerful.

  

> Recommended Version: 3.5.7


## Folder Structure

```

realtime-location-tracker/

``
realtime-location-tracker/
├── public/
│   ├── assets/
│   │   ├── android-log.png
│   │   ├── ios-log.png
│   │   ├── windows-log.png
│   │   ├── mac-log.png
│   │   ├── unknown-log.png
│   │   ├── microphone-on-icon.png
│   │   ├── microphone-muted-icon.png
│   │   ├── speaker-on-icon.png
│   │   ├── speaker-off-icon.png
│   │   ├── favico.png
│   │   ├── icons8-location.gif
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
│   ├── js/
│   │   ├── main.js
│   │   ├── config.js
│   │   ├── device.js
│   │   ├── map.js
│   │   ├── socket.js
│   │   ├── ui.js
│   │   ├── notification.js
│   │   ├── chat.js
│   │   ├── audio.js
├── views/
│   ├── index.ejs
├── app.js
├── package.json
├── README.md
├── dockerfile
``

```

### Folder Details:

  

-  **public/assets/**: Stores static assets (images, icons).

  
  
  

-  **public/js/**: Holds JavaScript files for frontend logic:

-  `config.js`: Constants (icons, WebRTC configuration, intervals).

-  `device.js`: Device name and info utilities.

-  `map.js`: Map initialization, marker management, and popups.

-  `socket.js`: Socket.IO initialization and event handlers.

-  `ui.js`: Sidebar, name popup, and device list management.

-  `notification.js`: Notification panel and draggable functionality.

-  `chat.js`: Chat panel and messaging logic.

-  `audio.js`: WebRTC audio controls and peer connections.

-  `main.js`Orchestrates all modules and initializes the app.

  

-  **views/index.ejs**: Main view template.

  

-  **app.js**: Initializes the server and routes.

  

-  **package.json**: Contains project metadata and dependencies.

  

-  **README.md**: Project documentation.

-  **Dockerfile**: Docker configuration for containerized deployment.
    
-  **.dockerignore**: Excludes unnecessary files from Docker builds.

  

---

  

## Installation

1.  **Clone the Repository:**

```bash

git clone https://github.com/mahmud-r-farhan/realtime-location-tracker.git

```

```bash

cd realtime-location-tracker

```

2.  **Install Dependencies:**

```bash

npm install

```

3.  **Configure Offline Support(optional):**

- Download Leaflet library and place CSS/JS files in `public/leaflet/`.

- Generate offline map tiles and place them in `public/tiles/offline-map-tiles/`.

4.  **Run the Application:**

```bash

npm start

```

  

---

  

## Usage

  

1. Open `http://localhost:3007` in a web browser.

  

2. Grant location access when prompted.

  

3. View the real-time locations of connected devices on the map.

  

4. Click on device markers to view detailed information in the popup.

  

5. Use the microphone and speaker buttons to initiate and manage audio communication.

  

6. Use the chat panel (accessed via the chat icon) to send text messages.

  

---

  

5. **Map System (Leaflet):**

  

- Leaflet is used to display the map and device markers.

  

- The map updates in real-time as device locations change.

  

6. **Chat System:**

  

- Users can send text messages to each other through the chat interface.

  

- Messages are transmitted via Socket.IO.

  

7. **WebRTC Audio:**

  

- WebRTC enables real-time audio communication between users.

  

- Signaling (session setup) is handled via Socket.IO.

  

- Audio data is transmitted directly between peers.

  

8. **Notification System:**

  

- Displays real-time notifications about device connections, disconnections, and other events.

  
  

---

  

## Live Test

- Live: [Render Deployment](https://realtime-location-tracker-v9ow.onrender.com/)

- Invite multiple users to test tracking and communication features.

  

---

## Deployment Options

1. Docker Deployment

Deploy the application as a containerized service for consistency and scalability.

Steps:

1.  Build the Docker Image:
    
    bash
    
    ```bash
    docker build -t realtime-location-tracker .
    ```
    
2.  Run the Container:
    
    bash
    
    ```bash
    docker run -p 3007:3007 --name tracker -d realtime-location-tracker
    ```
    
    -   Maps port 3007 on the host to 3007 in the container.
        
    -   Use -d for detached mode.
        
3.  Access the Application:
    
    -   Open http://localhost:3007 in a browser.
        
4.  Stop and Remove the Container:
    
    bash
    
    ```bash
    docker stop tracker
    docker rm tracker
    ```
    

Optional: Docker Compose

For managing multi-container setups (e.g., with a database), create a docker-compose.yml:

yaml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3007:3007"
    environment:
      - NODE_ENV=production
    volumes:
      - ./public/tiles:/app/public/tiles
```

Run with:

bash

```bash
docker-compose up -d
```

2. Render Deployment

Deploy to [Render](https://render.com/) for a managed cloud solution.

Steps:

1.  Push to GitHub:
    
    -   Ensure your repository is public or private on GitHub.
        
2.  Create a Render Account:
    
    -   Sign up at [render.com](https://render.com/).
        
3.  New Web Service:
    
    -   In Render, create a new Web Service and connect your GitHub repository.
        
4.  Configure Settings:
    
    -   Runtime: Node
        
    -   Build Command: npm install
        
    -   Start Command: npm start
        
            
5.  Deploy:
    
    -   Trigger a deployment. Render provides a URL (e.g., https://realtime-location-tracker-v9ow.onrender.com).
        
6.  Test:
    
    -   Access the deployed URL and verify functionality.
        

3. AWS EC2 Deployment

Deploy on an AWS EC2 instance for full control.

Steps:

1.  Launch an EC2 Instance:
    
    -   Choose an Ubuntu 20.04 or later AMI.
        
    -   Select an instance type (e.g., t2.micro for testing).
        
    -   Configure security group rules to allow:
        
        -   Port 3007 (HTTP)
            
        -   Port 22 (SSH)
            
2.  Connect to the Instance:
    
    bash
    
    ```bash
    ssh -i <your-key.pem> ubuntu@<ec2-public-ip>
    ```
    
3.  Install Dependencies:
    
    bash
    
    ```bash
    sudo apt update
    sudo apt install -y nodejs npm git
    ```
    
4.  Clone and Set Up:
    
    bash
    
    ```bash
    git clone https://github.com/mahmud-r-farhan/realtime-location-tracker.git
    cd realtime-location-tracker
    npm install
    ```
    
5.  Run the Application:
    
    bash
    
    ```bash
    npm start
    ```
    
    -   For production, use a process manager like PM2:
        
        bash
        
        ```bash
        sudo npm install -g pm2
        pm2 start server.js --name tracker
        pm2 startup
        pm2 save
        ```
        
6.  Access:
    
    -   Open http://<ec2-public-ip>:3007 in a browser.
        
7.  Optional: Set Up a Reverse Proxy:
    
    -   Use Nginx to handle HTTPS and load balancing (see Nginx Guide (#nginx-configuration)).
        

4. VPS Deployment

Deploy on any VPS provider (e.g., DigitalOcean, Linode).

Steps:

1.  Set Up the VPS:
    
    -   Provision an Ubuntu server.
        
    -   Update the system:
        
        bash
        
        ```bash
        sudo apt update && sudo apt upgrade
        ```
        
2.  Install Dependencies:
    
    bash
    
    ```bash
    sudo apt install -y nodejs npm git
    ```
    
3.  Clone and Configure:
    
    bash
    
    ```bash
    git clone https://github.com/mahmud-r-farhan/realtime-location-tracker.git
    cd realtime-location-tracker
    npm install
    ```
    
4.  Run the Application:
    
    bash
    
    ```bash
    npm start
    ```
    
    -   Use PM2 for production:
        
        bash
        
        ```bash
        sudo npm install -g pm2
        pm2 start server.js --name tracker
        ```
        
5.  Configure Firewall:
    
    bash
    
    ```bash
    sudo ufw allow 3007
    sudo ufw allow 22
    sudo ufw enable
    ```
    
6.  Access:
    
    -   Open http://<vps-ip>:3007.
        
7.  Optional: Domain and HTTPS:
    
    -   Point a domain to your VPS IP.
        
    -   Set up Nginx and SSL (see Nginx Configuration (#nginx-configuration)).
        

----------

Nginx Configuration (Optional)

For production, use Nginx as a reverse proxy to handle HTTPS and load balancing.

1.  Install Nginx:
    
    bash
    
    ```bash
    sudo apt install nginx
    ```
    
2.  Create an Nginx Configuration:
    
    bash
    
    ```bash
    sudo nano /etc/nginx/sites-available/tracker
    ```
    
    Add:
    
    nginx
    
    ```nginx
    server {
        listen 80;
        server_name your-domain.com;
    
        location / {
            proxy_pass http://localhost:3007;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
    
3.  Enable the Site:
    
    bash
    
    ```bash
    sudo ln -s /etc/nginx/sites-available/tracker /etc/nginx/sites-enabled/
    ```
    
4.  Test and Restart Nginx:
    
    bash
    
    ```bash
    sudo nginx -t
    sudo systemctl restart nginx
    ```
    
5.  Set Up SSL (Optional):
    
    -   Use [Certbot](https://certbot.eff.org/) for free SSL:
        
        bash
        
        ```bash
        sudo apt install certbot python3-certbot-nginx
        sudo certbot --nginx -d your-domain.com
        ```        
  
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

  
  
  

---

## FAQ

**Q: How accurate is the GPS?**

A: Depends on device hardware (typically ±5-50 meters).


**Q: Can I use custom map providers?**

A: Yes! Replace `leaflet.js` with Mapbox/Google Maps.


---

## Troubleshooting

-   Location Not Updating: Ensure geolocation is enabled and the browser has permission.
    
-   WebSocket Errors: Verify port 3007 is open and not blocked by a firewall.
    
-   WebRTC Issues: Check STUN/TURN server configurations and network connectivity.
    
-   Deployment Fails: Review logs (e.g., docker logs tracker or Render logs) for errors.
---