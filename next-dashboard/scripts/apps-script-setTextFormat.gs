// =============================================================================
// Apps Script snippet — add this to your Apps Script Web App project.
//
// HOW TO INSTALL:
//   1. Open the spreadsheet PRO_TABULKA_DB in Google Drive
//   2. Extensions → Apps Script
//   3. Paste the handleSetTextFormat function below into Code.gs
//   4. In the main `doPost` switch/router, add a case for op === 'setTextFormat':
//        case 'setTextFormat': return jsonOk(handleSetTextFormat(payload));
//   5. Deploy → Manage deployments → New version → Deploy
//   6. Re-run: npm run sheets:init
//
// WHAT IT DOES:
//   Sets the number format of an entire column to "@" (Plain Text), so Sheets
//   won't auto-parse values that look like dates or numbers. Critical for the
//   Month.id column ("2026-03" was being silently converted to a datetime cell).
// =============================================================================

function handleSetTextFormat(payload) {
  var tab = payload.tab;
  var column = payload.column;

  if (!tab || !column) {
    throw new Error('setTextFormat requires { tab, column }');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tab);
  if (!sheet) throw new Error('Tab not found: ' + tab);

  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('Tab is empty: ' + tab);

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var colIndex = headers.indexOf(column);
  if (colIndex === -1) throw new Error('Column not found in ' + tab + ': ' + column);

  // Format the whole column (all rows, including future inserts up to max rows)
  var range = sheet.getRange(1, colIndex + 1, sheet.getMaxRows(), 1);
  range.setNumberFormat('@');

  return { tab: tab, column: column, columnIndex: colIndex + 1 };
}
