/**
 * Food Event Participant Registration System
 * Google Apps Script - API & Email
 *
 * Setup Instructions:
 * 1. Open Google Sheet > Extensions > Apps Script
 * 2. Replace Code.gs with this code and save
 * 3. Deploy > Manage deployments > Edit > New version > Deploy
 */

// ============================================
// CONFIGURATION - Update these values
// ============================================
const CONFIG = {
  SHEET_NAME: 'Registrations',
  EVENT_NAME: 'नालागंडला क्षमावाणी कार्यक्रम - वात्सल्य भोज',
  EVENT_DATE: 'Sunday, October 04, 2026',
  EVENT_TIME: '09:30 AM',
  EVENT_VENUE: 'Aparna Sarovar Zenith ClubHouse, Behind Aparna Neo Mall, Nallagandla, Hyderabad',
  ORGANIZER_EMAIL: 'djj.nallagandla@gmail.com', // Optional: Add your email to get notifications
};

// Column mapping (1-indexed)
const COLS = {
  TIMESTAMP: 1,
  NAME: 2,
  PHONE: 3,
  EMAIL: 4,
  FAMILY_COUNT: 5,
  KIDS_COUNT: 6,
  ATTENDED: 7,
  CHECKIN_TIME: 8
};

// ============================================
// SETUP FUNCTIONS - Run once
// ============================================

/**
 * Run this once to set up the sheet with headers and authorize permissions
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  // Set headers (No Token)
  const headers = [
    'Timestamp',
    'Name',
    'Phone',
    'Email',
    'Family Count',
    'Kids Count',
    'Attended',
    'Check-in Time'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 160); // Timestamp
  sheet.setColumnWidth(2, 200); // Name
  sheet.setColumnWidth(3, 130); // Phone
  sheet.setColumnWidth(4, 200); // Email
  sheet.setColumnWidth(5, 110); // Family Count
  sheet.setColumnWidth(6, 110); // Kids Count
  sheet.setColumnWidth(7, 90);  // Attended
  sheet.setColumnWidth(8, 160); // Check-in Time

  // Trigger authorization for MailApp
  try {
    const quota = MailApp.getRemainingDailyQuota();
    Logger.log('Email daily quota remaining: ' + quota);
  } catch (e) {
    Logger.log('MailApp check: ' + e);
  }

  Logger.log('Sheet setup complete!');
}

/**
 * Run this function in Apps Script to verify/grant Email permissions
 */
function testEmailAndPermissions() {
  const quota = MailApp.getRemainingDailyQuota();
  Logger.log('Mail permission active! Remaining daily emails: ' + quota);
  
  if (CONFIG.ORGANIZER_EMAIL) {
    MailApp.sendEmail(
      CONFIG.ORGANIZER_EMAIL,
      'Test Email - Food Event Scanner',
      'Email service is connected and working!'
    );
    Logger.log('Sent test email to: ' + CONFIG.ORGANIZER_EMAIL);
  }
}

/**
 * Run this to clear all registrations for a new event (keeps headers)
 */
function clearForNewEvent() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  Logger.log('Sheet cleared for new event.');
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
    const action = (e && e.parameter && e.parameter.action) || 'stats';
    let result;

    switch(action) {
      case 'register':
        result = registerUser(e.parameter);
        break;
      case 'stats':
        result = getStats();
        break;
      case 'checkin':
        result = checkInUser(e.parameter.phone || e.parameter.token);
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
// REGISTRATION (NO TOKEN)
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
      isDuplicate: true
    };
  }

  const timestamp = new Date();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);

  // Check if existing sheet has a "Token" column to remain backward-compatible
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const hasTokenCol = headerRow.some(function(h) {
    return String(h).toLowerCase().indexOf('token') !== -1;
  });

  const rowData = [
    timestamp,
    name,
    String(phone).trim(),
    email || '',
    parseInt(familyCount, 10) || 1,
    parseInt(kidsCount, 10) || 0
  ];

  if (hasTokenCol) {
    rowData.push(''); // Leave Token column empty if it exists
  }

  rowData.push(false); // Attended
  rowData.push('');    // Check-in Time

  sheet.appendRow(rowData);
  SpreadsheetApp.flush();

  // Send confirmation email if email was provided (safely isolated)
  if (email) {
    try {
      sendConfirmationEmail(email, name, familyCount, kidsCount);
    } catch (e) {
      Logger.log('Attendee email notice: ' + e);
    }
  }

  // Notify organizer (safely isolated)
  if (CONFIG.ORGANIZER_EMAIL) {
    try {
      notifyOrganizer(name, phone, familyCount, kidsCount);
    } catch (e) {
      Logger.log('Organizer email notice: ' + e);
    }
  }

  return {
    success: true,
    message: 'Registration successful!',
    data: {
      name: name,
      phone: phone,
      email: email || null,
      familyCount: parseInt(familyCount, 10) || 1,
      kidsCount: parseInt(kidsCount, 10) || 0,
      eventName: CONFIG.EVENT_NAME,
      eventDate: CONFIG.EVENT_DATE,
      eventTime: CONFIG.EVENT_TIME,
      eventVenue: CONFIG.EVENT_VENUE
    }
  };
}

// ============================================
// CHECK-IN (FOR VENUE)
// ============================================

