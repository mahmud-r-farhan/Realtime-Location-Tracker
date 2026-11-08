const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { server } = require('../../src/app');

let url;
before(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 740, height: 360 }]) {
    test(`workspace interactions at ${viewport.width}x${viewport.height}`, async () => {
        const browser = await chromium.launch({
            headless: true,
            executablePath: process.env.CHROMIUM_PATH || undefined,
            args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])]
        });
        try {
            const context = await browser.newContext({ viewport, permissions: ['geolocation'], geolocation: { latitude: 23.8, longitude: 90.4 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
            const page = await context.newPage();
            page.setDefaultTimeout(7000);
            const pageErrors = [];
            page.on('pageerror', error => pageErrors.push(error.message));
            // Third-party tiles are not required to test controls and are often unavailable in CI.
            await page.route(/https:\/\//, route => route.abort());
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.locator('#continue-btn').focus();
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => document.activeElement.id), 'user-name-input');
            await page.locator('#user-name-input').fill('Tester');
            await page.locator('#org-input').fill('Field team');
            await page.locator('#continue-btn').click();
            await page.locator('#connection-status[data-state="connected"]').waitFor();
            await page.waitForFunction(() => document.getElementById('current-room').textContent === 'Field team');
            assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'), 'false');
            await page.locator('#sidebar-toggle').click();
            assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'), 'true');
            await page.locator('#device-list .device-focus').first().waitFor();
            await page.locator('#sharing-indicator[data-state="sharing"]').waitFor();
            await page.locator('#fit-devices-btn').click();
            if (viewport.width <= 768) {
                assert.equal(await page.locator('#sidebar-toggle').getAttribute('aria-expanded'), 'false');
                await page.locator('#sidebar-toggle').click();
            }
            await page.locator('#sharing-toggle').click();
            await page.locator('#sharing-indicator[data-state="paused"]').waitFor();
            await page.waitForFunction(() => document.getElementById('user-count').textContent === '0');
            assert.equal(await page.locator('#fit-devices-btn').isDisabled(), true);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.locator('#connection-status[data-state="connected"]').waitFor();
            await page.locator('#sidebar-toggle').click();
            await page.locator('#sharing-indicator[data-state="paused"]').waitFor();
            assert.equal(await page.locator('#user-count').innerText(), '0');
            await page.locator('#sharing-toggle').click();
            await page.locator('#sharing-indicator[data-state="sharing"]').waitFor();
            await page.locator('#device-list .device-focus').first().waitFor();
            await page.locator('#sidebar-toggle').click();
            await page.locator('#chat-fab').click();
            assert.equal(await page.locator('#chat-fab').getAttribute('aria-expanded'), 'true');
            await page.locator('#message-input').fill('Hello team');
            await page.locator('#send-message').click();
            await page.getByText('Hello team', { exact: true }).waitFor();
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#chat-fab').getAttribute('aria-expanded'), 'false');
            const mobile = viewport.width <= 768;
            if (mobile) {
                const chatBox = await page.locator('#chat-fab').boundingBox();
                const controlsBox = await page.locator('#mobile-controls').boundingBox();
                assert.ok(chatBox.x + chatBox.width <= controlsBox.x, 'mobile controls must not overlap chat');
            }
            if (!mobile) await page.locator('#fab-btn').click();
            const themeButton = page.locator(mobile ? '#mobile-theme-btn' : '#fab-theme-btn');
            await themeButton.click();
            assert.equal(await page.locator('body').getAttribute('class').then(value => value.includes('theme-dark')), true);
            await themeButton.click();
            await page.locator(mobile ? '#mobile-layers-btn' : '#fab-layers-btn').click();
            await page.locator('.layer-item.active').waitFor();
            assert.equal(await page.locator('.layer-item.active').innerText(), 'Satellite');
            await page.getByRole('button', { name: 'Close map styles' }).click();
            if (!mobile && await page.locator('#fab-btn').getAttribute('aria-expanded') === 'false') await page.locator('#fab-btn').click();
            await page.locator(mobile ? '#mobile-profile-btn' : '#fab-profile-btn').click();
            await page.locator('#org-input').fill('Other team');
            await page.locator('#continue-btn').click();
            await page.waitForFunction(() => document.getElementById('current-room').textContent === 'Other team');
            await page.locator('#chat-fab').click();
            assert.equal(await page.getByText('Hello team', { exact: true }).count(), 0, 'old-room chat must be cleared');
            await page.locator('#close-chat').click();
            await page.locator('#sos-btn').click();
            await page.locator('#sos-modal:not(.hidden)').waitFor();
            await page.locator('.sos-tab[data-tab="send"]').click();
            await page.locator('#sos-trigger-btn').focus();
            await page.keyboard.down(' ');
            await page.keyboard.press('Escape');
            await page.keyboard.up(' ');
            await page.waitForTimeout(2200);
            assert.equal(await page.locator('.sos-alert-item').count(), 0, 'closing the dialog must cancel the hold');
            assert.deepEqual(pageErrors, []);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal page overflow');
        } finally {
            await browser.close();
        }
    });
}

