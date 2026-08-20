import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function QrScanner({ onResult, onClose }) {
  const running = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (!decoded) return;
          onResultRef.current(decoded);
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {});
          running.current = false;
        }
      )
      .then(() => {
        running.current = true;
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      if (running.current) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Scan QR / Barcode</h3>
          <button className="text-slate-400" onClick={onClose}>
            ×
          </button>
        </div>
        <div id="qr-reader" className="overflow-hidden rounded-xl" />
        <p className="text-xs text-slate-500 mt-3">Point the camera at a Box, Pallet, or Product code.</p>
      </div>
    </div>
  );
}