function checkInUser(phone) {
  if (!phone) {
    return { success: false, error: 'Phone number is required' };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const cleanPhone = String(phone).trim();

  // Find attended column index (default 7 or 8)
  const headers = data[0];
  let attendedColIdx = 7;
  let checkinTimeColIdx = 8;
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c]).toLowerCase();
    if (h.indexOf('attend') !== -1 || h.indexOf('checked') !== -1) {
      attendedColIdx = c + 1;
    }
    if (h.indexOf('check-in time') !== -1 || h.indexOf('checkin') !== -1) {
      checkinTimeColIdx = c + 1;
    }
  }

  for (let i = 1; i < data.length; i++) {
    const rowPhone = String(data[i][COLS.PHONE - 1]).trim();
    if (rowPhone === cleanPhone) {
      if (data[i][attendedColIdx - 1] === true) {
        return {
          success: false,
          error: 'Already marked attended',
          name: data[i][COLS.NAME - 1]
        };
      }

      const checkInTime = new Date();
      sheet.getRange(i + 1, attendedColIdx).setValue(true);
      sheet.getRange(i + 1, checkinTimeColIdx).setValue(checkInTime);

      return {
        success: true,
        message: 'Marked attended successfully!',
        data: {
          name: data[i][COLS.NAME - 1],
          familyCount: data[i][COLS.FAMILY_COUNT - 1],
          kidsCount: data[i][COLS.KIDS_COUNT - 1]
        }
      };
    }
  }

  return { success: false, error: 'Participant not found' };
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
  let attended = 0;

  for (let i = 1; i < data.length; i++) {
    totalRegistrations++;
    const familyCount = parseInt(data[i][COLS.FAMILY_COUNT - 1], 10) || 1;
    const kidsCount = parseInt(data[i][COLS.KIDS_COUNT - 1], 10) || 0;
    totalPeople += familyCount;
    totalKids += kidsCount;

    // Check attended (column 7 or 8)
    if (data[i][6] === true || data[i][7] === true) {
      attended++;
    }
  }

  return {
    success: true,
    data: {
      totalRegistrations: totalRegistrations,
      totalPeople: totalPeople,
      totalKids: totalKids,
      attended: attended,
      pending: totalRegistrations - attended
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
        phone: data[i][COLS.PHONE - 1]
      };
    }
  }

  return null;
}

// ============================================
// EMAIL FUNCTIONS (NO TOKEN)
// ============================================

function sendConfirmationEmail(email, name, familyCount, kidsCount) {
  const subject = `Registration Confirmed - ${CONFIG.EVENT_NAME}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #4CAF50; color: white; padding: 22px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Registration Confirmed!</h1>
        <p style="margin: 6px 0 0 0; font-size: 16px;">वात्सल्य भोज नामांकन पुष्टि</p>
      </div>

      <div style="padding: 25px; background: #f9f9f9;">
        <p style="font-size: 16px;">Jai Jinendra <strong>${name}</strong>,</p>

        <p>Thank you for registering for <strong>${CONFIG.EVENT_NAME}</strong>. Your participant record has been recorded!</p>

        <div style="background: white; border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #4CAF50;">Participant Summary</h3>
          <p style="margin: 6px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 6px 0;"><strong>Headcount:</strong> ${familyCount || 1} Person(s) ${kidsCount > 0 ? `(${kidsCount} Kids)` : ''}</p>
        </div>

        <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #e0e0e0;">
          <h3 style="margin: 0 0 12px 0; color: #333;">Event Details</h3>
          <p style="margin: 6px 0;"><strong>Event:</strong> ${CONFIG.EVENT_NAME}</p>
          <p style="margin: 6px 0;"><strong>Date:</strong> ${CONFIG.EVENT_DATE}</p>
          <p style="margin: 6px 0;"><strong>Time:</strong> ${CONFIG.EVENT_TIME}</p>
          <p style="margin: 6px 0;"><strong>Venue:</strong> ${CONFIG.EVENT_VENUE}</p>
        </div>

        <p style="color: #666; font-size: 13px;">
          On event day, please share your registered name or phone number at the welcome desk.
        </p>
      </div>

      <div style="background: #333; color: white; padding: 14px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">दिगंबर जैन जिनालय, नल्लागंडला - This is an automated message.</p>
      </div>
    </div>
  `;

  const textBody = `
Registration Confirmed!
Jai Jinendra ${name},

Thank you for registering for ${CONFIG.EVENT_NAME}.
Your participant record has been recorded!

Participant Summary:
- Name: ${name}
- Headcount: ${familyCount || 1} Person(s) ${kidsCount > 0 ? `(${kidsCount} Kids)` : ''}

Event Details:
- Event: ${CONFIG.EVENT_NAME}
- Date: ${CONFIG.EVENT_DATE}
- Time: ${CONFIG.EVENT_TIME}
- Venue: ${CONFIG.EVENT_VENUE}
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

function notifyOrganizer(name, phone, familyCount, kidsCount) {
  const subject = `New Registration: ${name} (${familyCount} People)`;
  const body = `
New registration received:

Name: ${name}
Phone: ${phone}
Total Headcount: ${familyCount}
Kids (below 12): ${kidsCount || 0}
Time: ${new Date().toLocaleString()}
  `;

  try {
    MailApp.sendEmail(CONFIG.ORGANIZER_EMAIL, subject, body);
  } catch (error) {
    Logger.log(`Failed to notify organizer: ${error}`);
  }
}
