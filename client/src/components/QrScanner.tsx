import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  onResult: (decoded: string) => void;
  onClose: () => void;
}

async function stopScanner(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
  } catch {
    // already stopped
  }
  try {
    scanner.clear();
  } catch {
    // element may already be gone
  }
}

export function QrScanner({ onResult, onClose }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const closingRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    closingRef.current = false;
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (!decoded || closingRef.current) return;
          closingRef.current = true;
          onResultRef.current(decoded);
          void stopScanner(scanner).finally(() => {
            scannerRef.current = null;
          });
        },
        undefined
      )
      .then(() => {
        // User closed while start() was still pending — release camera now
        if (closingRef.current) {
          void stopScanner(scanner);
        }
      })
      .catch((err) => {
        if (!closingRef.current) {
          console.error(err);
        }
      });

    return () => {
      closingRef.current = true;
      void stopScanner(scanner).finally(() => {
        if (scannerRef.current === scanner) {
          scannerRef.current = null;
        }
      });
    };
  }, []);

  async function handleClose() {
    closingRef.current = true;
    await stopScanner(scannerRef.current);
    scannerRef.current = null;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-md">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Scan QR / Barcode</h3>
          <button type="button" className="text-slate-400 text-xl leading-none px-1" onClick={() => void handleClose()}>
            ×
          </button>
        </div>
        <div id="qr-reader" className="overflow-hidden rounded-xl" />
        <p className="text-xs text-slate-500 mt-3">Point the camera at a Box, Pallet, or Product code.</p>
      </div>
    </div>
  );
}
