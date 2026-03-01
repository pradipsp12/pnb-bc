'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SCHEMES    = ['PMSBY', 'PMJJBY'];
const PAGE_SIZES = [10, 25, 50, 100];

function Toast({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium min-w-[220px]
            ${t.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {t.type === 'success' ? '✅' : '❌'} {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Reusable 3-state cycle button: All → Yes → No → All ──────────────────────
// values: '' | trueVal | falseVal
function CycleFilter({ value, onChange, allLabel, trueVal, trueLabel, falseVal, falseLabel, trueColor, falseColor }) {
  const cycle = () => {
    if (value === '')        onChange(trueVal);
    else if (value === trueVal)  onChange(falseVal);
    else                         onChange('');
  };
  const base = 'px-3 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer';
  if (value === trueVal)  return <button onClick={cycle} className={`${base} ${trueColor}`}>{trueLabel}</button>;
  if (value === falseVal) return <button onClick={cycle} className={`${base} ${falseColor}`}>{falseLabel}</button>;
  return <button onClick={cycle} className={`${base} border-gray-200 bg-white text-gray-500 hover:border-gray-300`}>{allLabel}</button>;
}

export default function Home() {
  const router = useRouter();

  // ── Upload state ──────────────────────────────────────────────────────────
  const [pdfFile,      setPdfFile]      = useState(null);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [scheme,       setScheme]       = useState('');
  const [apy,          setApy]          = useState(false);
  const [aadhaarNo,    setAadhaarNo]    = useState('');
  const [aadhaarError, setAadhaarError] = useState('');
  const [dragging,     setDragging]     = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [result,       setResult]       = useState(null);
  const [uploadError,  setUploadError]  = useState(null);

  // ── Table state ───────────────────────────────────────────────────────────
  const [records,        setRecords]        = useState([]);
  const [loadingData,    setLoadingData]    = useState(true);
  const [pagination,     setPagination]     = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [page,           setPage]           = useState(1);
  const [limit,          setLimit]          = useState(10);
  const [searchInput,    setSearchInput]    = useState('');
  const [search,         setSearch]         = useState('');
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [schemeFilter,   setSchemeFilter]   = useState('');
  const [apyFilter,      setApyFilter]      = useState('');
  const [unfreezeFilter, setUnfreezeFilter] = useState(''); // '' | 'done' | 'pending'
  const [passbookFilter, setPassbookFilter] = useState(''); // '' | 'issued' | 'pending'
  const [exporting,      setExporting]      = useState('');
  const [toasts,         setToasts]         = useState([]);

  const searchTimer = useRef(null);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Fetch records ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (overrides = {}) => {
    setLoadingData(true);
    try {
      const q = new URLSearchParams({
        page:      overrides.page      ?? page,
        limit:     overrides.limit     ?? limit,
        search:    overrides.search    !== undefined ? overrides.search    : search,
        fromDate:  overrides.fromDate  !== undefined ? overrides.fromDate  : fromDate,
        toDate:    overrides.toDate    !== undefined ? overrides.toDate    : toDate,
        scheme:    overrides.scheme    !== undefined ? overrides.scheme    : schemeFilter,
        apy:       overrides.apy       !== undefined ? overrides.apy       : apyFilter,
        unfreeze:  overrides.unfreeze  !== undefined ? overrides.unfreeze  : unfreezeFilter,
        passbook:  overrides.passbook  !== undefined ? overrides.passbook  : passbookFilter,
      });
      const res  = await fetch(`/api/records?${q}`);
      const data = await res.json();
      if (data.success) { setRecords(data.records); setPagination(data.pagination); }
    } catch { toast('Failed to load records', 'error'); }
    finally  { setLoadingData(false); }
  }, [page, limit, search, fromDate, toDate, schemeFilter, apyFilter, unfreezeFilter, passbookFilter, toast]);

  useEffect(() => { fetchRecords(); }, [page, limit, schemeFilter, apyFilter, unfreezeFilter, passbookFilter]);

  // ── Search debounced ──────────────────────────────────────────────────────
  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val); setPage(1);
      fetchRecords({ search: val, page: 1 });
    }, 400);
  };

  // ── Date filter ───────────────────────────────────────────────────────────
  const applyDateFilter = () => { setPage(1); fetchRecords({ fromDate, toDate, page: 1 }); };

  // ── Clear all filters ─────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchInput(''); setSearch('');
    setFromDate('');    setToDate('');
    setSchemeFilter(''); setApyFilter('');
    setUnfreezeFilter(''); setPassbookFilter('');
    setPage(1);
    fetchRecords({ search: '', fromDate: '', toDate: '', scheme: '', apy: '', unfreeze: '', passbook: '', page: 1 });
  };

  const hasFilters = search || fromDate || toDate || schemeFilter || apyFilter || unfreezeFilter || passbookFilter;

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async (format) => {
    setExporting(format);
    try {
      const q = new URLSearchParams({ format, search, fromDate, toDate, scheme: schemeFilter, apy: apyFilter, unfreeze: unfreezeFilter, passbook: passbookFilter });
      const res = await fetch(`/api/records/export?${q}`);
      if (!res.ok) { toast('Export failed', 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `records_${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Exported as ${format.toUpperCase()} successfully!`);
    } catch { toast('Export failed', 'error'); }
    finally { setExporting(''); }
  };

  // ── Upload handlers ───────────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') { setPdfFile(f); setUploadError(null); setResult(null); }
    else setUploadError('Please drop a PDF file.');
  }, []);

  const handlePhotoChange = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPhotoFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handlePastePhoto = (e) => {
    const items = e.clipboardData?.items; if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile(); if (!blob) return;
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type });
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = ev => setPhotoPreview(ev.target.result);
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const handleAadhaarChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setAadhaarNo(val);
    setAadhaarError(val && val.length !== 12 ? 'Aadhaar must be exactly 12 digits' : '');
  };

  const handleUpload = async () => {
    if (!pdfFile) return;
    if (!aadhaarNo || aadhaarNo.length !== 12) { setAadhaarError('Aadhaar must be exactly 12 digits'); return; }
    setUploading(true); setUploadError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append('pdf', pdfFile);
      if (photoFile) fd.append('photo', photoFile);
      fd.append('scheme', scheme);
      fd.append('apy', String(apy));
      fd.append('aadhaarNo', aadhaarNo);
      const res  = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || 'Upload failed'); }
      else {
        setResult(data);
        setPdfFile(null); setPhotoFile(null); setPhotoPreview(null);
        setScheme(''); setApy(false); setAadhaarNo('');
        setPage(1); fetchRecords({ page: 1 });
        toast('Data saved successfully!');
      }
    } catch (err) { setUploadError('Network error: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleToggle = async (id, field, currentValue) => {
    setRecords(prev => prev.map(r => r._id === id ? { ...r, [field]: !currentValue } : r));
    try {
      const res = await fetch('/api/account/toggle', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value: !currentValue }),
      });
      if (!res.ok) setRecords(prev => prev.map(r => r._id === id ? { ...r, [field]: currentValue } : r));
    } catch {
      setRecords(prev => prev.map(r => r._id === id ? { ...r, [field]: currentValue } : r));
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const resultFields = [
    { key: 'accountOpenDate', label: 'Account Open Date' },
    { key: 'referenceNo',     label: 'Reference No' },
    { key: 'customerName',    label: 'Customer Name' },
    { key: 'sex',             label: 'Sex' },
    { key: 'dateOfBirth',     label: 'Date of Birth' },
    { key: 'accountNo',       label: 'Account No' },
    { key: 'customerId',      label: 'Customer ID' },
    { key: 'aadhaarNo',       label: 'Aadhaar No' },
    { key: 'mobileNo',        label: 'Mobile No' },
    { key: 'address',         label: 'Address' },
    { key: 'scheme',          label: 'Scheme',  format: v => v || '—' },
    { key: 'apy',             label: 'APY',     format: v => v ? '✅ Yes' : '—' },
    { key: 'photoUploaded',   label: 'Photo',   format: v => v ? '✅ Uploaded' : '—' },
    { key: 'pdfDriveUrl',     label: 'PDF',     format: v =>
        v ? <a href={v} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">📁 View PDF</a> : '—' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Header ── */}
     <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">

  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

    {/* LEFT SIDE */}
    <div className="flex items-center gap-3">
      <Link
        href="/"
        className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 
        rounded-xl flex items-center justify-center 
        text-white font-bold text-lg shadow-md"
      >
        P
      </Link>

      <div>
        <h1 className="text-lg md:text-2xl font-bold text-gray-900 leading-tight">
          PNB Form Data Extractor
        </h1>
        <p className="hidden sm:block text-gray-500 text-xs md:text-sm">
          Upload → Extract → Save Securely
        </p>
      </div>
    </div>

    {/* RIGHT SIDE */}
    <div className="flex items-center gap-2 w-full md:w-auto">

      <Link
        href="/customers"
        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2
        px-3 py-2 text-xs md:text-sm font-semibold
        text-white bg-blue-600 rounded-lg
        hover:bg-blue-700 transition-all duration-200 shadow-sm"
      >
        👥
        <span className="hidden sm:inline">Customers</span>
      </Link>

      <Link
        href="/reissue-passbook"
        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2
        px-3 py-2 text-xs md:text-sm font-semibold
        text-white bg-emerald-600 rounded-lg
        hover:bg-emerald-700 transition-all duration-200 shadow-sm"
      >
        📘
        <span className="hidden sm:inline">Passbook</span>
      </Link>

      <button
        onClick={handleLogout}
        className="flex-1 md:flex-none inline-flex items-center justify-center
        px-3 py-2 text-xs md:text-sm font-medium
        text-red-600 border border-red-200 rounded-lg
        hover:bg-red-50 transition-all duration-200"
      >
        <svg
          className="w-4 h-4 md:mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        <span className="hidden md:inline">Logout</span>
      </button>

    </div>

  </div>
</div>

      {/* ── Upload Card ── */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Upload Form</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📄 Account Opening Form (PDF) <span className="text-red-500">*</span>
              </label>
              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => document.getElementById('pdfInput').click()}
                className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-colors
                  ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
              >
                <input id="pdfInput" type="file" accept="application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setPdfFile(f); setUploadError(null); setResult(null); } }} />
                <div className="text-4xl mb-2">📄</div>
                {pdfFile ? (
                  <div>
                    <p className="text-blue-700 font-semibold text-sm">{pdfFile.name}</p>
                    <p className="text-gray-400 text-xs mt-1">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Drag & drop or <span className="text-blue-600 underline">click to browse</span></p>
                    <p className="text-gray-400 text-xs mt-1">PNB Account Opening Form</p>
                  </div>
                )}
              </div>
              {pdfFile && <button onClick={() => setPdfFile(null)} className="mt-1 text-xs text-red-400 hover:text-red-600">✕ Remove PDF</button>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🪪 Aadhaar Number <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal text-xs ml-1">(12 digits, mandatory)</span>
              </label>
              <input
                type="text" inputMode="numeric"
                value={aadhaarNo} onChange={handleAadhaarChange}
                placeholder="Enter 12-digit Aadhaar number" maxLength={12}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2
                  ${aadhaarError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-500'}`}
              />
              <div className="flex items-center justify-between mt-1">
                {aadhaarError
                  ? <p className="text-red-500 text-xs">{aadhaarError}</p>
                  : <p className="text-gray-400 text-xs">This will be saved as the actual Aadhaar number</p>}
                <p className={`text-xs font-mono ${aadhaarNo.length === 12 ? 'text-green-600' : 'text-gray-400'}`}>{aadhaarNo.length}/12</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🖼️ Customer Photo <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <div className="flex items-center gap-3">
                <div tabIndex={0} onPaste={handlePastePhoto}
                  onClick={() => document.getElementById('photoInput').click()}
                  className="flex-1 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                  <input id="photoInput" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="h-20 w-20 object-cover rounded-lg mx-auto" />
                    : <div><div className="text-3xl mb-1">👤</div><p className="text-gray-400 text-xs">Click to upload or paste photo</p></div>}
                </div>
                {photoFile && <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="text-xs text-red-400 hover:text-red-600">✕</button>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📋 Scheme <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <select value={scheme} onChange={e => setScheme(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Select Scheme</option>
                <option value="PMSBY">PMSBY</option>
                <option value="PMJJBY">PMJJBY</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" checked={apy} onChange={e => setApy(e.target.checked)} className="sr-only" />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    ${apy ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white group-hover:border-blue-400'}`}>
                    {apy && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>}
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700">APY <span className="text-gray-400 text-xs font-normal">(Atal Pension Yojana)</span></span>
              </label>
            </div>
          </div>
        </div>

        <button onClick={handleUpload} disabled={!pdfFile || uploading}
          className={`mt-6 w-full py-3 rounded-xl font-semibold text-white transition-colors
            ${!pdfFile || uploading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'}`}>
          {uploading
            ? <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Processing...
              </span>
            : 'Extract & Save Data'}
        </button>
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">❌ {uploadError}</div>
      )}

      {result && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-green-700 mb-4">✅ Data Saved Successfully</h2>
          <div className="flex flex-wrap gap-3 mb-5">
            {[
              { label: '🗄️ MongoDB', ok: result.mongodb?.saved,     msg: result.mongodb?.saved ? 'Saved' : 'Failed' },
              { label: '📊 Sheets',  ok: result.googleSheets?.saved, msg: result.googleSheets?.saved ? 'Row added' : `Failed: ${result.googleSheets?.error}` },
              { label: '📁 Drive',   ok: !!result.data?.pdfDriveUrl,
                msg: result.data?.pdfDriveUrl
                  ? <a href={result.data.pdfDriveUrl} target="_blank" rel="noreferrer" className="underline">PDF Saved ↗</a>
                  : 'Not saved' },
            ].map(({ label, ok, msg }) => (
              <div key={label} className={`flex-1 min-w-[140px] rounded-xl p-3 text-sm font-medium border
                ${ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                {label}: {msg}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {resultFields.map(({ key, label, format }) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-gray-900 font-medium text-sm break-all">
                  {format ? format(result.data?.[key]) : (result.data?.[key] || <span className="text-gray-400 italic">—</span>)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Records Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Saved Records</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {loadingData ? 'Loading...' : `${pagination.total} record${pagination.total !== 1 ? 's' : ''}${hasFilters ? ' (filtered)' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('excel')} disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 disabled:opacity-50">
              {exporting === 'excel'
                ? <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : '📊'} Excel
            </button>
            <button onClick={() => handleExport('pdf')} disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-50">
              {exporting === 'pdf'
                ? <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : '📄'} PDF
            </button>
            <button onClick={() => fetchRecords()}
              className="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 font-semibold">
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">

          {/* Row 1: Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder="Search by name, account, mobile, Aadhaar, reference..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>

          {/* Row 2: Scheme + APY + Unfreeze + Passbook */}
          <div className="flex flex-wrap gap-2">
            {/* Scheme */}
            <select value={schemeFilter}
              onChange={e => { setSchemeFilter(e.target.value); setPage(1); fetchRecords({ scheme: e.target.value, page: 1 }); }}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 focus:border-blue-500 outline-none">
              <option value="">All Schemes</option>
              {SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* APY cycle: All → Yes → No */}
            <CycleFilter
              value={apyFilter}
              onChange={v => { setApyFilter(v); setPage(1); fetchRecords({ apy: v, page: 1 }); }}
              allLabel="All APY"
              trueVal="Yes"  trueLabel="APY: Yes"  trueColor="border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              falseVal="No"  falseLabel="APY: No"   falseColor="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            />

            {/* Unfreeze cycle: All → Done → Pending */}
            <CycleFilter
              value={unfreezeFilter}
              onChange={v => { setUnfreezeFilter(v); setPage(1); fetchRecords({ unfreeze: v, page: 1 }); }}
              allLabel="All Unfreeze"
              trueVal="done"     trueLabel="✅ Unfrozen"   trueColor="border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              falseVal="pending" falseLabel="⏳ Freeze Pending" falseColor="border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
            />

            {/* Passbook cycle: All → Issued → Pending */}
            <CycleFilter
              value={passbookFilter}
              onChange={v => { setPassbookFilter(v); setPage(1); fetchRecords({ passbook: v, page: 1 }); }}
              allLabel="All Passbook"
              trueVal="issued"   trueLabel="📗 Issued"        trueColor="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              falseVal="pending" falseLabel="📘 PB Pending"   falseColor="border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
            />
          </div>

          {/* Row 3: Date range */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">

  {/* Date Filter Section */}
  <div className="flex flex-col sm:flex-row gap-3 w-full">

    {/* From Date */}
    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white w-full">
      <span className="text-gray-400 text-xs whitespace-nowrap">From</span>
      <input
        type="date"
        value={fromDate}
        onChange={e => setFromDate(e.target.value)}
        className="text-sm text-gray-700 focus:outline-none bg-transparent flex-1 min-w-0"
      />
    </div>

    {/* To Date */}
    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white w-full">
      <span className="text-gray-400 text-xs whitespace-nowrap">To</span>
      <input
        type="date"
        value={toDate}
        onChange={e => setToDate(e.target.value)}
        className="text-sm text-gray-700 focus:outline-none bg-transparent flex-1 min-w-0"
      />
    </div>

    {/* Apply Button */}
    <button
      onClick={applyDateFilter}
      className="w-full sm:w-auto px-4 py-2 bg-gray-700 text-white text-sm rounded-xl hover:bg-gray-800 font-medium"
    >
      Apply
    </button>

  </div>

  {/* Clear Button */}
  {hasFilters && (
    <button
      onClick={clearFilters}
      className="w-full sm:w-auto px-3 py-2 border border-red-200 text-red-600 bg-red-50 text-sm rounded-xl hover:bg-red-100 font-medium"
    >
      ✕ Clear All
    </button>
  )}
</div>

          {/* Active filter badges */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 pt-1">
              {search         && <span className="bg-blue-50   text-blue-700   border border-blue-200   text-xs px-3 py-1 rounded-full">🔍 "{search}"</span>}
              {schemeFilter   && <span className="bg-green-50  text-green-700  border border-green-200  text-xs px-3 py-1 rounded-full">📋 {schemeFilter}</span>}
              {apyFilter      && <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-3 py-1 rounded-full">APY: {apyFilter}</span>}
              {unfreezeFilter && <span className="bg-green-50  text-green-700  border border-green-200  text-xs px-3 py-1 rounded-full">🔓 Unfreeze: {unfreezeFilter}</span>}
              {passbookFilter && <span className="bg-blue-50   text-blue-700   border border-blue-200   text-xs px-3 py-1 rounded-full">📗 Passbook: {passbookFilter}</span>}
              {fromDate       && <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-3 py-1 rounded-full">📅 From: {fromDate}</span>}
              {toDate         && <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-3 py-1 rounded-full">📅 To: {toDate}</span>}
            </div>
          )}
        </div>

        {/* ── Table ── */}
        {loadingData ? (
          <div className="text-center py-12">
            <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-gray-400 text-sm">Loading records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">📂</div>
            <p className="font-medium">{hasFilters ? 'No records match your filters' : 'No records yet'}</p>
            <p className="text-sm mt-1">{hasFilters ? 'Try adjusting your search or filters' : 'Upload a PDF to get started'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    {['#', 'Open Date', 'Customer Name', 'Account No', 'Customer ID', 'Aadhaar No', 'Mobile No', 'Scheme', 'APY', 'Unfreeze', 'Passbook', 'Sign', 'PDF'].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => (
                    <tr key={rec._id} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${i % 2 ? 'bg-gray-50/30' : 'bg-white'}`}>
                      <td className="py-3 px-3 text-gray-400 text-xs">{(page - 1) * limit + i + 1}</td>
                      <td className="py-3 px-3 text-gray-600 whitespace-nowrap text-xs">{rec.accountOpenDate || '—'}</td>
                      <td className="py-3 px-3 font-medium text-gray-900 whitespace-nowrap">{rec.customerName || '—'}</td>
                      <td className="py-3 px-3 text-gray-600 font-mono text-xs">{rec.accountNo || '—'}</td>
                      <td className="py-3 px-3 text-gray-600 font-mono text-xs">{rec.customerId || '—'}</td>
                      <td className="py-3 px-3 text-gray-600 font-mono text-xs">{rec.aadhaarNo || '—'}</td>
                      <td className="py-3 px-3 text-gray-600 text-xs">{rec.mobileNo || '—'}</td>
                      <td className="py-3 px-3">
                        {rec.scheme
                          ? <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{rec.scheme}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        {rec.apy
                          ? <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">APY</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleToggle(rec._id, 'unfreezeStatus', rec.unfreezeStatus)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
                            ${rec.unfreezeStatus ? 'bg-green-500' : 'bg-gray-200'}`}
                          title={rec.unfreezeStatus ? 'Unfreeze: Done' : 'Unfreeze: Pending'}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200
                            ${rec.unfreezeStatus ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleToggle(rec._id, 'passbookIssued', rec.passbookIssued)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
                            ${rec.passbookIssued ? 'bg-blue-500' : 'bg-gray-200'}`}
                          title={rec.passbookIssued ? 'Passbook: Issued' : 'Passbook: Pending'}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200
                            ${rec.passbookIssued ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => router.push(`/sign?accountNo=${encodeURIComponent(rec.accountNo)}`)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                            ${rec.signUrl ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          {rec.signUrl ? 'View' : 'Upload'}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        {rec.pdfDriveUrl
                          ? <a href={rec.pdfDriveUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs font-medium">View ↗</a>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {pagination.totalPages > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Rows:</span>
                  <select value={limit}
                    onChange={e => { const v = Number(e.target.value); setLimit(v); setPage(1); fetchRecords({ limit: v, page: 1 }); }}
                    className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs outline-none focus:border-blue-400">
                    {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span>of <strong>{pagination.total}</strong></span>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => { setPage(1); fetchRecords({ page: 1 }); }} disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold">«</button>
                  <button onClick={() => { const n = Math.max(1, page-1); setPage(n); fetchRecords({ page: n }); }} disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
                    .map((p, idx) => p === '...'
                      ? <span key={`d${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>
                      : <button key={p} onClick={() => { setPage(p); fetchRecords({ page: p }); }}
                          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === p ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                          {p}
                        </button>
                    )
                  }
                  <button onClick={() => { const n = Math.min(pagination.totalPages, page+1); setPage(n); fetchRecords({ page: n }); }} disabled={page === pagination.totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <button onClick={() => { setPage(pagination.totalPages); fetchRecords({ page: pagination.totalPages }); }} disabled={page === pagination.totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold">»</button>
                </div>

                <p className="text-xs text-gray-400">Page {page} of {pagination.totalPages}</p>
              </div>
            )}
          </>
        )}
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}