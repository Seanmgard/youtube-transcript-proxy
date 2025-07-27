'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, Video, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/app/components/ui/use-toast';

interface YouTubeUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transcriptData: any) => void;
}

export default function YouTubeUrlModal({ isOpen, onClose, onSuccess }: YouTubeUrlModalProps) {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');

  const validateYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /^[a-zA-Z0-9_-]{11}$/ // Direct video ID
    ];
    
    return patterns.some(pattern => pattern.test(url.trim()));
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setValidationError('');
    
    if (value.trim() && !validateYouTubeUrl(value)) {
      setValidationError('Please enter a valid YouTube URL or video ID');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setValidationError('Please enter a YouTube URL');
      return;
    }

    if (!validateYouTubeUrl(url)) {
      setValidationError('Please enter a valid YouTube URL or video ID');
      return;
    }

    setIsProcessing(true);

    try {
      // Extract transcript using our external API
      const response = await fetch(process.env.NEXT_PUBLIC_TRANSCRIPT_ENDPOINT || 'https://yt-proxy.vercel.app/api/youtube_transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtubeUrl: url.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to extract transcript');
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to extract transcript');
      }

      toast({
        title: 'Transcript extracted successfully!',
        description: `Ready to generate content from "${result.videoTitle}"`,
      });

      // Pass the transcript data to parent component
      onSuccess({
        transcriptText: result.transcript,
        videoTitle: result.videoTitle,
        videoId: result.videoId,
        wordCount: result.wordCount,
        language: result.language,
        sourceType: 'youtube'
      });

      // Reset and close modal
      setUrl('');
      setValidationError('');
      onClose();

    } catch (error) {
      console.error('YouTube processing error:', error);
      toast({
        title: 'Error extracting transcript',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getVideoPreview = () => {
    const videoId = extractVideoId(url);
    if (videoId && validateYouTubeUrl(url)) {
      return (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Valid YouTube video detected</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Video ID: {videoId}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Video className="h-5 w-5" />
            <span>Add YouTube Video</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="youtube-url">YouTube URL or Video ID</Label>
            <Input
              id="youtube-url"
              type="text"
              placeholder="https://www.youtube.com/watch?v=... or video ID"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={isProcessing}
              className={validationError ? 'border-red-500' : ''}
            />
            
            {validationError && (
              <div className="flex items-center space-x-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{validationError}</span>
              </div>
            )}

            {getVideoPreview()}
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium mb-1">Supported formats:</p>
            <ul className="text-xs space-y-1">
              <li>• https://www.youtube.com/watch?v=VIDEO_ID</li>
              <li>• https://youtu.be/VIDEO_ID</li>
              <li>• Just the video ID: VIDEO_ID</li>
            </ul>
            <p className="text-xs mt-2 text-gray-500">
              Note: The video must have captions or transcripts enabled.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!url.trim() || !!validationError || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting Transcript...
                </>
              ) : (
                'Extract Transcript'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 