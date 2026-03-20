/**
 * Food Event Token Scanner Application
 * Handles QR code scanning and check-in validation
 */

// Application State
const state = {
    scanner: null,
    isScanning: false,
    apiUrl: localStorage.getItem('apiUrl') || '',
    lastScannedToken: null
};

// DOM Elements
const elements = {
    reader: document.getElementById('reader'),
    scannerSection: document.getElementById('scannerSection'),
    resultSection: document.getElementById('resultSection'),
    resultCard: document.getElementById('resultCard'),
    resultIcon: document.getElementById('resultIcon'),
    resultTitle: document.getElementById('resultTitle'),
    resultDetails: document.getElementById('resultDetails'),
    scanAgain: document.getElementById('scanAgain'),
    toggleManual: document.getElementById('toggleManual'),
    manualInput: document.getElementById('manualInput'),
    tokenInput: document.getElementById('tokenInput'),
    submitToken: document.getElementById('submitToken'),
    statsBtn: document.getElementById('statsBtn'),
    statsModal: document.getElementById('statsModal'),
    closeStats: document.getElementById('closeStats'),
    statsContent: document.getElementById('statsContent'),
    configBtn: document.getElementById('configBtn'),
    configModal: document.getElementById('configModal'),
    closeConfig: document.getElementById('closeConfig'),
    apiUrl: document.getElementById('apiUrl'),
    saveConfig: document.getElementById('saveConfig'),
    successSound: document.getElementById('successSound'),
    errorSound: document.getElementById('errorSound')
};

/**
 * Initialize the application
 */
function init() {
    // Check for saved API URL
    if (state.apiUrl) {
        elements.apiUrl.value = state.apiUrl;
        initScanner();
    } else {
        showConfigModal();
    }

    // Bind event listeners
    bindEvents();
}

/**
 * Bind all event listeners
 */
function bindEvents() {
    // Manual entry toggle
    elements.toggleManual.addEventListener('click', toggleManualEntry);

    // Manual token submission
    elements.submitToken.addEventListener('click', handleManualSubmit);
    elements.tokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleManualSubmit();
    });

    // Scan again button
    elements.scanAgain.addEventListener('click', resetScanner);

    // Stats modal
    elements.statsBtn.addEventListener('click', showStatsModal);
    elements.closeStats.addEventListener('click', closeStatsModal);

    // Config modal
    elements.configBtn.addEventListener('click', showConfigModal);
    elements.closeConfig.addEventListener('click', closeConfigModal);
    elements.saveConfig.addEventListener('click', saveConfig);

    // Close modals on outside click
    elements.statsModal.addEventListener('click', (e) => {
        if (e.target === elements.statsModal) closeStatsModal();
    });
    elements.configModal.addEventListener('click', (e) => {
        if (e.target === elements.configModal) closeConfigModal();
    });
}

/**
 * Initialize the QR code scanner
 */
function initScanner() {
    if (!state.apiUrl) {
        showConfigModal();
        return;
    }

    state.scanner = new Html5Qrcode('reader');

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    state.scanner.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanFailure
    ).then(() => {
        state.isScanning = true;
    }).catch((err) => {
        console.error('Failed to start scanner:', err);
        showError('Camera Error', 'Unable to access camera. Please check permissions and try again.');
    });
}

/**
 * Handle successful QR code scan
 */
async function onScanSuccess(decodedText) {
    // Prevent duplicate scans
    if (decodedText === state.lastScannedToken) {
        return;
    }

    state.lastScannedToken = decodedText;

    // Pause scanner while processing
    if (state.scanner && state.isScanning) {
        await state.scanner.pause();
    }

    // Process the token
    await processToken(decodedText);
}

/**
 * Handle scan failure (called frequently, just log errors)
 */
function onScanFailure(error) {
    // Only log actual errors, not "no QR found" messages
    if (!error.includes('No QR code found')) {
        console.warn('Scan error:', error);
    }
}

/**
 * Process a token (from scan or manual entry)
 */
async function processToken(token) {
    // Show loading state
    showResult('loading', 'Processing...', '<div class="loading">Validating token...</div>');

    try {
        // First validate the token
        const validateResponse = await callApi('validate', { token });

        if (!validateResponse.success) {
            playSound('error');
            showResult('error', 'Invalid Token', `<p>${validateResponse.error}</p>`);
            return;
        }

        const data = validateResponse.data;

        // Check if already checked in
        if (data.checkedIn) {
            playSound('error');
            showResult('warning', 'Already Checked In', `
                <div class="detail-row">
                    <span class="label">Name:</span>
                    <span class="value">${escapeHtml(data.name)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Check-in Time:</span>
                    <span class="value">${formatTime(data.checkInTime)}</span>
                </div>
            `);
            return;
        }

        // Perform check-in
        const checkInResponse = await callApi('checkin', { token });

        if (checkInResponse.success) {
            playSound('success');
            showResult('success', 'Check-in Successful!', `
                <div class="detail-row">
                    <span class="label">Name:</span>
                    <span class="value">${escapeHtml(checkInResponse.data.name)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Family Members:</span>
                    <span class="value">${checkInResponse.data.familyCount || 1}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Time:</span>
                    <span class="value">${formatTime(checkInResponse.data.checkInTime)}</span>
                </div>
            `);
        } else {
            playSound('error');
            showResult('error', 'Check-in Failed', `<p>${checkInResponse.error}</p>`);
        }

    } catch (error) {
        console.error('Process error:', error);
        playSound('error');
        showResult('error', 'Connection Error', '<p>Unable to connect to server. Please check your internet connection.</p>');
    }
}

