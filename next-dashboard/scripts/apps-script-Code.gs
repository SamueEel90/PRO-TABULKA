// =============================================================================
// PRO_TABULKA_DB — Apps Script Web App
//
// Deploy: Deploy → New deployment → Type: Web app
//   Execute as: Me
//   Who has access: Anyone (auth via SHARED_SECRET below)
//
// After every code change: Deploy → Manage deployments → Edit → New version
// =============================================================================

// IMPORTANT: must match SHEETS_APPS_SCRIPT_SECRET in Vercel env
var SHARED_SECRET = 'PUT_YOUR_SECRET_HERE';

// -----------------------------------------------------------------------------
// HTTP entry points
// -----------------------------------------------------------------------------

// Browser-friendly health check. Open the Web App URL in a browser → should
// see {"ok":true,"service":"PRO_TABULKA_DB",...}. Does NOT require the secret —
// returns no data, just confirms the deployment is live.
function doGet(e) {
  return jsonOut({
    ok: true,
    service: 'PRO_TABULKA_DB',
    time: new Date().toISOString(),
    message: 'Use POST with { secret, op, ...args } for data operations.',
  });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    if (payload.secret !== SHARED_SECRET) {
      return jsonOut({ ok: false, error: 'Unauthorized' });
    }

    var op = payload.op;

    // Writes are serialized via LockService so concurrent requests cannot
    // interleave (Sheets has no transactions). Reads stay lock-free.
    // bumpMeta is technically a write but takes the lock itself; only listed
    // here so callers can't accidentally bypass the serialization.
    var WRITE_OPS = { ensureTabs: 1, append: 1, bulkAppend: 1, updateById: 1, deleteById: 1, bulkReplace: 1, setTextFormat: 1 };
    if (WRITE_OPS[op]) {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) {
        return jsonOut({ ok: false, error: 'Sheets is busy (lock timeout). Try again.' });
      }
      try {
        return dispatchOp(op, payload);
      } finally {
        lock.releaseLock();
      }
    }
    return dispatchOp(op, payload);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message || err) });
  }
}

function dispatchOp(op, payload) {
  switch (op) {
    case 'ping':           return jsonOut({ ok: true, time: new Date().toISOString() });
    case 'modifiedTime':   return jsonOut({ ok: true, modifiedTime: handleModifiedTime() });
    case 'modifiedTimes':  return jsonOut({ ok: true, modifiedTimes: handleModifiedTimes() });
    case 'listTabs':       return jsonOut({ ok: true, tabs: handleListTabs() });
    case 'ensureTabs':     handleEnsureTabs(payload); return jsonOut({ ok: true });
    case 'read':           return jsonOut({ ok: true, data: handleRead(payload) });
    case 'readAll':        return jsonOut({ ok: true, data: handleReadAll(payload) });
    case 'append':         handleAppend(payload); return jsonOut({ ok: true });
    case 'bulkAppend':     return jsonOut(Object.assign({ ok: true }, handleBulkAppend(payload)));
    case 'updateById':     handleUpdateById(payload); return jsonOut({ ok: true });
    case 'deleteById':     handleDeleteById(payload); return jsonOut({ ok: true });
    case 'bulkReplace':    return jsonOut(Object.assign({ ok: true }, handleBulkReplace(payload)));
    case 'setTextFormat':  return jsonOut(Object.assign({ ok: true }, handleSetTextFormat(payload)));
    default:               return jsonOut({ ok: false, error: 'Unknown op: ' + op });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

function handleModifiedTime() {
  var file = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  return file.getLastUpdated().toISOString();
}

// -----------------------------------------------------------------------------
// Per-tab modifiedTime tracking
//
// The `__meta` tab stores rows of (tabName, modifiedTime). Every write op
// bumps the row for the affected tab. The client reads all rows via the
// `modifiedTimes` op and rebuilds only tabs whose timestamp has changed —
// no more full-spreadsheet rebuild on every small edit.
// -----------------------------------------------------------------------------

var META_TAB = '__meta';

function getOrCreateMetaSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(META_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(META_TAB);
    sheet.getRange(1, 1, 1, 2).setValues([['tabName', 'modifiedTime']]);
  }
  return sheet;
}

function handleModifiedTimes() {
  var sheet = getOrCreateMetaSheet();
  var out = {};

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) {
      var name = String(values[i][0] || '');
      if (!name) continue;
      var t = values[i][1];
      out[name] = (t instanceof Date) ? t.toISOString() : String(t || '');
    }
  }

  // Self-heal: any data tab that exists in the spreadsheet but isn't tracked
  // in __meta gets added with the current time. This makes the very first
  // deployment populate __meta automatically on first call.
  var all = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var nowIso = new Date().toISOString();
  var missing = [];
  for (var k = 0; k < all.length; k++) {
    var tabName = all[k].getName();
    if (tabName === META_TAB) continue;
    if (out[tabName] == null) {
      out[tabName] = nowIso;
      missing.push([tabName, nowIso]);
    }
  }
  if (missing.length > 0) {
    var startRow = Math.max(sheet.getLastRow() + 1, 2);
    sheet.getRange(startRow, 1, missing.length, 2).setValues(missing);
  }

  return out;
}

