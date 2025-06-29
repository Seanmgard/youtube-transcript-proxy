import { NextRequest, NextResponse } from 'next/server';

interface YouTubeTranscriptResponse {
  success: boolean;
  videoId?: string;
  videoTitle?: string;
  transcriptText?: string;
  wordCount?: number;
  duration?: number;
  error?: string;
  errorType?: string;
}

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
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

// Use a third-party transcript service
async function getTranscriptFromService(videoId: string): Promise<YouTubeTranscriptResponse> {
  try {
    // Using a reliable third-party service (RapidAPI)
    const response = await fetch(`https://youtube-transcript3.p.rapidapi.com/transcript?videoId=${videoId}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
        'X-RapidAPI-Host': 'youtube-transcript3.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      throw new Error(`Service responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      return {
        success: false,
        error: data.error,
        errorType: 'ServiceError'
      };
    }

    // Extract transcript text from the response
    const transcriptText = data.transcript?.map((item: any) => item.text).join(' ') || '';
    
    return {
      success: true,
      videoId: videoId,
      videoTitle: data.title || `Video ${videoId}`,
      transcriptText: transcriptText.replace(/\s+/g, ' ').trim(),
      wordCount: transcriptText.split(' ').length,
      duration: data.duration || 0
    };

  } catch (error) {
    console.error('Transcript service error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorType: 'ServiceError'
    };
  }
}

// Manual scraping fallback (similar to what worked locally)
async function getTranscriptManual(videoId: string): Promise<YouTubeTranscriptResponse> {
  try {
    // This is a simplified version - you'd implement the full scraping logic here
    // For now, return an error directing to use the Python version locally
    return {
      success: false,
      error: 'Manual extraction not yet implemented in this fallback. Python version should work locally.',
      errorType: 'NotImplemented'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Manual extraction failed',
      errorType: 'ManualExtractionError'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 YouTube Fallback API called');
    
    const body = await request.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json(
        { success: false, error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    console.log(`📺 Processing URL: ${youtubeUrl}`);

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid YouTube URL. Please provide a valid YouTube video URL or video ID.',
          errorType: 'InvalidUrl'
        },
        { status: 400 }
      );
    }

    console.log(`🎯 Extracted video ID: ${videoId}`);

    // Try third-party service first (if API key is available)
    if (process.env.RAPIDAPI_KEY) {
      console.log('🌐 Trying third-party transcript service...');
      const serviceResult = await getTranscriptFromService(videoId);
      
      if (serviceResult.success) {
        console.log('✅ Third-party service succeeded');
        return NextResponse.json(serviceResult);
      } else {
        console.log(`⚠️ Third-party service failed: ${serviceResult.error}`);
      }
    }

    // Fallback to manual extraction
    console.log('🔧 Trying manual extraction fallback...');
    const manualResult = await getTranscriptManual(videoId);
    
    if (manualResult.success) {
      console.log('✅ Manual extraction succeeded');
      return NextResponse.json(manualResult);
    }

    // If all methods fail, return error with suggestions
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to extract transcript. Please ensure the video has captions enabled and try again. If the issue persists, the video may be private or region-restricted.',
        errorType: 'AllMethodsFailed',
        suggestions: [
          'Verify the video has captions/subtitles enabled',
          'Check if the video is public and not region-restricted',
          'Try using a different YouTube video',
          'Contact support if the issue persists'
        ]
      },
      { status: 422 }
    );

  } catch (error) {
    console.error('💥 Fallback API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error occurred while processing the YouTube URL',
        errorType: 'InternalError'
      },
      { status: 500 }
    );
  }
} 