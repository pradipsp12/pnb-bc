// lib/pdfParser.js
import pdfParse from 'pdf-parse';

export async function extractAccountData(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  const text = data.text;

//  console.log('=== RAW PDF TEXT ===');
 // console.log(text);
  //console.log('===================');

  const extracted = extractFields(text);

  // Today's date — always the upload date
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  extracted.accountOpenDate = `${dd}-${mm}-${today.getFullYear()}`;
  extracted.photoBase64    = null;
  extracted.photoMimeType  = null;
  extracted.rawText        = text;

 // console.log('=== EXTRACTED DATA ===');
  //console.log(JSON.stringify({ ...extracted, rawText: '[omitted]' }, null, 2));
  //console.log('======================');

  return extracted;
}

/**
 * Main extraction — uses regex patterns that work regardless of PDF layout.
 * These patterns are derived from the actual raw text of PNB FORM-33 PDFs.
 *
 * The key insight: the VALUES always appear in the text as distinct tokens
 * that can be identified by their format, even without knowing their position.
 */
function extractFields(text) {

  // ── Reference No ──────────────────────────────────────────────────────────
  // Always: K followed by 26-28 digits
  const refMatch = text.match(/\b(K\d{24,30})\b/);
  const referenceNo = refMatch ? refMatch[1] : '';

  // ── Account No ────────────────────────────────────────────────────────────
  // Always: exactly 16 digits
  const accMatch = text.match(/\b(\d{16})\b/);
  const accountNo = accMatch ? accMatch[1] : '';

  // ── Customer ID ───────────────────────────────────────────────────────────
  // Always: R followed by 8 digits
  const cidMatch = text.match(/\b(R\d{8})\b/);
  const customerId = cidMatch ? cidMatch[1] : '';

  // ── Aadhaar No ────────────────────────────────────────────────────────────
  // Always: 12 chars, X-masked (e.g. XXXXXXXX0333) or plain digits
  const aadhaarMatch = text.match(/\b([X\d]{8}\d{4})\b/);
  const aadhaarNo = aadhaarMatch ? aadhaarMatch[1] : '';

  // ── Mobile No ─────────────────────────────────────────────────────────────
  // Always: 10 digits starting with 6-9
  // Could appear multiple times (also as Tel No) — take the first occurrence
  const mobileMatch = text.match(/\b([6-9]\d{9})\b/);
  const mobileNo = mobileMatch ? mobileMatch[1] : '';

  // ── Date of Birth ─────────────────────────────────────────────────────────
  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dobMatch = text.match(/\b(\d{2}[-\/]\d{2}[-\/]\d{4})\b/);
  const dateOfBirth = dobMatch ? dobMatch[1] : '';

  // ── Customer Name & Sex ───────────────────────────────────────────────────
  // In the value block, Reference No is always first, Customer Name next, Sex after.
  // Find the K-number line, then next two lines are Name and Sex.
  const lines = text.split('\n').map(l => l.trim());
  const refIdx = lines.findIndex(l => /^K\d{24,30}$/.test(l));

  let customerName = '';
  let sex = '';

  if (refIdx !== -1) {
    // Scan forward from K-line for the name (first non-empty, non-digit, non-label line)
    for (let i = refIdx + 1; i < Math.min(refIdx + 5, lines.length); i++) {
      const l = lines[i];
      if (l && l.length > 1 && !/^\d+$/.test(l) && !isKnownLabel(l)) {
        customerName = l;
        // Next line should be Sex (M or F)
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          if (/^(M|F|Male|Female)$/i.test(lines[j])) {
            sex = lines[j];
            break;
          }
        }
        break;
      }
    }
  }

  // ── Address ───────────────────────────────────────────────────────────────
  // Strategy: find lines that contain a 6-digit PIN code pattern.
  // Address is always 2 lines: locality line + "city, STATE, PIN" line.
  // We exclude phone numbers (10-digit) and known label lines.
  const addrLines = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Address line 2 always ends with STATE, PINCODE (e.g. "343, WB, 743357")
    if (/,\s*[A-Z]{2},\s*\d{6}$/.test(l) || /[A-Z]{2},\s*\d{6}$/.test(l)) {
      // Line before it is address line 1 (if not a label or phone)
      if (i > 0) {
        const prev = lines[i - 1];
        if (prev && prev.length > 5 && !/^\d{10}$/.test(prev) && !isKnownLabel(prev)) {
          addrLines.push(prev);
        }
      }
      addrLines.push(l);
      break;
    }
  }

  // If PIN pattern didn't match, try any line with 6-digit number (broader fallback)
  if (addrLines.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (/\d{6}/.test(lines[i]) && lines[i].length > 8 && !/^\d{10}$/.test(lines[i]) && !isKnownLabel(lines[i])) {
        if (i > 0 && lines[i-1].length > 5 && !isKnownLabel(lines[i-1]) && !/^\d{10}$/.test(lines[i-1])) {
          addrLines.push(lines[i-1]);
        }
        addrLines.push(lines[i]);
        break;
      }
    }
  }

  const address = addrLines
    .join(', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

  //console.log('Regex extraction results:', { referenceNo, customerName, sex, accountNo, customerId, aadhaarNo, mobileNo, dateOfBirth, address });

  return { referenceNo, customerName, sex, accountNo, customerId, aadhaarNo, mobileNo, dateOfBirth, address };
}

const KNOWN_LABELS = [
  'reference no', 'customer name', 'sex', 'account no', 'customer id',
  'aadhaar no', 'mobile no', 'date of birth', 'educational qualification',
  'nationality', 'category', 'religion', 'pan / gir', 'occupation type',
  'designation / profession', 'annual income', 'annual turnover',
  'classification', 'name of father', 'marital status', 'customer photo',
  'flat no./bldg', 'street / road', 'city / district', 'tel.no', 'email',
  'account opening form', 'type of account', 'nature of account',
  'mode of operation', 'address', 'customer profile', 'know your customer',
];

function isKnownLabel(line) {
  const l = line.toLowerCase();
  return KNOWN_LABELS.some(lbl => l === lbl || l.startsWith(lbl));
}