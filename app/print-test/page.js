'use client';

import { useEffect } from 'react';

export default function PrintTestPage() {

  useEffect(() => {
    // Load QZ Tray script
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.3/qz-tray.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const connectQZ = async () => {
    if (!window.qz) {
      alert("QZ Tray not loaded");
      return;
    }

    try {
      await window.qz.websocket.connect();
      console.log("QZ Connected");
    } catch (err) {
      console.error(err);
      alert("Failed to connect QZ Tray");
    }
  };

 const printTest = async () => {
  try {
    const qz = window.qz;

    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }

    const config = qz.configs.create("EPSON PLQ-20");

    const data = '\x1B@HELLO\r\n\r\n\x0C';

    await qz.print(config, [{
      type: 'raw',
      format: 'plain',
      data: data
    }]);

    alert("Print sent!");

  } catch (err) {
    console.error(err);
    alert("Print failed");
  }
};
  return (
    <div style={{ padding: '40px' }}>
      <h1>Passbook Print Test</h1>

      <button
        onClick={connectQZ}
        style={{
          padding: '10px 20px',
          marginRight: '10px',
          background: 'green',
          color: 'white',
          border: 'none'
        }}
      >
        Connect QZ Tray
      </button>

      <button
        onClick={printTest}
        style={{
          padding: '10px 20px',
          background: 'blue',
          color: 'white',
          border: 'none'
        }}
      >
        Print Test
      </button>
    </div>
  );
}