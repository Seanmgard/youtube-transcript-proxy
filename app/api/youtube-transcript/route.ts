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
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.youtube.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch video page:', response.status, response.statusText);
      return null;
    }
    
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
        androidSdkVersion: 30,
        userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
      },
    },
    videoId: videoId,
  };
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
      "X-YouTube-Client-Name": "3",
      "X-YouTube-Client-Version": "20.10.38",
      "Origin": "https://www.youtube.com",
      "Referer": `https://www.youtube.com/watch?v=${videoId}`,
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    console.error('Player API failed:', response.status, response.statusText);
    const errorText = await response.text();
    console.error('Player API error response:', errorText);
    throw new Error(`Player API request failed: ${response.status}`);
  }
  
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
  const response = await fetch(baseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.youtube.com/',
    }
  });
  
  if (!response.ok) {
    console.error('Failed to fetch captions:', response.status, response.statusText);
    throw new Error(`Failed to fetch captions: ${response.status}`);
  }
  
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
    console.log(`🎯 Step 1: Getting API key for video ${videoId}`);
    // Step 1: Get API key
    const apiKey = await getInnertubeApiKey(videoId);
    if (!apiKey) {
      throw new Error("Failed to extract INNERTUBE_API_KEY from YouTube page. Video may be private or unavailable.");
    }
    console.log(`✅ Step 1: Got API key: ${apiKey.substring(0, 10)}...`);
    
    console.log(`🎯 Step 2: Getting player response`);
    // Step 2: Get player response
    const playerData = await getPlayerResponse(videoId, apiKey);
    
    console.log(`📋 Player response keys:`, Object.keys(playerData));
    
    if (!playerData.videoDetails) {
      console.error(`❌ No videoDetails in player response:`, playerData);
      
      // Check for specific error messages
      if (playerData.playabilityStatus) {
        const status = playerData.playabilityStatus;
        console.error(`📺 Playability status:`, status);
        
        if (status.status === 'UNPLAYABLE') {
          throw new Error(`Video is unplayable: ${status.reason || 'Unknown reason'}`);
        } else if (status.status === 'LOGIN_REQUIRED') {
          throw new Error('Video requires login or is private.');
        } else if (status.status === 'ERROR') {
          throw new Error(`YouTube error: ${status.reason || 'Unknown error'}`);
        }
      }
      
      throw new Error("Video not found or unavailable. The video may be private, deleted, or restricted.");
    }
    
    console.log(`✅ Step 2: Got video details: "${playerData.videoDetails.title}"`);
    
    console.log(`🎯 Step 3: Extracting caption track URL`);
    // Step 3: Extract caption track URL
    const captionUrl = extractCaptionTrackUrl(playerData, language);
    console.log(`✅ Step 3: Got caption URL`);
    
    console.log(`🎯 Step 4: Fetching and parsing captions`);
    // Step 4: Fetch and parse captions
    const transcript = await fetchAndParseCaptions(captionUrl);
    console.log(`✅ Step 4: Parsed ${transcript.length} transcript segments`);
    
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
    
    console.log(`🎉 Successfully extracted transcript: ${transcriptText.length} characters, ${transcriptText.split(' ').length} words`);
    
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
    console.error(`💥 Error in getYoutubeTranscript:`, error.message);
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