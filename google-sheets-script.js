/**
 * ==============================================================================
 * MALLIKA RAO — HIGH PERFORMANCE COACHING & LIFE MENTORSHIP
 * Google Apps Script: Lead Ingestion & Real-Time Google Sheets Webhook
 * ==============================================================================
 * 
 * HOW TO DEPLOY IN 60 SECONDS:
 * 1. Open your Google Sheet (create a new one at https://sheets.new).
 * 2. In the top menu, go to: Extensions > Apps Script.
 * 3. Delete any existing code and PASTE this entire file.
 * 4. (Optional) Set your email below if you want instant email alerts on new bookings.
 * 5. Click "Deploy" (top right) > "New deployment".
 * 6. Select type: "Web app".
 * 7. Configuration:
 *    - Description: "HPC Consultation Leads Webhook"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone"  <-- CRITICAL for public form submissions
 * 8. Click "Deploy", authorize permissions, and COPY the Web App URL:
 *    (e.g., https://script.google.com/macros/s/AKfycb.../exec)
 * 9. Paste this URL into the HPC CRM Portal (under "Google Sheets Integration") 
 *    or set GOOGLE_SHEETS_WEBHOOK_URL in your server/.env file.
 * ==============================================================================
 */

// CONFIGURATION: Set email for instant notification alerts (leave empty to disable)
var NOTIFICATION_EMAIL = "coachmallika@gmail.com"; // Change to your preferred email address

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Mallika Rao HPC Google Sheets Webhook is operational.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 10 seconds for other processes to finish
  lock.tryLock(10000);

  try {
    var sheet = getOrCreateSheet();
    var payload = {};

    // 1. Parse incoming payload (supports raw JSON, text/plain, or form-urlencoded)
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    // 2. Format Timestamp
    var now = new Date();
    var formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    var refId = payload.refId || ("HPC-" + Math.floor(100000 + Math.random() * 900000));
    var fullName = payload.fullName || "";
    var email = payload.email || "";
    var phone = payload.phone || "";
    var designation = payload.designation || "";
    var company = payload.company || "";
    var linkedin = payload.linkedin || "";
    var transitionCategory = payload.transitionCategory || "General Inquiry";
    var currentChallenge = payload.currentChallenge || "";
    var investmentReadiness = payload.investmentReadiness || "";
    var bookedDate = payload.bookedDate || "";
    var bookedTime = payload.bookedTime || "";
    var status = payload.status || "New";
    var notes = payload.notes || "";

    // 3. Append Row
    var newRow = [
      formattedDate,
      refId,
      fullName,
      email,
      phone,
      designation,
      company,
      linkedin,
      transitionCategory,
      currentChallenge,
      investmentReadiness,
      bookedDate,
      bookedTime,
      status,
      notes
    ];

    sheet.appendRow(newRow);

    // Apply row formatting
    var lastRow = sheet.getLastRow();
    var range = sheet.getRange(lastRow, 1, 1, newRow.length);
    range.setFontFamily("Arial");
    range.setFontSize(10);
    range.setVerticalAlignment("middle");

    // Alternate row coloring
    if (lastRow % 2 === 0) {
      range.setBackground("#fbf9f6");
    } else {
      range.setBackground("#ffffff");
    }

    // 4. Send Email Alert (if email configured)
    if (NOTIFICATION_EMAIL && NOTIFICATION_EMAIL.indexOf("@") !== -1 && fullName) {
      try {
        var subject = "✦ New 1:1 Consultation Booking: " + fullName + " (" + refId + ")";
        var body = [
          "You have received a new confidential 1:1 consultation application.",
          "",
          "CLIENT DETAILS:",
          "• Name: " + fullName,
          "• Email: " + email,
          "• Phone: " + phone,
          "• Designation: " + designation,
          "• Company: " + company,
          "• LinkedIn: " + linkedin,
          "",
          "CONSULTATION DETAILS:",
          "• Reference ID: " + refId,
          "• Preferred Date: " + bookedDate,
          "• Preferred Time: " + bookedTime,
          "• Transition Focus: " + transitionCategory,
          "• Readiness: " + investmentReadiness,
          "",
          "CURRENT CHALLENGE & CROSSROADS:",
          currentChallenge,
          "",
          "Open your Google Sheet to view and update this lead: " + SpreadsheetApp.getActiveSpreadsheet().getUrl()
        ].join("\n");

        MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
      } catch (mailErr) {
        Logger.log("Email notification notice: " + mailErr.toString());
      }
    }

    // Return Success JSON
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      refId: refId,
      message: "Lead successfully recorded into Google Sheet.",
      timestamp: formattedDate
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error in doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Gets existing 'Consultation Leads' sheet or initializes with styled headers
 */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Consultation Leads";
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName, 0);
    initializeHeaders(sheet);
  } else if (sheet.getLastRow() === 0) {
    initializeHeaders(sheet);
  }

  return sheet;
}

/**
 * Applies professional header styling with luxury dark & gold tones
 */
function initializeHeaders(sheet) {
  var headers = [
    "Timestamp",
    "Reference ID",
    "Full Name",
    "Email",
    "Phone",
    "Designation",
    "Company",
    "LinkedIn",
    "Transition Focus",
    "Current Challenge",
    "Investment Readiness",
    "Booked Date",
    "Booked Time",
    "Lead Status",
    "Coach Notes"
  ];

  sheet.appendRow(headers);

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#1a1918"); // Deep luxury espresso
  headerRange.setFontColor("#f4ede4"); // Warm silk cream
  headerRange.setFontWeight("bold");
  headerRange.setFontSize(11);
  headerRange.setFontFamily("Arial");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);

  // Freeze header row
  sheet.setFrozenRows(1);

  // Set initial column widths
  sheet.setColumnWidth(1, 160); // Timestamp
  sheet.setColumnWidth(2, 120); // Ref ID
  sheet.setColumnWidth(3, 180); // Full Name
  sheet.setColumnWidth(4, 200); // Email
  sheet.setColumnWidth(5, 140); // Phone
  sheet.setColumnWidth(6, 160); // Designation
  sheet.setColumnWidth(7, 160); // Company
  sheet.setColumnWidth(8, 160); // LinkedIn
  sheet.setColumnWidth(9, 180); // Transition Focus
  sheet.setColumnWidth(10, 320); // Current Challenge
  sheet.setColumnWidth(11, 200); // Investment Readiness
  sheet.setColumnWidth(12, 120); // Booked Date
  sheet.setColumnWidth(13, 160); // Booked Time
  sheet.setColumnWidth(14, 120); // Status
  sheet.setColumnWidth(15, 260); // Coach Notes
}

/**
 * Helper function: Run this from Apps Script editor to manually format or test
 */
function testSetup() {
  var sheet = getOrCreateSheet();
  Logger.log("Sheet initialized at: " + sheet.getName());
}