// -----------------------------------------------------------------------------
// Text-column protection
//
// Google Sheets locale auto-parses string values that look like dates ("2026-09",
// "január 2026") into Date objects when written via setValues — which then
// round-trip back to the client as ISO datetimes, breaking FK joins
// (MonthlyValue.monthId no longer matches Month.id).
//
// To prevent this, listed (tab, column) pairs get their entire column forced
// to @ (text) number format before any write. Also, reads convert any Date
// values in those columns back to "YYYY-MM" strings — self-heals data that
// was corrupted before this guard was in place.
// -----------------------------------------------------------------------------

var TEXT_COLUMNS_BY_TAB = {
  MonthlyValue: ['monthId'],
  ImportBatch: ['monthId'],
  IstAdjustmentRequest: ['monthId'],
  Month: ['id', 'label'],
};

function ensureTextColumnsFormatted(sheet, tabName) {
  var textCols = TEXT_COLUMNS_BY_TAB[tabName];
  if (!textCols || textCols.length === 0) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < textCols.length; i++) {
    var idx = headers.indexOf(textCols[i]);
    if (idx < 0) continue;
    sheet.getRange(1, idx + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
  }
}

// Convert Date cell values in known-text columns back to "YYYY-MM" strings.
// Used on read paths so legacy corrupted rows still surface as the expected
// FK-joinable format.
function coerceDateValuesToMonthIds(values, tabName) {
  var textCols = TEXT_COLUMNS_BY_TAB[tabName];
  if (!textCols || textCols.length === 0 || values.length < 1) return values;
  var headers = values[0];
  var colIndexes = [];
  for (var c = 0; c < textCols.length; c++) {
    var idx = headers.indexOf(textCols[c]);
    if (idx >= 0) colIndexes.push(idx);
  }
  if (colIndexes.length === 0) return values;

  for (var r = 1; r < values.length; r++) {
    for (var k = 0; k < colIndexes.length; k++) {
      var ci = colIndexes[k];
      var v = values[r][ci];
      if (v instanceof Date) {
        // Pad month to 2 digits. Use UTC components to avoid timezone drift.
        var y = v.getUTCFullYear();
        var m = v.getUTCMonth() + 1;
        values[r][ci] = y + '-' + (m < 10 ? '0' + m : String(m));
      }
    }
  }
  return values;
}

function bumpTabModifiedTime(tabName) {
  if (!tabName || tabName === META_TAB) return;
  var sheet = getOrCreateMetaSheet();
  var now = new Date().toISOString();
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (String(names[i][0]) === tabName) {
        sheet.getRange(i + 2, 2).setValue(now);
        return;
      }
    }
  }
  sheet.appendRow([tabName, now]);
}

function handleListTabs() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function(s) { return s.getName(); });
}

function handleEnsureTabs(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = payload.tabs || [];
  for (var i = 0; i < tabs.length; i++) {
    var name = tabs[i].name;
    var headers = tabs[i].headers || [];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // Write headers if first row is empty or mismatched
    var firstRow = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
    var needHeaders = false;
    for (var j = 0; j < headers.length; j++) {
      if (String(firstRow[j] || '') !== headers[j]) { needHeaders = true; break; }
    }
    if (needHeaders && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
}

function handleRead(payload) {
  var sheet = mustGetSheet(payload.tab);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return [];
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  return coerceDateValuesToMonthIds(values, payload.tab);
}

function handleReadAll(payload) {
  var out = {};
  var tabs = payload.tabs || [];
  for (var i = 0; i < tabs.length; i++) {
    var name = tabs[i];
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet) { out[name] = []; continue; }
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow === 0 || lastCol === 0) {
      out[name] = [];
      continue;
    }
    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    out[name] = coerceDateValuesToMonthIds(values, name);
  }
  return out;
}

