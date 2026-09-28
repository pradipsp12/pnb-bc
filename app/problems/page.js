'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ── Model also needs feedback field ─────────────────────────────────────────
// Make sure Problem.js has: feedback: { type: String, trim: true }

// ── View toggle (manager only) ───────────────────────────────────────────────
function ViewToggle({ view, setView }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
      {[{ key: 'staff', label: '👷 Staff' }, { key: 'manager', label: '🗂️ Manager' }].map(({ key, label }) => (
        <button key={key} onClick={() => setView(key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
            ${view === key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  return status === 'done'
    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">✅ Done</span>
    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">⏳ Pending</span>;
}

// ── Add Problem Modal (manager only) ────────────────────────────────────────
function AddProblemModal({ onAdded, onClose }) {
  const [form, setForm]     = useState({ customerName: '', dateOfBirth: '', accountNo: '', customerId: '', adharNo: '', mobileNo: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));
  const inp = "w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono";
  const lbl = "block text-sm font-semibold text-gray-700 mb-1.5";

  const handleSubmit = async () => {
    if (!form.accountNo.trim()) { setError('Account No is required'); return; }
    setSaving(true); setError('');
    try {
      const res  = await fetch('/api/problems', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); }
      else { onAdded(data.problem); onClose(); }
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  };

  // Close on backdrop click
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-base">+</div>
            <h2 className="text-lg font-bold text-gray-900">Add Problem</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Customer Name</label>
              <input type="text" value={form.customerName} onChange={set('customerName')}
                placeholder="Full name" className={inp.replace('font-mono','')} autoFocus />
            </div>
            <div>
              <label className={lbl}>Date of Birth</label>
              <input type="text" value={form.dateOfBirth} onChange={set('dateOfBirth')}
                placeholder="DD-MM-YYYY" maxLength={10} className={inp} />
            </div>
            <div>
              <label className={lbl}>Account No <span className="text-red-500">*</span></label>
              <input type="text" value={form.accountNo} onChange={set('accountNo')}
                placeholder="16-digit account number" maxLength={20} className={inp} />
            </div>
            <div>
              <label className={lbl}>Customer ID</label>
              <input type="text" value={form.customerId} onChange={set('customerId')}
                placeholder="e.g. R65068508" className={inp} />
            </div>
            <div>
              <label className={lbl}>Aadhaar No <span className="text-red-500">*</span></label>
              <input type="text" inputMode="numeric" value={form.adharNo}
                onChange={e => setForm(p => ({ ...p, adharNo: e.target.value.replace(/\D/g,'').slice(0,12) }))}
                placeholder="12-digit Aadhaar" maxLength={12} className={inp} required />
            </div>
            <div>
              <label className={lbl}>Mobile No</label>
              <input type="text" inputMode="numeric" value={form.mobileNo}
                onChange={e => setForm(p => ({ ...p, mobileNo: e.target.value.replace(/\D/g,'').slice(0,10) }))}
                placeholder="10-digit mobile" maxLength={10} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Remarks / Problem Description</label>
            <textarea value={form.remarks} onChange={set('remarks')}
              placeholder="Describe the issue to be resolved by staff..."
              rows={3} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">❌ {error}</div>}
        </div>

        {/* Modal footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all
              ${saving ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100'}`}>
            {saving
              ? <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>Adding...
                </span>
              : '➕ Add Problem'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Problem Card ─────────────────────────────────────────────────────────────
function ProblemCard({ problem, onMarkDone, onMarkPending, isUpdating, isManager }) {
  const [expanded, setExpanded]     = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback]     = useState('');
  const isDone = problem.status === 'done';

  const handleConfirmDone = () => {
    onMarkDone(problem._id, feedback);
    setShowFeedback(false);
    setFeedback('');
  };

  return (
    <div className={`rounded-2xl border transition-all duration-200
      ${isDone ? 'bg-green-50/70 border-green-200' : 'bg-white border-gray-200 shadow-sm'}`}>

      {/* Main row */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={problem.status} />
              <span className="text-xs text-gray-400 font-mono">#{String(problem._id).slice(-6).toUpperCase()}</span>
              <span className="text-xs text-gray-400">
                {new Date(problem.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </span>
            </div>

            {/* Name — most prominent */}
            {problem.customerName && (
              <p className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                {problem.customerName}
              </p>
            )}

            {/* Account No — clearly visible below name */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Acc</span>
              <p className="font-mono text-sm sm:text-base font-bold text-blue-700">
                {problem.accountNo}
              </p>
            </div>

            {/* DOB + other fields */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {problem.dateOfBirth && (
                <span className="text-xs text-gray-600 font-medium">🎂 {problem.dateOfBirth}</span>
              )}
              {problem.customerId && (
                <span className="text-xs text-gray-500 font-mono">ID: {problem.customerId}</span>
              )}
              {problem.adharNo && (
                <span className="text-xs text-gray-500 font-mono">Aadhaar: {problem.adharNo}</span>
              )}
              {/* Mobile: manager only */}
              {isManager && problem.mobileNo && (
                <span className="text-xs text-gray-500 font-mono">📞 {problem.mobileNo}</span>
              )}
            </div>

            {/* Remarks */}
            {problem.remarks && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{problem.remarks}</p>
            )}

            {/* Done feedback (always visible if present) */}
            {isDone && problem.feedback && (
              <div className="mt-2 px-3 py-2 bg-green-100 rounded-xl">
                <p className="text-xs text-green-600 font-medium mb-0.5">Staff feedback:</p>
                <p className="text-sm text-green-800">{problem.feedback}</p>
              </div>
            )}

            {isDone && problem.doneAt && (
              <p className="text-xs text-gray-400 mt-2">
                ✅ Completed {new Date(problem.doneAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
              </p>
            )}
          </div>

          {/* Action button */}
          <div className="flex-shrink-0 pt-1">
            {isDone ? (
              <button onClick={() => onMarkPending(problem._id)} disabled={isUpdating}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-50 whitespace-nowrap transition-colors">
                ↩ Reopen
              </button>
            ) : (
              <button onClick={() => setShowFeedback(s => !s)} disabled={isUpdating}
                className={`text-sm px-4 py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 whitespace-nowrap
                  ${showFeedback ? 'bg-gray-500 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700 shadow-sm shadow-green-200 active:scale-95'}`}>
                {isUpdating ? '...' : showFeedback ? '✕ Cancel' : '✅ Done'}
              </button>
            )}
          </div>
        </div>

        {/* Feedback form — inline below content */}
        {!isDone && showFeedback && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-2">📝 Add feedback <span className="font-normal text-gray-400">(optional)</span></p>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="What did you do to resolve this? e.g. Aadhaar seeded, account unfrozen..."
              rows={3}
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-3"
            />
            <div className="flex gap-2">
              <button onClick={handleConfirmDone}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm">
                ✅ Confirm Done
              </button>
              <button onClick={() => { setShowFeedback(false); setFeedback(''); }}
                className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manager problem list ─────────────────────────────────────────────────────
function ManagerList({ problems, onDelete, onToggle }) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    if (!confirm('Delete this problem?')) return;
    setDeletingId(id);
    try { await fetch(`/api/problems/${id}`, { method: 'DELETE' }); onDelete(id); }
    catch { alert('Failed'); }
    finally { setDeletingId(null); }
  };

  if (problems.length === 0) return (
    <div className="text-center py-10 text-gray-400">
      <div className="text-4xl mb-2">📋</div><p>No problems yet.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {problems.map(p => (
        <div key={p._id} className={`bg-white rounded-2xl border p-4 flex items-start gap-3 transition-opacity
          ${p.status === 'done' ? 'opacity-60 border-gray-100' : 'border-gray-200 shadow-sm'}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge status={p.status} />
              {p.customerName && <span className="font-semibold text-gray-800">{p.customerName}</span>}
              <span className="font-mono text-xs text-blue-700 font-bold">{p.accountNo}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1">
              {p.dateOfBirth && <span className="text-xs text-gray-500">🎂 {p.dateOfBirth}</span>}
              {p.customerId  && <span className="text-xs text-gray-400 font-mono">{p.customerId}</span>}
              {p.mobileNo    && <span className="text-xs text-gray-500 font-mono">📞 {p.mobileNo}</span>}
            </div>
            {p.remarks   && <p className="text-sm text-gray-600 line-clamp-2 mt-1">{p.remarks}</p>}
            {p.feedback  && <p className="text-xs text-green-700 mt-1 italic">💬 {p.feedback}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(p.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => onToggle(p._id, p.status === 'done' ? 'pending' : 'done')}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
                ${p.status === 'done' ? 'border-orange-300 text-orange-600 hover:bg-orange-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}>
              {p.status === 'done' ? '↩' : '✅'}
            </button>
            <button onClick={() => handleDelete(p._id)} disabled={deletingId === p._id}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">
              {deletingId === p._id ? '...' : '🗑️'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ProblemsPage() {
  const router = useRouter();
  const [view, setView]           = useState('staff');
  const [isManager, setIsManager] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [problems, setProblems]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('pending');
  const [updatingId, setUpdatingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Detect role
  useEffect(() => {
    fetch('/api/auth/whoami').then(r => r.json()).then(data => {
      if (data.role === 'manager') { setIsManager(true); setView('manager'); }
    }).catch(() => {}).finally(() => setRoleLoaded(true));
  }, []);

  // Fetch problems
  const fetchProblems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/problems');
      const data = await res.json();
      if (data.success) setProblems(data.problems);
    } catch { console.error('Failed'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchProblems(); }, []);

  // Close modal on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const patchProblem = async (id, body) => {
    setUpdatingId(id);
    try {
      const res  = await fetch(`/api/problems/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) setProblems(prev => prev.map(p => p._id === id ? { ...p, ...data.problem } : p));
    } catch { alert('Update failed'); }
    finally { setUpdatingId(null); }
  };

  const handleMarkDone    = (id, feedback = '') => patchProblem(id, { status: 'done', feedback });
  const handleMarkPending = (id)               => patchProblem(id, { status: 'pending' });
  const handleToggle      = (id, status)       => status === 'done' ? handleMarkDone(id) : handleMarkPending(id);
  const handleAdded       = p                  => setProblems(prev => [p, ...prev]);
  const handleDeleted     = id                 => setProblems(prev => prev.filter(p => p._id !== id));

  const filtered     = problems.filter(p => filter === 'all' ? true : p.status === filter);
  const pendingCount = problems.filter(p => p.status === 'pending').length;
  const doneCount    = problems.filter(p => p.status === 'done').length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky top nav ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

          {/* Left: back (manager only) + title */}
          <div className="flex items-center gap-2 min-w-0">
            {isManager && (
              <button onClick={() => router.push('/')}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                title="Back to dashboard">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-none truncate">Problem Tracker</h1>
              <p className="text-xs text-gray-400 hidden sm:block">PNB Rajnagar</p>
            </div>
          </div>

          {/* Right: view toggle or role badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isManager && view === 'manager' && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add Problem</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
            {roleLoaded && (
              isManager
                ? <ViewToggle view={view} setView={setView} />
                : <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-xl font-medium whitespace-nowrap">👷 Staff</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="w-full max-w-5xl mx-auto px-4 py-5 sm:py-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total',   count: problems.length, bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-400'   },
            { label: 'Pending', count: pendingCount,     bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-400' },
            { label: 'Done',    count: doneCount,        bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-400'  },
          ].map(({ label, count, bg, text, border, dot }) => (
            <div key={label} className={`rounded-2xl border ${bg} ${text} ${border} p-3 sm:p-4 text-center`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                <p className="text-xs font-medium opacity-80">{label}</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{count}</p>
            </div>
          ))}
        </div>

        {/* ── STAFF VIEW ── */}
        {view === 'staff' && (
          <div>
            {/* Filter tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
              {[
                { key: 'pending', label: '⏳ Pending', count: pendingCount },
                { key: 'done',    label: '✅ Done',    count: doneCount    },
                { key: 'all',     label: '📋 All',     count: problems.length },
              ].map(({ key, label, count }) => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border whitespace-nowrap flex-shrink-0
                    ${filter === key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                  {label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                    ${filter === key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-20 text-gray-400">
                <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Loading tasks...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="text-6xl mb-4">{filter === 'pending' ? '🎉' : '📭'}</div>
                <p className="font-bold text-xl text-gray-600">
                  {filter === 'pending' ? 'All clear!' : 'Nothing here'}
                </p>
                <p className="text-sm mt-2 text-gray-400">
                  {filter === 'pending' ? 'No pending tasks right now.' : 'Try a different filter.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map(problem => (
                  <ProblemCard key={problem._id} problem={problem}
                    onMarkDone={handleMarkDone} onMarkPending={handleMarkPending}
                    isUpdating={updatingId === problem._id} isManager={isManager} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MANAGER VIEW ── */}
        {view === 'manager' && isManager && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                All Problems <span className="text-gray-400 font-normal normal-case">({problems.length})</span>
              </h3>
              <button onClick={fetchProblems} className="text-xs text-blue-600 hover:underline">🔄 Refresh</button>
            </div>
            {loading
              ? <div className="text-center py-10 text-gray-400">Loading...</div>
              : <ManagerList problems={problems} onDelete={handleDeleted} onToggle={handleToggle} />
            }
          </div>
        )}
      </div>

      {/* ── Add Problem Modal ── */}
      {showModal && (
        <AddProblemModal
          onAdded={(p) => { handleAdded(p); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
