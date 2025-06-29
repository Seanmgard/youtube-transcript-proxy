import { NextRequest, NextResponse } from 'next/server';

interface YouTubeTranscriptResponse {
  success: boolean;
  videoId?: string;
  videoTitle?: string;
  transcriptText?: string;
  wordCount?: number;
  error?: string;
}

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getTranscriptUsingPackage(videoId: string): Promise<YouTubeTranscriptResponse> {
  try {
    console.log(`📦 Using youtube-transcript package for: ${videoId}`);
    
    // Dynamic import to handle the package
    const { YoutubeTranscript } = await import('youtube-transcript');
    
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcriptData || transcriptData.length === 0) {
      return {
        success: false,
        error: 'No transcript data found for this video'
      };
    }

    const transcriptText = transcriptData
      .map((item: any) => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (transcriptText.length < 50) {
      return {
        success: false,
        error: 'Transcript too short - video may not have proper captions'
      };
    }

    console.log(`✅ Successfully extracted ${transcriptData.length} segments, ${transcriptText.split(' ').length} words`);

    return {
      success: true,
      videoId,
      videoTitle: `Video ${videoId}`,
      transcriptText,
      wordCount: transcriptText.split(' ').length
    };

  } catch (error: any) {
    console.error(`❌ Package extraction failed:`, error.message);
    
    // Parse specific error types
    if (error.message?.includes('Transcript is disabled')) {
      return {
        success: false,
        error: 'Transcripts are disabled for this video. Please try a different video with captions enabled.'
      };
    }
    
    if (error.message?.includes('No transcript found')) {
      return {
        success: false,
        error: 'No transcript found. The video may not have captions or may be private/restricted.'
      };
    }

    return {
      success: false,
      error: 'Unable to extract transcript. Please ensure the video has captions enabled and is publicly accessible.'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json(
        { success: false, error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid YouTube URL. Please provide a valid YouTube video URL.' 
        },
        { status: 400 }
      );
    }

    console.log(`🎯 Processing video ID: ${videoId}`);

    // In development, use the Node.js package
    // In production, the Python function at /api/youtube_transcript.py will handle it
    const result = await getTranscriptUsingPackage(videoId);
    
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 422 });
    }

  } catch (error) {
    console.error('YouTube transcript API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error. Please try again.'
      },
      { status: 500 }
    );
  }
} 