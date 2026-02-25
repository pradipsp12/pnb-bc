// lib/googleSheets.js
import { google } from 'googleapis';
import { Readable } from 'stream';
import stream from 'stream';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

async function getAuthClient() {
  const credentials = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
}

// ─── PHOTO: Upload to ImgBB ───────────────────────────────────────────────────
async function uploadPhotoToImgBB(photoBase64) {
  try {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) { console.log('IMGBB_API_KEY not set'); return null; }

    const body = new URLSearchParams();
    body.append('key', apiKey);
    body.append('image', photoBase64);
    body.append('expiration', '0');

    const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body });
    const result = await res.json();
    if (result.success) {
      console.log('Photo uploaded to ImgBB:', result.data.url);
      return result.data.url;
    }
    console.error('ImgBB failed:', result.error?.message);
    return null;
  } catch (err) {
    console.error('ImgBB error:', err.message);
    return null;
  }
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

export async function uploadPdfToDrive(pdfBuffer, customerName, accountNo) {
  try {
    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client,
    });

    // 📅 Get today date folder name (DD-MM-YYYY)
    const today = new Date();
    const dateFolderName = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

    // ==============================
    // 1️⃣ Ensure "PNB accounts" folder exists
    // ==============================

    const parentFolderQuery = await drive.files.list({
      q: `name='PNB accounts' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    let parentFolderId;

    if (parentFolderQuery.data.files.length > 0) {
      parentFolderId = parentFolderQuery.data.files[0].id;
    } else {
      const parentFolder = await drive.files.create({
        requestBody: {
          name: 'PNB accounts',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      parentFolderId = parentFolder.data.id;
    }

    // ==============================
    // 2️⃣ Ensure Date Folder exists inside PNB accounts
    // ==============================

    const dateFolderQuery = await drive.files.list({
      q: `name='${dateFolderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    let dateFolderId;

    if (dateFolderQuery.data.files.length > 0) {
      dateFolderId = dateFolderQuery.data.files[0].id;
    } else {
      const dateFolder = await drive.files.create({
        requestBody: {
          name: dateFolderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id',
      });
      dateFolderId = dateFolder.data.id;
    }

    // ==============================
    // 3️⃣ Upload PDF inside Date Folder
    // ==============================

    const bufferStream = new stream.PassThrough();
    bufferStream.end(pdfBuffer);

    const fileName = `${customerName}_${accountNo}.pdf`;

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [dateFolderId],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: bufferStream,
      },
      fields: 'id, webViewLink',
    });

    return response.data;

  } catch (error) {
    console.error('Drive Upload Error:', error);
    throw error;
  }
}

// Find or create a date folder inside the Shared Drive root
async function findOrCreateFolderInSharedDrive(drive, name, sharedDriveId) {
  try {
    // Search inside the shared drive
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${sharedDriveId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      driveId: sharedDriveId,
      corpora: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      console.log(`Folder "${name}" found in Shared Drive:`, res.data.files[0].id);
      return res.data.files[0].id;
    }

    // Create folder in shared drive root
    const folder = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [sharedDriveId],
      },
      fields: 'id',
    });

    console.log(`Folder "${name}" created in Shared Drive:`, folder.data.id);
    return folder.data.id;
  } catch (err) {
    console.error(`findOrCreateFolderInSharedDrive("${name}") failed:`, err.message);
    throw err;
  }
}

// ─── SHEET: Append one data row ──────────────────────────────────────────────
export async function appendToGoogleSheet(accountData) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  await ensureHeaders(sheets, spreadsheetId);

  // Photo cell
  let photoCell = '';
  if (accountData.photoBase64) {
    const url = await uploadPhotoToImgBB(accountData.photoBase64);
    if (url) photoCell = `=IMAGE("${url}", 4, 120, 100)`;
  }

  // PDF link cell
  const pdfCell = accountData.pdfDriveUrl
    ? `=HYPERLINK("${accountData.pdfDriveUrl}", "View PDF")`
    : '';

  // Debug: log what we're about to write
  console.log('Sheet row data:', {
    accountOpenDate: accountData.accountOpenDate,
    customerName:    accountData.customerName,
    dateOfBirth:     accountData.dateOfBirth,
    aadhaarNo:       accountData.aadhaarNo,
    mobileNo:        accountData.mobileNo,
  });

  // Prefix date fields with apostrophe so Sheets stores them as plain text
  // without auto-converting to date serial numbers
  const formatDate = (d) => d ? `'${d}` : '';

  const row = [
    formatDate(accountData.accountOpenDate),  // A - force plain text
    accountData.customerName    || '',         // B
    accountData.sex             || '',         // C
    formatDate(accountData.dateOfBirth),       // D - force plain text (fixes DOB issue)
    accountData.address         || '',         // E
    accountData.accountNo       || '',         // F
    accountData.customerId      || '',         // G
    accountData.aadhaarNo       || '',         // H
    accountData.mobileNo        || '',         // I
    accountData.referenceNo     || '',         // J
    accountData.scheme          || '',         // K
    accountData.apy ? 'APY'    : '',           // L
    photoCell,                                 // M
    pdfCell,                                   // N
    new Date().toLocaleString('en-IN'),        // O - readable timestamp
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A:O',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  await formatDataRow(sheets, spreadsheetId, response.data);
  return response.data;
}

