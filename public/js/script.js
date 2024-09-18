const socket = io();

// Function to get the device name from the user agent string
function getDeviceName() {
    const userAgent = navigator.userAgent;
    let deviceName = "Unknown Device";

    if (/android/i.test(userAgent)) {
        const match = userAgent.match(/Android\s+([\d.]+)/);
        deviceName = match ? `Android Device (v${match[1]})` : "Android Device";
    } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        const match = userAgent.match(/OS\s+([\d_]+)/);
        deviceName = match ? `iOS Device (v${match[1].replace(/_/g, '.')})` : "iOS Device";
    } else if (/Windows NT/i.test(userAgent)) {
        const match = userAgent.match(/Windows NT\s+([\d.]+)/);
        deviceName = match ? `Windows PC (v${match[1]})` : "Windows PC";
    } else if (/Macintosh/i.test(userAgent)) {
        const match = userAgent.match(/Mac OS X\s+([\d_]+)/);
        deviceName = match ? `Mac (v${match[1].replace(/_/g, '.')})` : "Mac";
    }

    console.log(`Device Name: ${deviceName}`); // Debugging statement
    return deviceName;
}

if (navigator.geolocation) {
    navigator.geolocation.watchPosition((position) => {
        const { latitude, longitude } = position.coords;
        const deviceName = getDeviceName();
        socket.emit("send-location", { latitude, longitude, deviceName });
    }, (error) => {
        console.error(error);
    }, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    });
}

const map = L.map("map").setView([0, 0], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "Mahmud R. Farhan"
}).addTo(map);

const markers = {};

// Define custom icons for different devices
const icons = {
    "Android Device": L.icon({
        iconUrl: '/assets/android-log.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    "iOS Device": L.icon({
        iconUrl: '/assets/ios-log.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    "Windows PC": L.icon({
        iconUrl: '/assets/windows-log.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    "Mac": L.icon({
        iconUrl: '/assets/mac-log.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    "Unknown Device": L.icon({
        iconUrl: '/assets/unknown-log.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    })
};

socket.on("receive-location", (data) => {
    const { id, latitude, longitude, deviceName } = data;
    map.setView([latitude, longitude], 15);
    const icon = icons[deviceName] || icons["Unknown Device"];
    if (markers[id]) {
        markers[id].setLatLng([latitude, longitude]);
        markers[id].setIcon(icon);
        markers[id].bindPopup(deviceName).openPopup();
    } else {
        markers[id] = L.marker([latitude, longitude], { icon: icon }).addTo(map)
            .bindPopup(deviceName).openPopup();
    }
});

socket.on("user-disconnect", (id) => {
    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
});


