'use client';

// app/customers/[id]/transactions/TransactionClient.jsx
// ─── CLIENT COMPONENT ─────────────────────────────────────────────────────────
// Receives server-fetched data as props — no useEffect fetch on mount.
// Handles: load more, add, edit, delete, balance updates.

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
    .format(Math.abs(n));

const fmtDate = (d) =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

const fmtDateShort = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ─── TxField — top-level to preserve focus ────────────────────────────────────
function TxField({ label, value, onChange, type = 'text', placeholder, error, prefix }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <div className={`flex items-center rounded-xl border transition-all
        ${error
          ? 'border-red-400 bg-red-50'
          : 'border-gray-200 bg-gray-50 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100'
        }`}>
        {prefix && <span className="pl-3 text-gray-400 text-sm font-medium flex-shrink-0">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm text-gray-900 rounded-xl"
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ─── TxModal ──────────────────────────────────────────────────────────────────
function TxModal({ isOpen, onClose, onSaved, editTx, defaultType, customerId }) {
  const [type,   setType]   = useState(defaultType || 'given');
  const [amount, setAmount] = useState('');
  const [note,   setNote]   = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const isEdit = !!editTx;

  useEffect(() => {
    if (isOpen) {
      if (editTx) {
        setType(editTx.type);
        setAmount(String(editTx.amount));
        setNote(editTx.note || '');
      } else {
        setType(defaultType || 'given');
        setAmount('');
        setNote('');
      }
      setErrors({}); setApiErr('');
    }
  }, [isOpen, editTx, defaultType]);

  const validate = () => {
    const e   = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true); setApiErr('');
    try {
      const url    = isEdit ? `/api/transactions/${editTx._id}` : '/api/transactions';
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ customerId, type, amount: parseFloat(amount), note }),
      });
      const data = await res.json();
      if (!res.ok) { setApiErr(data.error || 'Something went wrong'); return; }
      onSaved(data.transaction, data.balance, isEdit);
      onClose();
    } catch (err) {
      setApiErr('Network error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  const isGiven = type === 'given';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: isGiven ? '#fee2e2' : '#dcfce7' }}>
              <span className="text-lg">{isGiven ? '💸' : '💰'}</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isEdit ? 'Edit Transaction' : isGiven ? 'Money Given' : 'Money Received'}
              </h2>
              <p className="text-xs text-gray-400">{isEdit ? 'Update this transaction' : 'Enter the details below'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {apiErr && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{apiErr}</div>}

          {isEdit && (
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setType('given')}
                className="flex-1 py-2 text-sm font-semibold transition-colors"
                style={{ backgroundColor: type === 'given' ? '#ef4444' : '#f9fafb', color: type === 'given' ? '#fff' : '#6b7280' }}>
                💸 Given
              </button>
              <button onClick={() => setType('received')}
                className="flex-1 py-2 text-sm font-semibold transition-colors"
                style={{ backgroundColor: type === 'received' ? '#22c55e' : '#f9fafb', color: type === 'received' ? '#fff' : '#6b7280' }}>
                💰 Received
              </button>
            </div>
          )}

          <TxField label="Amount" value={amount} onChange={setAmount} type="number" placeholder="0.00" error={errors.amount} prefix="₹" />
          <TxField label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. Loan installment, EMI, etc." />
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: isGiven ? '#ef4444' : '#22c55e' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = isGiven ? '#dc2626' : '#16a34a'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = isGiven ? '#ef4444' : '#22c55e'}>
            {saving ? <><Spinner className="h-4 w-4" /> Saving...</> : isEdit ? '✏️ Update' : isGiven ? '💸 Given' : '💰 Received'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DeleteModal ──────────────────────────────────────────────────────────────
function DeleteModal({ isOpen, onClose, onConfirm, deleting }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Delete Transaction?</h3>
        <p className="text-xs text-gray-500 mb-5">This will permanently remove this entry and recalculate the balance.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {deleting ? <><Spinner className="h-4 w-4" /> Deleting...</> : '🗑️ Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-28 right-4 z-[60] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium min-w-[200px]"
          style={{ backgroundColor: t.type === 'success' ? '#16a34a' : '#dc2626' }}>
          {t.type === 'success' ? '✅' : '❌'} {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────
function Bubble({ tx, runningBalance, onEdit, onDelete }) {
  const isGiven    = tx.type === 'given';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef    = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div className={`flex ${isGiven ? 'justify-end' : 'justify-start'} mb-3 px-4`}>
      <div className="max-w-[78%] sm:max-w-[60%]">

        {/* ── Bubble card — both Given & Received use same white style ── */}
        <div className={`rounded-2xl px-4 py-3 shadow-sm border text-gray-900
          ${isGiven
            ? 'rounded-tr-sm'
            : 'bg-white border-gray-200 rounded-tl-sm'}`}
          style={isGiven ? { backgroundColor: '#fff7f7', borderColor: '#fecaca' } : {}}>

          {/* Top row: label left, 3-dot right */}
          <div className="flex items-center justify-between gap-3 mb-1.5">

            <div className="text-xs font-bold" style={{ color: isGiven ? '#f87171' : '#9ca3af' }}>
              {isGiven ? '💸 Given' : '💰 Received'}
            </div>

            {/* 3-dot always on the right inside bubble.
                Given bubble is right-aligned on screen → dropdown opens LEFT (right-0) to avoid clipping.
                Received bubble is left-aligned on screen → dropdown opens RIGHT (left-0). */}
            <div ref={menuRef} className="relative flex-shrink-0">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5"  r="1.8"/>
                  <circle cx="12" cy="12" r="1.8"/>
                  <circle cx="12" cy="19" r="1.8"/>
                </svg>
              </button>

              {menuOpen && (
                <div className={`absolute top-7 z-30 bg-white rounded-xl shadow-xl border border-gray-100 min-w-[130px] overflow-hidden
                  ${isGiven ? 'right-0' : 'left-0'}`}>
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(tx); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <div className="h-px bg-gray-100 mx-3" />
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(tx); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="text-xl font-extrabold tracking-tight" style={{ color: isGiven ? '#e11d48' : '#111827' }}>
            {fmt(tx.amount)}
          </div>

          {/* Note */}
          {tx.note && (
            <div className="text-xs mt-1.5 leading-relaxed" style={{ color: isGiven ? '#f87171' : '#6b7280' }}>
              {tx.note}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs mt-2" style={{ color: isGiven ? '#fca5a5' : '#9ca3af' }}>
            {fmtDate(tx.createdAt)}
          </div>
        </div>

        {/* Running balance tag */}
        <div className={`text-xs mt-1 px-1 font-medium
          ${runningBalance > 0 ? 'text-orange-600' : runningBalance < 0 ? 'text-blue-600' : 'text-green-600'}
          ${isGiven ? 'text-right' : 'text-left'}`}>
          {runningBalance === 0 ? 'Settled ✅' : runningBalance > 0 ? `Due ${fmt(runningBalance)}` : `Advance ${fmt(runningBalance)}`}
        </div>

      </div>
    </div>
  );
}

// ─── DateSep ──────────────────────────────────────────────────────────────────
function DateSep({ date }) {
  return (
    <div className="flex items-center gap-3 px-4 my-4">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-100 rounded-full whitespace-nowrap">
        {fmtDateShort(date)}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────
export default function TransactionClient({
  customerId,
  customer,
  initialTransactions,
  initialBalance,
}) {
  // ── State — initialised from server-fetched props, no fetch on mount ─────────
  const [transactions, setTransactions] = useState(initialTransactions);
  const [balance,      setBalance]      = useState(initialBalance);

  // Show last 5 initially; load more reveals 10 at a time going upward
  const [visibleFrom,  setVisibleFrom]  = useState(() => Math.max(0, initialTransactions.length - 5));

  const [modalOpen,    setModalOpen]    = useState(false);
  const [defaultType,  setDefaultType]  = useState('given');
  const [editTx,       setEditTx]       = useState(null);
  const [deleteTx,     setDeleteTx]     = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [toasts,       setToasts]       = useState([]);

  const bottomRef = useRef(null);
  const topRef    = useRef(null);

  // Scroll to bottom on first render (server already painted, just scroll)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, []);

  // Scroll to bottom when a new transaction is added
  const prevLengthRef = useRef(initialTransactions.length);
  useEffect(() => {
    if (transactions.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = transactions.length;
  }, [transactions.length]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);

  // ── Add / Edit saved ───────────────────────────────────────────────────────
  const handleSaved = (tx, newBalance, isEdit) => {
    if (isEdit) {
      setTransactions(p => p.map(t => t._id === tx._id ? tx : t));
      toast('Transaction updated!');
    } else {
      setTransactions(p => [...p, tx]);
      toast('Transaction added!');
    }
    setBalance(newBalance);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTx) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/transactions/${deleteTx._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Delete failed', 'error'); return; }
      setTransactions(p => {
        const next = p.filter(t => t._id !== deleteTx._id);
        setVisibleFrom(prev => Math.max(0, Math.min(prev, next.length - 1)));
        return next;
      });
      setBalance(data.balance);
      setDeleteTx(null);
      toast('Transaction deleted!');
    } catch { toast('Network error', 'error'); }
    finally  { setDeleting(false); }
  };

  // ── Running balances (full array, not just visible slice) ──────────────────
  const runningBalances = [];
  let running = 0;
  for (const t of transactions) {
    if (t.type === 'given')    running += t.amount;
    if (t.type === 'received') running -= t.amount;
    runningBalances.push(running);
  }

  // ── Visible window ─────────────────────────────────────────────────────────
  const visibleTxs  = transactions.slice(visibleFrom);
  const hiddenCount = visibleFrom;
  const hasMore     = hiddenCount > 0;

  const handleLoadMore = () => {
    setVisibleFrom(prev => Math.max(0, prev - 10));
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // ── Group visible transactions by date ─────────────────────────────────────
  const grouped = [];
  let lastDate = null;
  visibleTxs.forEach((t, localIdx) => {
    const globalIdx = visibleFrom + localIdx;
    const d = new Date(t.createdAt).toDateString();
    if (d !== lastDate) { grouped.push({ type: 'date', date: t.createdAt, key: `d-${globalIdx}` }); lastDate = d; }
    grouped.push({ type: 'tx', tx: t, runningBalance: runningBalances[globalIdx], key: t._id });
  });

  // ── Balance label ──────────────────────────────────────────────────────────
  const balanceLabel = balance === 0
    ? { text: 'Settled',               color: 'text-green-600',  bg: 'bg-green-50  border-green-200'  }
    : balance > 0
    ? { text: `Due ${fmt(balance)}`,     color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' }
    : { text: `Advance ${fmt(balance)}`, color: 'text-blue-600',   bg: 'bg-blue-50   border-blue-200'   };

  return (
    <>
      <style>{`
        @keyframes bubble-in-r { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes bubble-in-l { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        .bubble-given    { animation: bubble-in-r 0.25s ease; }
        .bubble-received { animation: bubble-in-l 0.25s ease; }
      `}</style>

      <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0 z-50 fixed top-0 w-full">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/customers"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>

            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {customer.customerName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold text-gray-900 leading-tight truncate">{customer.customerName}</h1>
              <p className={`text-xs font-semibold ${balanceLabel.color}`}>{balanceLabel.text}</p>
            </div>

            <div className={`flex-shrink-0 border rounded-xl px-3 py-1.5 ${balanceLabel.bg}`}>
              <p className={`text-xs font-bold ${balanceLabel.color}`}>{balanceLabel.text}</p>
            </div>
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="flex-1 overflow-y-auto  max-w-2xl mx-auto w-full" style={{paddingTop:"60px", paddingBottom:"100px"}}>

          {/* Empty state */}
          {transactions.length === 0 && (
            <div className="text-center py-20 px-8">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-500 font-semibold">No transactions yet</p>
              <p className="text-gray-400 text-sm mt-1">Use the buttons below to add a transaction</p>
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div ref={topRef} className="flex flex-col items-center gap-1 py-4">
              <button onClick={handleLoadMore}
                className="flex items-center gap-2 px-5 py-2 bg-white border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                Load more
              </button>
              <p className="text-xs text-gray-400">{hiddenCount} older transaction{hiddenCount !== 1 ? 's' : ''}</p>
            </div>
          )}

          {/* Bubbles */}
          {grouped.map(item =>
            item.type === 'date'
              ? <DateSep key={item.key} date={item.date} />
              : (
                <div key={item.key} className={item.tx.type === 'given' ? 'bubble-given' : 'bubble-received'}>
                  <Bubble
                    tx={item.tx}
                    runningBalance={item.runningBalance}
                    onEdit={(tx) => { setEditTx(tx); setModalOpen(true); }}
                    onDelete={(tx) => setDeleteTx(tx)}
                  />
                </div>
              )
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Fixed bottom bar ── */}
        <div className="flex-shrink-0 fixed w-full bg-white border-t border-gray-200 z-20" style={{bottom:'0px'}}>
          <div className="max-w-2xl mx-auto px-4 py-3 flex gap-3">
            
            <button
              onClick={() => { setEditTx(null); setDefaultType('received'); setModalOpen(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-sm transition-colors shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
              Received
            </button>
            <button
              onClick={() => { setEditTx(null); setDefaultType('given'); setModalOpen(true); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-sm transition-colors shadow-sm"
              style={{ backgroundColor: '#ef4444' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ef4444'}
              onMouseDown={e => e.currentTarget.style.backgroundColor = '#b91c1c'}
              onMouseUp={e => e.currentTarget.style.backgroundColor = '#dc2626'}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              Given
            </button>
          </div>
        </div>

      </div>

      <TxModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditTx(null); }}
        onSaved={handleSaved}
        editTx={editTx}
        defaultType={defaultType}
        customerId={customerId}
      />
      <DeleteModal
        isOpen={!!deleteTx}
        onClose={() => setDeleteTx(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
      <Toast toasts={toasts} />
    </>
  );
}