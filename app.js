/**
 * Food Event Registration App
 * Handles registration, token lookup, and save to image
 */

// ============================================
// CONFIGURATION - API URL is hardcoded
// ============================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwTeYOnT07HPNMgILXoXwQpC9_8_I8_u0sE4VNnKUhHjdJoJq_ELhYGpqr3ucUIT06-oA/exec';

const state = {
    currentToken: null,
    currentData: null
};

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    registerTab: document.getElementById('registerTab'),
    lookupTab: document.getElementById('lookupTab'),

    // Registration form
    registrationForm: document.getElementById('registrationForm'),
    submitBtn: document.getElementById('submitBtn'),
    nameInput: document.getElementById('name'),
    phoneInput: document.getElementById('phone'),
    emailInput: document.getElementById('email'),
    familyCountSelect: document.getElementById('familyCount'),
    kidsCountSelect: document.getElementById('kidsCount'),

    // Lookup form
    lookupForm: document.getElementById('lookupForm'),
    lookupBtn: document.getElementById('lookupBtn'),
    lookupPhoneInput: document.getElementById('lookupPhone'),
    lookupEmailInput: document.getElementById('lookupEmail'),

    // Result section
    resultSection: document.getElementById('resultSection'),
    resultTitle: document.getElementById('resultTitle'),
    tokenDisplay: document.getElementById('tokenDisplay'),
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

function init() {
    // Bind events
    bindEvents();
}

function bindEvents() {
    // Tab navigation
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Registration form
    elements.registrationForm.addEventListener('submit', handleRegistration);

    // Lookup form
    elements.lookupForm.addEventListener('submit', handleLookup);

    // Save button
    elements.saveImageBtn.addEventListener('click', saveAsImage);
    elements.newRegistrationBtn.addEventListener('click', resetToForm);

    // Error handling
    elements.tryAgainBtn.addEventListener('click', resetToForm);
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabName) {
    // Update tab buttons
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    elements.registerTab.classList.toggle('active', tabName === 'register');
    elements.lookupTab.classList.toggle('active', tabName === 'lookup');

    // Hide result/error sections
    elements.resultSection.classList.add('hidden');
    elements.errorSection.classList.add('hidden');
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

    // Show loading state
    setButtonLoading(elements.submitBtn, true);

    try {
        const response = await callApi('register', formData);

        if (response.success) {
            state.currentToken = response.token;
            state.currentData = response.data;
            showSuccess(response.token, response.data, !!formData.email);
        } else {
            // Check if already registered
            if (response.existingToken) {
                showError(
                    'Already Registered',
                    `This phone number is already registered. Your token is: ${response.existingToken}`
                );
            } else {
                showError('Registration Failed', response.error);
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('Connection Error', 'Unable to connect to server. Please check your internet connection.');
    } finally {
        setButtonLoading(elements.submitBtn, false);
    }
}

// ============================================
// TOKEN LOOKUP
// ============================================

async function handleLookup(e) {
    e.preventDefault();

    const phone = elements.lookupPhoneInput.value.trim();
    const email = elements.lookupEmailInput.value.trim();

    if (!phone && !email) {
        showError('Validation Error', 'Please enter your phone number or email');
        return;
    }

    // Show loading state
    setButtonLoading(elements.lookupBtn, true);

    try {
        const response = await callApi('lookup', { phone, email });

        if (response.success) {
            state.currentToken = response.data.token;
            state.currentData = response.data;
            showSuccess(response.data.token, response.data, false, true);
        } else {
            showError('Not Found', response.error);
        }
    } catch (error) {
        console.error('Lookup error:', error);
        showError('Connection Error', 'Unable to connect to server. Please check your internet connection.');
    } finally {
        setButtonLoading(elements.lookupBtn, false);
    }
}

// ============================================
// DISPLAY RESULTS
// ============================================

function showSuccess(token, data, emailSent = false, isLookup = false) {
    // Hide form tabs
    elements.registerTab.classList.remove('active');
    elements.lookupTab.classList.remove('active');
    elements.errorSection.classList.add('hidden');

    // Update result content
    elements.resultTitle.textContent = isLookup ? 'Token Found!' : 'Registration Successful!';
    elements.tokenDisplay.textContent = token;

    if (data.eventDate) elements.eventDate.textContent = data.eventDate;
    if (data.eventTime) elements.eventTime.textContent = data.eventTime;
    if (data.eventVenue) elements.eventVenue.textContent = data.eventVenue;

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
    elements.lookupForm.reset();

    // Hide result/error sections
    elements.resultSection.classList.add('hidden');
    elements.errorSection.classList.add('hidden');

    // Show register tab
    switchTab('register');

    // Clear state
    state.currentToken = null;
    state.currentData = null;
}

// ============================================
// SAVE AS IMAGE
// ============================================

function saveAsImage() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');

    // Set canvas size (optimized for phone screens)
    const width = 400;
    const height = 450;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Header background
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, width, 80);

    // Header text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Event Pass', width / 2, 50);

    // Token label
    ctx.fillStyle = '#666666';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('Your Token Number', width / 2, 130);

    // Token number (large)
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 72px Arial, sans-serif';
    ctx.fillText(state.currentToken, width / 2, 200);

    // Divider line
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 240);
    ctx.lineTo(width - 40, 240);
    ctx.stroke();

    // Event details
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333333';
    ctx.font = '16px Arial, sans-serif';

    const data = state.currentData || {};
    let y = 280;
    const lineHeight = 35;

    if (data.name) {
        ctx.fillText(`Name: ${data.name}`, 40, y);
        y += lineHeight;
    }

    ctx.fillText(`Date: ${data.eventDate || 'Sunday, March 29, 2026'}`, 40, y);
    y += lineHeight;

    ctx.fillText(`Time: ${data.eventTime || '11:30 AM'}`, 40, y);
    y += lineHeight;

    ctx.fillText(`Venue: ${data.eventVenue || 'Digambar Jain Jinalay'}`, 40, y);

    // Footer
    ctx.fillStyle = '#999999';
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tell this number at the venue', width / 2, height - 25);

    // Download the image
    const link = document.createElement('a');
    link.download = `token-${state.currentToken}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ============================================
// API CALLS
// ============================================

async function callApi(action, params = {}) {
    const url = new URL(API_URL);
    url.searchParams.append('action', action);

    Object.keys(params).forEach(key => {
        if (params[key]) {
            url.searchParams.append(key, params[key]);
        }
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
