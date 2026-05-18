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
    var WRITE_OPS = { ensureTabs: 1, append: 1, updateById: 1, deleteById: 1, bulkReplace: 1, setTextFormat: 1 };
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
    case 'listTabs':       return jsonOut({ ok: true, tabs: handleListTabs() });
    case 'ensureTabs':     handleEnsureTabs(payload); return jsonOut({ ok: true });
    case 'read':           return jsonOut({ ok: true, data: handleRead(payload) });
    case 'readAll':        return jsonOut({ ok: true, data: handleReadAll(payload) });
    case 'append':         handleAppend(payload); return jsonOut({ ok: true });
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
  return sheet.getRange(1, 1, lastRow, lastCol).getValues();
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
    out[name] = (lastRow === 0 || lastCol === 0)
      ? []
      : sheet.getRange(1, 1, lastRow, lastCol).getValues();
  }
  return out;
}

function handleAppend(payload) {
  var sheet = mustGetSheet(payload.tab);
  sheet.appendRow(payload.row);
}

function handleUpdateById(payload) {
  var sheet = mustGetSheet(payload.tab);
  var idColumn = payload.idColumn;
  var id = payload.id;
  var row = payload.row;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idColIndex = headers.indexOf(idColumn);
  if (idColIndex === -1) throw new Error('idColumn not found: ' + idColumn);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Row not found (sheet empty): ' + id);

  var ids = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
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

  sheet.clear();
  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

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
