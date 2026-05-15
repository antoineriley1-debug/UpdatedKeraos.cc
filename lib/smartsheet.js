// Smartsheet REST client. Server-side only — uses the token from env.
// Never import this file from a client component.

const API_BASE = 'https://api.smartsheet.com/2.0';

// The 8 column IDs for the Priority Tasks sheet, captured 2026-05-13.
// These are the actual column IDs from the sheet — verified via get_columns.
export const COLUMNS = {
  Category:   1780343935111044,
  Tasks:      1709559652847492,
  Owner:      6213159280217988,
  Status:     5049231649050500,
  Notes:      5577734639357828,
  StartDate:  3961359466532740,
  EndDate:    8464959093903236,
  Barriers:   2797431835365252,
};

function token() {
  const t = process.env.SMARTSHEET_TOKEN;
  if (!t) throw new Error('SMARTSHEET_TOKEN env variable is not set');
  return t;
}

function sheetId() {
  const s = process.env.SMARTSHEET_SHEET_ID;
  if (!s) throw new Error('SMARTSHEET_SHEET_ID env variable is not set');
  return s;
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    // Always fetch fresh from Smartsheet — never cache
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Smartsheet API ${res.status}: ${text}`);
  }
  return res.json();
}

// Flatten Smartsheet row format (cells array) into a friendly object keyed
// by column name. Each cell has columnId + value.
function flattenRow(row, columnsById) {
  const out = { row_id: row.id, modified_at: row.modifiedAt };
  for (const cell of row.cells || []) {
    const colName = columnsById[cell.columnId];
    if (colName) out[colName] = cell.value ?? null;
  }
  return out;
}

// Build columnsById map from column array
function buildColumnsById(columns) {
  const map = {};
  for (const c of columns) map[c.id] = c.title.trim(); // strip trailing space on "Barriers "
  return map;
}

// Normalize "Barriers " (with trailing space) → "Barriers" so it's a clean JS key
function normalizeBarriers(row) {
  if ('Barriers ' in row) {
    row.Barriers = row['Barriers '];
    delete row['Barriers '];
  }
  return row;
}

// =====================================================
// PUBLIC API
// =====================================================

// Get the full sheet with discussions and attachments.
// Returns { rows, comments, attachments, version }.
export async function getSheet() {
  const data = await api(
    `/sheets/${sheetId()}?include=discussions,attachments`
  );
  const columnsById = buildColumnsById(data.columns);

  const rows = (data.rows || [])
    .map(r => normalizeBarriers(flattenRow(r, columnsById)));

  // Extract comments per row (rowId → array of {by, at, text})
  const comments = {};
  for (const row of data.rows || []) {
    if (!row.discussions || !row.discussions.length) continue;
    const all = [];
    for (const d of row.discussions) {
      for (const c of (d.comments || [])) {
        all.push({
          by: c.createdBy?.name || 'Unknown',
          at: c.createdAt,
          text: c.text,
        });
      }
    }
    if (all.length) comments[row.id] = all;
  }

  // Extract attachments per row (rowId → array of {name, sizeKb, by, at})
  const attachments = {};
  for (const row of data.rows || []) {
    if (!row.attachments || !row.attachments.length) continue;
    attachments[row.id] = row.attachments.map(a => ({
      name: a.name,
      sizeKb: Math.round((a.sizeInKb || 0)),
      by: a.createdBy?.name || 'Unknown',
      at: a.createdAt,
    }));
  }

  return {
    rows,
    comments,
    attachments,
    version: data.version,
    sheet_name: data.name,
  };
}

// Cheap version check — returns only { version }. Used for polling.
export async function getSheetVersion() {
  const data = await api(`/sheets/${sheetId()}?include=&pageSize=1`);
  return { version: data.version };
}

// Get a single row (used for reading current Notes before append).
export async function getRow(rowId) {
  const sheet = await api(`/sheets/${sheetId()}?rowIds=${rowId}`);
  const columnsById = buildColumnsById(sheet.columns);
  const row = (sheet.rows || []).find(r => String(r.id) === String(rowId));
  if (!row) throw new Error(`Row ${rowId} not found`);
  return normalizeBarriers(flattenRow(row, columnsById));
}

// Add a new row to the sheet. Maps friendly column names → column IDs.
export async function addRow(fields) {
  const cells = [];
  for (const [colName, columnId] of Object.entries(COLUMNS)) {
    const v = fields[colName];
    if (v !== undefined && v !== null && v !== '') {
      cells.push({ columnId, value: v });
    }
  }
  if (!cells.length) throw new Error('No cells to add');

  const result = await api(`/sheets/${sheetId()}/rows`, {
    method: 'POST',
    body: JSON.stringify([{ toBottom: true, cells }]),
  });
  return result.result?.[0];
}

// Update an existing row. Only sets the specified fields.
export async function updateRow(rowId, fields) {
  const cells = [];
  for (const [colName, columnId] of Object.entries(COLUMNS)) {
    if (colName in fields) {
      cells.push({ columnId, value: fields[colName] });
    }
  }
  if (!cells.length) throw new Error('No cells to update');

  const result = await api(`/sheets/${sheetId()}/rows`, {
    method: 'PUT',
    body: JSON.stringify([{ id: Number(rowId), cells }]),
  });
  return result.result?.[0];
}

// Close a task: Status=Completed, EndDate=today (if blank), append audit to Notes.
// Reads existing Notes first to preserve them.
export async function closeRow(rowId, userName) {
  const today = new Date().toISOString().slice(0, 10);
  const audit = `[Closed ${today} by ${userName}]`;
  const current = await getRow(rowId);
  const newNotes = current.Notes ? `${current.Notes}\n\n${audit}` : audit;

  const fields = {
    Status: 'Completed',
    Notes: newNotes,
  };
  if (!current.EndDate) fields.EndDate = today;

  return updateRow(rowId, fields);
}

// Reopen a task: Status=In Progress, append audit to Notes.
export async function reopenRow(rowId, userName) {
  const today = new Date().toISOString().slice(0, 10);
  const audit = `[Reopened ${today} by ${userName}]`;
  const current = await getRow(rowId);
  const newNotes = current.Notes ? `${current.Notes}\n\n${audit}` : audit;

  return updateRow(rowId, {
    Status: 'In Progress',
    Notes: newNotes,
  });
}
