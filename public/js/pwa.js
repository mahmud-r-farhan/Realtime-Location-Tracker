// PWA Registration and Management

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.swRegistration = null;
        this.isStandalone = this.checkStandaloneMode();

        this.init();
    }

    /**
     * Initialize PWA functionality
     */
    async init() {
        // Register service worker
        await this.registerServiceWorker();

        // Setup install prompt handling
        this.setupInstallPrompt();

        // Setup update handling
        this.setupUpdateHandler();

        // Setup online/offline handling
        this.setupConnectivityHandler();

        // Log PWA status
        this.logPWAStatus();
    }

    /**
     * Register Service Worker
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });

                console.log('[PWA] Service Worker registered successfully:', this.swRegistration);

                // Check for updates periodically
                setInterval(() => {
                    this.swRegistration.update();
                }, 60 * 60 * 1000); // Check every hour

            } catch (error) {
                console.error('[PWA] Service Worker registration failed:', error);
            }
        } else {
            console.warn('[PWA] Service Workers not supported');
        }
    }

    /**
     * Setup install prompt handling
     */
    setupInstallPrompt() {
        // Capture the install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('[PWA] Install prompt captured');

            // Show install button/banner
            this.showInstallPrompt();
        });

        // Handle app installed event
        window.addEventListener('appinstalled', (e) => {
            console.log('[PWA] App installed successfully');
            this.deferredPrompt = null;
            this.hideInstallPrompt();
            this.showToast('App installed successfully! 🎉');
        });
    }

    /**
     * Setup update handler
     */
    setupUpdateHandler() {
        if (!this.swRegistration) return;

        this.swRegistration.addEventListener('updatefound', () => {
            const newWorker = this.swRegistration.installing;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New update available
                    this.showUpdatePrompt();
                }
            });
        });

        // Handle controller change (when update is activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }

    /**
     * Setup online/offline connectivity handler
     */
    setupConnectivityHandler() {
        window.addEventListener('online', () => {
            console.log('[PWA] Back online');
            this.showToast('Connection restored! 🌐', 'success');
        });

        window.addEventListener('offline', () => {
            console.log('[PWA] Gone offline');
            this.showToast('You are offline. Some features may be limited.', 'warning');
        });
    }

    /**
     * Check if running in standalone mode
     */
    checkStandaloneMode() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    }

    /**
     * Show install prompt UI
     */
    showInstallPrompt() {
        // Don't show if already installed or in standalone mode
        if (this.isStandalone || !this.deferredPrompt) return;

        // Check if user has dismissed before
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
            return; // Don't show for 7 days after dismissal
        }

        // Create install banner
        if (!document.getElementById('pwa-install-banner')) {
            const banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.innerHTML = `
                <div class="pwa-banner-content">
                <div class="pwa-banner-icon">
                        <img src="/assets/icons/icon.svg" alt="App Icon" onerror="this.src='/assets/favico.png'">
                    </div>
                    <div class="pwa-banner-text">
                        <strong>Install Location Tracker</strong>
                        <span>Get the full app experience!</span>
                    </div>
                    <div class="pwa-banner-actions">
                        <button id="pwa-install-btn" class="pwa-btn-install">Install</button>
                        <button id="pwa-dismiss-btn" class="pwa-btn-dismiss">×</button>
                    </div>
                </div>
            `;
            document.body.appendChild(banner);

            // Add styles
            this.addBannerStyles();

            // Setup event listeners
            document.getElementById('pwa-install-btn').addEventListener('click', () => {
                this.promptInstall();
            });

            document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
                this.hideInstallPrompt();
                localStorage.setItem('pwa-install-dismissed', Date.now().toString());
            });
        }
    }

    /**
     * Hide install prompt UI
     */
    hideInstallPrompt() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.classList.add('hiding');
            setTimeout(() => banner.remove(), 300);
        }
    }

    /**
     * Prompt user to install the app
     */
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('[PWA] No install prompt available');
            return false;
        }

        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log('[PWA] User choice:', outcome);
            this.deferredPrompt = null;
            this.hideInstallPrompt();
            return outcome === 'accepted';
        } catch (error) {
            console.error('[PWA] Install prompt error:', error);
            return false;
        }
    }

    /**
     * Show update prompt
     */
    showUpdatePrompt() {
        const updateBanner = document.createElement('div');
        updateBanner.id = 'pwa-update-banner';
        updateBanner.innerHTML = `
            <div class="pwa-update-content">
                <span>🔄 A new version is available!</span>
                <button id="pwa-update-btn">Update Now</button>
            </div>
        `;
        document.body.appendChild(updateBanner);

        // Add styles
        this.addUpdateStyles();

        document.getElementById('pwa-update-btn').addEventListener('click', () => {
            if (this.swRegistration.waiting) {
                this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `pwa-toast pwa-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Add styles if not present
        this.addToastStyles();

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Add banner styles
     */
    addBannerStyles() {
        if (document.getElementById('pwa-banner-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'pwa-banner-styles';
        styles.textContent = `
            #pwa-install-banner {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 1px solid rgba(79, 70, 229, 0.3);
                border-radius: 16px;
                padding: 16px 20px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                z-index: 10000;
                animation: slideUp 0.3s ease-out;
                max-width: 400px;
                width: calc(100% - 40px);
            }

            #pwa-install-banner.hiding {
                animation: slideDown 0.3s ease-out forwards;
            }

            @keyframes slideUp {
                from { transform: translateX(-50%) translateY(100px); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }

            @keyframes slideDown {
                from { transform: translateX(-50%) translateY(0); opacity: 1; }
                to { transform: translateX(-50%) translateY(100px); opacity: 0; }
            }

            .pwa-banner-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .pwa-banner-icon img {
                width: 48px;
                height: 48px;
                border-radius: 12px;
            }

            .pwa-banner-text {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .pwa-banner-text strong {
                color: #fff;
                font-size: 14px;
            }

            .pwa-banner-text span {
                color: rgba(255, 255, 255, 0.6);
                font-size: 12px;
            }

            .pwa-banner-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .pwa-btn-install {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: #fff;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            .pwa-btn-install:hover {
                transform: scale(1.05);
            }

            .pwa-btn-dismiss {
                background: transparent;
                border: none;
                color: rgba(255, 255, 255, 0.5);
                font-size: 20px;
                cursor: pointer;
                padding: 5px 10px;
            }

            .pwa-btn-dismiss:hover {
                color: #fff;
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Add update styles
     */
    addUpdateStyles() {
        if (document.getElementById('pwa-update-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'pwa-update-styles';
        styles.textContent = `
            #pwa-update-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: #fff;
                padding: 12px 20px;
                text-align: center;
                z-index: 10001;
                animation: slideDown 0.3s ease-out;
            }

            @keyframes slideDown {
                from { transform: translateY(-100%); }
                to { transform: translateY(0); }
            }

            .pwa-update-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
                flex-wrap: wrap;
            }

            #pwa-update-btn {
                background: #fff;
                color: #4f46e5;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            #pwa-update-btn:hover {
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Add toast styles
     */
    addToastStyles() {
        if (document.getElementById('pwa-toast-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'pwa-toast-styles';
        styles.textContent = `
            .pwa-toast {
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 10002;
                animation: fadeIn 0.3s ease-out;
            }

            .pwa-toast.hiding {
                animation: fadeOut 0.3s ease-out forwards;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }

            @keyframes fadeOut {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }

            .pwa-toast-info {
                background: #1a1a2e;
                color: #fff;
                border: 1px solid rgba(79, 70, 229, 0.3);
            }

            .pwa-toast-success {
                background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                color: #fff;
            }

            .pwa-toast-warning {
                background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
                color: #fff;
            }

            .pwa-toast-error {
                background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
                color: #fff;
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Log PWA status
     */
    logPWAStatus() {
        console.log('[PWA] Status:', {
            standalone: this.isStandalone,
            serviceWorker: 'serviceWorker' in navigator,
            online: navigator.onLine
        });
    }

    /**
     * Clear all caches
     */
    async clearCache() {
        if (this.swRegistration?.active) {
            this.swRegistration.active.postMessage({ type: 'CLEAR_CACHE' });
            this.showToast('Cache cleared successfully!', 'success');
        }
    }
}

// Initialize PWA Manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pwaManager = new PWAManager();
    });
} else {
    window.pwaManager = new PWAManager();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAManager;
}
