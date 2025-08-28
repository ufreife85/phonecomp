// src/Scanner.jsx

import React, { useEffect, memo, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { CheckCircle } from 'lucide-react';

const Scanner = memo(({ onScanSuccess, onScanError, lastScannedName }) => {
  // State to control the visibility of the success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // Effect to show the overlay when a new student is scanned
  useEffect(() => {
    // Check if lastScannedName is a non-empty string
    if (lastScannedName) {
      setShowSuccessOverlay(true);
      const timer = setTimeout(() => {
        setShowSuccessOverlay(false);
      }, 1500); // Show the overlay for 1.5 seconds

      return () => clearTimeout(timer); // Cleanup the timer
    }
  }, [lastScannedName]); // This effect runs only when lastScannedName changes

  useEffect(() => {
    const scannerId = "qr-code-reader";
    let scannerInstance = null;

    const html5QrcodeScanner = new Html5QrcodeScanner(
      scannerId,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false
    );
    
    scannerInstance = html5QrcodeScanner;
    // Important: Pass a function that only calls onScanSuccess
    // This prevents the entire component from re-rendering unnecessarily
    const successCallback = (decodedText, decodedResult) => {
        onScanSuccess(decodedText, decodedResult);
    };
    
    html5QrcodeScanner.render(successCallback, onScanError);

    return () => {
      if (scannerInstance && scannerInstance.getState() === 2 /* SCANNING */) {
        scannerInstance.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner.", error);
        });
      }
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden">
      <div id="qr-code-reader" className="w-full"></div>

      {/* The success overlay dialog */}
      {showSuccessOverlay && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white pointer-events-none transition-opacity duration-300">
          <CheckCircle size={64} className="text-green-400" />
          <p className="text-2xl font-bold mt-4">{lastScannedName}</p>
          <p className="text-lg">Added to list!</p>
        </div>
      )}
    </div>
  );
});

export default Scanner;