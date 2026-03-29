'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';

// ─── Constants ────────────────────────────────────────────────────────────────
const SCHEMES    = ['PMSBY', 'PMJJBY'];
const APY_OPTS   = ['Yes', 'No'];
const PAGE_SIZES = [10, 25, 50, 100];

const EMPTY_FORM = {
  customerName: '',
  accountNo:    '',
  adharNo:      '',
  mobileNo:     '',
  scheme:       '',
  apy:          '',
  resetDate: '', 
  newPassbookRequired: false,
};

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  const colors = {
    blue:   'bg-blue-100 text-blue-700 border-blue-200',
    green:  'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    gray:   'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ─── Field & SelectField — TOP LEVEL to preserve input focus ─────────────────
function Field({ label, name, value, onChange, errors, type = 'text', placeholder, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all outline-none
          ${errors?.[name]
            ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200'
            : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100'
          }`}
      />
      {errors?.[name] && <p className="text-red-500 text-xs mt-1">{errors[name]}</p>}
    </div>
  );
}

function SelectField({ label, name, value, onChange, errors, options, placeholder, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(name, e.target.value)}
        className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all outline-none appearance-none bg-no-repeat
          ${errors?.[name]
            ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200'
            : 'border-gray-200 bg-gray-50 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100'
          }`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' strokeWidth='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundPosition: 'right 10px center',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {errors?.[name] && <p className="text-red-500 text-xs mt-1">{errors[name]}</p>}
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
function ReissueModal({ isOpen, onClose, onSaved, editData }) {
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [errors,         setErrors]         = useState({});
  const [saving,         setSaving]         = useState(false);
  const [apiErr,         setApiErr]         = useState('');
  const [customerStatus, setCustomerStatus] = useState('');
  const isEdit = !!editData;

  useEffect(() => {
    if (isOpen) {
      setForm(editData ? {
        customerName: editData.customerName || '',
        accountNo:    editData.accountNo    || '',
        adharNo:      editData.adharNo      || '',
        mobileNo:     editData.mobileNo     || '',
        scheme:       editData.scheme       || '',
        apy:          editData.apy === true ? 'Yes' : (editData.apy === false ? 'No' : ''),
        // resetDate drives checkbox: if date stored → checkbox auto-checked
          resetDate: editData.resetDate
          ? new Date(editData.resetDate).toISOString().split('T')[0]
          : '',
          newPassbookRequired: !!editData.newPassbookRequired,
      } : EMPTY_FORM);
      setErrors({});
      setApiErr('');
      setCustomerStatus('');
    }
  }, [isOpen, editData]);

  const handleChange = useCallback((name, value) => {
    setForm(p => ({ ...p, [name]: value }));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.customerName.trim())                         e.customerName = 'Name is required';
    if (!form.accountNo.trim())                            e.accountNo    = 'Account No is required';
    if (!/^\d{12}$/.test(form.adharNo))                   e.adharNo      = 'Must be 12 digits';
    if (form.mobileNo && !/^\d{10}$/.test(form.mobileNo)) e.mobileNo     = 'Must be 10 digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true); setApiErr(''); setCustomerStatus('');
    try {
      const url    = isEdit ? `/api/reissue-passbook/${editData._id}` : '/api/reissue-passbook';
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setApiErr(data.error || 'Something went wrong'); return; }

      if (!isEdit && data.customerStatus) {
        setCustomerStatus(data.customerStatus);
        setTimeout(() => { onSaved(data.record, false); onClose(); }, 1400);
      } else {
        onSaved(data.record, isEdit);
        onClose();
      }
    } catch (err) {
      setApiErr('Network error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isEdit
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                }
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit Reissue Record' : 'New Reissue Passbook'}</h2>
              <p className="text-xs text-gray-400">{isEdit ? 'Update record details' : 'Fill in the details below'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {apiErr && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {apiErr}
            </div>
          )}

          {customerStatus === 'added' && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm flex items-center gap-2 font-medium">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ✅ Also added to Customer collection
            </div>
          )}
          {customerStatus === 'skipped' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-blue-700 text-sm flex items-center gap-2 font-medium">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ℹ️ Already in Customer collection — skipped
            </div>
          )}

          <Field label="Customer Name" name="customerName" value={form.customerName} onChange={handleChange} errors={errors} placeholder="e.g. Ramesh Kumar" required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account No" name="accountNo" value={form.accountNo} onChange={handleChange} errors={errors} placeholder="e.g. 1234567890" required />
            <Field label="Aadhaar No" name="adharNo"   value={form.adharNo}   onChange={handleChange} errors={errors} placeholder="12-digit number"  required />
          </div>
          <Field label="Mobile No" name="mobileNo" value={form.mobileNo} onChange={handleChange} errors={errors} placeholder="10-digit (optional)" type="tel" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Scheme" name="scheme" value={form.scheme} onChange={handleChange} errors={errors} options={SCHEMES} placeholder="Select scheme"  />
            <SelectField label="APY"    name="apy"    value={form.apy}    onChange={handleChange} errors={errors} options={APY_OPTS} placeholder="Select"         />
          </div>
        </div>

                {/* Reset Required — checkbox state derived from resetDate; no separate boolean stored */}
        <div className="px-6 pb-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer group select-none p-3 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50/40 transition-all">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                checked={!!form.resetDate}
                onChange={e => {
                  if (e.target.checked) {
                    // auto set today's date (optional)
                    const today = new Date().toISOString().split('T')[0];
                    handleChange('resetDate', today);
                  } else {
                    handleChange('resetDate', '');
                  }
                }}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                ${!!form.resetDate ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white group-hover:border-orange-300'}`}>
                {!!form.resetDate && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700">🔄 Reset Required</p>
              <p className="text-xs text-gray-400">Tick and pick a date to mark reset required</p>
            </div>
            {!!form.resetDate && (
              <span className="text-xs font-bold text-orange-600 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full flex-shrink-0">
                Required
              </span>
            )}
          </label>
 
          {/* Animated Reset Date Field */}
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                form.resetDate ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'
              }`}
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Reset Date
                </label>
                <input
                  type="date"
                  value={form.resetDate}
                  onChange={e => handleChange('resetDate', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all
                    border-orange-300 bg-orange-50 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>
 {/* New Passbook Required checkbox */}

            <div className="px-6 pb-4">
          <label className="flex items-center gap-3 cursor-pointer group select-none p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                checked={!!form.newPassbookRequired}
                onChange={e => handleChange('newPassbookRequired', e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                ${form.newPassbookRequired
                  ? 'bg-blue-600 border-blue-600'
                  : 'border-gray-300 bg-white group-hover:border-blue-300'}`}>
                {form.newPassbookRequired && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700">📒 New Passbook Required</p>
              <p className="text-xs text-gray-400">Mark if a new passbook needs to be issued</p>
            </div>
            {form.newPassbookRequired && (
              <span className="text-xs font-bold text-blue-600 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full flex-shrink-0">
                Required
              </span>
            )}
          </label>
        </div>

        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving ? <><Spinner /> Saving...</> : isEdit ? '✏️ Update Record' : '📗 Add Reissue'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ isOpen, onClose, onConfirm, record, deleting }) {
  if (!isOpen || !record) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Record?</h3>
        <p className="text-sm text-gray-500 mb-1">You are about to delete</p>
        <p className="text-sm font-semibold text-gray-800 mb-4">{record.customerName} — {record.accountNo}</p>
        <p className="text-xs text-red-500 mb-6">This only removes the reissue record, not the customer.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {deleting ? <><Spinner /> Deleting...</> : '🗑️ Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium min-w-[220px] animate-slide-in
            ${t.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <span>{t.type === 'success' ? '✅' : '❌'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Main page content ────────────────────────────────────────────────────────
function ReissuePassbookContent() {
  const [records,     setRecords]     = useState([]);
  const [pagination,  setPagination]  = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loadingData, setLoadingData] = useState(true);
  const [search,      setSearch]      = useState('');
  const [fromDate,    setFromDate]    = useState('');
  const [toDate,      setToDate]      = useState('');
  const [page,        setPage]        = useState(1);
  const [limit,       setLimit]       = useState(10);
  const [exporting,   setExporting]   = useState('');

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editData,    setEditData]    = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, record: null });
  const [deleting,    setDeleting]    = useState(false);
  const [toasts,      setToasts]      = useState([]);

  const searchTimer = useRef(null);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const fetchRecords = useCallback(async (overrides = {}) => {
    setLoadingData(true);
    const q = new URLSearchParams({
      page:     overrides.page     ?? page,
      limit:    overrides.limit    ?? limit,
      search:   overrides.search   !== undefined ? overrides.search   : search,
      fromDate: overrides.fromDate !== undefined ? overrides.fromDate : fromDate,
      toDate:   overrides.toDate   !== undefined ? overrides.toDate   : toDate,
    });
    try {
      const res  = await fetch(`/api/reissue-passbook?${q}`);
      const data = await res.json();
      if (data.success) { setRecords(data.records); setPagination(data.pagination); }
    } catch { toast('Failed to load records', 'error'); }
    finally  { setLoadingData(false); }
  }, [page, limit, search, fromDate, toDate, toast]);

  useEffect(() => { fetchRecords(); }, [page, limit]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchRecords({ search: val, page: 1 });
    }, 400);
  };

  const applyDateFilter   = () => { setPage(1); fetchRecords({ fromDate, toDate, page: 1 }); };
  const handleLimitChange = (val) => { setLimit(val); setPage(1); fetchRecords({ limit: val, page: 1 }); };

  const clearFilters = () => {
    setSearch(''); setFromDate(''); setToDate('');
    setPage(1);
    fetchRecords({ search: '', fromDate: '', toDate: '', page: 1 });
  };

  const hasFilters = search || fromDate || toDate;

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const q = new URLSearchParams({ format, search, fromDate, toDate });
      const res = await fetch(`/api/reissue-passbook/export?${q}`);
      if (!res.ok) { toast('Export failed', 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `reissue_passbook_${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Exported as ${format.toUpperCase()} successfully!`);
    } catch { toast('Export failed', 'error'); }
    finally  { setExporting(''); }
  };

  const handleSaved = (record, isEdit) => {
    if (isEdit) {
      setRecords(p => p.map(r => r._id === record._id ? record : r));
      toast('Record updated successfully!');
    } else {
      fetchRecords({ page: 1 });
      setPage(1);
      toast('Reissue record added successfully!');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.record) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/reissue-passbook/${deleteModal.record._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Delete failed', 'error'); return; }
      setRecords(p => p.filter(r => r._id !== deleteModal.record._id));
      setPagination(p => ({ ...p, total: p.total - 1 }));
      setDeleteModal({ open: false, record: null });
      toast('Record deleted successfully!');
    } catch { toast('Network error', 'error'); }
    finally  { setDeleting(false); }
  };

  const pmsby  = records.filter(r => r.scheme === 'PMSBY').length;
  const pmjjby = records.filter(r => r.scheme === 'PMJJBY').length;
  const apyYes = records.filter(r => r.apy === true).length;

  return (
    <>
      <style>{`
        @keyframes slide-in { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        .animate-slide-in { animation: slide-in 0.3s ease; }
        @keyframes fade-in  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .animate-fade-in  { animation: fade-in 0.25s ease; }
      `}</style>

      <div className="min-h-screen bg-gray-50">
{/* ── Sticky header ── */}
<div className="sticky top-0 z-30 backdrop-blur bg-white/90 border-b border-gray-200">

  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-4">

    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

      {/* LEFT SECTION */}
      <div className="flex items-center gap-3">

        {/* Back Button */}
        <Link
          href="/"
          className="p-2 rounded-lg hover:bg-gray-100 
          text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>

        {/* Icon */}
        <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 
          rounded-xl flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight">
            Reissue Passbook
          </h1>
          <p className="hidden sm:block text-xs text-gray-400">
            Manage passbook reissue records
          </p>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center gap-2 w-full md:w-auto">

        {/* My Customers */}
        <Link
          href="/customers"
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2
          px-3 py-2 text-xs md:text-sm font-medium
          text-gray-700 bg-gray-100 rounded-lg
          hover:bg-gray-200 transition-all duration-200"
        >
          👥
          <span className="hidden sm:inline">Customers</span>
        </Link>

        {/* Add Reissue */}
        <button
          onClick={() => { setEditData(null); setModalOpen(true); }}
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2
          px-3 py-2 text-xs md:text-sm font-semibold
          text-white bg-emerald-600 rounded-lg
          hover:bg-emerald-700 active:scale-95
          transition-all duration-200 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>

          <span className="hidden sm:inline">Add Reissue</span>
          <span className="sm:hidden">Add</span>
        </button>

      </div>

    </div>
  </div>
</div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Reissues', value: pagination.total, icon: '📗', bg: 'bg-blue-50   border-blue-100',   txt: 'text-blue-700'   },
              { label: 'PMSBY',          value: pmsby,             icon: '🛡️', bg: 'bg-green-50  border-green-100',  txt: 'text-green-700'  },
              { label: 'PMJJBY',         value: pmjjby,            icon: '❤️', bg: 'bg-purple-50 border-purple-100', txt: 'text-purple-700' },
              { label: 'APY Yes',        value: apyYes,            icon: '✅', bg: 'bg-orange-50 border-orange-100', txt: 'text-orange-700' },
            ].map(({ label, value, icon, bg, txt }) => (
              <div key={label} className={`${bg} border rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{icon}</span>
                  <span className="text-xs font-medium text-gray-500">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${txt}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Filters ── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search by name, account no, mobile, aadhaar..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* Date range — column on mobile, row on sm+ */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 flex-1">
                <span className="text-gray-400 text-xs whitespace-nowrap">From</span>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="text-sm text-gray-700 focus:outline-none bg-transparent flex-1 w-full" />
              </div>
              <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 flex-1">
                <span className="text-gray-400 text-xs whitespace-nowrap">To</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="text-sm text-gray-700 focus:outline-none bg-transparent flex-1 w-full" />
              </div>
              <div className="flex gap-2">
                <button onClick={applyDateFilter}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gray-700 text-white text-sm rounded-xl hover:bg-gray-800 font-medium">
                  Apply
                </button>
                {hasFilters && (
                  <button onClick={clearFilters}
                    className="flex-1 sm:flex-none px-3 py-2 border border-red-200 text-red-600 bg-red-50 text-sm rounded-xl hover:bg-red-100 font-medium">
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>

            {/* Active filter badges */}
            {hasFilters && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                {search   && <span className="bg-blue-50   text-blue-700   border border-blue-200   text-xs px-2.5 py-0.5 rounded-full">🔍 "{search}"</span>}
                {fromDate && <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-2.5 py-0.5 rounded-full">📅 From: {fromDate}</span>}
                {toDate   && <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-2.5 py-0.5 rounded-full">📅 To: {toDate}</span>}
              </div>
            )}

            {/* Record count + Export buttons */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {loadingData ? 'Loading...' : `${pagination.total} record${pagination.total !== 1 ? 's' : ''}${hasFilters ? ' (filtered)' : ''}`}
              </p>
              <div className="flex gap-2">
                <button onClick={() => handleExport('excel')} disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50">
                  {exporting === 'excel' ? <Spinner className="h-3.5 w-3.5" /> : '📊'} Excel
                </button>
                <button onClick={() => handleExport('pdf')} disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50">
                  {exporting === 'pdf' ? <Spinner className="h-3.5 w-3.5" /> : '📄'} PDF
                </button>
              </div>
            </div>

          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['#', 'Customer Name', 'Account No', 'Aadhaar No', 'Mobile No', 'Scheme', 'APY', 'Reset Date','New PB', 'Added On', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingData
                    ? Array.from({ length: limit }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          {Array.from({ length: 9 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 bg-gray-100 rounded-lg" style={{ width: `${55 + (j * 17) % 40}%` }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : records.length === 0
                      ? (
                        <tr>
                          <td colSpan={10} className="text-center py-16">
                            <div className="text-5xl mb-3">📗</div>
                            <p className="text-gray-500 font-medium">No reissue records found</p>
                            <p className="text-gray-400 text-xs mt-1">
                              {hasFilters ? 'Try adjusting your search or date filter' : 'Click "Add Reissue" to get started'}
                            </p>
                          </td>
                        </tr>
                      )
                      : records.map((r, i) => (
                        <tr key={r._id} className="hover:bg-blue-50/30 transition-colors animate-fade-in">
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{(page - 1) * limit + i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                                {r.customerName?.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-900 truncate max-w-[160px]">{r.customerName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700 text-xs">{r.accountNo}</td>
                          <td className="px-4 py-3 font-mono text-gray-600 text-xs">
                            {r.adharNo ? r.adharNo.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{r.mobileNo || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3">
                            {r.scheme
                              ? <Badge label={r.scheme} color={r.scheme === 'PMSBY' ? 'green' : 'purple'} />
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Badge label={r.apy === true ? 'Yes' : 'No'} color={r.apy === true ? 'blue' : 'orange'} />
                          </td>
                          <td className="px-4 py-3">
                            {r.resetDate
                              ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                  🔄 {new Date(r.resetDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {r.newPassbookRequired ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">📒 Yes</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditData(r); setModalOpen(true); }}
                                className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Edit">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => setDeleteModal({ open: true, record: r })}
                                className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors" title="Delete">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {loadingData
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 animate-pulse space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/2" />
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                    </div>
                  ))
                : records.length === 0
                  ? <div className="text-center py-16"><div className="text-5xl mb-3">📗</div><p className="text-gray-500 font-medium">No records found</p></div>
                  : records.map(r => (
                    <div key={r._id} className="p-4 hover:bg-blue-50/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
                            {r.customerName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{r.customerName}</p>
                            <p className="text-xs font-mono text-gray-500">{r.accountNo}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setEditData(r); setModalOpen(true); }} className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => setDeleteModal({ open: true, record: r })} className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-400">Aadhaar</p>
                          <p className="text-xs font-mono text-gray-700">{r.adharNo ? r.adharNo.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Mobile</p>
                          <p className="text-xs text-gray-700">{r.mobileNo || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {r.scheme && <Badge label={r.scheme} color={r.scheme === 'PMSBY' ? 'green' : 'purple'} />}
                        <Badge label={`APY: ${r.apy === true ? 'Yes' : 'No'}`} color={r.apy === true ? 'blue' : 'orange'} />
                        {r.resetDate && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                            🔄 {new Date(r.resetDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {r.newPassbookRequired && (<span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">📒 New PB</span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
              }
            </div>

            {/* ── Pagination ── */}
            {!loadingData && pagination.totalPages > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Rows:</span>
                  <select value={limit} onChange={e => handleLimitChange(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs outline-none focus:border-blue-400">
                    {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span>of <strong>{pagination.total}</strong></span>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-colors">«</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>

                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                      acc.push(p); return acc;
                    }, [])
                    .map((p, idx) => p === '...'
                      ? <span key={`dot-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>
                      : <button key={p} onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === p ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 text-gray-600'}`}>
                          {p}
                        </button>
                    )
                  }

                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button onClick={() => setPage(pagination.totalPages)} disabled={page === pagination.totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-colors">»</button>
                </div>

                <p className="text-xs text-gray-400">Page {page} of {pagination.totalPages}</p>
              </div>
            )}
          </div>

        </div>
      </div>

      <ReissueModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null); }}
        onSaved={handleSaved}
        editData={editData}
      />
      <DeleteModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, record: null })}
        onConfirm={handleDelete}
        record={deleteModal.record}
        deleting={deleting}
      />
      <Toast toasts={toasts} />
    </>
  );
}

export default function ReissuePassbookPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner className="h-10 w-10 text-blue-600" />
      </div>
    }>
      <ReissuePassbookContent />
    </Suspense>
  );
}