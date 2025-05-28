import React from 'react';
import { ImageOff } from 'lucide-react';

interface NoImageFallbackProps {
  message?: string;
  className?: string;
}

const NoImageFallback: React.FC<NoImageFallbackProps> = ({
  message = "No image available",
  className = ""
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 bg-gray-100 rounded-lg ${className}`}>
      <ImageOff size={48} className="text-gray-400 mb-4" />
      <p className="text-gray-600 text-center">{message}</p>
    </div>
  );
};

export default NoImageFallback;