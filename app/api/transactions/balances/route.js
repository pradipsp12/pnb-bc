// app/api/transactions/balances/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Returns balances for multiple customers in a SINGLE aggregation query.
// Replaces N individual /api/transactions?customerId=X calls on the list page,
// which was exhausting M0's connection pool.
//
// GET /api/transactions/balances?ids=id1,id2,id3,...
// Response: { balances: { "id1": 500, "id2": -200, "id3": 0 } }
//   positive = customer owes you (due)
//   negative = you owe customer (advance)
//   0        = settled / no transactions
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Transaction     from '@/lib/models/Transaction';
import mongoose        from 'mongoose';

export async function GET(request) {
  await connectDB();

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('ids') || '';

  if (!raw.trim()) {
    return NextResponse.json({ balances: {} });
  }

  // Parse and validate IDs
  const ids = raw
    .split(',')
    .map(id => id.trim())
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

  if (!ids.length) {
    return NextResponse.json({ balances: {} });
  }

  try {
    // Single aggregation — group by customerId, sum given vs received amounts
    // This opens ONE connection and runs ONE query regardless of how many customers
    const rows = await Transaction.aggregate([
      { $match: { customerId: { $in: ids } } },
      {
        $group: {
          _id: '$customerId',
          given:    { $sum: { $cond: [{ $eq: ['$type', 'given']    }, '$amount', 0] } },
          received: { $sum: { $cond: [{ $eq: ['$type', 'received'] }, '$amount', 0] } },
        },
      },
    ]);

    // Build result map — customers with no transactions won't appear in rows,
    // so we seed everything to 0 first then overwrite with actual values
    const balances = {};
    for (const id of ids) {
      balances[id.toString()] = 0;
    }
    for (const row of rows) {
      balances[row._id.toString()] = row.given - row.received;
    }

    return NextResponse.json({ success: true, balances });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}