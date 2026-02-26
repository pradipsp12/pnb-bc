// app/api/upload/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Account from '@/lib/models/Account';
import Customer from '@/lib/models/Customer'; 
import { extractAccountData } from '@/lib/pdfParser';
import { appendToGoogleSheet, uploadPdfToDrive } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const pdfFile   = formData.get('pdf');
    const photoFile = formData.get('photo');
    const scheme    = formData.get('scheme') || '';
    const apy       = formData.get('apy') === 'true';
    const aadhaarNo = (formData.get('aadhaarNo') || '').trim(); // manual 12-digit input

    if (!pdfFile) return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    if (pdfFile.type !== 'application/pdf') return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });

    // Validate Aadhaar
    if (!aadhaarNo || !/^\d{12}$/.test(aadhaarNo)) {
      return NextResponse.json({ error: 'Valid 12-digit Aadhaar number is required' }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    //console.log('Extracting data from PDF...');
    const extractedData = await extractAccountData(pdfBuffer);

    // Today's date
    const today = new Date();
    const accountOpenDate = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

    // Manual photo
    let photoBase64 = null;
    if (photoFile && photoFile.size > 0) {
      photoBase64 = Buffer.from(await photoFile.arrayBuffer()).toString('base64');
      console.log('Manual photo received:', photoFile.name, photoFile.size, 'bytes');
    }

    // Upload PDF to Drive
    let pdfDriveUrl = null;
    try {
      const driveResult = await uploadPdfToDrive(pdfBuffer, extractedData.customerName, extractedData.accountNo);
      if (driveResult) pdfDriveUrl = driveResult.webViewLink;
    } catch (err) {
      console.error('Drive upload error:', err.message);
    }

    // Save to MongoDB — use manually entered aadhaarNo (overrides masked PDF value)
    await connectDB();
    const account = new Account({
      referenceNo:     extractedData.referenceNo,
      accountOpenDate,
      customerName:    extractedData.customerName,
      sex:             extractedData.sex,
      address:         extractedData.address,
      accountNo:       extractedData.accountNo,
      customerId:      extractedData.customerId,
      aadhaarNo,        // ← manual input, real 12-digit number
      mobileNo:        extractedData.mobileNo,
      dateOfBirth:     extractedData.dateOfBirth,
      photoBase64,
      scheme,
      apy,
      pdfDriveUrl,
      rawText:         extractedData.rawText,
    });

    const savedAccount = await account.save();
    console.log('Saved to MongoDB:', savedAccount._id);

        // ── Save to Customer collection (new) ─────────────────────────────────────
    let savedCustomer = null;
    let customerError = null;
    try {
      savedCustomer = await Customer.create({
        customerName: extractedData.customerName,
        accountNo:    extractedData.accountNo,
        adharNo:      aadhaarNo,                         // real 12-digit aadhaar
        mobileNo:     extractedData.mobileNo || null,
        scheme:       scheme,
        apy:          apy,               // bool → 'Yes'/'No' enum
      });
      console.log('Saved to Customer collection:', savedCustomer._id);
    } catch (err) {
      // Don't fail the whole request if customer save fails
      // (e.g. duplicate accountNo if re-uploaded)
      customerError = err.code === 11000
        ? 'Customer record already exists for this account number'
        : err.message;
      console.error('Customer collection save error:', customerError);
    }

    // Append to Google Sheets
    let sheetsResult = null, sheetsError = null;
    try {
      sheetsResult = await appendToGoogleSheet({
        ...extractedData,
        accountOpenDate,
        aadhaarNo,        // ← override with real aadhaar
        photoBase64,
        scheme,
        apy,
        pdfDriveUrl,
      });
      console.log('Saved to Google Sheets');
    } catch (err) {
      sheetsError = err.message;
      console.error('Google Sheets error:', err.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        mongoId: savedAccount._id,
        accountOpenDate,
        referenceNo:   extractedData.referenceNo,
        customerName:  extractedData.customerName,
        sex:           extractedData.sex,
        address:       extractedData.address,
        accountNo:     extractedData.accountNo,
        customerId:    extractedData.customerId,
        aadhaarNo,
        mobileNo:      extractedData.mobileNo,
        dateOfBirth:   extractedData.dateOfBirth,
        scheme,
        apy,
        photoUploaded: !!photoBase64,
        pdfDriveUrl,
      },
      mongodb:      { saved: true, id: savedAccount._id },
      googleSheets: sheetsError ? { saved: false, error: sheetsError } : { saved: true },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process PDF', details: error.message }, { status: 500 });
  }
}
