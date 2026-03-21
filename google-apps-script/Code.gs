/**
 * Food Event Registration System
 * Google Apps Script - API & Email
 *
 * Setup Instructions:
 * 1. Create a new Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code and save
 * 4. Run setupSheet() once to create headers
 * 5. Deploy as Web App (Execute as: Me, Access: Anyone)
 * 6. Copy the Web App URL for the registration app
 *
 * For new events: Clear rows 2+ in the sheet (keep headers), tokens restart from 001
 */

// ============================================
// CONFIGURATION - Update these values
// ============================================
const CONFIG = {
  SHEET_NAME: 'Registrations',
  EVENT_NAME: 'श्री महावीर जन्म कल्याणक महोत्सव - वात्सल्य भोज',
  EVENT_DATE: 'Sunday, March 29, 2026',
  EVENT_TIME: '11:30 AM',
  EVENT_VENUE: 'Digambar Jain Jinalay, Nallagandla',
  ORGANIZER_EMAIL: '', // Optional: Add your email to get notifications
};

// Column mapping (1-indexed)
const COLS = {
  TIMESTAMP: 1,
  NAME: 2,
  PHONE: 3,
  EMAIL: 4,
  FAMILY_COUNT: 5,
  KIDS_COUNT: 6,
  TOKEN: 7,
  CHECKED_IN: 8,
  CHECKIN_TIME: 9
};

// ============================================
// SETUP FUNCTIONS - Run once
// ============================================

/**
 * Run this once to set up the sheet with headers
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  // Set headers
  const headers = [
    'Timestamp',
    'Name',
    'Phone',
    'Email',
    'Family Count',
    'Kids Count',
    'Token',
    'Checked In',
    'Check-in Time'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(COLS.TIMESTAMP, 150);
  sheet.setColumnWidth(COLS.NAME, 200);
  sheet.setColumnWidth(COLS.PHONE, 120);
  sheet.setColumnWidth(COLS.EMAIL, 200);
  sheet.setColumnWidth(COLS.TOKEN, 80);

  Logger.log('Sheet setup complete!');
}

/**
 * Run this to clear all data for a new event (keeps headers)
 */
function clearForNewEvent() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  Logger.log('Sheet cleared for new event. Token numbers will restart from 001.');
}

// ============================================
// WEB APP ENDPOINTS
// ============================================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action;
    let result;

    switch(action) {
      case 'register':
        result = registerUser(e.parameter);
        break;
      case 'lookup':
        result = lookupToken(e.parameter);
        break;
      case 'verify':
        result = verifyToken(e.parameter.token);
        break;
      case 'stats':
        result = getStats();
        break;
      case 'checkin':
        result = checkInUser(e.parameter.token);
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }

    output.setContent(JSON.stringify(result));
  } catch (error) {
    output.setContent(JSON.stringify({
      success: false,
      error: error.toString()
    }));
  }

  return output;
}

// ============================================
// REGISTRATION
// ============================================

function registerUser(params) {
  const { name, phone, email, familyCount, kidsCount } = params;

  // Validation
  if (!name || !phone) {
    return { success: false, error: 'Name and phone are required' };
  }

  // Check if phone already registered
  const existing = findByPhone(phone);
  if (existing) {
    return {
      success: false,
      error: 'This phone number is already registered',
      existingToken: existing.token
    };
  }

  // Generate simple sequential token
  const token = generateToken();
  const timestamp = new Date();

  // Save to sheet
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  sheet.appendRow([
    timestamp,
    name,
    phone,
    email || '',
    parseInt(familyCount) || 1,
    parseInt(kidsCount) || 0,
    token,
    false,
    ''
  ]);

  // Send confirmation email
  if (email) {
    sendConfirmationEmail(email, name, token);
  }

  // Notify organizer (optional)
  if (CONFIG.ORGANIZER_EMAIL) {
    notifyOrganizer(name, phone, familyCount, kidsCount, token);
  }

  return {
    success: true,
    token: token,
    message: 'Registration successful!',
    data: {
      name: name,
      phone: phone,
      email: email || null,
      familyCount: parseInt(familyCount) || 1,
      kidsCount: parseInt(kidsCount) || 0,
      eventName: CONFIG.EVENT_NAME,
      eventDate: CONFIG.EVENT_DATE,
      eventTime: CONFIG.EVENT_TIME,
      eventVenue: CONFIG.EVENT_VENUE
    }
  };
}