test('pause ignores an in-flight fix and resume waits for a fresh fix', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
        await context.addInitScript(() => {
            window.locationCallbacks = [];
            navigator.geolocation.getCurrentPosition = success => window.locationCallbacks.push(success);
        });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.waitForFunction(() => window.locationCallbacks.length > 0);
        await page.locator('#sidebar-toggle').click();
        await page.locator('#sharing-toggle').click();
        await page.locator('#sharing-indicator[data-state="paused"]').waitFor();
        await page.evaluate(() => window.locationCallbacks.shift()({ coords: { latitude: 10, longitude: 20, accuracy: 5 }, timestamp: Date.now() }));
        await page.waitForTimeout(250);
        assert.equal(await page.locator('#user-count').innerText(), '0');
        await page.locator('#sharing-toggle').click();
        await page.waitForFunction(() => window.locationCallbacks.length > 0);
        await page.evaluate(() => window.locationCallbacks.shift()({ coords: { latitude: 11, longitude: 21, accuracy: 7 }, timestamp: Date.now() }));
        await page.locator('#sharing-indicator[data-state="sharing"]').waitFor();
        assert.match(await page.locator('.device-fix').first().innerText(), /±7 m/);
    } finally { await browser.close(); }
});

test('location permission denial can be retried without reloading', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
        await context.addInitScript(() => {
            navigator.geolocation.getCurrentPosition = (success, error) => error({ code: 1, message: 'Permission denied' });
        });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.locator('#permission-alert-location .retry-btn').click();
        await page.locator('#sidebar-toggle').click();
        await page.locator('#sharing-indicator[data-state="denied"]').waitFor();
        await page.evaluate(() => {
            navigator.geolocation.getCurrentPosition = success => success({ coords: { latitude: 10, longitude: 20, accuracy: 9 }, timestamp: Date.now() });
        });
        await page.locator('#sharing-retry').click();
        await page.locator('#sharing-indicator[data-state="sharing"]').waitFor();
    } finally { await browser.close(); }
});

test('reconnecting while paused does not republish location', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 23.8, longitude: 90.4 } });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.locator('#sidebar-toggle').click();
        await page.locator('#sharing-indicator[data-state="sharing"]').waitFor();
        await page.evaluate(() => window.__DEBUG__.socket.disconnect());
        await page.locator('#connection-status[data-state="offline"]').waitFor();
        assert.equal(await page.locator('#user-count').innerText(), '—');
        assert.equal(await page.locator('#device-empty-title').innerText(), 'Locations unavailable');
        await page.locator('#sharing-toggle').click();
        await page.evaluate(() => window.__DEBUG__.socket.connect());
        await page.locator('#connection-status[data-state="connected"]').waitFor();
        await page.locator('#sharing-indicator[data-state="paused"]').waitFor();
        await page.waitForTimeout(2500);
        assert.equal(await page.locator('#user-count').innerText(), '0');
        await page.locator('#sharing-toggle').click();
        await page.locator('#sharing-indicator[data-state="sharing"]').waitFor();
    } finally { await browser.close(); }
});

test('unresponsive optional device metadata does not block location sharing', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 23.8, longitude: 90.4 } });
        await context.addInitScript(() => { navigator.getBattery = () => new Promise(() => {}); });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.locator('#sidebar-toggle').click();
        await page.locator('#sharing-indicator[data-state="sharing"]').waitFor();
    } finally { await browser.close(); }
});

// These tests intentionally use a tiny deterministic tile rather than making
// the suite dependent on a third-party tile provider or network availability.
const sampleTile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP3sAAAAASUVORK5CYII=', 'base64');

