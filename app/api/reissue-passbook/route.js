// app/api/reissue-passbook/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb'; 
import ReissuePassbook  from '@/lib/models/ReissuePassbook';
import Customer         from '@/lib/models/Customer';

// ── Same sanitize pattern as customers API ────────────────────────────────────
function sanitizeBody(body) {
  const clean = { ...body };
  if ('apy' in clean) {
    const v = clean.apy;
    clean.apy = v === true || v === 'true' || v === 'Yes' || v === 1 || v === '1';
  }
  if ('scheme' in clean) clean.scheme = clean.scheme ?? '';
  return clean;
}

// ─── GET — list with server-side pagination + search ─────────────────────────
export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const page   = Math.max(1,   parseInt(searchParams.get('page')  || '1'));
  const limit  = Math.min(100, parseInt(searchParams.get('limit') || '10'));
  const search = searchParams.get('search')   || '';
  const fromDate = searchParams.get('fromDate') || '';
  const toDate   = searchParams.get('toDate')   || '';

  const query = {};

  if (search.trim()) {
    const re = { $regex: search.trim(), $options: 'i' };
    query.$or = [
      { customerName: re },
      { accountNo:    re },
      { mobileNo:     re },
      { adharNo:      re },
    ];
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate)   query.createdAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  try {
    const [records, total] = await Promise.all([
      ReissuePassbook.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReissuePassbook.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — create reissue record + sync to Customer collection ───────────────
export async function POST(request) {
  await connectDB();
  try {
    const raw  = await request.json();
    const body = sanitizeBody(raw);

    // 1. Always save to ReissuePassbook (multiple reissues allowed per account)
    const record = await ReissuePassbook.create(body);

    // 2. Sync to Customer — add only if accountNo not already in Customer collection
    const existing = await Customer.findOne({ accountNo: body.accountNo }).lean();
    let customerStatus = 'skipped'; // already exists

    if (!existing) {
      await Customer.create({
        customerName: body.customerName,
        accountNo:    body.accountNo,
        adharNo:      body.adharNo,
        mobileNo:     body.mobileNo || null,
        scheme:       body.scheme   || '',
        apy:          body.apy,
      });
      customerStatus = 'added'; // newly added to Customer collection
    }

    return NextResponse.json(
      { success: true, record, customerStatus },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}