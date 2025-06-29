'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { QuizSettings } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface QuizUploaderProps {
  onQuizGenerated: (quiz: any) => void;
  onStreamingUpdate: (text: string) => void;
}

export default function QuizUploader({ onQuizGenerated, onStreamingUpdate }: QuizUploaderProps) {
  const inputFileRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [settings, setSettings] = useState<QuizSettings>({
    numberOfQuestions: 10,
    difficulty: 'medium',
    questionType: 'multiple_choice',
    sourceType: 'file',
  });
  const { toast } = useToast();
  const router = useRouter();

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds the 50MB limit. Please use a smaller file.`
      };
    }

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint', // .ppt
      'text/plain', // .txt
      'text/csv', // .csv
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Please upload a PDF, Word document (.doc/.docx), PowerPoint presentation (.ppt/.pptx), or text file (.txt/.csv)'
      };
    }

    // Check file extension as additional validation
    const fileName = file.name.toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.csv'];
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      return {
        valid: false,
        error: 'File must have a valid extension: .pdf, .doc, .docx, .ppt, .pptx, .txt, or .csv'
      };
    }

    return { valid: true };
  };

  const validateYoutubeUrl = (url: string): { valid: boolean; error?: string } => {
    if (!url.trim()) {
      return { valid: false, error: 'YouTube URL is required' };
    }

    // YouTube URL patterns
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];
    
    const isValid = patterns.some(pattern => pattern.test(url.trim()));
    
    if (!isValid) {
      return {
        valid: false,
        error: 'Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID)'
      };
    }

    return { valid: true };
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validation = validateFile(file);
      if (!validation.valid) {
        toast({
          title: 'Invalid file',
          description: validation.error,
          variant: 'destructive',
        });
        // Clear the input
        if (inputFileRef.current) {
          inputFileRef.current.value = '';
        }
        setFileName('');
        return;
      }
      setFileName(file.name);
    } else {
      setFileName('');
    }
  };

  const handleSourceTypeChange = (sourceType: string) => {
    setSettings({ ...settings, sourceType: sourceType as 'file' | 'youtube' });
    // Clear the other input when switching
    if (sourceType === 'file') {
      setYoutubeUrl('');
    } else {
      setFileName('');
      if (inputFileRef.current) {
        inputFileRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Validate based on source type
    if (settings.sourceType === 'file') {
      if (!inputFileRef.current?.files?.[0]) {
        toast({
          title: 'No file selected',
          description: 'Please choose a file to upload.',
          variant: 'destructive',
        });
        return;
      }

      const file = inputFileRef.current.files[0];
      const validation = validateFile(file);
      if (!validation.valid) {
        toast({
          title: 'Invalid file',
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }
    } else if (settings.sourceType === 'youtube') {
      const validation = validateYoutubeUrl(youtubeUrl);
      if (!validation.valid) {
        toast({
          title: 'Invalid YouTube URL',
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsGenerating(true);
    onQuizGenerated({ loading: true });

    try {
      if (settings.sourceType === 'youtube') {
        // YouTube transcript path - use client-side extraction
        onStreamingUpdate('🎬 Extracting YouTube video transcript...');
        
        // Extract video ID
        const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/)?.[1] ||
                         youtubeUrl.match(/^([a-zA-Z0-9_-]{11})$/)?.[1];
        
        if (!videoId) {
          throw new Error('Could not extract video ID from YouTube URL');
        }

        // Step 1: Get video page HTML via proxy
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const pageResponse = await fetch(`/api/youtube-proxy?url=${encodeURIComponent(videoUrl)}`);
        
        if (!pageResponse.ok) {
          throw new Error('Failed to fetch video page. Video may be private or unavailable.');
        }
        
        const html = await pageResponse.text();
        
        // Step 2: Extract API key
        const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
        if (!apiKeyMatch) {
          throw new Error('Could not find API key. Video may be unavailable.');
        }
        
        const apiKey = apiKeyMatch[1];
        onStreamingUpdate('🔑 Found API key, getting video details...');
        
        // Step 3: Get player response via proxy
        const playerResponse = await fetch('/api/youtube-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
            body: {
              context: {
                client: {
                  clientName: "WEB",
                  clientVersion: "2.20231101.00.00",
                },
              },
              videoId: videoId,
            }
          }),
        });
        
        if (!playerResponse.ok) {
          throw new Error('Failed to get video details from YouTube API');
        }
        
        const playerData = await playerResponse.json();
        
        if (!playerData.videoDetails) {
          throw new Error('Video not found or unavailable. It may be private, deleted, or restricted.');
        }
        
        onStreamingUpdate(`📺 Found video: "${playerData.videoDetails.title}"`);
        
        // Step 4: Extract caption track URL
        const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!tracks) {
          throw new Error('No captions available for this video. Please try a video with subtitles/captions enabled.');
        }
        
        // Find best track (English preferred)
        let track = tracks.find((t: any) => t.languageCode === 'en') ||
                    tracks.find((t: any) => t.languageCode.startsWith('en')) ||
                    tracks[0];
        
        if (!track) {
          throw new Error('No suitable captions found');
        }
        
        const captionUrl = track.baseUrl.replace(/&fmt=\w+$/, '') + '&fmt=json3';
        onStreamingUpdate('📝 Downloading transcript...');
        
        // Step 5: Get transcript via proxy
        const transcriptResponse = await fetch(`/api/youtube-proxy?url=${encodeURIComponent(captionUrl)}`);
        if (!transcriptResponse.ok) {
          throw new Error('Failed to fetch transcript data');
        }
        
        const transcriptData = await transcriptResponse.json();
        
        if (!transcriptData.events) {
          throw new Error('No transcript events found');
        }
        
        // Process transcript
        const transcriptText = transcriptData.events
          .filter((event: any) => event.segs)
          .map((event: any) => event.segs.map((seg: any) => seg.utf8).join(''))
          .join(' ')
          .replace(/[\u200B-\u200D\uFEFF]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        const wordCount = transcriptText.split(' ').length;
        const segmentCount = transcriptData.events.filter((e: any) => e.segs).length;
        
        onStreamingUpdate(`✅ Successfully extracted transcript: ${wordCount} words from ${segmentCount} segments`);

        // Generate quiz from transcript
        const response = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcriptText: transcriptText,
            settings: settings,
            sourceType: 'youtube',
            youtubeVideoId: videoId,
            youtubeVideoTitle: playerData.videoDetails.title,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate quiz');
        }

        if (!response.body) {
          throw new Error('The response body is empty.');
        }
        
        // Handle streaming response (same as file upload)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let fullResponse = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            
            const lines = fullResponse.split('\n\n');
            fullResponse = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                  const dataContent = line.substring(6);
                  if (dataContent === '[DONE]') {
                      break;
                  }
                  try {
                      const parsed = JSON.parse(dataContent);
                      if (parsed.type === 'info' || parsed.type === 'warning' || parsed.type === 'progress' || parsed.type === 'success') {
                          onStreamingUpdate(parsed.message);
                      } else if (parsed.type === 'final') {
                          console.log('🎯 QuizUploader: Received final quiz data:', parsed.quiz);
                          onQuizGenerated(parsed.quiz);
                          onStreamingUpdate('Quiz generation completed!');
                      } else if (parsed.type === 'error') {
                          throw new Error(parsed.message);
                      } else if (parsed.type === 'complete') {
                          console.log('✅ QuizUploader: Received complete signal');
                          onStreamingUpdate(parsed.message);
                          done = true;
                          break;
                      } else {
                          console.log('🔄 QuizUploader: Received fallback quiz data:', parsed);
                          onQuizGenerated(parsed);
                      }
                  } catch (e) {
                      console.error('Error parsing stream data chunk:', dataContent, e);
                  }
              }
            }
          }
        }

      } else {
        // File upload path (existing logic)
        const file = inputFileRef.current!.files![0];
        setIsUploading(true);
        onStreamingUpdate(`Uploading ${file.name} (${Math.round(file.size / 1024)}KB)...`);
        
        const newBlob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          onUploadProgress: (progressEvent) => {
            const percentage = Math.round(progressEvent.percentage);
            setUploadProgress(percentage);
            onStreamingUpdate(`Upload progress: ${percentage}%`);
          },
        });

        setIsUploading(false);
        const blobUrl = newBlob.url;
        onStreamingUpdate('File uploaded successfully. Starting quiz generation...');

        const response = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blobUrl,
            settings: settings,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate quiz');
        }

        if (!response.body) {
          throw new Error('The response body is empty.');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let fullResponse = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            
            const lines = fullResponse.split('\n\n');
            fullResponse = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                  const dataContent = line.substring(6);
                  if (dataContent === '[DONE]') {
                      break;
                  }
                  try {
                      const parsed = JSON.parse(dataContent);
                      if (parsed.type === 'info' || parsed.type === 'warning' || parsed.type === 'progress' || parsed.type === 'success') {
                          onStreamingUpdate(parsed.message);
                      } else if (parsed.type === 'final') {
                          console.log('🎯 QuizUploader: Received final quiz data:', parsed.quiz);
                          onQuizGenerated(parsed.quiz);
                          onStreamingUpdate('Quiz generation completed!');
                      } else if (parsed.type === 'error') {
                          throw new Error(parsed.message);
                      } else if (parsed.type === 'complete') {
                          console.log('✅ QuizUploader: Received complete signal');
                          onStreamingUpdate(parsed.message);
                          done = true;
                          break;
                      } else {
                          console.log('🔄 QuizUploader: Received fallback quiz data:', parsed);
                          onQuizGenerated(parsed);
                      }
                  } catch (e) {
                      console.error('Error parsing stream data chunk:', dataContent, e);
                  }
              }
            }
          }
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error('Quiz generation error:', error);
      toast({
        title: 'Error Generating Quiz',
        description: errorMessage,
        variant: 'destructive',
      });
      onQuizGenerated({ title: 'Error', questions: [{ text: errorMessage }] });
      onStreamingUpdate(`Error: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
      setUploadProgress(0);
      if (settings.sourceType === 'file') {
        setFileName('');
        if (inputFileRef.current) {
          inputFileRef.current.value = '';
        }
      } else {
        setYoutubeUrl('');
      }
    }
  };



  const isFormValid = () => {
    if (settings.sourceType === 'file') {
      return fileName.length > 0;
    } else {
      return youtubeUrl.trim().length > 0;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="space-y-4 flex-1">
        {/* Source Type Selection */}
        <div>
          <Label className="block mb-2">Content Source</Label>
          <div className="flex gap-4 mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="sourceType"
                value="file"
                checked={settings.sourceType === 'file'}
                onChange={(e) => handleSourceTypeChange(e.target.value)}
                disabled={isGenerating}
                className="mr-2"
              />
              <span className="text-sm">📄 Upload File</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="sourceType"
                value="youtube"
                checked={settings.sourceType === 'youtube'}
                onChange={(e) => handleSourceTypeChange(e.target.value)}
                disabled={isGenerating}
                className="mr-2"
              />
              <span className="text-sm">🎬 YouTube Video</span>
            </label>
          </div>
        </div>

        {/* Conditional Input - File Upload */}
        {settings.sourceType === 'file' && (
          <div>
            <Label htmlFor="file-upload" className="block mb-2">Upload Document</Label>
            <Input
              id="file-upload"
              ref={inputFileRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv"
              onChange={handleFileChange}
              disabled={isGenerating}
              className="cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1 space-y-1">
              <span className="block sm:inline">
                <strong className="text-gray-600">Supported formats:</strong>
              </span>
              <span className="block sm:inline sm:ml-1">
                PDF, Word (.doc/.docx), PowerPoint (.ppt/.pptx), Text (.txt/.csv)
              </span>
              <span className="block mt-1">
                <strong className="text-gray-600">Maximum file size:</strong> 50MB
              </span>
              <span className="hidden sm:block text-amber-600 mt-1">
                💡 Larger files may take longer to process
              </span>
            </p>
          </div>
        )}

        {/* Conditional Input - YouTube URL */}
        {settings.sourceType === 'youtube' && (
          <div>
            <Label htmlFor="youtube-url" className="block mb-2">YouTube Video URL</Label>
            <Input
              id="youtube-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              disabled={isGenerating}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1 space-y-1">
              <span className="block">
                <strong className="text-gray-600">Supported formats:</strong> Full YouTube URLs or video IDs
              </span>
              <span className="block text-amber-600">
                ⚠️ Video must have captions/transcripts enabled to work
              </span>
              <span className="block text-blue-600">
                💡 Educational videos work best for quiz generation
              </span>
            </p>
          </div>
        )}

        {/* Number of Questions */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>Number of Questions</Label>
            <span className="text-sm text-gray-500">
              {settings.numberOfQuestions} questions
            </span>
          </div>
          <Slider
            value={[settings.numberOfQuestions]}
            min={5}
            max={50}
            step={1}
            onValueChange={(value) => setSettings({ ...settings, numberOfQuestions: value[0] })}
            disabled={isGenerating}
          />
        </div>

        {/* Difficulty Level */}
        <div>
          <Label className="block mb-2">Difficulty</Label>
          <RadioGroup
            value={settings.difficulty}
            onValueChange={(value) => setSettings({ ...settings, difficulty: value as 'easy' | 'medium' | 'hard' })}
            className="flex flex-col space-y-1"
            disabled={isGenerating}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="easy" id="easy" disabled={isGenerating} />
              <Label htmlFor="easy">Easy</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="medium" id="medium" disabled={isGenerating} />
              <Label htmlFor="medium">Medium</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="hard" id="hard" disabled={isGenerating} />
              <Label htmlFor="hard">Hard</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Question Type */}
        <div>
          <Label className="block mb-2">Question Type</Label>
          <RadioGroup
            value={settings.questionType}
            onValueChange={(value) => setSettings({ ...settings, questionType: value as 'multiple_choice' | 'open_ended' | 'mixed' })}
            className="flex flex-col space-y-1"
            disabled={isGenerating}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="multiple_choice" id="multiple_choice" disabled={isGenerating} />
              <Label htmlFor="multiple_choice">Multiple Choice</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="open_ended" id="open_ended" disabled={isGenerating} />
              <Label htmlFor="open_ended">Open Ended</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mixed" id="mixed" disabled={isGenerating} />
              <Label htmlFor="mixed">Mixed</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Generate Quiz Button */}
      <div className="mt-4">
        <Button 
          type="submit" 
          className="w-full"
          disabled={isGenerating || !isFormValid()}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isUploading ? `Uploading... ${uploadProgress}%` : 
               settings.sourceType === 'youtube' ? 'Extracting transcript & generating quiz...' : 'Generating Quiz...'}
            </>
          ) : `Generate Quiz from ${settings.sourceType === 'youtube' ? 'YouTube Video' : 'File'}`}
        </Button>
      </div>
    </form>
  );
}
