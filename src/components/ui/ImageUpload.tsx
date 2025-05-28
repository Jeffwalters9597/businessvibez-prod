import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Upload } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

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
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': accept
    },
    maxSize,
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      className={twMerge(
        'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400',
        className
      )}
    >
      <input {...getInputProps()} />
      
      {preview ? (
        <div className="relative aspect-video">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover rounded-md"
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;