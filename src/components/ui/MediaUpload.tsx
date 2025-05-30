import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Upload, AlertCircle, Film, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { isMobileDevice } from '../../mobile-fixes';
import Button from './Button';

interface MediaUploadProps {
  onUpload: (file: File) => void;
  className?: string;
  accept?: Record<string, string[]>;
  maxSize?: number;
  preview?: string;
  previewType?: 'image' | 'video';
  onClear?: () => void;
}

const MediaUpload: React.FC<MediaUploadProps> = ({
  onUpload,
  className,
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
    'video/*': ['.mp4', '.mov', '.avi', '.flv', '.hevc']
  },
  maxSize = 52428800, // 50MB
  preview,
  previewType = 'image',
  onClear
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = isMobileDevice();
  const videoRef = useRef<HTMLVideoElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setError(null);
      
      const file = acceptedFiles[0];
      
      // For mobile devices, check file size more aggressively
      if (isMobile && file.size > 10 * 1024 * 1024) {
        setError(`File is too large (${Math.round(file.size/1024/1024)}MB). Mobile uploads should be under 10MB.`);
        return;
      }
      
      setIsLoading(true);
      
      // Check file type
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        // For images, check dimensions before uploading
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
      } else if (isVideo) {
        // For videos, we'll check duration if possible
        const video = document.createElement('video');
        const objectUrl = URL.createObjectURL(file);
        
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(objectUrl);
          
          // Check if video duration is too long (optional, set to 60 seconds for example)
          if (video.duration > 60) {
            setError(`Video is too long (${Math.round(video.duration)}s). Please use a shorter video (under 60s).`);
            setIsLoading(false);
            return;
          }
          
          // All checks passed, process the upload
          onUpload(file);
          setIsLoading(false);
        };
        
        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          setError('Failed to process video. Please try another file.');
          setIsLoading(false);
        };
        
        // Set the source and attempt to load it
        video.preload = 'metadata';
        video.src = objectUrl;
      } else {
        // Not an image or video
        setError('Unsupported file type. Please upload an image or video.');
        setIsLoading(false);
      }
    }
  }, [onUpload, isMobile]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
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
        setError('Invalid file type. Please upload an image or video.');
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
            <p className="text-sm text-gray-600">Processing media...</p>
          </div>
        ) : preview ? (
          <div className="relative aspect-video">
            {previewType === 'image' ? (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover rounded-md"
                crossOrigin="anonymous"
              />
            ) : (
              <video 
                ref={videoRef}
                src={preview}
                className="w-full h-full object-cover rounded-md"
                controls
                crossOrigin="anonymous"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity rounded-md">
              <Upload className="w-8 h-8 text-white" />
            </div>
            
            {onClear && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
              >
                <X size={16} className="text-gray-600" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 py-4">
            <div className="flex justify-center space-x-2">
              <ImageIcon className="w-10 h-10 text-gray-400" />
              <Film className="w-10 h-10 text-gray-400" />
            </div>
            <div className="text-sm text-gray-600">
              {isDragActive ? (
                <p>Drop the file here</p>
              ) : (
                <>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p>Images (PNG, JPG, GIF) or Videos (MP4, MOV, AVI, FLV, HEVC)</p>
                  <p className="text-xs mt-1 text-gray-500">
                    Max file size: {maxSize / 1024 / 1024}MB
                  </p>
                  {isMobile && (
                    <p className="text-xs mt-1 text-gray-500">
                      Mobile uploads recommended under 10MB
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

export default MediaUpload;