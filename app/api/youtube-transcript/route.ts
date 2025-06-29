import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { youtubeUrl } = await request.json();
    
    console.log('🔍 Received YouTube URL:', youtubeUrl);
    
    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    try {
      // Call the Python serverless function
      console.log('🚀 Calling Python serverless function...');
      
      // Get the base URL for the request
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = request.headers.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      
      const response = await fetch(`${baseUrl}/api/youtube-transcript.py`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtubeUrl }),
      });

      if (!response.ok) {
        throw new Error(`Python function failed with status: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('✅ Python function result:', result);
      
      if (!result.success) {
        return NextResponse.json({
          error: result.error
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

    } catch (functionError: any) {
      console.error('💥 Error calling Python function:', functionError);
      
      return NextResponse.json({
        error: `Failed to extract transcript: ${functionError.message}`,
        debug: {
          originalUrl: youtubeUrl,
          errorMessage: functionError.message
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