// app/api/transactions/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb'; 
import Transaction  from '@/lib/models/Transaction';
import Customer     from '@/lib/models/Customer';

// ─── GET — all transactions for a customer + computed balance ─────────────────
// ?customerId=xxx
export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId') || '';

  if (!customerId)
    return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });

  try {
    const [customer, transactions] = await Promise.all([
      Customer.findById(customerId).lean(),
      Transaction.find({ customerId }).sort({ createdAt: 1 }).lean(),
    ]);

    if (!customer)
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

    // ── Balance calculation ───────────────────────────────────────────────────
    // given    = we gave money to customer → customer owes us → increases "due"
    // received = customer gave money to us → reduces "due" / builds "advance"
    // balance > 0 → customer owes us (due)
    // balance < 0 → we owe customer (advance)
    let balance = 0;
    for (const t of transactions) {
      if (t.type === 'given')    balance += t.amount;
      if (t.type === 'received') balance -= t.amount;
    }

    return NextResponse.json({
      success: true,
      customer,
      transactions,
      balance, // positive = due, negative = advance
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — create a new transaction ─────────────────────────────────────────
export async function POST(request) {
  await connectDB();
  try {
    const body = await request.json();
    const { customerId, type, amount, note } = body;

    if (!customerId)              return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
    if (!['given','received'].includes(type))
                                  return NextResponse.json({ success: false, error: 'type must be given or received' }, { status: 400 });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)         return NextResponse.json({ success: false, error: 'Amount must be greater than 0' }, { status: 400 });

    const transaction = await Transaction.create({
      customerId,
      type,
      amount: amt,
      note:   (note || '').trim(),
    });

    // Recompute balance
    const all = await Transaction.find({ customerId }).sort({ createdAt: 1 }).lean();
    let balance = 0;
    for (const t of all) {
      if (t.type === 'given')    balance += t.amount;
      if (t.type === 'received') balance -= t.amount;
    }

    return NextResponse.json({ success: true, transaction, balance }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}