function handleAppend(payload) {
  var sheet = mustGetSheet(payload.tab);
  ensureTextColumnsFormatted(sheet, payload.tab);
  sheet.appendRow(payload.row);
  bumpTabModifiedTime(payload.tab);
}

// Append N rows in a single API call. Caller passes rows in column order.
// All rows are written via one setValues() — orders of magnitude faster than
// N separate `append` calls when the client needs to insert many rows
// (e.g. saving a batch of VOD adjustments).
function handleBulkAppend(payload) {
  var sheet = mustGetSheet(payload.tab);
  var rows = payload.rows || [];
  if (rows.length === 0) {
    return { inserted: 0 };
  }
  ensureTextColumnsFormatted(sheet, payload.tab);
  var width = (payload.headers && payload.headers.length) || sheet.getLastColumn();
  var startRow = sheet.getLastRow() + 1;
  if (startRow < 2) startRow = 2; // skip header row
  sheet.getRange(startRow, 1, rows.length, width).setValues(rows);
  bumpTabModifiedTime(payload.tab);
  return { inserted: rows.length };
}

function handleUpdateById(payload) {
  var sheet = mustGetSheet(payload.tab);
  var idColumn = payload.idColumn;
  var id = payload.id;
  var row = payload.row;

  ensureTextColumnsFormatted(sheet, payload.tab);

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIndex = headers.indexOf(idColumn);
  if (idColIndex === -1) throw new Error('idColumn not found: ' + idColumn);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Row not found (sheet empty): ' + id);

  var ids = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
      bumpTabModifiedTime(payload.tab);
      return;
    }
  }
  throw new Error('Row not found: ' + id);
}

function handleDeleteById(payload) {
  var sheet = mustGetSheet(payload.tab);
  var idColumn = payload.idColumn;
  var id = payload.id;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIndex = headers.indexOf(idColumn);
  if (idColIndex === -1) throw new Error('idColumn not found: ' + idColumn);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var ids = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      bumpTabModifiedTime(payload.tab);
      return;
    }
  }
  // Idempotent: deleting a non-existent id is OK
}

function handleBulkReplace(payload) {
  var sheet = mustGetSheet(payload.tab);
  var headers = payload.headers || [];
  var rows = payload.rows || [];

  // Optimistic concurrency: caller may pass expectedModifiedTime captured before
  // its read. If the spreadsheet was modified by another writer in the meantime,
  // reject the write so caller can retry against fresh state.
  if (payload.expectedModifiedTime) {
    var current = handleModifiedTime();
    if (current !== payload.expectedModifiedTime) {
      throw new Error('Conflict: spreadsheet modified by another writer (expected '
        + payload.expectedModifiedTime + ', got ' + current + ')');
    }
  }

  // clearContents() (not clear()) preserves existing number formats — esp.
  // the @ (text) format on monthId-style columns. Sheets locale would
  // otherwise auto-parse "2026-09" back into a Date on the next setValues.
  sheet.clearContents();
  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  // Re-apply text format for known-text columns BEFORE inserting rows.
  // This is the safety net for tabs whose format was wiped by an earlier
  // (legacy) call to clear().
  ensureTextColumnsFormatted(sheet, payload.tab);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  bumpTabModifiedTime(payload.tab);
  // Return the new modifiedTime so caller can chain further conditional writes.
  return { modifiedTime: handleModifiedTime() };
}

function handleSetTextFormat(payload) {
  var tab = payload.tab;
  var column = payload.column;
  if (!tab || !column) throw new Error('setTextFormat requires { tab, column }');

  var sheet = mustGetSheet(tab);
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('Tab is empty: ' + tab);

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var colIndex = headers.indexOf(column);
  if (colIndex === -1) throw new Error('Column not found in ' + tab + ': ' + column);

  var range = sheet.getRange(1, colIndex + 1, sheet.getMaxRows(), 1);
  range.setNumberFormat('@');

  return { tab: tab, column: column, columnIndex: colIndex + 1 };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function mustGetSheet(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Tab not found: ' + name);
  return sheet;
}
