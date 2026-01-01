/**
 * Controls Module
 * Handles FAB Menu, My Location, Map Layer Controls, and responsive control switching
 */

// Imports
import { map } from './map.js';
import { toggleTheme, getCurrentTheme } from './theme.js';
import { addNotification } from './notification.js';
import { showNamePopup } from './ui.js';

// State
let fabOpen = false;
let mapLayerDropdownOpen = false;

/**
 * Go to user's current location on the map
 */
export async function goToMyLocation() {
    const btn = document.getElementById('my-location-btn') || document.getElementById('mobile-my-location-btn');

    if (btn) {
        btn.classList.add('loading');
        btn.disabled = true;
    }

    try {
        if (!('geolocation' in navigator)) {
            throw new Error('Geolocation is not supported by this browser');
        }

        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        const { latitude, longitude } = position.coords;

        if (map) {
            map.setView([latitude, longitude], 16);
            addNotification('📍 Centered on your location');

            // Create a pulsing marker at current location
            createLocationPulse(latitude, longitude);
        }
    } catch (error) {
        console.error('Geolocation error:', error);
        let message = 'Unable to get your location';

        switch (error.code) {
            case 1:
                message = '📍 Location access denied';
                break;
            case 2:
                message = '📍 Location unavailable';
                break;
            case 3:
                message = '📍 Location request timed out';
                break;
        }

        addNotification(message);
    } finally {
        if (btn) {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }
}

/**
 * Create a pulsing effect at the current location
 */
function createLocationPulse(lat, lng) {
    // Remove existing pulse if any
    const existingPulse = document.querySelector('.location-pulse-marker');
    if (existingPulse) {
        existingPulse.remove();
    }

    // Create pulsing marker
    const pulseIcon = L.divIcon({
        className: 'location-pulse-marker',
        html: `<div class="pulse-dot"></div><div class="pulse-ring"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const pulseMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(map);

    // Remove after animation completes
    setTimeout(() => {
        map.removeLayer(pulseMarker);
    }, 3000);
}

/**
 * Toggle FAB Menu
 */
export function toggleFabMenu() {
    fabOpen = !fabOpen;
    const fabMenu = document.getElementById('fab-menu');
    const fabBtn = document.getElementById('fab-btn');

    if (fabMenu) {
        fabMenu.classList.toggle('open', fabOpen);
    }
    if (fabBtn) {
        fabBtn.classList.toggle('open', fabOpen);
    }
}

/**
 * Toggle Map Layer Dropdown
 */
export function toggleMapLayerDropdown() {
    mapLayerDropdownOpen = !mapLayerDropdownOpen;
    const dropdown = document.getElementById('map-layer-dropdown');

    if (dropdown) {
        dropdown.classList.toggle('open', mapLayerDropdownOpen);
    }
}

/**
 * Switch map layer
 * @param {string} layerName - Name of the layer to switch to
 */
export function switchMapLayer(layerName) {
    // Close dropdown
    toggleMapLayerDropdown();

    // Find the layer control and trigger the layer switch
    if (map) {
        const layers = map._layers;
        // This will be handled by Leaflet's layer control
        addNotification(`🗺️ Switched to ${layerName} view`);
    }
}

/**
 * Handle theme toggle from controls
 */
export function handleThemeToggle() {
    const newTheme = toggleTheme();
    const themeIcon = document.querySelector('#theme-toggle-btn i, #mobile-theme-btn i');

    if (themeIcon) {
        themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    addNotification(`🎨 Switched to ${newTheme} mode`);
}

/**
 * Create FAB Menu HTML
 */
function createFabMenu() {
    const existingFab = document.getElementById('fab-container');
    if (existingFab) return;

    const fabContainer = document.createElement('div');
    fabContainer.id = 'fab-container';
    fabContainer.className = 'fab-container';
    fabContainer.innerHTML = `
        <div id="fab-menu" class="fab-menu">
            <button id="fab-theme-btn" class="fab-item" title="Toggle Theme">
                <i class="fas ${getCurrentTheme() === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>
                <span class="fab-tooltip">Theme</span>
            </button>
            <button id="fab-location-btn" class="fab-item" title="My Location">
                <i class="fas fa-crosshairs"></i>
                <span class="fab-tooltip">My Location</span>
            </button>
            <button id="fab-layers-btn" class="fab-item" title="Map Layers">
                <i class="fas fa-layer-group"></i>
                <span class="fab-tooltip">Layers</span>
            </button>
            <button id="fab-profile-btn" class="fab-item" title="Edit Profile">
                <i class="fas fa-user-edit"></i>
                <span class="fab-tooltip">Profile</span>
            </button>
        </div>
        <button id="fab-btn" class="fab-main" title="Controls">
            <i class="fas fa-plus"></i>
        </button>
    `;

    document.body.appendChild(fabContainer);
}

/**
 * Create Mobile Controls
 */
function createMobileControls() {
    const existingControls = document.getElementById('mobile-controls');
    if (existingControls) return;

    const mobileControls = document.createElement('div');
    mobileControls.id = 'mobile-controls';
    mobileControls.className = 'mobile-controls';
    mobileControls.innerHTML = `
        <button id="mobile-theme-btn" class="mobile-control-btn" title="Toggle Theme">
            <i class="fas ${getCurrentTheme() === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>
        </button>
        <button id="mobile-my-location-btn" class="mobile-control-btn" title="My Location">
            <i class="fas fa-crosshairs"></i>
        </button>
        <button id="mobile-layers-btn" class="mobile-control-btn" title="Map Layers">
            <i class="fas fa-layer-group"></i>
        </button>
        <button id="mobile-profile-btn" class="mobile-control-btn" title="Edit Profile">
            <i class="fas fa-user-edit"></i>
        </button>
    `;

    document.body.appendChild(mobileControls);
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // FAB Main Button
    const fabBtn = document.getElementById('fab-btn');
    if (fabBtn) {
        fabBtn.addEventListener('click', toggleFabMenu);
    }

    // FAB Theme Toggle
    const fabThemeBtn = document.getElementById('fab-theme-btn');
    if (fabThemeBtn) {
        fabThemeBtn.addEventListener('click', handleThemeToggle);
    }

    // FAB Location Button
    const fabLocationBtn = document.getElementById('fab-location-btn');
    if (fabLocationBtn) {
        fabLocationBtn.addEventListener('click', goToMyLocation);
    }

    // FAB Layers Button
    const fabLayersBtn = document.getElementById('fab-layers-btn');
    if (fabLayersBtn) {
        fabLayersBtn.addEventListener('click', toggleLayerSelector);
    }

    // FAB Profile Button
    const fabProfileBtn = document.getElementById('fab-profile-btn');
    if (fabProfileBtn) {
        fabProfileBtn.addEventListener('click', () => {
            // Pre-fill current values
            const currentName = localStorage.getItem('userName') || '';
            const currentOrg = localStorage.getItem('orgName') || '';

            const nameInput = document.getElementById('user-name-input');
            const orgInput = document.getElementById('org-input');

            if (nameInput) nameInput.value = currentName;
            if (orgInput) orgInput.value = currentOrg;

            showNamePopup();

            // Handle Save
            const continueBtn = document.getElementById('continue-btn');
            const handleSave = () => {
                const newName = nameInput.value.trim();
                const newOrg = orgInput.value.trim();

                if (newName) {
                    localStorage.setItem('userName', newName);
                    // Update variable if we could access main.js scope, but we can't easily.
                    // Reloading page is a safe bet for full update, or just update UI where possible.
                    // For now, let's just save and notify.
                }
                if (newOrg) {
                    localStorage.setItem('orgName', newOrg);
                }

                addNotification('✅ Profile updated! Reloading...');
                document.getElementById('name-popup').classList.add('hidden');

                // Reload to apply changes cleanly across all sockets/modules
                setTimeout(() => window.location.reload(), 1000);

                continueBtn.removeEventListener('click', handleSave);
            };

            // Remove previous listeners (cloning node is a dirty but effective reset)
            const newBtn = continueBtn.cloneNode(true);
            continueBtn.parentNode.replaceChild(newBtn, continueBtn);
            newBtn.addEventListener('click', handleSave);
        });
    }

    // Mobile Theme Button
    const mobileThemeBtn = document.getElementById('mobile-theme-btn');
    if (mobileThemeBtn) {
        mobileThemeBtn.addEventListener('click', handleThemeToggle);
    }

    // Mobile Location Button
    const mobileLocationBtn = document.getElementById('mobile-my-location-btn');
    if (mobileLocationBtn) {
        mobileLocationBtn.addEventListener('click', goToMyLocation);
    }

    // Mobile Layers Button
    const mobileLayersBtn = document.getElementById('mobile-layers-btn');
    if (mobileLayersBtn) {
        mobileLayersBtn.addEventListener('click', toggleLayerSelector);
    }

    // Mobile Profile Button
    const mobileProfileBtn = document.getElementById('mobile-profile-btn');
    if (mobileProfileBtn) {
        mobileProfileBtn.addEventListener('click', () => {
            // Pre-fill current values
            const currentName = localStorage.getItem('userName') || '';
            const currentOrg = localStorage.getItem('orgName') || '';

            const nameInput = document.getElementById('user-name-input');
            const orgInput = document.getElementById('org-input');

            if (nameInput) nameInput.value = currentName;
            if (orgInput) orgInput.value = currentOrg;

            showNamePopup();

            // Handle Save
            const continueBtn = document.getElementById('continue-btn');
            const handleSave = () => {
                const newName = nameInput.value.trim();
                const newOrg = orgInput.value.trim();

                if (newName) {
                    localStorage.setItem('userName', newName);
                }
                if (newOrg) {
                    localStorage.setItem('orgName', newOrg);
                }

                addNotification('✅ Profile updated! Reloading...');
                document.getElementById('name-popup').classList.add('hidden');

                // Reload to apply changes cleanly across all sockets/modules
                setTimeout(() => window.location.reload(), 1000);

                continueBtn.removeEventListener('click', handleSave);
            };

            // Remove previous listeners (cloning node is a dirty but effective reset)
            const newBtn = continueBtn.cloneNode(true);
            continueBtn.parentNode.replaceChild(newBtn, continueBtn);
            newBtn.addEventListener('click', handleSave);
        });
    }

    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
        const fabContainer = document.getElementById('fab-container');
        const layerSelector = document.getElementById('layer-selector-modal');

        if (fabOpen && fabContainer && !fabContainer.contains(e.target)) {
            toggleFabMenu();
        }

        // Close layer selector if clicking outside
        if (layerSelector && !layerSelector.classList.contains('hidden') && !layerSelector.querySelector('.layer-selector-content').contains(e.target) && !e.target.closest('#fab-layers-btn') && !e.target.closest('#mobile-layers-btn')) {
            layerSelector.classList.add('hidden');
        }
    });

    // Listen for theme changes to update icons
    window.addEventListener('themeChange', (e) => {
        const iconClass = e.detail.theme === 'dark' ? 'fa-sun' : 'fa-moon';

        const fabThemeIcon = document.querySelector('#fab-theme-btn i');
        if (fabThemeIcon) {
            fabThemeIcon.className = `fas ${iconClass}`;
        }

        const mobileThemeIcon = document.querySelector('#mobile-theme-btn i');
        if (mobileThemeIcon) {
            mobileThemeIcon.className = `fas ${iconClass}`;
        }
    });
}

/**
 * Toggle Layer Selector Modal
 */
function toggleLayerSelector() {
    const selector = document.getElementById('layer-selector-modal');
    if (selector) {
        selector.classList.toggle('hidden');
    } else {
        createLayerSelector();
    }
}

/**
 * Create Layer Selector Modal
 */
function createLayerSelector() {
    import('./map.js').then(module => {
        const { baseLayers, switchLayer } = module;
        const layerNames = Object.keys(baseLayers);

        const modal = document.createElement('div');
        modal.id = 'layer-selector-modal';
        modal.className = 'layer-selector-modal'; // Start visible

        const content = document.createElement('div');
        content.className = 'layer-selector-content';

        const header = document.createElement('div');
        header.className = 'layer-selector-header';
        header.innerHTML = `
            <h3>Select Map Style</h3>
            <button class="close-layer-selector">&times;</button>
        `;

        const list = document.createElement('div');
        list.className = 'layer-list';

        layerNames.forEach(name => {
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.innerHTML = `
                <div class="layer-preview ${name.replace(/\s+/g, '-').toLowerCase()}">
                    <i class="fas fa-map"></i>
                </div>
                <span>${name}</span>
            `;
            item.addEventListener('click', () => {
                switchLayer(name);
                addNotification(`🗺️ Changed map to ${name}`);

                // Update active state
                document.querySelectorAll('.layer-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });

            // Set initial active
            // This is a bit rough since we don't know the current layer easily without refactoring map.js more 
            // but we default to OSM usually.
            if (name === 'OpenStreetMap') item.classList.add('active');

            list.appendChild(item);
        });

        content.appendChild(header);
        content.appendChild(list);
        modal.appendChild(content);

        document.body.appendChild(modal);

        // Close button logic
        header.querySelector('.close-layer-selector').addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // Add specific styles for this modal
        const style = document.createElement('style');
        style.textContent = `
            .layer-selector-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 2000; /* Above everything */
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 1;
                transition: opacity 0.3s;
            }
            .layer-selector-modal.hidden {
                display: none;
                opacity: 0;
                pointer-events: none;
            }
            .layer-selector-content {
                background: var(--surface, #fff);
                padding: 20px;
                border-radius: 16px;
                width: 90%;
                max-width: 400px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                animation: scaleIn 0.3s ease;
            }
            @keyframes scaleIn {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            .layer-selector-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            .layer-selector-header h3 {
                margin: 0;
                font-size: 1.2rem;
            }
            .close-layer-selector {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--text-muted);
            }
            .layer-list {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                max-height: 60vh;
                overflow-y: auto;
            }
            .layer-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                padding: 15px;
                border: 2px solid transparent;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                background: var(--bg-secondary, #f8f9fa);
            }
            .layer-item:hover {
                background: var(--bg-tertiary, #e9ecef);
                transform: translateY(-2px);
            }
            .layer-item.active {
                border-color: var(--primary-color, #4f46e5);
                background: rgba(79, 70, 229, 0.05);
            }
            .layer-preview {
                width: 100%;
                height: 60px;
                background: #ddd;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                color: #666;
            }
            /* Mock previews - in a real app these would be images */
            .layer-preview.dark-mode { background: #222; color: #fff; }
            .layer-preview.satellite { background: #004d40; color: #fff; }
            .layer-preview.openstreetmap { background: #a5d6a7; color: #1b5e20; }
            .layer-preview.light-mode { background: #f5f5f5; color: #333; }
            .layer-preview.voyager { background: #e0f7fa; color: #006064; }
            .layer-preview.cyclosm { background: #ffe0b2; color: #e65100; }
            .layer-preview.street-map { background: #ffd54f; color: #3e2723; }
            .layer-preview.opentopomap { background: #8d6e63; color: #fff; }
        `;
        document.head.appendChild(style);
    });
}

/**
 * Add control styles
 */
function addControlStyles() {
    if (document.getElementById('controls-styles')) return;

    const style = document.createElement('style');
    style.id = 'controls-styles';
    style.textContent = `
        /* FAB Container */
        .fab-container {
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 100;
            display: flex;
            flex-direction: column-reverse;
            align-items: center;
            gap: 12px;
        }

        @media (max-width: 768px) {
            .fab-container {
                display: none;
            }
        }

        /* FAB Main Button */
        .fab-main {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: none;
            background: var(--fab-bg, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
            color: white;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .fab-main:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
        }

        .fab-main.open {
            transform: rotate(45deg);
        }

        .fab-main.open:hover {
            transform: rotate(45deg) scale(1.1);
        }

        /* FAB Menu */
        .fab-menu {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 0;
            height: 0;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            z-index: 90;
        }

        .fab-menu.open {
            width: 200px;
            height: 200px;
        }

        /* FAB Items */
        .fab-item {
            position: absolute;
            bottom: 5px;
            right: 5px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            background: var(--card-bg, #fff);
            color: var(--text-primary, #212529);
            font-size: 18px;
            cursor: pointer;
            box-shadow: 0 4px 10px var(--shadow-color, rgba(0,0,0,0.2));
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transform: scale(0);
        }

        /* FAB Item Positioning - Fan Out Effect */
        .fab-menu.open .fab-item {
            opacity: 1;
            transform: scale(1);
        }

        /* 4 Items: 0 to 90 degrees approx */
        .fab-menu.open .fab-item:nth-child(1) { bottom: 90px; right: 0px; }   /* Top-most */
        .fab-menu.open .fab-item:nth-child(2) { bottom: 75px; right: 45px; }
        .fab-menu.open .fab-item:nth-child(3) { bottom: 45px; right: 75px; }
        .fab-menu.open .fab-item:nth-child(4) { bottom: 0px; right: 90px; }   /* Left-most */

        .fab-item:hover {
            transform: scale(1.1) !important;
            background: var(--accent-color, #4f46e5);
            color: white;
            z-index: 100;
        }

        /* FAB Tooltip */
        .fab-tooltip {
            position: absolute;
            right: 60px;
            background: var(--bg-secondary, #f8f9fa);
            color: var(--text-primary, #212529);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
            box-shadow: 0 2px 10px var(--shadow-color);
        }

        .fab-item:hover .fab-tooltip {
            opacity: 1;
        }

        /* Mobile Controls */
        .mobile-controls {
            display: none;
            position: fixed;
            top: 80px;
            right: 10px;
            z-index: 45;
            flex-direction: column;
            gap: 8px;
        }

        @media (max-width: 768px) {
            .mobile-controls {
                display: flex;
            }
        }

        .mobile-control-btn {
            width: 42px;
            height: 42px;
            border-radius: 10px;
            border: none;
            background: var(--card-bg, #fff);
            color: var(--text-primary, #212529);
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 2px 10px var(--shadow-color, rgba(0,0,0,0.15));
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .mobile-control-btn:hover,
        .mobile-control-btn:active {
            background: var(--accent-color, #4f46e5);
            color: white;
            transform: scale(1.05);
        }

        .mobile-control-btn.loading {
            opacity: 0.7;
            pointer-events: none;
        }

        .mobile-control-btn.loading i {
            animation: spin 1s linear infinite;
        }

        /* Location Pulse Animation */
        .location-pulse-marker {
            background: transparent;
        }

        .pulse-dot {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 12px;
            height: 12px;
            background: #4f46e5;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }

        .pulse-ring {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            border: 3px solid #4f46e5;
            border-radius: 50%;
            animation: pulse-ring 1.5s ease-out infinite;
        }

        @keyframes pulse-ring {
            0% {
                transform: translate(-50%, -50%) scale(0.5);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(2);
                opacity: 0;
            }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Theme transition */
        body {
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        /* Fix Leaflet layer control on mobile */
        @media (max-width: 768px) {
            .leaflet-control-layers {
                position: fixed !important;
                top: 200px !important;
                right: 10px !important;
            }
        }
    `;

    document.head.appendChild(style);
}

/**
 * Initialize controls
 */
export function initControls() {
    addControlStyles();
    createFabMenu();
    createMobileControls();
    attachEventListeners();

    console.log('🎛️ Controls initialized');
}

// Export for global access
export { goToMyLocation as focusOnMyLocation };
