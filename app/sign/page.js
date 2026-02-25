'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Cropper from 'react-easy-crop';

function SignPageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const accountNo    = searchParams.get('accountNo') || '';

  const [account, setAccount]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [signFile, setSignFile]     = useState(null);
  const [preview, setPreview]       = useState(null);
  const [dragging, setDragging]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');

  // crop states
  const [crop, setCrop]                   = useState({ x: 0, y: 0 });
  const [zoom, setZoom]                   = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropper, setShowCropper]     = useState(false);
  const [rotation, setRotation]           = useState(0);
  const [aspect, setAspect]               = useState(4 / 3); // ✅ dynamic aspect

  const ASPECT_RATIOS = [
    { label: '4:3',  value: 4 / 3 },
    { label: '3:4',  value: 3 / 4 },
    { label: '1:1',  value: 1 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: 'Free', value: null },
  ];

  // Load account info
  useEffect(() => {
    if (!accountNo) { setNotFound(true); setLoading(false); return; }
    fetch(`/api/account/sign?accountNo=${encodeURIComponent(accountNo)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setAccount(data.account);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [accountNo]);

  const handleFile = (file) => {
    if (!file) return;

    if (!['image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Only JPG/JPEG files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB');
      return;
    }

    setError('');
    setSignFile(file);
    setAspect(4 / 3); // reset aspect on new file
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleSubmit = async () => {
    if (!signFile) { setError('Please select a signature image'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      if (preview) {
        const blob = await (await fetch(preview)).blob();
        fd.append('sign', blob, 'signature.jpg');
      }
      fd.append('accountNo', accountNo);

      const res  = await fetch('/api/account/sign', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) { setError(data.error || 'Upload failed'); }
      else {
        setSuccess(true);
        setAccount(prev => ({ ...prev, signUrl: data.signUrl }));
        setSignFile(null); setPreview(null);
      }
    } catch (err) { setError('Network error: ' + err.message); }
    finally { setUploading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <p className="text-gray-500">Loading account...</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Account Not Found</h2>
        <p className="text-gray-500 mb-6">No account found for: <code className="bg-gray-100 px-2 py-1 rounded">{accountNo}</code></p>
        <button onClick={() => router.push('/')} className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">

        {/* Back button */}
        <button onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">✍️</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Customer Signature</h1>
              <p className="text-gray-500 text-sm">{account?.customerName}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Account No</p>
              <p className="font-mono text-sm font-semibold text-gray-800">{account?.accountNo}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sign Status</p>
              <p className={`text-sm font-semibold ${account?.signUrl ? 'text-green-600' : 'text-orange-500'}`}>
                {account?.signUrl ? '✅ Uploaded' : '⏳ Pending'}
              </p>
            </div>
          </div>
        </div>

        {/* Existing sign */}
        {account?.signUrl && !success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5">
            <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Signature already uploaded
            </h3>
            <a href={account.signUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              View / Download Sign
            </a>
            <p className="text-green-700 text-xs mt-3">You can re-upload below to replace the existing signature.</p>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-5">
            <p className="text-green-700 font-semibold mb-2">✅ Signature uploaded successfully!</p>
            <a href={account?.signUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              View / Download Sign
            </a>
          </div>
        )}

        {/* ✅ Cropper Modal with dynamic aspect ratio */}
        {showCropper && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[90%] max-w-md">

              <h3 className="text-base font-semibold text-gray-800 mb-3">Crop Signature</h3>

              {/* Crop area */}
              <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
                <Cropper
                  image={preview}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}             // ✅ dynamic
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                />
              </div>

              {/* ✅ Aspect Ratio Selector */}
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                  Aspect Ratio
                </label>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map(({ label, value }) => (
                    <button
                      key={label}
                      onClick={() => setAspect(value)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border transition-colors
                        ${aspect === value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-100 text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom */}
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                  Zoom
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* Rotate */}
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                  Rotate — {rotation}°
                </label>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => {
                    setShowCropper(false);
                    setSignFile(null);
                    setPreview(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const croppedImage = await getCroppedImg(preview, croppedAreaPixels, rotation);
                    setPreview(croppedImage);
                    setShowCropper(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Crop & Save
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Upload card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {account?.signUrl ? 'Replace Signature' : 'Upload Signature'}
          </h2>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => document.getElementById('signInput').click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4
              ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
          >
            <input id="signInput" type="file" accept="image/jpeg,image/jpg" className="hidden"
              onChange={e => handleFile(e.target.files?.[0])} />

            {preview ? (
              <div>
                <img src={preview} alt="Sign preview" className="max-h-36 mx-auto rounded-lg border border-gray-200 mb-3 object-contain" />
                <p className="text-blue-700 font-medium text-sm">{signFile?.name}</p>
                <p className="text-gray-400 text-xs mt-1">{signFile ? (signFile.size / 1024).toFixed(1) + ' KB' : ''}</p>
              </div>
            ) : (
              <div>
                <div className="text-5xl mb-3">✍️</div>
                <p className="text-gray-700 font-medium text-sm">Drag & drop or <span className="text-blue-600 underline">click to browse</span></p>
                <p className="text-gray-400 text-xs mt-2">JPG / JPEG only • Max 5MB</p>
              </div>
            )}
          </div>

          {/* Re-crop button — shown after crop is done */}
          {preview && !showCropper && signFile && (
            <button
              onClick={() => setShowCropper(true)}
              className="text-xs text-blue-500 hover:text-blue-700 mb-2 block font-medium"
            >
              ✂️ Re-crop
            </button>
          )}

          {/* Remove preview */}
          {signFile && (
            <button onClick={() => { setSignFile(null); setPreview(null); setError(''); }}
              className="text-xs text-red-400 hover:text-red-600 mb-3 block">✕ Remove</button>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4">❌ {error}</div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={!signFile || uploading}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-colors
              ${!signFile || uploading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'}`}>
            {uploading
              ? <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Uploading to Drive...
                </span>
              : '📤 Upload Signature'
            }
          </button>
        </div>

      </div>
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>
    }>
      <SignPageContent />
    </Suspense>
  );
}

const getCroppedImg = (imageSrc, pixelCrop, rotation = 0) => {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageSrc;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const radians = (rotation * Math.PI) / 180;

      const maxSize = Math.max(image.width, image.height);
      const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

      canvas.width = safeArea;
      canvas.height = safeArea;

      ctx.translate(safeArea / 2, safeArea / 2);
      ctx.rotate(radians);
      ctx.translate(-image.width / 2, -image.height / 2);
      ctx.drawImage(image, 0, 0);

      const offsetX = (safeArea - image.width) / 2;
      const offsetY = (safeArea - image.height) / 2;

      const data = ctx.getImageData(
        pixelCrop.x + offsetX,
        pixelCrop.y + offsetY,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      ctx.putImageData(data, 0, 0);

      resolve(canvas.toDataURL('image/jpeg'));
    };
  });
};