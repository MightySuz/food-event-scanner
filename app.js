/**
 * Food Event Registration App
 * Handles registration, record display, and save confirmation pass
 */

// ============================================
// CONFIGURATION
// ============================================

let API_URL = '';

const DEFAULT_EVENT = {
    eventName: 'श्री महावीर जन्म कल्याणक महोत्सव - वात्सल्य भोज',
    eventDate: 'Sunday, October 04, 2026',
    eventTime: '12:00 PM',
    eventVenue: 'Aparna Sarovar Zenith ClubHouse, Behind Aparna Neo Mall, Nallagandla, Hyderabad'
};

const state = {
    currentData: null
};

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    // Registration form
    registerTab: document.getElementById('registerTab'),
    registrationForm: document.getElementById('registrationForm'),
    submitBtn: document.getElementById('submitBtn'),
    nameInput: document.getElementById('name'),
    phoneInput: document.getElementById('phone'),
    emailInput: document.getElementById('email'),
    familyCountSelect: document.getElementById('familyCount'),
    kidsCountSelect: document.getElementById('kidsCount'),

    // Result section
    resultSection: document.getElementById('resultSection'),
    resultTitle: document.getElementById('resultTitle'),
    summaryName: document.getElementById('summaryName'),
    summaryPhone: document.getElementById('summaryPhone'),
    summaryHeadcount: document.getElementById('summaryHeadcount'),
    eventDate: document.getElementById('eventDate'),
    eventTime: document.getElementById('eventTime'),
    eventVenue: document.getElementById('eventVenue'),
    emailSent: document.getElementById('emailSent'),

    // Save button
    saveImageBtn: document.getElementById('saveImageBtn'),
    newRegistrationBtn: document.getElementById('newRegistrationBtn'),

    // Error section
    errorSection: document.getElementById('errorSection'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    tryAgainBtn: document.getElementById('tryAgainBtn'),

    // Canvas for image generation
    canvas: document.getElementById('tokenCanvas')
};

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    // 1. Try loading config from config.json (with cache buster)
    try {
        const response = await fetch('config.json?t=' + Date.now());
        if (response.ok) {
            const config = await response.json();
            const urlVal = (config.apiUrl || '').trim();
            if (urlVal && urlVal !== 'add the url here') {
                API_URL = urlVal;
            }
        }
    } catch (e) {
        console.warn('Could not read config.json:', e);
    }

    // 2. If not specified or running on local server, fallback to /api
    if (!API_URL && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
        API_URL = '/api';
    }

    // Bind events
    bindEvents();
}

function bindEvents() {
    // Registration form
    elements.registrationForm.addEventListener('submit', handleRegistration);

    // Save button
    elements.saveImageBtn.addEventListener('click', saveAsImage);
    elements.newRegistrationBtn.addEventListener('click', resetToForm);

    // Error handling
    elements.tryAgainBtn.addEventListener('click', resetToForm);

    // Phone number validation - only allow digits
    elements.phoneInput.addEventListener('input', filterPhoneInput);
}

// Filter phone input to only allow digits
function filterPhoneInput(e) {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
}

// Validate phone number (must be digits only, 10 digits)
function isValidPhone(phone) {
    return /^[0-9]{10}$/.test(phone);
}

// ============================================
// REGISTRATION
// ============================================

