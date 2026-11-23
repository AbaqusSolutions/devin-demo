// UI Controls

function applyFx(enabled) {
    document.documentElement.dataset.fx = enabled ? 'on' : 'off';
    document.getElementById('fx-toggle').checked = enabled;
}

function loadFx() {
    const saved = localStorage.getItem('fxEnabled');
    const enabled = saved !== null
        ? saved === 'true'
        : !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    applyFx(enabled);
}

export function initUI() {
    const settingsIcon = document.getElementById('settings-icon');
    const settingsPanel = document.getElementById('settings-panel');
    const fxToggle = document.getElementById('fx-toggle');

    loadFx();

    // Toggle settings panel
    settingsIcon.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent click from propagating to document
        settingsPanel.classList.toggle('visible');
    });

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && settingsPanel.classList.contains('visible')) {
            settingsPanel.classList.remove('visible');
        }
    });

    // Prevent game controls when interacting with settings
    settingsPanel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    fxToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        applyFx(enabled);
        localStorage.setItem('fxEnabled', enabled);
    });
}
