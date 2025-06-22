import { NextResponse } from 'next/server';
import TranscriptClient from 'youtube-transcript-api';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function extractVideoId(url: string): string | null {
  // Handle various YouTube URL formats
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
}

function formatTranscriptText(transcript: any[]): string {
  if (!transcript || !Array.isArray(transcript)) {
    throw new Error('Invalid transcript format');
  }
  
  // Combine all transcript segments into a single text
  const fullText = transcript
    .map(segment => segment.text)
    .join(' ')
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .trim();
    
  return fullText;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { youtubeUrl } = await request.json();
    
    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    // Extract video ID from URL
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json({ 
        error: 'Invalid YouTube URL. Please provide a valid YouTube video URL or video ID.' 
      }, { status: 400 });
    }

    try {
      // Create transcript client and fetch transcript
      console.log('Creating transcript client for video ID:', videoId);
      const client = new TranscriptClient();
      
      console.log('Initializing YouTube transcript service...');
      await client.ready;
      
      console.log('Connecting to YouTube and extracting captions...');
      const result = await client.getTranscript(videoId);
      
      if (!result.tracks || result.tracks.length === 0 || !result.tracks[0].transcript) {
        return NextResponse.json({
          error: 'No transcript available for this video. The video may not have captions or transcripts enabled.'
        }, { status: 404 });
      }

      const transcript = result.tracks[0].transcript;
      
      // Format transcript text
      const transcriptText = formatTranscriptText(transcript);
      
      // Validate transcript length
      if (transcriptText.length < 100) {
        return NextResponse.json({
          error: 'Transcript is too short to generate meaningful questions. Please try a longer video.'
        }, { status: 400 });
      }

      // Calculate approximate duration from last transcript segment
      const lastSegment = transcript[transcript.length - 1];
      const duration = lastSegment ? parseFloat(lastSegment.start) + parseFloat(lastSegment.dur || '0') : 0;

      // Return the transcript text and metadata
      return NextResponse.json({
        success: true,
        videoId,
        videoTitle: result.title || 'Unknown Video',
        transcriptText,
        wordCount: transcriptText.split(' ').length,
        duration: Math.round(duration),
        segmentCount: transcript.length
      });

    } catch (transcriptError: any) {
      console.error('Error fetching YouTube transcript:', transcriptError);
      
      // Handle specific YouTube transcript errors
      if (transcriptError.message?.includes('video not found') || transcriptError.message?.includes('unavailable')) {
        return NextResponse.json({
          error: 'Video is unavailable. It may be private, deleted, or restricted in your region.'
        }, { status: 404 });
      }
      
      if (transcriptError.message?.includes('Transcript not available')) {
        return NextResponse.json({
          error: 'No transcript available for this video. The video may be private, age-restricted, or have transcripts disabled.'
        }, { status: 404 });
      }

      return NextResponse.json({
        error: 'Failed to extract transcript from YouTube video. Please check the URL and try again.'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in YouTube transcript API:', error);
    return NextResponse.json({
      error: 'Internal server error while processing YouTube transcript'
    }, { status: 500 });
  }
} 