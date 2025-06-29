import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export const dynamic = 'force-dynamic';

interface TranscriptEntry {
  text: string;
  startTime: number;
  duration: number;
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

async function getYouTubeTranscriptWithPuppeteer(videoId: string): Promise<{
  success: boolean;
  videoId: string;
  videoTitle: string;
  transcriptText: string;
  wordCount: number;
  duration: number;
  segmentCount: number;
  error?: string;
}> {
  let browser = null;
  
  try {
    console.log(`🚀 Launching browser for video ${videoId}`);
    
    // Launch browser with minimal detection footprint
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    });

    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    
    // Add extra headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`📺 Navigating to: ${videoUrl}`);
    
    // Navigate to video page
    await page.goto(videoUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    console.log(`🔍 Extracting video data from page...`);

    // Extract data using page evaluation (runs in browser context)
    const result = await page.evaluate((vId: string) => {
      try {
        // Get video title
        const titleElement = document.querySelector('h1[class*="title"] yt-formatted-string') ||
                            document.querySelector('h1.title yt-formatted-string') ||
                            document.querySelector('meta[property="og:title"]');
        
        const videoTitle = titleElement?.textContent || 
                          (titleElement as HTMLMetaElement)?.content || 
                          'Unknown Title';

        // Extract ytInitialPlayerResponse
        const scripts = Array.from(document.querySelectorAll('script'));
        let playerResponse = null;
        
        for (const script of scripts) {
          const content = script.textContent || '';
          const match = content.match(/var ytInitialPlayerResponse = ({.*?});/);
          if (match) {
            try {
              playerResponse = JSON.parse(match[1]);
              break;
            } catch (e) {
              continue;
            }
          }
        }

        if (!playerResponse) {
          throw new Error('Could not find ytInitialPlayerResponse');
        }

        // Check if video is available
        if (!playerResponse.videoDetails) {
          throw new Error('Video not found or unavailable');
        }

        // Get caption tracks
        const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!captionTracks || captionTracks.length === 0) {
          throw new Error('No captions available for this video');
        }

        // Find best caption track (English preferred)
        let selectedTrack = captionTracks.find((track: any) => track.languageCode === 'en') ||
                           captionTracks.find((track: any) => track.languageCode.startsWith('en')) ||
                           captionTracks[0];

        if (!selectedTrack) {
          throw new Error('No suitable caption track found');
        }

        return {
          success: true,
          videoTitle,
          videoId: playerResponse.videoDetails.videoId || vId,
          duration: parseInt(playerResponse.videoDetails.lengthSeconds || '0') || 0,
          captionUrl: selectedTrack.baseUrl
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }, videoId) as { success: boolean; videoTitle?: string; videoId?: string; duration?: number; captionUrl?: string; error?: string };

    if (!result.success) {
      throw new Error(result.error || 'Failed to extract video data');
    }

    console.log(`🎯 Found video: "${result.videoTitle}"`);
    console.log(`📝 Fetching transcript from caption URL...`);

    // Fetch transcript using the browser context
    if (!result.captionUrl) {
      throw new Error('No caption URL available');
    }
    
    const transcriptData = await page.evaluate(async (captionUrl) => {
      try {
        const response = await fetch(captionUrl + '&fmt=json3');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
      } catch (error: any) {
        throw new Error(`Failed to fetch transcript: ${error.message}`);
      }
    }, result.captionUrl) as any;

    // Process transcript data
    if (!transcriptData.events) {
      throw new Error('No transcript events found');
    }

    const transcriptSegments: TranscriptEntry[] = transcriptData.events
      .filter((event: any) => event.segs)
      .map((event: any) => ({
        text: event.segs.map((seg: any) => seg.utf8).join(''),
        startTime: parseFloat(event.tStartMs) / 1000,
        duration: parseFloat(event.dDurationMs || 0) / 1000,
      }));

    const transcriptText = transcriptSegments
      .map(segment => segment.text)
      .join(' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove invisible characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    console.log(`✅ Successfully extracted transcript: ${transcriptText.length} characters`);

    return {
      success: true,
      videoId,
      videoTitle: result.videoTitle || 'Unknown Title',
      transcriptText,
      wordCount: transcriptText.split(' ').length,
      duration: result.duration || 0,
      segmentCount: transcriptSegments.length
    };

  } catch (error: any) {
    console.error(`💥 Puppeteer error:`, error.message);
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
  } finally {
    if (browser) {
      await browser.close();
    }
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
      // Get transcript using Puppeteer
      console.log('🚀 Starting Puppeteer transcript extraction...');
      const result = await getYouTubeTranscriptWithPuppeteer(videoId);
      
      console.log('✅ Puppeteer result:', { success: result.success, wordCount: result.wordCount });
      
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
      console.error('💥 Error with Puppeteer extraction:', apiError);
      
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