/**
 * Food Event Registration - Local Web Server & API (No Tokens)
 * Built with pure Node.js (Zero external dependencies)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'registrations.json');

const EVENT_CONFIG = {
  eventName: 'श्री महावीर जन्म कल्याणक महोत्सव - वात्सल्य भोज',
  eventDate: 'Sunday, October 04, 2026',
  eventTime: '12:00 PM',
  eventVenue: 'Aparna Sarovar Zenith ClubHouse, Behind Aparna Neo Mall, Nallagandla, Hyderabad'
};

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
}

function getRegistrations() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('Error reading registrations:', err);
    return [];
  }
}

function saveRegistrations(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving registrations:', err);
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// API Handler
function handleApi(req, res, parsedUrl) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const query = Object.fromEntries(parsedUrl.searchParams.entries());
  const action = query.action;
  const registrations = getRegistrations();

  function sendJson(status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  switch (action) {
    case 'register': {
      const name = (query.name || '').trim();
      const phone = (query.phone || '').trim();
      const email = (query.email || '').trim();
      const familyCount = parseInt(query.familyCount, 10) || 1;
      const kidsCount = parseInt(query.kidsCount, 10) || 0;

      if (!name || !phone) {
        return sendJson(200, { success: false, error: 'Name and phone are required' });
      }

      if (!/^[0-9]{10}$/.test(phone)) {
        return sendJson(200, { success: false, error: 'Please enter a valid 10-digit phone number' });
      }

      // Check if already registered
      const existing = registrations.find(r => String(r.phone).trim() === phone);
      if (existing) {
        return sendJson(200, {
          success: false,
          error: 'This phone number is already registered',
          isDuplicate: true
        });
      }

      const newEntry = {
        timestamp: new Date().toISOString(),
        name,
        phone,
        email: email || null,
        familyCount,
        kidsCount,
        attended: false,
        checkInTime: null
      };

      registrations.push(newEntry);
      saveRegistrations(registrations);

      return sendJson(200, {
        success: true,
        message: 'Registration successful!',
        data: {
          name,
          phone,
          email: email || null,
          familyCount,
          kidsCount,
          eventName: EVENT_CONFIG.eventName,
          eventDate: EVENT_CONFIG.eventDate,
          eventTime: EVENT_CONFIG.eventTime,
          eventVenue: EVENT_CONFIG.eventVenue
        }
      });
    }

    case 'checkin': {
      const phone = (query.phone || '').trim();
      if (!phone) {
        return sendJson(200, { success: false, error: 'Phone number is required' });
      }

      const match = registrations.find(r => String(r.phone).trim() === phone);
      if (!match) {
        return sendJson(200, { success: false, error: 'Participant not found' });
      }

      if (match.attended) {
        return sendJson(200, {
          success: false,
          error: 'Already marked attended',
          name: match.name,
          checkInTime: match.checkInTime
        });
      }

      match.attended = true;
      match.checkInTime = new Date().toISOString();
      saveRegistrations(registrations);

      return sendJson(200, {
        success: true,
        message: 'Marked attended successfully!',
        data: {
          name: match.name,
          familyCount: match.familyCount,
          kidsCount: match.kidsCount,
          checkInTime: match.checkInTime
        }
      });
    }

    case 'stats': {
      let totalRegistrations = registrations.length;
      let totalPeople = 0;
      let totalKids = 0;
      let attended = 0;

      for (const r of registrations) {
        const fCount = parseInt(r.familyCount, 10) || 1;
        const kCount = parseInt(r.kidsCount, 10) || 0;
        totalPeople += fCount;
        totalKids += kCount;

        if (r.attended) {
          attended++;
        }
      }

      return sendJson(200, {
        success: true,
        data: {
          totalRegistrations,
          totalPeople,
          totalKids,
          attended,
          pending: totalRegistrations - attended
        }
      });
    }

    case 'list': {
      return sendJson(200, {
        success: true,
        data: registrations
      });
    }

    case 'export': {
      const headers = ['Timestamp', 'Name', 'Phone', 'Email', 'Family Count', 'Kids Count', 'Attended', 'Check-in Time'];
      const rows = registrations.map(r => [
        `"${r.timestamp || ''}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${r.phone || ''}"`,
        `"${r.email || ''}"`,
        r.familyCount || 1,
        r.kidsCount || 0,
        r.attended ? 'YES' : 'NO',
        `"${r.checkInTime || ''}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="event-participants.csv"'
      });
      res.end(csvContent);
      return;
    }

    default:
      return sendJson(400, { success: false, error: 'Invalid action' });
  }
}

// Static File Server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/api') {
    return handleApi(req, res, parsedUrl);
  }

  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Event Registration Server running at http://localhost:${PORT}`);
});
