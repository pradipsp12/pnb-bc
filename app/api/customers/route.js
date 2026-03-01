import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

// Helper — sanitize body so boolean fields are always boolean regardless of what comes in
function sanitizeBody(body) {
  const clean = { ...body };

  // Cast apy to boolean safely
  if ('apy' in clean) {
    const v = clean.apy;
    clean.apy = v === true || v === 'true' || v === 'Yes' || v === 1 || v === '1';
  }

  // Cast vip to boolean safely
  if ('vip' in clean) {
    const v = clean.vip;
    clean.vip = v === true || v === 'true' || v === 1 || v === '1';
  }

  // Normalize scheme — treat undefined/null as empty string
  if ('scheme' in clean) {
    clean.scheme = clean.scheme ?? '';
  }

  return clean;
}

// ─── GET — List with pagination + search ─────────────────────────────────────
export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const page     = Math.max(1, parseInt(searchParams.get('page')  || '1'));
  const limit    = Math.min(100, parseInt(searchParams.get('limit') || '10'));
  const search   = searchParams.get('search')   || '';
  const scheme   = searchParams.get('scheme')   || '';
  const apy      = searchParams.get('apy')      || '';
  const vip      = searchParams.get('vip')      || '';
  const fromDate = searchParams.get('fromDate') || '';
  const toDate   = searchParams.get('toDate')   || '';

  const query = {};

  if (search) {
    query.$or = [
      { customerName: { $regex: search, $options: 'i' } },
      { accountNo:    { $regex: search, $options: 'i' } },
      { mobileNo:     { $regex: search, $options: 'i' } },
      { adharNo:      { $regex: search, $options: 'i' } },
    ];
  }

  if (scheme) query.scheme = scheme;

  // apy filter: 'Yes' → true, 'No' → false
  if (apy === 'Yes') query.apy = true;
  if (apy === 'No')  query.apy = false;

  // vip filter: 'Yes' → true, 'No' → false
  if (vip === 'Yes') query.vip = true;
  if (vip === 'No')  query.vip = false;

  // date range filter on createdAt
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) query.createdAt.$gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate)   query.createdAt.$lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  try {
    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — Create ────────────────────────────────────────────────────────────
export async function POST(request) {
  await connectDB();
  try {
    const raw      = await request.json();
    const body     = sanitizeBody(raw);
    const customer = await Customer.create(body);
    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'Account number already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 400 }
    );
  }
}