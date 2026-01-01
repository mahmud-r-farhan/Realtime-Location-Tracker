// Theme state
let currentTheme = 'light';

// CSS Variables for themes
const themes = {
    light: {
        '--primary-color': '#4f46e5',
        '--primary-dark': '#4338ca',
        '--primary-light': '#818cf8',
        '--gradient-primary': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        '--gradient-accent': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f8f9fa',
        '--bg-tertiary': '#e9ecef',
        '--text-primary': '#212529',
        '--text-secondary': '#495057',
        '--text-muted': '#6c757d',
        '--border-color': '#dee2e6',
        '--shadow-color': 'rgba(0, 0, 0, 0.1)',
        '--accent-color': '#4f46e5',
        '--accent-hover': '#4338ca',
        '--success-color': '#10b981',
        '--warning-color': '#f59e0b',
        '--danger-color': '#ef4444',
        '--card-bg': '#ffffff',
        '--overlay-bg': 'rgba(0, 0, 0, 0.5)',
        '--input-bg': '#ffffff',
        '--input-border': '#ced4da',
        '--sidebar-bg': 'rgba(255, 255, 255, 0.95)',
        '--panel-bg': 'rgba(255, 255, 255, 0.98)',
        '--notification-bg': 'rgba(255, 255, 255, 0.95)',
        '--fab-bg': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        '--gradient-start': '#667eea',
        '--gradient-end': '#764ba2'
    },
    dark: {
        '--primary-color': '#6366f1',
        '--primary-dark': '#4f46e5',
        '--primary-light': '#818cf8',
        '--gradient-primary': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        '--gradient-accent': 'linear-gradient(135deg, #9f7aea 0%, #d53f8c 100%)',
        '--bg-primary': '#0f172a',
        '--bg-secondary': '#1e293b',
        '--bg-tertiary': '#334155',
        '--text-primary': '#f1f5f9',
        '--text-secondary': '#cbd5e1',
        '--text-muted': '#94a3b8',
        '--border-color': '#475569',
        '--shadow-color': 'rgba(0, 0, 0, 0.4)',
        '--accent-color': '#818cf8',
        '--accent-hover': '#6366f1',
        '--success-color': '#34d399',
        '--warning-color': '#fbbf24',
        '--danger-color': '#f87171',
        '--card-bg': '#1e293b',
        '--overlay-bg': 'rgba(0, 0, 0, 0.7)',
        '--input-bg': '#1e293b',
        '--input-border': '#475569',
        '--sidebar-bg': 'rgba(30, 41, 59, 0.98)',
        '--panel-bg': 'rgba(30, 41, 59, 0.98)',
        '--notification-bg': 'rgba(30, 41, 59, 0.95)',
        '--fab-bg': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        '--gradient-start': '#6366f1',
        '--gradient-end': '#8b5cf6'
    }
};

/**
 * Apply theme to the document
 * @param {string} themeName - 'light' or 'dark'
 */
export function applyTheme(themeName) {
    const theme = themes[themeName];
    if (!theme) return;

    currentTheme = themeName;

    // Apply CSS variables to root
    const root = document.documentElement;
    Object.entries(theme).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });

    // Toggle body class for additional styling
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${themeName}`);

    // Save preference
    localStorage.setItem('theme', themeName);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', themeName === 'dark' ? '#0f172a' : '#4f46e5');
    }

    // Dispatch custom event for other modules
    window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme: themeName } }));

    console.log(`🎨 Theme switched to: ${themeName}`);
}

/**
 * Toggle between light and dark themes
 * @returns {string} The new theme name
 */
export function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    return newTheme;
}

/**
 * Get current theme
 * @returns {string} Current theme name
 */
export function getCurrentTheme() {
    return currentTheme;
}

/**
 * Detect system theme preference
 * @returns {string} 'dark' or 'light'
 */
function detectSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/**
 * Initialize theme system
 */
export function initTheme() {
    // Check saved preference first
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        applyTheme(savedTheme);
    } else {
        // Fall back to system preference
        applyTheme(detectSystemTheme());
    }

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only auto-switch if user hasn't set a preference
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    console.log('🎨 Theme system initialized');
}
