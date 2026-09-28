// app/api/account/toggle/route.js
// PATCH /api/account/toggle
// Body: { id, field: 'unfreezeStatus' | 'passbookIssued', value: boolean }
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Account from '@/lib/models/Account';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  try {
    const { id, field, value } = await request.json();

    if (!id || !field) {
      return NextResponse.json({ error: 'id and field are required' }, { status: 400 });
    }

    const allowed = ['unfreezeStatus', 'passbookIssued'];
    if (!allowed.includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    await connectDB();
    const updated = await Account.findByIdAndUpdate(
      id,
      { [field]: value },
      { new: true, select: '_id unfreezeStatus passbookIssued' }
    );

    if (!updated) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    return NextResponse.json({ success: true, record: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
