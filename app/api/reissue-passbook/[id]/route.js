// app/api/reissue-passbook/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb'; 
import ReissuePassbook from '@/lib/models/ReissuePassbook';

function sanitizeBody(body) {
  const clean = { ...body };
  if ('apy' in clean) {
    const v = clean.apy;
    clean.apy = v === true || v === 'true' || v === 'Yes' || v === 1 || v === '1';
  }
  if ('scheme' in clean) clean.scheme = clean.scheme ?? '';
  return clean;
}

export async function GET(request, { params }) {
  await connectDB();
  try {
    const record = await ReissuePassbook.findById(params.id).lean();
    if (!record) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  await connectDB();
  try {
    const body   = sanitizeBody(await request.json());
    const record = await ReissuePassbook.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();
    if (!record) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  await connectDB();
  try {
    const record = await ReissuePassbook.findByIdAndDelete(params.id).lean();
    if (!record) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}