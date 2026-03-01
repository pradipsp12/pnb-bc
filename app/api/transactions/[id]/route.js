// app/api/transactions/[id]/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb'; 
import Transaction from '@/lib/models/Transaction';

// ─── PUT — edit amount / note / type ─────────────────────────────────────────
export async function PUT(request, { params }) {
  await connectDB();
  try {
    const body = await request.json();
    const { type, amount, note } = body;

    const updates = {};
    if (type !== undefined) {
      if (!['given','received'].includes(type))
        return NextResponse.json({ success: false, error: 'type must be given or received' }, { status: 400 });
      updates.type = type;
    }
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0)
        return NextResponse.json({ success: false, error: 'Amount must be greater than 0' }, { status: 400 });
      updates.amount = amt;
    }
    if (note !== undefined) updates.note = (note || '').trim();

    const transaction = await Transaction.findByIdAndUpdate(
      params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!transaction)
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });

    // Recompute balance for this customer
    const all = await Transaction.find({ customerId: transaction.customerId }).sort({ createdAt: 1 }).lean();
    let balance = 0;
    for (const t of all) {
      if (t.type === 'given')    balance += t.amount;
      if (t.type === 'received') balance -= t.amount;
    }

    return NextResponse.json({ success: true, transaction, balance });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(request, { params }) {
  await connectDB();
  try {
    const transaction = await Transaction.findByIdAndDelete(params.id).lean();
    if (!transaction)
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });

    // Recompute balance
    const all = await Transaction.find({ customerId: transaction.customerId }).sort({ createdAt: 1 }).lean();
    let balance = 0;
    for (const t of all) {
      if (t.type === 'given')    balance += t.amount;
      if (t.type === 'received') balance -= t.amount;
    }

    return NextResponse.json({ success: true, balance });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}