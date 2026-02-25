'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PAGE_SIZE = 10;

export default function Home() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // ── Upload form state ────────────────────────────────────────────────────
  const [pdfFile, setPdfFile]           = useState(null);
  const [photoFile, setPhotoFile]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [scheme, setScheme]             = useState('');
  const [apy, setApy]                   = useState(false);
  const [aadhaarNo, setAadhaarNo]       = useState('');
  const [aadhaarError, setAadhaarError] = useState('');
  const [dragging, setDragging]         = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState(null);

  // ── Table state ──────────────────────────────────────────────────────────
  const [records, setRecords]           = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [search, setSearch]             = useState('');
  const [searchInput, setSearchInput]   = useState('');
  const [fromDate, setFromDate]         = useState('');
  const [toDate, setToDate]             = useState('');
  const [page, setPage]                 = useState(1);
  const [pagination, setPagination]     = useState({ total: 0, totalPages: 1 });

  // ── Fetch records ────────────────────────────────────────────────────────
  const fetchRecords = async (opts = {}) => {
    setLoadingRecords(true);
    try {
      const p      = opts.page     ?? page;
      const s      = opts.search   ?? search;
      const from   = opts.fromDate ?? fromDate;
      const to     = opts.toDate   ?? toDate;

      const params = new URLSearchParams({ page: p });
      if (s)    params.set('search', s);
      if (from) params.set('fromDate', from);
      if (to)   params.set('toDate', to);

      const res  = await fetch(`/api/records?${params}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
        setPagination(data.pagination);
      }
    } catch { console.error('Failed to load records'); }
    finally  { setLoadingRecords(false); }
  };

  useEffect(() => { fetchRecords(); }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') { setPdfFile(f); setError(null); setResult(null); }
    else setError('Please drop a PDF file.');
  }, []);

  const handlePhotoChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleAadhaarChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setAadhaarNo(val);
    if (val && val.length !== 12) setAadhaarError('Aadhaar must be exactly 12 digits');
    else setAadhaarError('');
  };

  const handleUpload = async () => {
    if (!pdfFile) return;
    if (!aadhaarNo || aadhaarNo.length !== 12) {
      setAadhaarError('Aadhaar must be exactly 12 digits');
      return;
    }
    setUploading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append('pdf', pdfFile);
      if (photoFile) fd.append('photo', photoFile);
      fd.append('scheme', scheme);
      fd.append('apy', String(apy));
      fd.append('aadhaarNo', aadhaarNo);

      const res  = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) { setError(data.error || 'Upload failed'); }
      else {
        setResult(data);
        setPdfFile(null); setPhotoFile(null); setPhotoPreview(null);
        setScheme(''); setApy(false); setAadhaarNo('');
        fetchRecords({ page: 1 });
        setPage(1);
      }
    } catch (err) { setError('Network error: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
    fetchRecords({ search: searchInput, page: 1, fromDate, toDate });
  };

  const handleDateFilter = () => {
    setPage(1);
    fetchRecords({ search, page: 1, fromDate, toDate });
  };

  const handleClearFilters = () => {
    setSearchInput(''); setSearch('');
    setFromDate(''); setToDate('');
    setPage(1);
    fetchRecords({ search: '', page: 1, fromDate: '', toDate: '' });
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchRecords({ page: newPage });
  };


  const handleToggle = async (id, field, currentValue) => {
    // Optimistic update
    setRecords(prev => prev.map(r => r._id === id ? { ...r, [field]: !currentValue } : r));
    try {
      const res = await fetch('/api/account/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value: !currentValue }),
      });
      if (!res.ok) {
        // Revert on failure
        setRecords(prev => prev.map(r => r._id === id ? { ...r, [field]: currentValue } : r));
      }
    } catch {
      setRecords(prev => prev.map(r => r._id === id ? { ...r, [field]: currentValue } : r));
    }
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
const handlePastePhoto = (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (!blob) return;

      // Create a proper File object
      const file = new File([blob], `screenshot-${Date.now()}.png`, {
        type: blob.type,
      });

      setPhotoFile(file);

      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);

      break;
    }
  }
};
  const hasFilters = search || fromDate || toDate;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-lg">P</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PNB Form Data Extractor</h1>
            <p className="text-gray-500 text-sm">Upload FORM-33 → Extract → Save to MongoDB, Google Sheets & Drive</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>

      {/* ── Upload Card ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Upload Form</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: PDF + Aadhaar */}
          <div className="flex flex-col gap-4">
            {/* PDF drop zone */}
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
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setPdfFile(f); setError(null); setResult(null); } }} />
                <div className="text-4xl mb-2">📄</div>
                {pdfFile ? (
                  <div>
                    <p className="text-blue-700 font-semibold text-sm">{pdfFile.name}</p>
                    <p className="text-gray-400 text-xs mt-1">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Drag & drop or <span className="text-blue-600 underline">click to browse</span></p>
                    <p className="text-gray-400 text-xs mt-1">PNB Account Opening Form (FORM-33)</p>
                  </div>
                )}
              </div>
              {pdfFile && <button onClick={() => setPdfFile(null)} className="mt-1 text-xs text-red-400 hover:text-red-600">✕ Remove PDF</button>}
            </div>

            {/* Aadhaar input — mandatory */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🪪 Aadhaar Number <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal text-xs ml-1">(12 digits, mandatory)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={aadhaarNo}
                onChange={handleAadhaarChange}
                placeholder="Enter 12-digit Aadhaar number"
                maxLength={12}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2
                  ${aadhaarError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-blue-500'}`}
              />
              <div className="flex items-center justify-between mt-1">
                {aadhaarError
                  ? <p className="text-red-500 text-xs">{aadhaarError}</p>
                  : <p className="text-gray-400 text-xs">This will be saved as the actual Aadhaar number</p>
                }
                <p className={`text-xs font-mono ${aadhaarNo.length === 12 ? 'text-green-600' : 'text-gray-400'}`}>
                  {aadhaarNo.length}/12
                </p>
              </div>
            </div>
          </div>

          {/* Right: Photo + Scheme + APY */}
          <div className="flex flex-col gap-4">

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🖼️ Customer Photo <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <div className="flex items-center gap-3">
                <div
                tabIndex={0}
                onPaste={handlePastePhoto}
                  onClick={() => document.getElementById('photoInput').click()}
                  className="flex-1 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input id="photoInput" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="h-20 w-20 object-cover rounded-lg mx-auto" />
                    : <div><div className="text-3xl mb-1">👤</div><p className="text-gray-400 text-xs">Click to upload photo</p></div>
                  }
                </div>
                {photoFile && <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="text-xs text-red-400 hover:text-red-600">✕</button>}
              </div>
            </div>

            {/* Scheme */}
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

            {/* APY */}
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

        {/* Submit */}
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

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">❌ {error}</div>}

      {/* ── Result ────────────────────────────────────────────────────────── */}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-green-700 mb-4">✅ Data Saved Successfully</h2>

          <div className="flex flex-wrap gap-3 mb-5">
            {[
              { label: '🗄️ MongoDB', ok: result.mongodb?.saved, msg: result.mongodb?.saved ? 'Saved' : 'Failed' },
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

      {/* ── Records Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

        {/* Table Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Saved Records</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {pagination.total} total account{pagination.total !== 1 ? 's' : ''}
              {hasFilters && ' (filtered)'}
            </p>
          </div>
          <button onClick={() => fetchRecords()} className="text-blue-600 text-sm hover:underline">🔄 Refresh</button>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">

          {/* Search box */}
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name, account no, mobile, Aadhaar..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium whitespace-nowrap">
              🔍 Search
            </button>
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 border border-gray-300 rounded-xl px-3 py-2 bg-white">
              <span className="text-gray-400 text-xs whitespace-nowrap">From</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="text-sm text-gray-700 focus:outline-none bg-transparent" />
            </div>
            <span className="text-gray-400 text-xs">—</span>
            <div className="flex items-center gap-1.5 border border-gray-300 rounded-xl px-3 py-2 bg-white">
              <span className="text-gray-400 text-xs whitespace-nowrap">To</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="text-sm text-gray-700 focus:outline-none bg-transparent" />
            </div>
            <button onClick={handleDateFilter}
              className="px-3 py-2 bg-gray-700 text-white text-sm rounded-xl hover:bg-gray-800 font-medium whitespace-nowrap">
              Filter
            </button>
          </div>

          {/* Clear */}
          {hasFilters && (
            <button onClick={handleClearFilters}
              className="px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50 whitespace-nowrap">
              ✕ Clear
            </button>
          )}
        </div>

        {/* Active filter summary */}
        {hasFilters && (
          <div className="mb-4 flex flex-wrap gap-2">
            {search && <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-3 py-1 rounded-full">🔍 "{search}"</span>}
            {fromDate && <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-3 py-1 rounded-full">📅 From: {fromDate}</span>}
            {toDate   && <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-3 py-1 rounded-full">📅 To: {toDate}</span>}
          </div>
        )}

        {/* Table */}
        {loadingRecords ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Loading records...
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">📂</div>
            <p className="font-medium">{hasFilters ? 'No records match your filters' : 'No records yet'}</p>
            <p className="text-sm mt-1">{hasFilters ? 'Try adjusting your search or date range' : 'Upload a PDF to get started'}</p>
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
                      <td className="py-3 px-3 text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + i + 1}</td>
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

                      {/* Unfreeze toggle */}
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

                      {/* Passbook toggle */}
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

                      {/* Sign button */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => router.push(`/sign?accountNo=${encodeURIComponent(rec.accountNo)}`)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                            ${rec.signUrl
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
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
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, pagination.total)} of <strong>{pagination.total}</strong> records
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handlePageChange(1)} disabled={page === 1}
                    className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">«</button>
                  <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">‹ Prev</button>

                  {/* Page number buttons */}
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 2)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) => p === '...'
                      ? <span key={`dots-${idx}`} className="px-2 text-gray-400 text-xs">…</span>
                      : <button key={p} onClick={() => handlePageChange(p)}
                          className={`px-3 py-1.5 text-xs rounded-lg border font-medium
                            ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {p}
                        </button>
                    )
                  }

                  <button onClick={() => handlePageChange(page + 1)} disabled={page === pagination.totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next ›</button>
                  <button onClick={() => handlePageChange(pagination.totalPages)} disabled={page === pagination.totalPages}
                    className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}