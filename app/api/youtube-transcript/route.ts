import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TranscriptEntry {
  caption: string;
  startTime: number;
  endTime: number;
}

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

async function getInnertubeApiKey(videoId: string): Promise<string | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(videoUrl);
    const html = await response.text();
    
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    return apiKeyMatch ? apiKeyMatch[1] : null;
  } catch (error) {
    console.error('Error fetching API key:', error);
    return null;
  }
}

async function getPlayerResponse(videoId: string, apiKey: string) {
  const endpoint = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
  
  const body = {
    context: {
      client: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
      },
    },
    videoId: videoId,
  };
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  return await response.json();
}

function extractCaptionTrackUrl(playerResponse: any, lang: string = "en"): string {
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  
  if (!tracks) {
    throw new Error("No caption tracks found.");
  }
  
  // Try to find the requested language first
  let track = tracks.find((t: any) => t.languageCode === lang);
  
  // If not found, try English variants
  if (!track) {
    track = tracks.find((t: any) => t.languageCode.startsWith('en'));
  }
  
  // If still not found, take the first available track
  if (!track) {
    track = tracks[0];
  }
  
  if (!track) {
    throw new Error(`No captions available for this video.`);
  }
  
  // Remove "&fmt=srv3" if present and use json3 format
  return track.baseUrl.replace(/&fmt=\w+$/, '') + '&fmt=json3';
}

async function fetchAndParseCaptions(baseUrl: string): Promise<TranscriptEntry[]> {
  const response = await fetch(baseUrl);
  const data = await response.json();
  
  if (!data.events) {
    throw new Error('No transcript events found');
  }
  
  return data.events
    // Remove invalid segments
    .filter((event: any) => event.segs)
    .map((event: any) => ({
      caption: event.segs.map((seg: any) => seg.utf8).join(''),
      startTime: parseFloat(event.tStartMs) / 1000,
      endTime: parseFloat(event.tStartMs) / 1000 + parseFloat(event.dDurationMs || 0) / 1000,
    }));
}

async function getYoutubeTranscript(videoId: string, language: string = "en"): Promise<{
  success: boolean;
  videoId: string;
  videoTitle: string;
  transcriptText: string;
  wordCount: number;
  duration: number;
  segmentCount: number;
  error?: string;
}> {
  try {
    // Step 1: Get API key
    const apiKey = await getInnertubeApiKey(videoId);
    if (!apiKey) {
      throw new Error("INNERTUBE_API_KEY not found.");
    }
    
    // Step 2: Get player response
    const playerData = await getPlayerResponse(videoId, apiKey);
    
    if (!playerData.videoDetails) {
      throw new Error("Video not found or unavailable.");
    }
    
    // Step 3: Extract caption track URL
    const captionUrl = extractCaptionTrackUrl(playerData, language);
    
    // Step 4: Fetch and parse captions
    const transcript = await fetchAndParseCaptions(captionUrl);
    
    // Format transcript text
    const transcriptText = transcript
      .map(entry => entry.caption)
      .join(' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' ') // Replace any whitespace with single space
      .trim();
    
    // Calculate duration from video details or last transcript entry
    const duration = playerData.videoDetails.lengthSeconds 
      ? parseInt(playerData.videoDetails.lengthSeconds)
      : transcript.length > 0 
        ? Math.ceil(transcript[transcript.length - 1].endTime)
        : 0;
    
    return {
      success: true,
      videoId,
      videoTitle: playerData.videoDetails.title || `Video ${videoId}`,
      transcriptText,
      wordCount: transcriptText.split(' ').length,
      duration,
      segmentCount: transcript.length
    };
    
  } catch (error: any) {
    return {
      success: false,
      videoId,
      videoTitle: `Video ${videoId}`,
      transcriptText: '',
      wordCount: 0,
      duration: 0,
      segmentCount: 0,
      error: error.message
    };
  }
}

export async function POST(request: Request) {
  try {
    const { youtubeUrl } = await request.json();
    
    console.log('🔍 Received YouTube URL:', youtubeUrl);
    
    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json({
        error: 'Invalid YouTube URL. Please provide a valid YouTube video URL or video ID.'
      }, { status: 400 });
    }

    console.log('🎯 Extracted video ID:', videoId);

    try {
      // Get transcript using Innertube API
      console.log('🚀 Calling Innertube API to extract transcript...');
      const result = await getYoutubeTranscript(videoId);
      
      console.log('✅ Innertube API result:', { success: result.success, wordCount: result.wordCount });
      
      if (!result.success) {
        return NextResponse.json({
          error: result.error || 'Failed to extract transcript'
        }, { status: 404 });
      }

      // Validate transcript length
      if (result.transcriptText.length < 100) {
        return NextResponse.json({
          error: 'Transcript is too short to generate meaningful questions. Please try a longer video.'
        }, { status: 400 });
      }

      console.log('🎉 Successfully extracted transcript!');
      console.log('📄 Transcript length:', result.transcriptText.length);
      console.log('📄 First 200 characters:', result.transcriptText.substring(0, 200));

      // Return the transcript text and metadata
      return NextResponse.json({
        success: true,
        videoId: result.videoId,
        videoTitle: result.videoTitle,
        transcriptText: result.transcriptText,
        wordCount: result.wordCount,
        duration: result.duration,
        segmentCount: result.segmentCount
      });

    } catch (apiError: any) {
      console.error('💥 Error calling Innertube API:', apiError);
      
      return NextResponse.json({
        error: `Failed to extract transcript: ${apiError.message}`,
        debug: {
          originalUrl: youtubeUrl,
          videoId,
          errorMessage: apiError.message
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('💥 General error in YouTube transcript API:', error);
    return NextResponse.json({
      error: 'Internal server error while processing YouTube transcript',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 