test('Leaflet renders tiles and markers, zooms, switches layers and fits antimeridian locations', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 23.8, longitude: 90.4, accuracy: 10 } });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route(/https:\/\//, route => route.fulfill({ status: 200, contentType: 'image/png', body: sampleTile }));
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.waitForFunction(() => document.querySelector('.leaflet-tile-loaded')?.naturalWidth > 0);
        await page.locator('.leaflet-marker-icon').first().waitFor();
        await page.waitForFunction(async () => {
            const { map } = await import('/js/map.js');
            return map && Math.abs(map.getCenter().lat - 23.8) < 0.01 && Math.abs(map.getCenter().lng - 90.4) < 0.01;
        });
        const zoom = await page.evaluate(async () => (await import('/js/map.js')).map.getZoom());
        await page.locator('.leaflet-control-zoom-in').click();
        await page.waitForFunction(async before => (await import('/js/map.js')).map.getZoom() > before, zoom);
        await page.locator('#sidebar-toggle').click();
        await page.locator('#device-list .device-info').first().click();
        await page.locator('.leaflet-popup-content .device-coordinates').waitFor();
        await page.locator('#sidebar-toggle').click();
        await page.locator('#fab-btn').click();
        await page.locator('#fab-layers-btn').click();
        await page.getByRole('button', { name: 'OpenStreetMap' }).click();
        assert.equal(await page.evaluate(async () => (await import('/js/map.js')).getCurrentLayerName()), 'OpenStreetMap');
        assert.match(await page.locator('.leaflet-control-attribution').innerText(), /OpenStreetMap/);
        await page.getByRole('button', { name: 'Close map styles' }).click();
        await page.evaluate(async () => (await import('/js/map.js')).focusMapOnDevice(10, 10, 8));
        await page.waitForFunction(async () => {
            const { map } = await import('/js/map.js');
            return Math.abs(map.getCenter().lat - 10) < 0.1 && Math.abs(map.getCenter().lng - 10) < 0.1;
        });
        const preserved = await page.evaluate(async () => {
            const module = await import('/js/map.js');
            module.updateMarker({ id: window.__DEBUG__.socket.id, latitude: 30, longitude: 30, deviceName: 'Self' });
            return { lat: module.map.getCenter().lat, lng: module.map.getCenter().lng };
        });
        assert.ok(Math.abs(preserved.lat - 10) < 0.1 && Math.abs(preserved.lng - 10) < 0.1, `new fixes must not recenter a deliberately chosen view: ${JSON.stringify(preserved)}`);
        await page.evaluate(async () => {
            const module = await import('/js/map.js');
            module.removeMarker(window.__DEBUG__.socket.id);
            module.updateMarker({ id: 'east', latitude: 0, longitude: 179, deviceName: 'East' });
            module.updateMarker({ id: 'west', latitude: 0, longitude: -179, deviceName: 'West' });
            module.fitVisibleDevices();
        });
        await page.waitForFunction(async () => {
            const { map } = await import('/js/map.js');
            return Math.abs(Math.abs(map.getCenter().lng) - 180) < 1 && map.getZoom() > 3;
        });
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
});

test('failed map tiles produce a warning and retry recovers', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 23.8, longitude: 90.4 } });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        let fail = true;
        await page.route(/https:\/\//, route => fail ? route.abort() : route.fulfill({ status: 200, contentType: 'image/png', body: sampleTile }));
        await page.goto(url);
        await page.locator('#continue-btn').click();
        // Wait for the initial GPS-driven view and its tile batch to settle.
        // Otherwise a late request could succeed before the retry click.
        await page.waitForFunction(async () => {
            const { map, baseLayers, getCurrentLayerName } = await import('/js/map.js');
            return Math.abs(map.getCenter().lat - 23.8) < 0.01 && !baseLayers[getCurrentLayerName()].isLoading();
        });
        await page.locator('#map-tile-warning:not(.hidden)').waitFor();
        fail = false;
        await page.locator('#retry-map-tiles').click();
        await page.waitForFunction(() => document.querySelector('.leaflet-tile-loaded')?.naturalWidth > 0);
        assert.equal(await page.locator('#map-tile-warning').isVisible(), false);
    } finally { await browser.close(); }
});

