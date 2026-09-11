import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
  /** Accessible description; the code itself is meaningless read aloud. */
  label: string;
}

/**
 * Renders the pairing URL as a QR on a canvas. The library is bundled — this
 * page loads no third-party script, by policy and by CSP.
 */
export function QrCode({ value, size = 236, label }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    void QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#181826ff', light: '#ffffffff' },
    }).catch(() => {
      if (cancelled) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        background: '#fff',
        display: 'block',
      }}
    />
  );
}
