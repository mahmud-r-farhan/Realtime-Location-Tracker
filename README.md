# **Real-Time Location Tracker**

## Overview

The Real-Time Location Tracker is a web application that allows users to track the real-time location of devices. This project leverages Leaflet for map visualization and WebSockets for real-time communication, making it ideal for applications like fleet management, delivery tracking, and personal location sharing.

## Features

Real-Time Tracking: Track the location of devices in real-time.
Device Identification: Identify devices based on their user agent string (e.g., Android, iOS, Windows, Mac).
Custom Icons: Display custom icons for different types of devices.
Offline Map Support: Automatically switch between online and offline maps based on internet connectivity.
Responsive Design: Fully responsive design for seamless use on both desktop and mobile devices.

## Installation

Clone the Repository:
git clone https://github.com/mahmud-r-farhan/realtime-location-tracker.git
cd realtime-location-tracker

#### Install Dependencies:

npm install

## Download Leaflet Library:

Download the Leaflet library and place the CSS and JS files in the leaflet directory.
Download Map Tiles:
Use tools like TileMill or MapTiler to generate offline map tiles and place them in the appropriate directory.
Run the Application:
npm start

## Usage

Open the Application:

Navigate to http://localhost:3000 in your web browser.
Allow Location Access:
Allow the application to access your location to start tracking.
View Real-Time Locations:
The map will display the real-time locations of all connected devices with custom icons.
Contributing
We welcome contributions from the community! To contribute:

Fork the repository.
Create a new branch (git checkout -b feature-branch).
Make your changes and commit them (git commit -m 'Add new feature').
Push to the branch (git push origin feature-branch).
Open a pull request.

#### License

This project is licensed under the MIT License. See the LICENSE file for details.

### Contact

For any questions or suggestions, feel free to reach out:

Email: farhanstack.dev@gmail.com
GitHub: mahmud-r-farhan