test('a map gesture before the first GPS fix is not overridden', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
        await context.addInitScript(() => {
            window.locationCallbacks = [];
            navigator.geolocation.getCurrentPosition = success => window.locationCallbacks.push(success);
        });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.fulfill({ status: 200, contentType: 'image/png', body: sampleTile }));
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.waitForFunction(() => window.locationCallbacks.length > 0);
        await page.locator('#map').click({ position: { x: 600, y: 400 } });
        await page.evaluate(() => window.locationCallbacks.shift()({ coords: { latitude: 45, longitude: 40, accuracy: 5 }, timestamp: Date.now() }));
        await page.locator('.leaflet-marker-icon').first().waitFor();
        const center = await page.evaluate(async () => { const { map } = await import('/js/map.js'); return { lat: map.getCenter().lat, lng: map.getCenter().lng }; });
        assert.ok(Math.abs(center.lat - 45) > 1 || Math.abs(center.lng - 40) > 1);
    } finally { await browser.close(); }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 740, height: 360 }]) {
    test(`map corner controls do not overlap at ${viewport.width}x${viewport.height}`, async () => {
        const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
        try {
            const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 23.8, longitude: 90.4 } });
            const page = await context.newPage();
            page.setDefaultTimeout(7000);
            await page.route(/https:\/\//, route => route.fulfill({ status: 200, contentType: 'image/png', body: sampleTile }));
            await page.goto(url);
            await page.locator('#continue-btn').click();
            await page.locator('#connection-status[data-state="connected"]').waitFor();
            const mobile = viewport.width <= 768;
            const selectors = ['.workspace-header', '.leaflet-control-zoom', '#notification-panel', '#sos-btn', '#sidebar-toggle', '#chat-fab', mobile ? '#mobile-controls' : '#fab-btn'];
            const boxes = [];
            for (const selector of selectors) {
                const box = await page.locator(selector).boundingBox();
                assert.ok(box, `${selector} must be visible`);
                assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${selector} must fit the viewport`);
                boxes.push({ selector, ...box });
            }
            for (let i = 0; i < boxes.length; i++) {
                for (let j = i + 1; j < boxes.length; j++) {
                    const a = boxes[i], b = boxes[j];
                    const intersects = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
                    assert.equal(intersects, false, `${a.selector} overlaps ${b.selector}`);
                }
            }
            if (mobile) {
                await page.locator('#chat-fab').click();
                await page.locator('#sidebar-toggle').click();
                assert.equal(await page.locator('#chat-panel').isVisible(), false, 'drawer should close chat on small screens');
                assert.equal(await page.locator('#chat-fab').isVisible(), false);
                assert.equal(await page.locator('#mobile-controls').isVisible(), false);
                assert.equal(await page.locator('#sos-btn').isVisible(), true);
            } else {
                await page.locator('#sidebar-toggle').click();
                const drawer = await page.locator('#sidebar').boundingBox();
                const fab = await page.locator('#fab-btn').boundingBox();
                assert.ok(fab.x + fab.width <= drawer.x, 'desktop map controls should remain accessible beside the drawer');
            }
        } finally { await browser.close(); }
    });
}

test('device recognition uses consistent best-effort labels and updates accessible map pins', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 10, longitude: 20 } });
        const page = await context.newPage();
        await page.route(/https:\/\//, route => route.fulfill({ status: 200, contentType: 'image/png', body: sampleTile }));
        await page.goto(url);
        const results = await page.evaluate(async () => {
            const { detectDevice, getBrowserName, getDeviceIcon } = await import('/js/device.js');
            return [
                detectDevice('Mozilla Android Linux', 'Linux arm', 5).name,
                detectDevice('Mozilla Macintosh', 'MacIntel', 5).name,
                detectDevice('Mozilla CrOS x86_64 Linux', 'Linux x86_64', 0).name,
                detectDevice('Mozilla Windows NT', 'Win32', 0).name,
                detectDevice('unknown', '', 0).name,
                getBrowserName('Mozilla CriOS/123 Safari/604'), getBrowserName('Mozilla FxiOS/123 Safari/604'),
                getBrowserName('Mozilla EdgiOS/123 CriOS/123 Safari/604'), getDeviceIcon('chromeos')
            ];
        });
        assert.deepEqual(results, ['Android Device', 'iOS Device', 'Chromebook', 'Windows PC', 'Unknown Device', 'Chrome', 'Firefox', 'Edge', 'Chromebook']);
        await page.locator('#continue-btn').click();
        await page.locator('.tracker-marker-self').waitFor();
        await page.evaluate(async () => {
            const { updateMarker } = await import('/js/map.js');
            updateMarker({ id: 'peer-pin', latitude: 11, longitude: 21, deviceName: '<img src=x onerror=alert(1)>', deviceInfo: { deviceType: 'Unknown' } });
            updateMarker({ id: 'peer-pin', latitude: 12, longitude: 22, deviceName: 'Alex', deviceInfo: { deviceType: 'Android' } });
        });
        const peer = page.locator('.leaflet-marker-icon[aria-label="Location of Alex"]');
        await peer.waitFor();
        assert.equal(await peer.locator('.fa-mobile-alt').count(), 1);
        assert.equal(await page.locator('.leaflet-marker-icon img[src="x"]').count(), 0);
    } finally { await browser.close(); }
});

test('activity shows unread updates, can be cleared and does not retain another room', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 10, longitude: 20 } });
        const page = await context.newPage();
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.locator('#connection-status[data-state="connected"]').waitFor();
        await page.evaluate(async () => (await import('/js/notification.js')).addNotification('Private activity from previous room'));
        assert.equal(await page.locator('#activity-unread').isVisible(), true);
        await page.locator('#notification-toggle').click();
        assert.equal(await page.locator('#activity-unread').isVisible(), false);
        assert.equal(await page.getByText('Private activity from previous room').count(), 1);
        await page.locator('#clear-activity').click();
        assert.equal(await page.locator('#activity-empty').isVisible(), true);
        await page.evaluate(async () => (await import('/js/notification.js')).addNotification('Old room event'));
        await page.evaluate(() => window.dispatchEvent(new Event('tracker-room-changing')));
        assert.equal(await page.getByText('Old room event').count(), 0);
        assert.equal(await page.locator('#activity-empty').isVisible(), true);
    } finally { await browser.close(); }
});

test('SOS is shown immediately, relayed with honest status, and can be viewed on the map', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 10, longitude: 20, accuracy: 12 }, reducedMotion: 'reduce' })));
        const [sender, receiver] = await Promise.all(contexts.map(c => c.newPage()));
        for (const page of [sender, receiver]) {
            page.setDefaultTimeout(7000);
            await page.route('https://ipapi.co/**', async route => { await new Promise(resolve => setTimeout(resolve, 5000)); await route.abort().catch(() => {}); });
            await page.route(/https:\/\/(?!ipapi\.co)/, route => route.fulfill({ status: 200, contentType: 'image/png', body: sampleTile }));
            await page.goto(url);
            await page.locator('#org-input').fill('rescue-room');
            await page.locator('#continue-btn').click();
            await page.waitForFunction(async () => (await import('/js/socket.js')).getJoinedRoom() === 'rescue-room');
        }
        await sender.locator('#sos-btn').click();
        await sender.locator('.sos-tab[data-tab="send"]').click();
        await sender.locator('#sos-trigger-btn').focus();
        await sender.keyboard.down(' ');
        await sender.waitForTimeout(2150);
        await sender.keyboard.up(' ');
        await receiver.locator('.sos-alert-item').waitFor({ timeout: 3000 });
        await sender.locator('.sos-delivery[data-state="relayed"]').waitFor();
        assert.match(await sender.locator('#sos-status').innerText(), /receipt and response are not guaranteed/i);
        assert.match(await receiver.locator('.sos-alert-item').innerText(), /rescue-room/);
        assert.match(await receiver.locator('.sos-alert-item').innerText(), /Estimated ±12 m/);
        await receiver.locator('.sos-action-btn.view-map').click();
        await receiver.locator('.tracker-marker-sos').waitFor();
        await receiver.locator('.sos-map-popup').waitFor({ state: 'visible' });
        await receiver.waitForFunction(() => document.querySelector('.sos-map-popup')?.innerText.includes('SOS location'));
        assert.match(await receiver.locator('.sos-map-popup').innerText(), /SOS location/);
        await receiver.locator('.leaflet-popup-close-button').click();
        assert.equal(await receiver.locator('.tracker-marker-sos').count(), 0);
    } finally { await browser.close(); }
});

test('an SOS started in one room is not sent after a room change', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
        await context.addInitScript(() => {
            window.sosCallbacks = [];
            navigator.geolocation.getCurrentPosition = (success, error, options) => {
                if (options?.maximumAge === 0) window.sosCallbacks.push(success);
                else success({ coords: { latitude: 10, longitude: 20, accuracy: 20 }, timestamp: Date.now() });
            };
        });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#org-input').fill('first-room');
        await page.locator('#continue-btn').click();
        await page.waitForFunction(async () => (await import('/js/socket.js')).getJoinedRoom() === 'first-room');
        await page.locator('#sos-btn').click();
        await page.locator('.sos-tab[data-tab="send"]').click();
        await page.locator('#sos-trigger-btn').focus();
        await page.keyboard.down(' ');
        await page.waitForTimeout(2150);
        await page.keyboard.up(' ');
        await page.waitForFunction(() => window.sosCallbacks.length > 0);
        await page.evaluate(async () => (await import('/js/profile.js')).updateProfile('Sender', 'second-room'));
        await page.waitForFunction(async () => (await import('/js/socket.js')).getJoinedRoom() === 'second-room');
        await page.evaluate(() => window.sosCallbacks.shift()({ coords: { latitude: 1, longitude: 2, accuracy: 5 }, timestamp: Date.now() }));
        await page.locator('.sos-delivery[data-state="not-sent"]').waitFor();
        assert.match(await page.locator('#sos-status').innerText(), /not sent/i);
        assert.match(await page.locator('.sos-history-room').first().innerText(), /first-room/);
    } finally { await browser.close(); }
});

test('offline SOS reports not sent immediately and preserves that status after reload', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 10, longitude: 20 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.waitForFunction(async () => !!(await import('/js/socket.js')).getJoinedRoom());
        await page.evaluate(() => window.__DEBUG__.socket.disconnect());
        await page.locator('#connection-status[data-state="offline"]').waitFor();
        await page.locator('#sos-btn').click();
        await page.locator('.sos-tab[data-tab="send"]').click();
        await page.locator('#sos-trigger-btn').focus();
        await page.keyboard.down(' ');
        await page.waitForTimeout(2150);
        await page.keyboard.up(' ');
        await page.locator('.sos-delivery[data-state="not-sent"]').waitFor({ timeout: 2000 });
        assert.match(await page.locator('#sos-status').innerText(), /not sent/i);
        assert.equal(await page.locator('.sos-alert-item .view-map').count(), 0);
        await page.reload();
        await page.locator('#connection-status[data-state="connected"]').waitFor();
        await page.locator('#sos-btn').click();
        await page.locator('.sos-delivery[data-state="not-sent"]').waitFor();
    } finally { await browser.close(); }
});

test('SOS uses an honestly labelled last-shared fallback when location callbacks never arrive', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
        await context.addInitScript(() => {
            const realTimeout = window.setTimeout.bind(window);
            window.setTimeout = (fn, ms, ...args) => realTimeout(fn, ms === 8250 || ms === 4250 ? 150 : ms, ...args);
            navigator.geolocation.getCurrentPosition = (success, error, options) => {
                if (options?.timeout === 8000 || options?.timeout === 4000) return;
                success({ coords: { latitude: 10, longitude: 20, accuracy: 32 }, timestamp: Date.now() });
            };
        });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.waitForFunction(async () => (await import('/js/socket.js')).getJoinedRoom() && (await import('/js/map.js')).markers[window.__DEBUG__.socket.id]);
        await page.locator('#sos-btn').click();
        await page.locator('.sos-tab[data-tab="send"]').click();
        await page.locator('#sos-trigger-btn').focus();
        await page.keyboard.down(' ');
        await page.waitForTimeout(2150);
        await page.keyboard.up(' ');
        await page.locator('.sos-delivery[data-state="relayed"]').waitFor();
        assert.match(await page.locator('.sos-alert-item').innerText(), /Last shared location may be old/);
        assert.match(await page.locator('.sos-alert-item').innerText(), /Estimated ±32 m/);
    } finally { await browser.close(); }
});

test('activity can be dragged and expanded without leaving the viewport', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 10, longitude: 20 } });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        const handle = await page.locator('.drag-handle').boundingBox();
        await page.mouse.move(handle.x + 8, handle.y + 8);
        await page.mouse.down();
        await page.mouse.move(350, 820, { steps: 5 });
        await page.mouse.up();
        await page.locator('#notification-toggle').click();
        await page.waitForTimeout(100);
        const box = await page.locator('#notification-panel').boundingBox();
        assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= 391 && box.y + box.height <= 845);
        assert.equal(await page.locator('#notification-toggle').getAttribute('aria-expanded'), 'true');
    } finally { await browser.close(); }
});

test('landscape SOS hold control remains visible without scrolling', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ viewport: { width: 740, height: 360 }, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 10, longitude: 20 } });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.locator('#sos-btn').click();
        await page.locator('.sos-tab[data-tab="send"]').click();
        const hold = await page.locator('#sos-trigger-btn').boundingBox();
        const scrollArea = await page.locator('#sos-tab-send').boundingBox();
        assert.ok(hold.y >= scrollArea.y && hold.y + hold.height <= scrollArea.y + scrollArea.height, 'hold control should be within the visible dialog');
        assert.equal(await page.locator('.sos-tab[data-tab="send"]').getAttribute('aria-pressed'), 'true');
    } finally { await browser.close(); }
});

test('activity drag works with touch input', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 10, longitude: 20 } });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        const before = await page.locator('#notification-panel').boundingBox();
        const handle = await page.locator('.drag-handle').boundingBox();
        const client = await context.newCDPSession(page);
        const x = Math.round(handle.x + 6), y = Math.round(handle.y + 6);
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 40, y: y + 150 }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const after = await page.locator('#notification-panel').boundingBox();
        assert.ok(after.y > before.y + 50, 'activity should follow a touch drag');
    } finally { await browser.close(); }
});

test('devices drawer preserves controls and focus during live updates and handles empty state', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ viewport: { width: 320, height: 568 }, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['geolocation'], geolocation: { latitude: 10, longitude: 20 } });
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#continue-btn').click();
        await page.locator('#sidebar-toggle').click();
        await page.locator('#sharing-indicator[data-state="sharing"]').waitFor();
        await page.locator('#sharing-toggle').click();
        await page.waitForFunction(() => document.getElementById('user-count').textContent === '0');
        assert.equal(await page.locator('#device-empty').isVisible(), true);
        assert.equal(await page.locator('#fit-devices-btn').isDisabled(), true);
        await page.evaluate(async () => {
            const { updateDeviceList } = await import('/js/ui.js');
            const stamp = new Date().toISOString();
            window.drawerDevices = [
                ['self', { latitude: 10, longitude: 20, deviceName: 'A very long device name that must wrap without clipping the details control', capturedAt: stamp, accuracy: 5, deviceInfo: { deviceType: 'Android' } }],
                ['other', { latitude: 11, longitude: 21, deviceName: '<img src=x onerror=alert(1)>', capturedAt: stamp, deviceInfo: { deviceType: 'iOS' } }]
            ];
            updateDeviceList(window.drawerDevices, 'self');
        });
        assert.equal(await page.locator('#device-empty').isVisible(), false);
        assert.equal(await page.locator('#fit-devices-btn').isDisabled(), false);
        assert.equal(await page.locator('#device-list li').count(), 2);
        assert.equal(await page.locator('#device-list img').count(), 0, 'names are text, not HTML');
        assert.equal(await page.locator('.device-self-badge:not([hidden])').count(), 1);
        const control = page.locator('#device-list li[data-device-id="self"] .device-info');
        await control.focus();
        const before = await control.boundingBox();
        assert.ok(before.width >= 44 && before.height >= 44, 'details button should be touch-friendly');
        await page.evaluate(async () => {
            window.originalControl = document.activeElement;
            window.drawerDevices[0][1].accuracy = 20;
            const { updateDeviceList } = await import('/js/ui.js');
            updateDeviceList([...window.drawerDevices].reverse(), 'self');
        });
        assert.equal(await page.evaluate(() => document.activeElement === window.originalControl && window.originalControl.isConnected), true);
        assert.match(await page.locator('#device-list li[data-device-id="self"] .device-fix').innerText(), /±20 m/);
        assert.match(await page.locator('#device-list li[data-device-id="self"] .device-focus').getAttribute('aria-label'), /estimated accuracy 20 meters/);
        assert.equal(await page.evaluate(() => document.getElementById('info-panel').scrollWidth <= document.getElementById('info-panel').clientWidth), true, 'drawer must not overflow horizontally');
        await page.evaluate(async () => (await import('/js/ui.js')).updateDeviceList([window.drawerDevices[1]], 'self'));
        assert.equal(await page.evaluate(() => document.activeElement.id), 'fit-devices-btn', 'focus moves to a usable action when a focused device disappears');
        await page.evaluate(async () => (await import('/js/ui.js')).updateDeviceList([], 'self'));
        assert.equal(await page.locator('#device-empty').isVisible(), true);
        assert.equal(await page.locator('#fit-devices-btn').isDisabled(), true);
        await page.evaluate(async () => (await import('/js/theme.js')).applyTheme('dark'));
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.devices-section .section-eyebrow')).color === 'rgb(168, 183, 202)');
        const contrast = await page.evaluate(() => {
            const color = getComputedStyle(document.querySelector('.devices-section .section-eyebrow')).color.match(/\d+/g).slice(0, 3).map(Number);
            const background = [30, 41, 59];
            const luminance = rgb => rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
            const [a, b] = [luminance(color), luminance(background)].sort((x, y) => y - x);
            return (a + 0.05) / (b + 0.05);
        });
        assert.ok(contrast >= 4.5, 'drawer section labels should be legible in dark mode');
        assert.deepEqual(await page.locator('#audio-controls .audio-button-label').allTextContents(), ['Invite', 'Join', 'Mic off', 'Sound on']);
        await page.locator('#speaker-btn').click();
        assert.equal(await page.locator('#speaker-btn').getAttribute('aria-pressed'), 'false');
    } finally { await browser.close(); }
});

test('drawer uses the joined room for invites and distinguishes offline from zero locations', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
        await context.addInitScript(() => localStorage.setItem('locationSharingPaused', 'true'));
        const page = await context.newPage();
        page.setDefaultTimeout(7000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.locator('#org-input').fill('Field <b>Team</b>');
        await page.locator('#continue-btn').click();
        await page.locator('#sidebar-toggle').click();
        await page.waitForFunction(async () => (await import('/js/socket.js')).getJoinedRoom() === 'Field Team');
        await page.waitForFunction(() => document.getElementById('user-count').textContent === '0');
        assert.equal(await page.locator('#device-empty-title').innerText(), 'No locations yet');
        assert.equal(await page.locator('#copy-invite-btn').isEnabled(), true);
        await page.locator('#copy-invite-btn').click();
        await page.getByText('Invite copied. Anyone with the room name can join.').waitFor();
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        assert.equal(new URL(copied).searchParams.get('room'), 'Field Team');
        await page.evaluate(() => window.__DEBUG__.socket.disconnect());
        await page.locator('#connection-status[data-state="offline"]').waitFor({ state: 'attached' });
        assert.equal(await page.locator('#device-empty-title').innerText(), 'Locations unavailable');
        assert.equal(await page.locator('#user-count').innerText(), '—');
        assert.equal(await page.locator('#copy-invite-btn').isDisabled(), true);
        assert.match(await page.locator('#invite-status').innerText(), /connect/i);
        assert.deepEqual(await page.locator('#audio-controls .audio-button-label').allTextContents(), ['Invite', 'Join', 'Mic off', 'Sound on']);
        await page.locator('#speaker-btn').click();
        assert.equal(await page.locator('#speaker-btn .audio-button-label').innerText(), 'Sound off');
        assert.equal(await page.locator('#speaker-btn .fa-volume-mute').count(), 1);
    } finally { await browser.close(); }
});

test('service worker displays an honest offline fallback and retries without a redirect loop', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', ...(process.env.CHROMIUM_PATH ? ['--single-process', '--no-zygote'] : [])] });
    try {
        const context = await browser.newContext({ serviceWorkers: 'allow', reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        await page.route(/https:\/\//, route => route.abort());
        await page.goto(url);
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.waitForFunction(() => !!navigator.serviceWorker.controller);
        await context.setOffline(true);
        await page.goto(`${url}/previously-unvisited-offline-page`);
        await page.getByRole('heading', { name: "You're Offline" }).waitFor();
        assert.match(await page.locator('.offline-container').innerText(), /not queued for later delivery/);
        assert.doesNotMatch(await page.locator('.offline-container').innerText(), /will sync|location data is cached locally/i);
        assert.match(await page.locator('#statusText').innerText(), /waiting for a network/i);
        await context.setOffline(false);
        await page.waitForFunction(() => document.getElementById('statusText')?.textContent.includes('Try reconnecting'));
        assert.match(page.url(), /previously-unvisited-offline-page/, 'network restoration should not cause a redirect loop');
        await page.getByRole('button', { name: 'Try Again' }).click();
        await page.waitForURL(url + '/');
        await page.locator('.workspace-header').waitFor({ state: 'attached' });
    } finally { await browser.close(); }
});

test('manifest references correctly sized PNG install icons', async () => {
    const response = await fetch(`${url}/manifest.json`);
    const manifest = await response.json();
    for (const size of [192, 512]) {
        const icon = manifest.icons.find(item => item.sizes === `${size}x${size}` && item.type === 'image/png');
        assert.ok(icon, `${size}px PNG icon is declared`);
        const image = await fetch(new URL(icon.src, url));
        assert.match(image.headers.get('content-type'), /^image\/png/);
        const bytes = Buffer.from(await image.arrayBuffer());
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        assert.equal(bytes.readUInt32BE(16), size);
        assert.equal(bytes.readUInt32BE(20), size);
    }
});
