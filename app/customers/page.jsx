'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────
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
  vip:          false,
};

// ─── Reusable badge ───────────────────────────────────────────────────────────
function Badge({ label, color }) {
  const colors = {
    blue:   'bg-blue-100 text-blue-700 border-blue-200',
    green:  'bg-green-100 text-green-700 border-green-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colors[color] || colors.blue}`}>
      {label}
    </span>
  );
}

// ─── Field & SelectField ──────────────────────────────────────────────────────
// IMPORTANT: These are defined at the TOP LEVEL (outside CustomerModal).
// If defined inside CustomerModal, React treats them as new component types
// on every render, causing inputs to unmount/remount and lose focus after
// every single keystroke.
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
function CustomerModal({ isOpen, onClose, onSaved, editData }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const isEdit = !!editData;

  useEffect(() => {
    if (isOpen) {
      setForm(editData ? {
        customerName: editData.customerName || '',
        accountNo:    editData.accountNo    || '',
        adharNo:      editData.adharNo      || '',
        mobileNo:     editData.mobileNo     || '',
        scheme:       editData.scheme       || '',
        apy:          editData.apy          || '',
        vip:          !!editData.vip,
      } : EMPTY_FORM);
      setErrors({});
      setApiErr('');
    }
  }, [isOpen, editData]);

  // Single shared onChange for all Field / SelectField components
  const handleChange = useCallback((name, value) => {
    setForm(p => ({ ...p, [name]: value }));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.customerName.trim())                         e.customerName = 'Name is required';
    if (!form.accountNo.trim())                            e.accountNo    = 'Account No is required';
    if (!/^\d{12}$/.test(form.adharNo))                   e.adharNo      = 'Must be 12 digits';
    if (form.mobileNo && !/^\d{10}$/.test(form.mobileNo)) e.mobileNo     = 'Must be 10 digits';
    // if (!form.scheme)                                      e.scheme       = 'Select a scheme';
    // if (!form.apy)                                         e.apy          = 'Select APY';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true); setApiErr('');
    try {
      const url    = isEdit ? `/api/customers/${editData._id}` : '/api/customers';
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setApiErr(data.error || 'Something went wrong'); return; }
      onSaved(data.customer, isEdit);
      onClose();
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
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                }
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit Customer' : 'Add New Customer'}</h2>
              <p className="text-xs text-gray-400">{isEdit ? 'Update customer information' : 'Fill in the details below'}</p>
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

          <Field
            label="Customer Name" name="customerName"
            value={form.customerName} onChange={handleChange} errors={errors}
            placeholder="e.g. Ramesh Kumar" required
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Account No" name="accountNo"
              value={form.accountNo} onChange={handleChange} errors={errors}
              placeholder="e.g. 1234567890" required
            />
            <Field
              label="Aadhaar No" name="adharNo"
              value={form.adharNo} onChange={handleChange} errors={errors}
              placeholder="12-digit number" required
            />
          </div>
          <Field
            label="Mobile No" name="mobileNo"
            value={form.mobileNo} onChange={handleChange} errors={errors}
            placeholder="10-digit (optional)" type="tel"
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Scheme" name="scheme"
              value={form.scheme} onChange={handleChange} errors={errors}
              options={SCHEMES} placeholder="Select scheme" 
            />
            <SelectField
              label="APY" name="apy"
              value={form.apy} onChange={handleChange} errors={errors}
              options={APY_OPTS} placeholder="Select" 
            />
          </div>

          {/* VIP checkbox — only shown when editing */}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer group select-none p-3 rounded-xl border border-gray-200 hover:border-yellow-300 hover:bg-yellow-50/50 transition-all">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={form.vip}
                  onChange={e => handleChange('vip', e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                  ${form.vip ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300 bg-white group-hover:border-yellow-300'}`}>
                  {form.vip && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  ⭐ VIP Customer
                </p>
                <p className="text-xs text-gray-400">Mark this customer as VIP</p>
              </div>
              {form.vip && (
                <span className="ml-auto text-xs font-bold text-yellow-600 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full">VIP</span>
              )}
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Saving...</>
              : isEdit ? '✏️ Update Customer' : '➕ Add Customer'
            }
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ isOpen, onClose, onConfirm, customer, deleting }) {
  if (!isOpen || !customer) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Customer?</h3>
        <p className="text-sm text-gray-500 mb-1">You are about to delete</p>
        <p className="text-sm font-semibold text-gray-800 mb-4">{customer.customerName} — {customer.accountNo}</p>
        <p className="text-xs text-red-500 mb-6">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {deleting
              ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Deleting...</>
              : '🗑️ Delete'
            }
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
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium min-w-[220px] animate-slide-in
            ${t.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
        >
          <span>{t.type === 'success' ? '✅' : '❌'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function CustomersPageContent() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [customers,    setCustomers]    = useState([]);
  const [pagination,   setPagination]   = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loadingData,  setLoadingData]  = useState(true);
  const [search,       setSearch]       = useState(searchParams.get('search') || '');
  const [schemeFilter, setSchemeFilter] = useState(searchParams.get('scheme') || '');
  const [apyFilter,    setApyFilter]    = useState(searchParams.get('apy')    || '');
  const [vipFilter,    setVipFilter]    = useState('');
  const [fromDate,     setFromDate]     = useState('');
  const [toDate,       setToDate]       = useState('');
  const [page,         setPage]         = useState(Number(searchParams.get('page')  || 1));
  const [limit,        setLimit]        = useState(Number(searchParams.get('limit') || 10));

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editData,    setEditData]    = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, customer: null });
  const [deleting,    setDeleting]    = useState(false);
  const [exporting,   setExporting]   = useState('');
  const [toasts,      setToasts]      = useState([]);

  const searchTimer = useRef(null);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const fetchCustomers = useCallback(async (overrides = {}) => {
    setLoadingData(true);
    const q = new URLSearchParams({
      page:   overrides.page   ?? page,
      limit:  overrides.limit  ?? limit,
      search: overrides.search !== undefined ? overrides.search : search,
      scheme:    overrides.scheme    !== undefined ? overrides.scheme    : schemeFilter,
      apy:       overrides.apy       !== undefined ? overrides.apy       : apyFilter,
      vip:       overrides.vip       !== undefined ? overrides.vip       : vipFilter,
      fromDate:  overrides.fromDate  !== undefined ? overrides.fromDate  : fromDate,
      toDate:    overrides.toDate    !== undefined ? overrides.toDate    : toDate,
    });
    try {
      const res  = await fetch(`/api/customers?${q}`);
      const data = await res.json();
      if (data.success) {
        console.log('Fetched customers:', data.customers);
        setCustomers(data.customers);
        setPagination(data.pagination);
      }
    } catch {
      toast('Failed to load customers', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [page, limit, search, schemeFilter, apyFilter, vipFilter, fromDate, toDate, toast]);

  useEffect(() => { fetchCustomers(); }, [page, limit, schemeFilter, apyFilter, vipFilter]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchCustomers({ search: val, page: 1 });
    }, 400);
  };

  const handleSchemeFilter = (val) => { setSchemeFilter(val); setPage(1); fetchCustomers({ scheme: val, page: 1 }); };
  const handleApyFilter    = (val) => { setApyFilter(val);    setPage(1); fetchCustomers({ apy: val,    page: 1 }); };
  const handleVipFilter    = (val) => { setVipFilter(val);    setPage(1); fetchCustomers({ vip: val,    page: 1 }); };
  const handleLimitChange  = (val) => { setLimit(val);        setPage(1); fetchCustomers({ limit: val,  page: 1 }); };
  const applyDateFilter    = ()    => { setPage(1);           fetchCustomers({ fromDate, toDate, page: 1 }); };

  const handleSaved = (customer, isEdit) => {
    if (isEdit) {
      setCustomers(p => p.map(c => c._id === customer._id ? customer : c));
      toast('Customer updated successfully!');
    } else {
      fetchCustomers({ page: 1 });
      setPage(1);
      toast('Customer added successfully!');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.customer) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/customers/${deleteModal.customer._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Delete failed', 'error'); return; }
      setCustomers(p => p.filter(c => c._id !== deleteModal.customer._id));
      setPagination(p => ({ ...p, total: p.total - 1 }));
      setDeleteModal({ open: false, customer: null });
      toast('Customer deleted successfully!');
    } catch {
      toast('Network error', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const q   = new URLSearchParams({ format, search, scheme: schemeFilter, apy: apyFilter, vip: vipFilter, fromDate, toDate });
      const res = await fetch(`/api/customers/export?${q}`);
      if (!res.ok) { toast('Export failed', 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `customers_${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Exported as ${format.toUpperCase()} successfully!`);
    } catch {
      toast('Export failed', 'error');
    } finally {
      setExporting('');
    }
  };

  const clearFilters = () => {
    setSearch(''); setSchemeFilter(''); setApyFilter('');
    setVipFilter(''); setFromDate(''); setToDate('');
    setPage(1);
    fetchCustomers({ search: '', scheme: '', apy: '', vip: '', fromDate: '', toDate: '', page: 1 });
  };

  const hasFilters = search || schemeFilter || apyFilter || vipFilter || fromDate || toDate;

  return (
    <>
      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.25s ease; }
      `}</style>

      <div className="min-h-screen bg-gray-50">

       {/* Sticky header */}
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
        <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 
          rounded-xl flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight">
            Customers
          </h1>
          <p className="hidden sm:block text-xs text-gray-400">
            Manage all customer records
          </p>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex items-center gap-2 w-full md:w-auto">

        {/* Reissue Button */}
        <Link
          href="/reissue-passbook"
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2
          px-3 py-2 text-xs md:text-sm font-medium
          text-gray-700 bg-gray-100 rounded-lg
          hover:bg-gray-200 transition-all duration-200"
        >
          📘
          <span className="hidden sm:inline">Passbook</span>
        </Link>

        {/* Add Customer Button */}
        <button
          onClick={() => { setEditData(null); setModalOpen(true); }}
          className="flex-1 md:flex-none inline-flex items-center justify-center gap-2
          px-3 py-2 text-xs md:text-sm font-semibold
          text-white bg-blue-600 rounded-lg
          hover:bg-blue-700 active:scale-95
          transition-all duration-200 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>

          <span className="hidden sm:inline">Add Customer</span>
          <span className="sm:hidden">Add</span>
        </button>

      </div>

    </div>
  </div>
</div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total',   value: pagination.total,                                    icon: '👥', color: 'blue'   },
              { label: 'PMSBY',   value: customers.filter(c => c.scheme === 'PMSBY').length,  icon: '🛡️', color: 'green'  },
              { label: 'PMJJBY', value: customers.filter(c => c.scheme === 'PMJJBY').length, icon: '❤️', color: 'purple' },
              { label: 'APY Yes', value: customers.filter(c => c.apy === 'Yes').length,       icon: '✅', color: 'orange' },
            ].map(({ label, value, icon, color }) => {
              const bg  = { blue: 'bg-blue-50 border-blue-100', green: 'bg-green-50 border-green-100', purple: 'bg-purple-50 border-purple-100', orange: 'bg-orange-50 border-orange-100' };
              const txt = { blue: 'text-blue-700', green: 'text-green-700', purple: 'text-purple-700', orange: 'text-orange-700' };
              return (
                <div key={label} className={`${bg[color]} border rounded-2xl p-4`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{icon}</span>
                    <span className="text-xs font-medium text-gray-500">{label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${txt[color]}`}>{value}</p>
                </div>
              );
            })}
          </div>

          {/* Search & filters */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search by name, account, mobile, aadhaar..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <select
                  value={schemeFilter}
                  onChange={e => handleSchemeFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="">All Schemes</option>
                  {SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={apyFilter}
                  onChange={e => handleApyFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="">All APY</option>
                  {APY_OPTS.map(a => <option key={a} value={a}>APY: {a}</option>)}
                </select>
                {/* VIP filter */}
                <select
                  value={vipFilter}
                  onChange={e => handleVipFilter(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="">All VIP</option>
                  <option value="Yes">⭐ VIP Only</option>
                  <option value="No">Non-VIP</option>
                </select>
                {hasFilters && (
                  <button onClick={clearFilters} className="px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors flex-shrink-0">
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>

            {/* Date range row */}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100 sm:flex-row sm:items-center sm:gap-3">
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
              <button onClick={applyDateFilter}
                className="w-full sm:w-auto px-4 py-2 bg-gray-700 text-white text-sm rounded-xl hover:bg-gray-800 font-medium">
                Apply
              </button>
            </div>

            {/* Active filter badges */}
            {hasFilters && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                {search      && <span className="bg-blue-50   text-blue-700   border border-blue-200   text-xs px-2.5 py-0.5 rounded-full">🔍 "{search}"</span>}
                {schemeFilter && <span className="bg-green-50  text-green-700  border border-green-200  text-xs px-2.5 py-0.5 rounded-full">📋 {schemeFilter}</span>}
                {apyFilter    && <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2.5 py-0.5 rounded-full">APY: {apyFilter}</span>}
                {vipFilter    && <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs px-2.5 py-0.5 rounded-full">⭐ VIP: {vipFilter}</span>}
                {fromDate     && <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-2.5 py-0.5 rounded-full">📅 From: {fromDate}</span>}
                {toDate       && <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-2.5 py-0.5 rounded-full">📅 To: {toDate}</span>}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {loadingData ? 'Loading...' : `${pagination.total} record${pagination.total !== 1 ? 's' : ''} found`}
              </p>
              <div className="flex gap-2">
                <button onClick={() => handleExport('excel')} disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50">
                  {exporting === 'excel'
                    ? <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : '📊'} Excel
                </button>
                <button onClick={() => handleExport('pdf')} disabled={!!exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50">
                  {exporting === 'pdf'
                    ? <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : '📄'} PDF
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['#', 'Customer Name', 'Account No', 'Aadhaar No', 'Mobile No', 'Scheme', 'APY', 'VIP', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingData
                    ? Array.from({ length: limit }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          {Array.from({ length: 10 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded-lg" style={{ width: `${60 + (j * 17) % 40}%` }} /></td>
                          ))}
                        </tr>
                      ))
                    : customers.length === 0
                      ? (
                        <tr>
                          <td colSpan={10} className="text-center py-16">
                            <div className="text-5xl mb-3">🔍</div>
                            <p className="text-gray-500 font-medium">No customers found</p>
                            <p className="text-gray-400 text-xs mt-1">Try adjusting your search or filters</p>
                          </td>
                        </tr>
                      )
                      : customers.map((c, i) => (
                        <tr key={c._id} className="hover:bg-blue-50/40 transition-colors animate-fade-in">
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">{(page - 1) * limit + i + 1}</td>
                          <td className="px-4 py-3">
                            <Link href={`/customers/${c._id}/transactions`} className="flex items-center gap-2.5 group">
                              <div className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0 transition-colors">
                                {c.customerName.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-900 group-hover:text-blue-600 truncate max-w-[140px] transition-colors">{c.customerName}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700 text-xs">{c.accountNo}</td>
                          <td className="px-4 py-3 font-mono text-gray-600 text-xs">{c.adharNo.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}</td>
                          <td className="px-4 py-3 text-gray-600">{c.mobileNo || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3"><Badge label={c.scheme} color={c.scheme === 'PMSBY' ? 'green' : 'purple'} /></td>
                          <td className="px-4 py-3"><Badge label={c.apy? 'Yes' : 'No'} color={c.apy === 'Yes' ? 'blue' : 'orange'} /></td>
                          <td className="px-4 py-3">
                            {c.vip
                              ? <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full">⭐ VIP</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditData(c); setModalOpen(true); }}
                                className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors" title="Edit">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => setDeleteModal({ open: true, customer: c })}
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
                : customers.length === 0
                  ? <div className="text-center py-16"><div className="text-5xl mb-3">🔍</div><p className="text-gray-500 font-medium">No customers found</p></div>
                  : customers.map((c) => (
                    <div key={c._id} className="p-4 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
                            {c.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/customers/${c._id}/transactions`} className="font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate block">{c.customerName}</Link>
                            <p className="text-xs font-mono text-gray-500">{c.accountNo}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setEditData(c); setModalOpen(true); }} className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => setDeleteModal({ open: true, customer: c })} className="p-2 rounded-lg hover:bg-red-100 text-red-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-400">Aadhaar</p>
                          <p className="text-xs font-mono text-gray-700">{c.adharNo.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Mobile</p>
                          <p className="text-xs text-gray-700">{c.mobileNo || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge label={c.scheme} color={c.scheme === 'PMSBY' ? 'green' : 'purple'} />
                        <Badge label={`APY: ${c.apy}`} color={c.apy === 'Yes' ? 'blue' : 'orange'} />
                        {c.vip && <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded-full">⭐ VIP</span>}
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
              }
            </div>

            {/* Pagination */}
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
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '...'
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

      <CustomerModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null); }}
        onSaved={handleSaved}
        editData={editData}
      />
      <DeleteModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, customer: null })}
        onConfirm={handleDelete}
        customer={deleteModal.customer}
        deleting={deleting}
      />
      <Toast toasts={toasts} />
    </>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>
    }>
      <CustomersPageContent />
    </Suspense>
  );
}