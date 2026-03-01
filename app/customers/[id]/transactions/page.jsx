// app/customers/[id]/transactions/page.jsx
// ─── SERVER COMPONENT — no 'use client' ──────────────────────────────────────
// Data is fetched directly from MongoDB at request time.
// The client shell receives hydrated props — no loading spinner on first paint.

import { notFound } from 'next/navigation';
import connectDB from '@/lib/mongodb'; 
import Customer    from '@/lib/models/Customer';
import Transaction from '@/lib/models/Transaction';
import TransactionClient from '@/lib/components/Transactionclient';

// ─── Compute balance from a list of transactions ──────────────────────────────
function computeBalance(transactions) {
  let balance = 0;
  for (const t of transactions) {
    if (t.type === 'given')    balance += t.amount;
    if (t.type === 'received') balance -= t.amount;
  }
  return balance;
}

export default async function TransactionPage({ params }) {
  const { id: customerId } = await params;

  await connectDB();

  const [customer, transactions] = await Promise.all([
    Customer.findById(customerId).lean(),
    Transaction.find({ customerId }).sort({ createdAt: 1 }).lean(),
  ]);

  if (!customer) notFound();

  const balance = computeBalance(transactions);

  // Serialize: convert ObjectId / Date to plain strings so they can be passed
  // as props from Server → Client component
  const serialize = (obj) => JSON.parse(JSON.stringify(obj));

  return (
    <TransactionClient
      customerId={customerId}
      customer={serialize(customer)}
      initialTransactions={serialize(transactions)}
      initialBalance={balance}
    />
  );
}