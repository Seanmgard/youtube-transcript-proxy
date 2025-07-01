'use client';

import React from 'react';
import { X, ZoomIn } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';

interface ImageZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageAlt: string;
  imageTitle?: string;
}

export function ImageZoomModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  imageAlt, 
  imageTitle 
}: ImageZoomModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] w-full h-full bg-black/95 border-none p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{imageTitle || 'Image Zoom'}</DialogTitle>
        </DialogHeader>
        {/* Header with close button */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10 backdrop-blur-md">
              <ZoomIn className="h-5 w-5 text-white" />
            </div>
            {imageTitle && (
              <h3 className="text-white font-medium text-lg bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
                {imageTitle}
              </h3>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-10 w-10 p-0 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white border-none"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Image container */}
        <div className="w-full h-full flex items-center justify-center p-4 pt-16">
          <div className="relative max-w-full max-h-full">
            <Image
              src={imageUrl}
              alt={imageAlt}
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm">
            Click anywhere outside the image to close
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 