async function handleRegistration(e) {
    e.preventDefault();

    // Get form data
    const formData = {
        name: elements.nameInput.value.trim(),
        phone: elements.phoneInput.value.trim(),
        email: elements.emailInput.value.trim(),
        familyCount: elements.familyCountSelect.value,
        kidsCount: elements.kidsCountSelect.value
    };

    // Validate
    if (!formData.name || !formData.phone) {
        showError('Validation Error', 'Please fill in all required fields');
        return;
    }

    // Validate phone number
    if (!isValidPhone(formData.phone)) {
        showError('Validation Error', 'Please enter a valid 10-digit phone number');
        return;
    }

    // Show loading state
    setButtonLoading(elements.submitBtn, true);

    try {
        const response = await callApi('register', formData);

        if (response.success) {
            state.currentData = response.data || formData;
            showSuccess(state.currentData, !!formData.email);
        } else {
            // Check if already registered
            if (response.existingToken || response.isDuplicate || (response.error && response.error.includes('already registered'))) {
                showError(
                    'Already Registered',
                    'This phone number is already registered for the event.'
                );
            } else {
                showError('Registration Failed', response.error || 'Unable to register. Please try again.');
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('Connection Error', error.message || 'Unable to connect to server. Please check your internet connection.');
    } finally {
        setButtonLoading(elements.submitBtn, false);
    }
}

// ============================================
// DISPLAY RESULTS
// ============================================

function showSuccess(data, emailSent = false) {
    // Hide form
    elements.registerTab.classList.add('hidden');
    elements.errorSection.classList.add('hidden');

    // Update result summary
    elements.summaryName.textContent = data.name || '-';
    elements.summaryPhone.textContent = data.phone || '-';

    const fCount = data.familyCount || 1;
    const kCount = parseInt(data.kidsCount) || 0;
    elements.summaryHeadcount.textContent = `${fCount} Person(s) ${kCount > 0 ? `(${kCount} Kids)` : ''}`;

    // Event details
    elements.eventDate.textContent = data.eventDate || DEFAULT_EVENT.eventDate;
    elements.eventTime.textContent = data.eventTime || DEFAULT_EVENT.eventTime;
    elements.eventVenue.textContent = data.eventVenue || DEFAULT_EVENT.eventVenue;

    // Show/hide email notice
    elements.emailSent.classList.toggle('hidden', !emailSent);

    // Show result section
    elements.resultSection.classList.remove('hidden');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(title, message) {
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    elements.errorSection.classList.remove('hidden');
    elements.resultSection.classList.add('hidden');
}

function resetToForm() {
    // Clear forms
    elements.registrationForm.reset();

    // Hide result/error sections
    elements.resultSection.classList.add('hidden');
    elements.errorSection.classList.add('hidden');

    // Show form
    elements.registerTab.classList.remove('hidden');

    // Clear state
    state.currentData = null;
}

// ============================================
// SAVE AS IMAGE (CONFIRMATION CARD)
// ============================================

function saveAsImage() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');

    // Canvas size
    const width = 420;
    const height = 480;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Header gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 85);
    gradient.addColorStop(0, '#2e7d32');
    gradient.addColorStop(1, '#4caf50');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 85);

    // Header text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('श्री महावीर जन्म कल्याणक महोत्सव', width / 2, 38);

    ctx.font = '15px Arial, sans-serif';
    ctx.fillText('वात्सल्य भोज - नामांकन पुष्टि', width / 2, 65);

    // Confirmation Badge
    ctx.fillStyle = '#e8f5e9';
    ctx.beginPath();
    ctx.roundRect(40, 105, width - 80, 50, 10);
    ctx.fill();

    ctx.fillStyle = '#2e7d32';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('✓ REGISTRATION CONFIRMED', width / 2, 136);

    // Participant details
    ctx.textAlign = 'left';
    ctx.fillStyle = '#212121';
    ctx.font = '15px Arial, sans-serif';

    const data = state.currentData || {};
    let y = 190;
    const lineHeight = 32;

    if (data.name) {
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText(`Name: ${data.name}`, 40, y);
        y += lineHeight;
        ctx.font = '15px Arial, sans-serif';
    }

    if (data.phone) {
        ctx.fillText(`Phone: ${data.phone}`, 40, y);
        y += lineHeight;
    }

    const fCount = data.familyCount || 1;
    const kCount = parseInt(data.kidsCount) || 0;
    ctx.fillText(`Total Headcount: ${fCount} Person(s) ${kCount > 0 ? `(${kCount} Kids)` : ''}`, 40, y);
    y += lineHeight;

    // Divider line
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(width - 40, y);
    ctx.stroke();
    y += 24;

    // Event details
    ctx.fillText(`Date: ${data.eventDate || DEFAULT_EVENT.eventDate}`, 40, y);
    y += lineHeight;

    ctx.fillText(`Time: ${data.eventTime || DEFAULT_EVENT.eventTime}`, 40, y);
    y += lineHeight;

    // Venue wrap
    const venueText = `Venue: ${data.eventVenue || DEFAULT_EVENT.eventVenue}`;
    wrapText(ctx, venueText, 40, y, width - 80, 20);

    // Footer bar
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, height - 40, width, 40);
    ctx.fillStyle = '#666666';
    ctx.font = '13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('दिगंबर जैन जिनालय, नल्लागंडला', width / 2, height - 16);

    // Download the image
    const link = document.createElement('a');
    link.download = `Vatsalya-Bhoj-Pass.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

// ============================================
// API CALLS
// ============================================

async function callApi(action, params = {}) {
    if (!API_URL || API_URL === 'add the url here') {
        throw new Error('API URL is not configured. Please check config.json.');
    }

    const url = new URL(API_URL, window.location.origin);
    url.searchParams.append('action', action);

    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            url.searchParams.append(key, params[key]);
        }
    });

    let response;
    try {
        response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors'
        });
    } catch (networkError) {
        if (API_URL.includes('script.google.com')) {
            throw new Error('Google Apps Script permission error. Ensure "Who has access" is set to "Anyone" in Google Apps Script deployment.');
        }
        throw new Error('Unable to connect to server. Check your network or server status.');
    }

    if (!response.ok) {
        if (response.status === 403 && API_URL.includes('script.google.com')) {
            throw new Error('Google Apps Script returned 403. Set "Who has access" to "Anyone" in deployment.');
        }
        throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
}

// ============================================
// UI HELPERS
// ============================================

function setButtonLoading(button, loading) {
    const textSpan = button.querySelector('.btn-text');
    const loadingSpan = button.querySelector('.btn-loading');

    if (textSpan && loadingSpan) {
        textSpan.classList.toggle('hidden', loading);
        loadingSpan.classList.toggle('hidden', !loading);
    }

    button.disabled = loading;
}

// ============================================
// INITIALIZE APP
// ============================================

document.addEventListener('DOMContentLoaded', init);
