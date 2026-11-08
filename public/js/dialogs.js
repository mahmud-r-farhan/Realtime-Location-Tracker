// Keep keyboard focus inside the currently visible modal. Dialogs themselves
// remain responsible for choosing initial focus and restoring it on close.
export function initDialogFocus() {
    document.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const dialog = ['name-popup', 'sos-modal', 'layer-selector-modal', 'battery-panel-modal']
            .map(id => document.getElementById(id))
            .find(element => element && !element.classList.contains('hidden'));
        if (!dialog) return;
        const controls = Array.from(dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]'))
            .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length > 0);
        if (!controls.length) { event.preventDefault(); return; }
        const index = controls.indexOf(document.activeElement);
        if (event.shiftKey && index <= 0) {
            event.preventDefault();
            controls[controls.length - 1].focus();
        } else if (!event.shiftKey && (index === -1 || index === controls.length - 1)) {
            event.preventDefault();
            controls[0].focus();
        }
    });
}
