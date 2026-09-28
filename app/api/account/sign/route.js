// app/api/account/sign/route.js
// GET  ?accountNo=xxx  → get sign info
// POST multipart       → upload sign image to Drive, save URL to MongoDB

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Account from '@/lib/models/Account';
import { uploadSignToDrive } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET: fetch sign status for an account
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountNo = searchParams.get('accountNo');
    if (!accountNo) return NextResponse.json({ error: 'accountNo required' }, { status: 400 });

    await connectDB();
    const account = await Account.findOne({ accountNo }).select('accountNo customerName signUrl signDriveFileId');
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    return NextResponse.json({ success: true, account });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: upload sign image
export async function POST(request) {
  try {
    const formData  = await request.formData();
    const signFile  = formData.get('sign');
    const accountNo = formData.get('accountNo');

    if (!accountNo) return NextResponse.json({ error: 'accountNo required' }, { status: 400 });
    if (!signFile)  return NextResponse.json({ error: 'Sign image required' }, { status: 400 });

    // Only allow JPG/JPEG
    const validTypes = ['image/jpeg', 'image/jpg'];
    if (!validTypes.includes(signFile.type)) {
      return NextResponse.json({ error: 'Only JPG/JPEG files are allowed for signature' }, { status: 400 });
    }

    await connectDB();
    const account = await Account.findOne({ accountNo });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // Upload to Google Drive "Customer Sign" folder
    const signBuffer = Buffer.from(await signFile.arrayBuffer());
    const driveResult = await uploadSignToDrive(signBuffer, accountNo);

    if (!driveResult) {
      return NextResponse.json({ error: 'Failed to upload sign to Drive' }, { status: 500 });
    }

    // Save Drive URL to MongoDB
    account.signUrl         = driveResult.webViewLink;
    account.signDriveFileId = driveResult.fileId;
    await account.save();

    return NextResponse.json({
      success: true,
      signUrl: driveResult.webViewLink,
      customerName: account.customerName,
    });
  } catch (err) {
    console.error('Sign upload error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}