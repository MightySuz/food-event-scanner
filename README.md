# Food Event Registration System

A free, simple web app for community food event registration with automatic token generation.

## Features

- Custom branded registration form
- Simple sequential token numbers (001, 002, 003...)
- Token sent via email (optional)
- "Find My Token" lookup feature
- Save token as image to phone
- Offline verification list for event day
- Reusable for future events

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   Registration App  │────────▶│   Google Apps Script │
│   (GitHub Pages)    │◀────────│   (API + Email)      │
│                     │  Token  │                      │
│  - Register form    │         │  - Store in Sheet    │
│  - Find My Token    │         │  - Send email        │
│  - Save to phone    │         │  - Generate token    │
└─────────────────────┘         └──────────────────────┘
                                          │
                                          ▼
                                ┌──────────────────────┐
                                │    Google Sheet      │
                                │  (Download as PDF    │
                                │   for offline list)  │
                                └──────────────────────┘
```

## User Flow

1. User visits your registration link
2. Fills out the form (name, phone, email, family count)
3. Clicks "Register Now"
4. Token number displayed (e.g., 001, 002...)
5. Email sent with token (if email provided)
6. User can save token as image to phone
7. On event day: Tell token number at venue

## Cost: $0

All components are free:
- GitHub Pages: Free hosting
- Google Apps Script: Free API
- Google Sheets: Free database
- Gmail (via Apps Script): Free email

---

## Setup Instructions

### Step 1: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it "Event Registrations"

### Step 2: Add Apps Script

1. In your Google Sheet, go to **Extensions** → **Apps Script**
2. Delete any existing code in `Code.gs`
3. Copy the entire contents of `google-apps-script/Code.gs` and paste it
4. **Update the CONFIG section** at the top with your event details:

```javascript
const CONFIG = {
  SHEET_NAME: 'Registrations',
  EVENT_NAME: 'Your Event Name',
  EVENT_DATE: 'April 15, 2025',
  EVENT_TIME: '1:00 PM',
  EVENT_VENUE: 'Your Venue Address',
  ORGANIZER_EMAIL: 'your@email.com', // Optional
};
```

5. Save the project (Ctrl+S or Cmd+S)

### Step 3: Set Up Sheet

1. In the Apps Script editor, select `setupSheet` from the function dropdown
2. Click **Run**
3. Grant permissions when prompted (click "Advanced" → "Go to project")
4. This creates the "Registrations" sheet with headers

### Step 4: Deploy as Web App

1. In Apps Script, click **Deploy** → **New deployment**
2. Click the gear icon → select **Web app**
3. Configure:
   - **Description**: "Event Registration API"
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. **Copy the Web App URL** - you'll need this!

### Step 5: Host the Registration App

#### Using GitHub Pages

1. Fork or clone this repository
2. Go to repository **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main**, Folder: **/ (root)**
5. Click **Save**
6. Your app will be at: `https://yourusername.github.io/food-event-scanner/`

### Step 6: Configure the App

1. Open your hosted registration app
2. Click **Admin Settings** at the bottom
3. Paste the Google Apps Script Web App URL from Step 4
4. Click **Save**

---

## Running Future Events

For each new event:

### Option 1: Clear the Sheet (Recommended)
1. Open Google Sheet
2. In Apps Script, run the `clearForNewEvent()` function
3. Update CONFIG with new event details
4. Deploy a new version of the web app
5. Token numbers restart from 001

### Option 2: Manual Clear
1. Open Google Sheet
2. Delete all rows except header (row 1)
3. Update event details in Apps Script CONFIG
4. Deploy a new version

---

## Customization

### Update Event Details

Edit the CONFIG section in `Code.gs`:

```javascript
const CONFIG = {
  SHEET_NAME: 'Registrations',
  EVENT_NAME: 'Community Potluck Dinner',
  EVENT_DATE: 'December 25, 2025',
  EVENT_TIME: '6:00 PM',
  EVENT_VENUE: '123 Main Street, Community Center',
  ORGANIZER_EMAIL: 'organizer@example.com',
};
```

After editing, deploy a **new version** of the web app.

### Update Website Header

Edit `index.html`:

```html
<header class="app-header">
    <h1>Your Event Name</h1>
    <p class="event-date">Your Date | Your Time</p>
</header>
```

### Change Colors

Edit `styles.css` - modify the CSS variables at the top:

```css
:root {
    --primary: #4CAF50;      /* Main color */
    --primary-dark: #388E3C; /* Darker shade */
}
```

---

## Event Day: Offline Verification

### Prepare Before Event

1. Open your Google Sheet
2. Go to **File** → **Download** → **PDF** or **Excel**
3. Print or save to your phone/tablet
4. Use this list to verify tokens at the venue

### At the Venue

When someone arrives:
1. Ask for their token number (e.g., "What's your token?")
2. Find it in your printed/downloaded list
3. Mark them as attended

---

## API Reference

### Register User
```
GET {web_app_url}?action=register&name=John&phone=9876543210&email=john@example.com&familyCount=3
```

### Lookup Token
```
GET {web_app_url}?action=lookup&phone=9876543210
```

### Verify Token
```
GET {web_app_url}?action=verify&token=001
```

### Get Statistics
```
GET {web_app_url}?action=stats
```

---

## Sheet Structure

| Column | Header | Description |
|--------|--------|-------------|
| A | Timestamp | Registration time |
| B | Name | Full name |
| C | Phone | Phone number |
| D | Email | Email (optional) |
| E | Family Count | Number of people |
| F | Token | Sequential number (001, 002...) |
| G | Checked In | Check-in status |
| H | Check-in Time | When checked in |

---

## Troubleshooting

### "Connection Error" message
- Verify the API URL is correct (must start with `https://script.google.com/`)
- Re-deploy the Apps Script if needed
- Check internet connection

### Emails not sending
- Google Apps Script has daily email limits (100/day for free accounts)
- Check the email address format
- Look at Apps Script execution logs for errors

### Token not found during lookup
- Ensure phone number matches exactly
- Try using email instead
- Check the Google Sheet directly

---

## File Structure

```
food-event-scanner/
├── google-apps-script/
│   └── Code.gs              # API + Email logic
├── index.html               # Registration UI
├── app.js                   # Form handling + save feature
├── styles.css               # Mobile-friendly styles
└── README.md                # This file
```

---

## License

Free to use for community events.
