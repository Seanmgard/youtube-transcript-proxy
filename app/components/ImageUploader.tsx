'use client';

import React, { useCallback, useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { useToast } from '@/app/components/ui/use-toast';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Loader2,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import Image from 'next/image';

interface ImageData {
  url: string;
  alt?: string;
  size?: 'small' | 'medium' | 'large';
}

interface ImageUploaderProps {
  label: string;
  currentImage?: ImageData;
  onImageChange: (image: ImageData | null) => void;
  maxSize?: number; // in MB
  className?: string;
  side?: 'front' | 'back'; // for specific styling
}

export function ImageUploader({
  label,
  currentImage,
  onImageChange,
  maxSize = 10,
  className = '',
  side = 'front'
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateImage = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `Image size (${Math.round(file.size / 1024 / 1024)}MB) exceeds the ${maxSize}MB limit.`
      };
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload a JPEG, PNG, GIF, or WebP image.'
      };
    }

    return { valid: true };
  };

  const uploadImage = async (file: File) => {
    try {
      setIsUploading(true);

      const validation = validateImage(file);
      if (!validation.valid) {
        toast({
          title: 'Invalid image',
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }

      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload-image',
      });

      const imageData: ImageData = {
        url: blob.url,
        alt: file.name.split('.')[0], // Use filename without extension as alt text
        size: 'medium' // Default size
      };

      onImageChange(imageData);

      toast({
        title: 'Image uploaded',
        description: 'Your image has been successfully uploaded!',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    uploadImage(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const removeImage = () => {
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  if (currentImage && previewMode) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
          <Image
            src={currentImage.url}
            alt={currentImage.alt || 'Flashcard image'}
            width={400}
            height={300}
            className="w-full h-auto max-h-64 object-contain"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPreviewMode(false)}
              className="h-8 w-8 p-0"
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700">{label}</Label>
        {currentImage && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewMode(true)}
              className="h-7 px-2 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              Preview
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={removeImage}
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove
            </Button>
          </div>
        )}
      </div>

      {currentImage ? (
        <div className="relative bg-gray-50 rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="relative w-16 h-16 bg-white rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
              <Image
                src={currentImage.url}
                alt={currentImage.alt || 'Uploaded image'}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentImage.alt || 'Flashcard Image'}
              </p>
              <p className="text-xs text-gray-500">
                {side === 'front' ? 'Front of flashcard' : 'Back of flashcard'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 ${
            isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : isUploading 
                ? 'border-gray-300 bg-gray-50' 
                : 'border-gray-300 bg-gray-50/50'
          } ${isUploading ? 'pointer-events-none' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!isUploading ? openFileDialog : undefined}
        >
          <div className="text-center">
            {isUploading ? (
              <>
                <Loader2 className="mx-auto h-8 w-8 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-gray-600">Uploading image...</p>
              </>
            ) : (
              <>
                <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                  <ImageIcon className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Drop an image here, or click to browse
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to {maxSize}MB
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading}
          />
        </div>
      )}
    </div>
  );
} 