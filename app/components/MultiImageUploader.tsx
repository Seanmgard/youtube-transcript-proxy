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
  Plus,
  Camera,
  Sparkles
} from 'lucide-react';
import Image from 'next/image';

interface ImageData {
  url: string;
  alt?: string;
  size?: 'small' | 'medium' | 'large';
}

interface MultiImageUploaderProps {
  label: string;
  currentImages: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  maxImages?: number;
  maxSize?: number; // in MB
  className?: string;
  side?: 'front' | 'back';
}

export function MultiImageUploader({
  label,
  currentImages,
  onImagesChange,
  maxImages = 2,
  maxSize = 10,
  className = '',
  side = 'front'
}: MultiImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateImage = (file: File): { valid: boolean; error?: string } => {
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `Image size (${Math.round(file.size / 1024 / 1024)}MB) exceeds the ${maxSize}MB limit.`
      };
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload a JPEG, PNG, GIF, or WebP image.'
      };
    }

    return { valid: true };
  };

  const uploadImage = async (file: File, index: number) => {
    try {
      setUploadingIndex(index);

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
        alt: file.name.split('.')[0],
        size: 'medium'
      };

      const newImages = [...currentImages];
      if (index < newImages.length) {
        newImages[index] = imageData;
      } else {
        newImages.push(imageData);
      }

      onImagesChange(newImages);

      toast({
        title: '🎉 Image uploaded!',
        description: 'Your image looks awesome on the flashcard!',
        className: 'border-green-200 bg-green-50 text-green-900',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleFileSelect = (files: FileList, targetIndex?: number) => {
    const fileArray = Array.from(files);
    
    if (targetIndex !== undefined) {
      // Replace specific image
      if (fileArray[0]) {
        uploadImage(fileArray[0], targetIndex);
      }
    } else {
      // Add new images
      const availableSlots = maxImages - currentImages.length;
      const filesToUpload = fileArray.slice(0, availableSlots);
      
      filesToUpload.forEach((file, index) => {
        uploadImage(file, currentImages.length + index);
      });
      
      if (fileArray.length > availableSlots) {
        toast({
          title: 'Too many images',
          description: `You can only add ${maxImages} images per side. Only the first ${availableSlots} were uploaded.`,
          variant: 'destructive',
        });
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
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
    
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, []);

  const removeImage = (index: number) => {
    const newImages = currentImages.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const sideColor = side === 'front' ? 'blue' : 'purple';
  const sideEmoji = side === 'front' ? '🤔' : '💡';

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl bg-gradient-to-r ${
          side === 'front' 
            ? 'from-blue-100 to-indigo-100' 
            : 'from-purple-100 to-pink-100'
        }`}>
          <Camera className={`h-5 w-5 ${
            side === 'front' ? 'text-blue-600' : 'text-purple-600'
          }`} />
        </div>
        <div>
          <Label className="text-base font-semibold text-gray-800 flex items-center gap-2">
            {label}
            <span className="text-lg">{sideEmoji}</span>
          </Label>
          <p className="text-sm text-gray-500">
            Add up to {maxImages} images • Perfect for diagrams, charts, or visual aids!
          </p>
        </div>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 gap-4 w-full">
        {Array.from({ length: maxImages }).map((_, index) => {
          const image = currentImages[index];
          const isUploading = uploadingIndex === index;

          return (
            <div key={index} className="h-32 w-full">
              {image ? (
                // Existing Image
                <div className="relative group h-full bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-all">
                  <Image
                    src={image.url}
                    alt={image.alt || 'Flashcard image'}
                    fill
                    className="object-cover"
                  />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeImage(index)}
                      className="h-8 w-8 p-0 rounded-full"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Image Number Badge */}
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full bg-gradient-to-r ${
                    side === 'front' 
                      ? 'from-blue-500 to-indigo-600' 
                      : 'from-purple-500 to-pink-600'
                  } flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                </div>
              ) : (
                // Upload Zone
                <div
                  className={`relative h-full border-2 border-dashed rounded-2xl transition-all cursor-pointer group ${
                    isDragging 
                      ? `border-${sideColor}-500 bg-${sideColor}-50` 
                      : isUploading 
                        ? 'border-gray-300 bg-gray-50' 
                        : `border-gray-300 bg-gray-50/80 hover:border-${sideColor}-400 hover:bg-${sideColor}-50/50`
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={!isUploading ? openFileDialog : undefined}
                >
                  <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                    {isUploading ? (
                      <>
                        <Loader2 className={`h-8 w-8 text-${sideColor}-500 animate-spin mb-2`} />
                        <p className="text-sm text-gray-600 font-medium">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${
                          side === 'front' 
                            ? 'from-blue-100 to-indigo-100' 
                            : 'from-purple-100 to-pink-100'
                        } flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                          <Plus className={`h-6 w-6 ${
                            side === 'front' ? 'text-blue-600' : 'text-purple-600'
                          }`} />
                        </div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">
                          Image {index + 1}
                        </p>
                        <p className="text-xs text-gray-500">
                          Drop or click
                        </p>
                      </>
                    )}
                  </div>

                  {/* Number Badge for Empty Slots */}
                  <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 ${
                    side === 'front' 
                      ? 'border-blue-200 text-blue-400' 
                      : 'border-purple-200 text-purple-400'
                  } flex items-center justify-center bg-white`}>
                    <span className="text-xs font-bold">{index + 1}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>



      {/* Tips */}
      {currentImages.length === 0 && (
        <div className={`p-4 rounded-xl bg-gradient-to-r ${
          side === 'front' 
            ? 'from-blue-50 to-indigo-50 border border-blue-200' 
            : 'from-purple-50 to-pink-50 border border-purple-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-1 rounded-lg ${
              side === 'front' ? 'bg-blue-100' : 'bg-purple-100'
            }`}>
              <ImageIcon className={`h-4 w-4 ${
                side === 'front' ? 'text-blue-600' : 'text-purple-600'
              }`} />
            </div>
            <div>
              <h4 className={`text-sm font-semibold ${
                side === 'front' ? 'text-blue-900' : 'text-purple-900'
              } mb-1`}>
                Pro Tips for {side === 'front' ? 'Question' : 'Answer'} Images:
              </h4>
              <ul className={`text-xs ${
                side === 'front' ? 'text-blue-700' : 'text-purple-700'
              } space-y-1`}>
                {side === 'front' ? (
                  <>
                    <li>• Add diagrams, charts, or visual problems</li>
                    <li>• Include screenshots of important concepts</li>
                  </>
                ) : (
                  <>
                    <li>• Show step-by-step solutions or explanations</li>
                    <li>• Add helpful visual aids or memory tricks</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        disabled={uploadingIndex !== null}
      />
    </div>
  );
} 