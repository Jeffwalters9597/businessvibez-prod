import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import Button from './Button';

interface QrCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
  className?: string;
  onDownload?: () => void;
  hideDownload?: boolean;
}

const QrCode: React.FC<QrCodeProps> = ({
  value,
  size = 512, // Doubled from 256 to 512
  level = 'H',
  includeMargin = true,
  className,
  onDownload,
  hideDownload = false
}) => {
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    try {
      const qrContainer = qrRef.current;
      if (!qrContainer) return;

      // Get the QR code SVG element
      const qrSvg = qrContainer.querySelector('svg');
      if (!qrSvg) {
        console.error('QR code SVG not found');
        return;
      }

      // Create a new SVG with transparent background
      const svgString = new XMLSerializer().serializeToString(qrSvg);

      // Create a Blob from the SVG string
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-code-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      URL.revokeObjectURL(url);

      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('Failed to download QR code:', error);
    }
  };

  return (
    <div className={className}>
      <div 
        ref={qrRef} 
        className="inline-block"
        style={{
          lineHeight: 0, // Remove any extra space
          fontSize: 0, // Remove any extra space
          width: size, // Explicitly set container width
          height: size // Explicitly set container height
        }}
      >
        <QRCodeSVG
          value={value}
          size={size}
          level={level}
          includeMargin={includeMargin}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>
      {!hideDownload && (
        <Button
          onClick={handleDownload}
          variant="outline"
          className="w-full mt-4"
          leftIcon={<Download size={16} />}
        >
          Download QR Code
        </Button>
      )}
    </div>
  );
};

export default QrCode;