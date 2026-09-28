// app/api/problems/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Problem  from '@/lib/models/Problem';
import Customer from '@/lib/models/Customer';
import { createGoogleContact } from '@/lib/google/people';

export const dynamic = 'force-dynamic';

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const query  = status ? { status } : {};
    const problems = await Problem.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, problems });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      customerName,
      accountNo,
      adharNo,       // matches Customer schema
      mobileNo,
      dateOfBirth,
      customerId,
      remarks,
    } = body;

    if (!customerName?.trim()) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    if (!accountNo?.trim())    return NextResponse.json({ error: 'Account No is required' },    { status: 400 });
    if (!adharNo || !/^\d{12}$/.test(adharNo.trim()))
      return NextResponse.json({ error: 'Valid 12-digit Aadhaar is required' }, { status: 400 });

    const cleanMobile = /^\d{10}$/.test(mobileNo?.trim() || '') ? mobileNo.trim() : null;

    await connectDB();

    // 1. Save problem
    const problem = await Problem.create({
      customerName: customerName.trim(),
      accountNo:    accountNo.trim(),
      adharNo:      adharNo.trim(),
      mobileNo:     cleanMobile,
      dateOfBirth:  dateOfBirth?.trim() || '',
      customerId:   customerId?.trim()  || '',
      remarks:      remarks?.trim()     || '',
      status:       'pending',
    });

    // 2. Sync to Customer — skip if already exists
    let customerStatus = 'skipped';
    const existing = await Customer.findOne({ accountNo: accountNo.trim() }).lean();

    if (!existing) {
      await Customer.create({
        customerName: customerName.trim(),
        accountNo:    accountNo.trim(),
        adharNo:      adharNo.trim(),
        mobileNo:     cleanMobile,
        scheme:       '',
        apy:          false,
      });
      customerStatus = 'added';
      console.log('Customer added to CRM:', accountNo.trim());

      // 3. Google Contact — non-blocking
      try {
        await createGoogleContact({
          customerName: customerName.trim(),
          accountNo:    accountNo.trim(),
          adharNo:      adharNo.trim(),
          mobileNo:     cleanMobile,
        });
        console.log('Google Contact created:', customerName.trim());
      } catch (err) {
        console.error('Google Contact failed (non-fatal):', err.message);
      }
    } else {
      console.log('Customer already in CRM:', accountNo.trim());
    }

    return NextResponse.json({ success: true, problem, customerStatus });
  } catch (err) {
    console.error('Problems POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