/**
 * Call the Google Apps Script API
 */
async function callApi(action, params = {}) {
    const url = new URL(state.apiUrl);
    url.searchParams.append('action', action);

    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors'
    });

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
}

/**
 * Show result card
 */
function showResult(type, title, detailsHtml) {
    elements.scannerSection.classList.add('hidden');
    elements.resultSection.classList.remove('hidden');

    elements.resultCard.className = `result-card ${type}`;
    elements.resultIcon.innerHTML = getIconForType(type);
    elements.resultTitle.textContent = title;
    elements.resultDetails.innerHTML = detailsHtml;
}

/**
 * Get icon SVG for result type
 */
function getIconForType(type) {
    const icons = {
        success: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>`,
        error: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`,
        loading: `<div class="spinner"></div>`
    };
    return icons[type] || icons.error;
}

/**
 * Reset scanner to scan again
 */
async function resetScanner() {
    state.lastScannedToken = null;

    elements.resultSection.classList.add('hidden');
    elements.scannerSection.classList.remove('hidden');

    // Resume scanner
    if (state.scanner && state.isScanning) {
        try {
            await state.scanner.resume();
        } catch (e) {
            // If resume fails, restart scanner
            initScanner();
        }
    }
}

/**
 * Toggle manual entry visibility
 */
function toggleManualEntry() {
    elements.manualInput.classList.toggle('hidden');
    if (!elements.manualInput.classList.contains('hidden')) {
        elements.tokenInput.focus();
    }
}

/**
 * Handle manual token submission
 */
async function handleManualSubmit() {
    const token = elements.tokenInput.value.trim().toUpperCase();

    if (!token) {
        alert('Please enter a token');
        return;
    }

    // Pause scanner if running
    if (state.scanner && state.isScanning) {
        await state.scanner.pause();
    }

    await processToken(token);
    elements.tokenInput.value = '';
}

/**
 * Show statistics modal
 */
async function showStatsModal() {
    elements.statsModal.classList.remove('hidden');
    elements.statsContent.innerHTML = '<div class="loading">Loading statistics...</div>';

    try {
        const response = await callApi('stats');

        if (response.success) {
            const stats = response.data;
            elements.statsContent.innerHTML = `
                <div class="stat-grid">
                    <div class="stat-item">
                        <div class="stat-value">${stats.totalRegistrations}</div>
                        <div class="stat-label">Total Registrations</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.totalFamilyMembers}</div>
                        <div class="stat-label">Total People</div>
                    </div>
                    <div class="stat-item highlight">
                        <div class="stat-value">${stats.checkedIn}</div>
                        <div class="stat-label">Checked In</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.checkedInFamilyMembers}</div>
                        <div class="stat-label">People Checked In</div>
                    </div>
                    <div class="stat-item warning">
                        <div class="stat-value">${stats.noShows}</div>
                        <div class="stat-label">No Shows</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.paid}/${stats.totalRegistrations}</div>
                        <div class="stat-label">Paid</div>
                    </div>
                </div>
            `;
        } else {
            elements.statsContent.innerHTML = `<p class="error-message">${response.error}</p>`;
        }
    } catch (error) {
        console.error('Stats error:', error);
        elements.statsContent.innerHTML = '<p class="error-message">Failed to load statistics</p>';
    }
}

/**
 * Close statistics modal
 */
function closeStatsModal() {
    elements.statsModal.classList.add('hidden');
}

/**
 * Show configuration modal
 */
function showConfigModal() {
    elements.configModal.classList.remove('hidden');
    elements.apiUrl.focus();
}

/**
 * Close configuration modal
 */
function closeConfigModal() {
    if (!state.apiUrl) {
        alert('Please configure the API URL to use the scanner');
        return;
    }
    elements.configModal.classList.add('hidden');
}

/**
 * Save configuration
 */
function saveConfig() {
    const url = elements.apiUrl.value.trim();

    if (!url) {
        alert('Please enter a valid URL');
        return;
    }

    if (!url.startsWith('https://script.google.com/')) {
        alert('Please enter a valid Google Apps Script URL');
        return;
    }

    state.apiUrl = url;
    localStorage.setItem('apiUrl', url);

    closeConfigModal();
    elements.configModal.classList.add('hidden');

    // Initialize scanner if not already running
    if (!state.isScanning) {
        initScanner();
    }
}

/**
 * Show error message
 */
function showError(title, message) {
    showResult('error', title, `<p>${message}</p>`);
}

/**
 * Play feedback sound
 */
function playSound(type) {
    const sound = type === 'success' ? elements.successSound : elements.errorSound;
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {
            // Ignore audio play errors (common on mobile)
        });
    }

    // Also trigger vibration on supported devices
    if (navigator.vibrate) {
        navigator.vibrate(type === 'success' ? 200 : [100, 50, 100]);
    }
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
