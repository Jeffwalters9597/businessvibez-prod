import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Upload, AlertCircle } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { isMobileDevice } from '../../mobile-fixes';

interface ImageUploadProps {
  onUpload: (file: File) => void;
  className?: string;
  accept?: string[];
  maxSize?: number;
  preview?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onUpload,
  className,
  accept = ['image/jpeg', 'image/png', 'image/gif'],
  maxSize = 5242880, // 5MB
  preview
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = isMobileDevice();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setError(null);
      
      const file = acceptedFiles[0];
      
      // For mobile devices, check file size more aggressively
      if (isMobile && file.size > 2 * 1024 * 1024) {
        setError(`File is too large (${Math.round(file.size/1024)}KB). Mobile uploads should be under 2MB.`);
        return;
      }
      
      // Check image dimensions before uploading (especially important for mobile)
      setIsLoading(true);
      
      const checkImage = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      checkImage.onload = () => {
        // Revoke the object URL to avoid memory leaks
        URL.revokeObjectURL(objectUrl);
        
        const { width, height } = checkImage;
        
        // Check if dimensions are too large
        if (width > 3000 || height > 3000) {
          setError(`Image dimensions are too large (${width}x${height}). Please use a smaller image.`);
          setIsLoading(false);
          return;
        }
        
        // All checks passed, process the upload
        onUpload(file);
        setIsLoading(false);
      };
      
      checkImage.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError('Failed to process image. Please try another file.');
        setIsLoading(false);
      };
      
      checkImage.src = objectUrl;
    }
  }, [onUpload, isMobile]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/*': accept
    },
    maxSize,
    multiple: false
  });
  
  // Handle file rejections (wrong type, too large, etc.)
  React.useEffect(() => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      
      if (rejection.errors[0].code === 'file-too-large') {
        setError(`File is too large (max ${maxSize / 1024 / 1024}MB)`);
      } else if (rejection.errors[0].code === 'file-invalid-type') {
        setError('Invalid file type. Please upload an image.');
      } else {
        setError(rejection.errors[0].message);
      }
    }
  }, [fileRejections, maxSize]);

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={twMerge(
          'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400',
          isLoading && 'opacity-50 pointer-events-none'
        )}
      >
        <input {...getInputProps()} />
        
        {isLoading ? (
          <div className="space-y-2 py-4">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-gray-600">Processing image...</p>
          </div>
        ) : preview ? (
          <div className="relative aspect-video">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover rounded-md"
              crossOrigin="anonymous"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity rounded-md">
              <Upload className="w-8 h-8 text-white" />
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-4">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <div className="text-sm text-gray-600">
              {isDragActive ? (
                <p>Drop the image here</p>
              ) : (
                <>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p>PNG, JPG or GIF (max. {maxSize / 1024 / 1024}MB)</p>
                  {isMobile && (
                    <p className="text-xs mt-1 text-gray-500">
                      Mobile uploads recommended under 2MB
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-error-600 flex items-center">
          <AlertCircle size={16} className="mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;