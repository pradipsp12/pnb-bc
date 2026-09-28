// lib/pdfParser.js
import pdfParse from 'pdf-parse';

export async function extractAccountData(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  const text = data.text;

  const extracted = extractFields(text);

  // Today's date — always the upload date
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  extracted.accountOpenDate = `${dd}-${mm}-${today.getFullYear()}`;
  extracted.photoBase64    = null;
  extracted.photoMimeType  = null;
  extracted.rawText        = text;

  return extracted;
}

/**
 * Main extraction — anchor-based instead of pure regex/position guessing.
 *
 * WHY THE OLD APPROACH BROKE:
 * - Reference No is NOT always "K" + digits. Some forms use a plain
 *   16-digit number for Reference No, which is the *same shape* as
 *   Account No (also 16 digits). A single global regex for "first
 *   16-digit number" then grabs the wrong field.
 * - Date of Birth doesn't always land in the same relative position in
 *   the raw text stream — sometimes it appears right after Customer ID,
 *   sometimes much later — so treating the value-block as a fixed
 *   sequence breaks between form variants.
 *
 * FIX: anchor on the two fields whose format is unambiguous no matter
 * the form variant — the Sex line ("M"/"F") and the Customer ID line
 * ("R" + 8 digits) — and derive every neighboring field's position
 * relative to those anchors instead of relative to the start of the
 * document. Fields that can still appear anywhere (Aadhaar, Mobile,
 * DOB, Address) are found by scanning forward from the Customer ID
 * anchor and taking the first structurally-matching line, rather than
 * the first match anywhere in the whole document.
 */
function extractFields(text) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // ── Anchor 1: Sex ("M" / "F" / "Male" / "Female") ───────────────────────
  const sexIdx = lines.findIndex(l => /^(M|F|Male|Female)$/i.test(l));

  // ── Anchor 2: Customer ID ("R" + 8 digits) ──────────────────────────────
  // Search after sexIdx if we have it, otherwise anywhere.
  const cidIdx = lines.findIndex(
    (l, i) => /^R\d{8}$/.test(l) && (sexIdx === -1 || i > sexIdx)
  );

  let customerName = '';
  let sex = '';
  let referenceNo = '';
  let accountNo = '';
  let customerId = '';

  if (sexIdx !== -1) {
    sex = lines[sexIdx];
    customerName = lines[sexIdx - 1] || '';

    // Reference No sits two lines above Sex (before the name).
    const refCandidate = lines[sexIdx - 2] || '';
    referenceNo = /^K?\d{10,35}$/.test(refCandidate) ? refCandidate : '';

    // Account No sits directly below Sex, directly above Customer ID.
    const accCandidate = lines[sexIdx + 1] || '';
    accountNo = /^\d{14,18}$/.test(accCandidate) ? accCandidate : '';
  }

  if (cidIdx !== -1) {
    customerId = lines[cidIdx];
    // Cross-check account No if we didn't get it from the sex anchor.
    if (!accountNo) {
      const accCandidate = lines[cidIdx - 1] || '';
      if (/^\d{14,18}$/.test(accCandidate)) accountNo = accCandidate;
    }
  }

  // Fallbacks if anchors weren't found at all (format changed drastically)
  if (!referenceNo) {
    const refMatch =
      text.match(/\b(K\d{24,30})\b/) || text.match(/\b(\d{16,17})\b/);
    referenceNo = refMatch ? refMatch[1] : '';
  }
  if (!customerId) {
    const cidMatch = text.match(/\b(R\d{8})\b/);
    customerId = cidMatch ? cidMatch[1] : '';
  }

  // ── Fields found by scanning forward from Customer ID ───────────────────
  const searchFrom = cidIdx !== -1 ? cidIdx + 1 : 0;
  const tail = lines.slice(searchFrom);

  // Aadhaar No: 8 X's + 4 digits (masked) or 12 plain digits.
  const aadhaarLine = tail.find(l => /^(?:X{8}\d{4}|\d{12})$/.test(l));
  const aadhaarNo = aadhaarLine || fallbackMatch(text, /\b([X\d]{8}\d{4})\b/);

  // Mobile No: first 10-digit number starting 6-9 after Customer ID.
  // (It legitimately repeats later as "Tel No" — we want the first hit.)
  const mobileLine = tail.find(l => /^[6-9]\d{9}$/.test(l));
  const mobileNo = mobileLine || fallbackMatch(text, /\b([6-9]\d{9})\b/);

  // Date of Birth: first DD-MM-YYYY / DD/MM/YYYY after Customer ID.
  // Taking the FIRST such date after Customer ID reliably lands on DOB
  // even though the declaration date/nominee DOB appear later in the doc.
  const dobLine = tail.find(l => /^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(l));
  const dateOfBirth = dobLine || fallbackMatch(text, /\b(\d{2}[-\/]\d{2}[-\/]\d{4})\b/);

  // ── Address ───────────────────────────────────────────────────────────
  // Address always sits between the FIRST occurrence of the mobile number
  // and its SECOND occurrence (the form repeats it as Tel No right after
  // the address block). This correctly handles both single-line and
  // multi-line (wrapped) addresses without guessing line counts.
  let address = '';
  if (mobileNo) {
    const mobileIdxs = [];
    lines.forEach((l, i) => {
      if (l === mobileNo) mobileIdxs.push(i);
    });
    if (mobileIdxs.length >= 2) {
      const [first, second] = mobileIdxs;
      address = lines
        .slice(first + 1, second)
        .filter(l => !isKnownLabel(l))
        .join(', ')
        .replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // Fallback address extraction (old PIN-code based method) if the
  // mobile-repeat approach didn't find anything.
  if (!address) {
    address = extractAddressByPin(lines);
  }

  return {
    referenceNo,
    customerName,
    sex,
    accountNo,
    customerId,
    aadhaarNo,
    mobileNo,
    dateOfBirth,
    address,
  };
}

function fallbackMatch(text, regex) {
  const m = text.match(regex);
  return m ? m[1] : '';
}

function extractAddressByPin(lines) {
  const addrLines = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/,\s*[A-Z]{2},\s*\d{6}$/.test(l) || /[A-Z]{2},\s*\d{6}$/.test(l)) {
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
  return addrLines
    .join(', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
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