// ============================================
// TOKEN GENERATION - Simple sequential number
// ============================================

function generateToken() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const lastRow = sheet.getLastRow();

  let maxToken = 0;

  // Find the highest token number
  if (lastRow > 1) {
    const tokens = sheet.getRange(2, COLS.TOKEN, lastRow - 1, 1).getValues();
    for (let i = 0; i < tokens.length; i++) {
      const tokenNum = parseInt(tokens[i][0]);
      if (!isNaN(tokenNum) && tokenNum > maxToken) {
        maxToken = tokenNum;
      }
    }
  }

  // Next token is max + 1, padded to 3 digits
  const nextToken = maxToken + 1;
  return String(nextToken).padStart(3, '0');
}

// ============================================
// TOKEN LOOKUP
// ============================================

function lookupToken(params) {
  const { phone, email } = params;

  if (!phone && !email) {
    return { success: false, error: 'Please provide phone or email' };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowPhone = String(row[COLS.PHONE - 1]).trim();
    const rowEmail = String(row[COLS.EMAIL - 1]).trim().toLowerCase();

    const phoneMatch = phone && rowPhone === String(phone).trim();
    const emailMatch = email && rowEmail === String(email).trim().toLowerCase();

    if (phoneMatch || emailMatch) {
      return {
        success: true,
        data: {
          name: row[COLS.NAME - 1],
          token: String(row[COLS.TOKEN - 1]).padStart(3, '0'),
          familyCount: row[COLS.FAMILY_COUNT - 1],
          kidsCount: row[COLS.KIDS_COUNT - 1],
          eventName: CONFIG.EVENT_NAME,
          eventDate: CONFIG.EVENT_DATE,
          eventTime: CONFIG.EVENT_TIME,
          eventVenue: CONFIG.EVENT_VENUE
        }
      };
    }
  }

  return { success: false, error: 'No registration found with this phone/email' };
}

// ============================================
// TOKEN VERIFICATION (for event day)
// ============================================

function verifyToken(token) {
  if (!token) {
    return { success: false, error: 'Token is required' };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  // Normalize token for comparison
  const searchToken = String(token).trim();

  for (let i = 1; i < data.length; i++) {
    const rowToken = String(data[i][COLS.TOKEN - 1]).trim();
    if (rowToken === searchToken || rowToken === searchToken.padStart(3, '0')) {
      return {
        success: true,
        data: {
          name: data[i][COLS.NAME - 1],
          phone: data[i][COLS.PHONE - 1],
          familyCount: data[i][COLS.FAMILY_COUNT - 1],
          kidsCount: data[i][COLS.KIDS_COUNT - 1],
          checkedIn: data[i][COLS.CHECKED_IN - 1],
          checkInTime: data[i][COLS.CHECKIN_TIME - 1]
        }
      };
    }
  }

  return { success: false, error: 'Invalid token' };
}

// ============================================
// CHECK-IN (for event day)
// ============================================

function checkInUser(token) {
  if (!token) {
    return { success: false, error: 'Token is required' };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const searchToken = String(token).trim();

  for (let i = 1; i < data.length; i++) {
    const rowToken = String(data[i][COLS.TOKEN - 1]).trim();
    if (rowToken === searchToken || rowToken === searchToken.padStart(3, '0')) {
      // Check if already checked in
      if (data[i][COLS.CHECKED_IN - 1] === true) {
        return {
          success: false,
          error: 'Already checked in',
          checkInTime: data[i][COLS.CHECKIN_TIME - 1],
          name: data[i][COLS.NAME - 1]
        };
      }

      // Mark as checked in
      const checkInTime = new Date();
      sheet.getRange(i + 1, COLS.CHECKED_IN).setValue(true);
      sheet.getRange(i + 1, COLS.CHECKIN_TIME).setValue(checkInTime);

      return {
        success: true,
        message: 'Check-in successful!',
        data: {
          name: data[i][COLS.NAME - 1],
          familyCount: data[i][COLS.FAMILY_COUNT - 1],
          kidsCount: data[i][COLS.KIDS_COUNT - 1],
          checkInTime: checkInTime.toISOString()
        }
      };
    }
  }

  return { success: false, error: 'Invalid token' };
}

// ============================================
// STATISTICS
// ============================================

function getStats() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  let totalRegistrations = 0;
  let totalPeople = 0;
  let totalKids = 0;
  let checkedIn = 0;
  let checkedInPeople = 0;
  let checkedInKids = 0;

  for (let i = 1; i < data.length; i++) {
    totalRegistrations++;
    const familyCount = parseInt(data[i][COLS.FAMILY_COUNT - 1]) || 1;
    const kidsCount = parseInt(data[i][COLS.KIDS_COUNT - 1]) || 0;
    totalPeople += familyCount;
    totalKids += kidsCount;

    if (data[i][COLS.CHECKED_IN - 1] === true) {
      checkedIn++;
      checkedInPeople += familyCount;
      checkedInKids += kidsCount;
    }
  }

  return {
    success: true,
    data: {
      totalRegistrations,
      totalPeople,
      totalKids,
      checkedIn,
      checkedInPeople,
      checkedInKids,
      pending: totalRegistrations - checkedIn
    }
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function findByPhone(phone) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const cleanPhone = String(phone).trim();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COLS.PHONE - 1]).trim() === cleanPhone) {
      return {
        name: data[i][COLS.NAME - 1],
        token: data[i][COLS.TOKEN - 1]
      };
    }
  }

  return null;
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

