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

// ─── GET single ──────────────────────────────────────────────────────────────
export async function GET(request, { params }) {
  await connectDB();
  try {
    const customer = await Customer.findById(params.id).lean();
    if (!customer)
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    return NextResponse.json({ success: true, customer });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PUT — Update ────────────────────────────────────────────────────────────
export async function PUT(request, { params }) {
  await connectDB();
  try {
    const raw      = await request.json();
    const body     = sanitizeBody(raw);
    const customer = await Customer.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!customer)
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

    return NextResponse.json({ success: true, customer });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'Account number already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(request, { params }) {
  await connectDB();
  try {
    const customer = await Customer.findByIdAndDelete(params.id).lean();
    if (!customer)
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}