async function formatDataRow(sheets, spreadsheetId, appendResult) {
  try {
    const sheetId = await getSheetId(sheets, spreadsheetId);
    if (sheetId === null) return;

    const updatedRange = appendResult.updates?.updatedRange || '';
    const rowMatch = updatedRange.match(/(\d+):/);
    if (!rowMatch) return;
    const rowIndex = parseInt(rowMatch[1]) - 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
              properties: { pixelSize: 120 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: 'COLUMNS', startIndex: 12, endIndex: 13 },
              properties: { pixelSize: 110 },
              fields: 'pixelSize',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 1, green: 1, blue: 1 },
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,verticalAlignment)',
            },
          },
        ],
      },
    });
  } catch (err) {
    console.log('Row formatting skipped:', err.message);
  }
}

async function ensureHeaders(sheets, spreadsheetId) {
  const headers = [
    'Account Open Date', 'Customer Name', 'Sex', 'Date of Birth',
    'Address', 'Account No', 'Customer ID', 'Aadhaar No', 'Mobile No',
    'Reference No', 'Scheme', 'APY', 'Photo', 'PDF File', 'Added At',
  ];

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId, range: 'Sheet1!A1:O1',
  });

  const firstRow = existing.data.values?.[0] || [];
  if (firstRow[0] === 'Account Open Date') return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1:O1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers] },
  });

  const sheetId = await getSheetId(sheets, spreadsheetId);
  if (sheetId !== null) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  backgroundColor: { red: 0.13, green: 0.37, blue: 0.69 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment,verticalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  }
}

async function getSheetId(sheets, spreadsheetId) {
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    return res.data.sheets?.[0]?.properties?.sheetId ?? null;
  } catch { return null; }
}
// ─── SIGN: Upload signature JPG to Personal Google Drive (Smart Update) ───
export async function uploadSignToDrive(signBuffer, accountNo) {
  try {
    if (!accountNo) {
      console.error("accountNo missing");
      return null;
    }

    const drive = google.drive({
      version: 'v3',
      auth: oauth2Client, // personal OAuth2
    });

    // ==============================
    // 1️⃣ Ensure "Customer Sign" folder exists
    // ==============================

    const folderQuery = await drive.files.list({
      q: `name='Customer Sign' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    let folderId;

    if (folderQuery.data.files.length > 0) {
      folderId = folderQuery.data.files[0].id;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: 'Customer Sign',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      folderId = folder.data.id;
    }

    const fileName = `${accountNo}.jpg`;

    // ==============================
    // 2️⃣ Check if file already exists
    // ==============================

    const existing = await drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name)',
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(signBuffer);

    let fileId;
    let webViewLink;

    if (existing.data.files.length > 0) {
      // 🔁 UPDATE EXISTING FILE
      fileId = existing.data.files[0].id;

      const updated = await drive.files.update({
        fileId,
        media: {
          mimeType: 'image/jpeg',
          body: bufferStream,
        },
        fields: 'id, webViewLink',
      });

      webViewLink = updated.data.webViewLink;

      console.log(`Signature updated for account ${accountNo}`);
    } else {
      // 🆕 CREATE NEW FILE
      const created = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
          mimeType: 'image/jpeg',
        },
        media: {
          mimeType: 'image/jpeg',
          body: bufferStream,
        },
        fields: 'id, webViewLink',
      });

      fileId = created.data.id;
      webViewLink = created.data.webViewLink;

      // Make public only first time
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      console.log(`Signature created for account ${accountNo}`);
    }

    return { fileId, webViewLink };

  } catch (err) {
    console.error("Sign upload failed:", err.message);
    return null;
  }
}