function sendConfirmationEmail(email, name, token) {
  const subject = `Your Registration Token: ${token} - ${CONFIG.EVENT_NAME}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4CAF50; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Registration Confirmed!</h1>
      </div>

      <div style="padding: 30px; background: #f9f9f9;">
        <p>Hello <strong>${name}</strong>,</p>

        <p>Thank you for registering for <strong>${CONFIG.EVENT_NAME}</strong>!</p>

        <div style="background: white; border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #666;">Your Token Number</p>
          <h2 style="margin: 0; font-size: 48px; letter-spacing: 4px; color: #333;">${token}</h2>
        </div>

        <p><strong>Please save this token!</strong> You'll need to tell this number at the venue.</p>

        <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #4CAF50;">Event Details</h3>
          <p style="margin: 5px 0;"><strong>Event:</strong> ${CONFIG.EVENT_NAME}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${CONFIG.EVENT_DATE}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${CONFIG.EVENT_TIME}</p>
          <p style="margin: 5px 0;"><strong>Venue:</strong> ${CONFIG.EVENT_VENUE}</p>
        </div>

        <p style="color: #666; font-size: 14px;">
          If you forget your token, you can retrieve it anytime from the registration website using your phone number.
        </p>
      </div>

      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">This is an automated message. Please do not reply.</p>
      </div>
    </div>
  `;

  const textBody = `
Registration Confirmed!

Hello ${name},

Thank you for registering for ${CONFIG.EVENT_NAME}!

YOUR TOKEN NUMBER: ${token}

Please save this token! You'll need to tell this number at the venue.

Event Details:
- Event: ${CONFIG.EVENT_NAME}
- Date: ${CONFIG.EVENT_DATE}
- Time: ${CONFIG.EVENT_TIME}
- Venue: ${CONFIG.EVENT_VENUE}

If you forget your token, you can retrieve it from the registration website using your phone number.
  `;

  try {
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody
    });
    Logger.log(`Email sent to ${email}`);
  } catch (error) {
    Logger.log(`Failed to send email: ${error}`);
  }
}

function notifyOrganizer(name, phone, familyCount, kidsCount, token) {
  const subject = `New Registration #${token}: ${name}`;
  const body = `
New registration received:

Token: ${token}
Name: ${name}
Phone: ${phone}
Family Count: ${familyCount}
Kids (below 12): ${kidsCount || 0}
Time: ${new Date().toLocaleString()}
  `;

  try {
    MailApp.sendEmail(CONFIG.ORGANIZER_EMAIL, subject, body);
  } catch (error) {
    Logger.log(`Failed to notify organizer: ${error}`);
  }
}
