import { NextRequest, NextResponse } from 'next/server';

// Simple video ID extraction function
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^[a-zA-Z0-9_-]{11}$/ // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl } = await request.json();
    
    if (!youtubeUrl) {
      return NextResponse.json({ error: 'youtubeUrl is required' }, { status: 400 });
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid YouTube URL or video ID',
        videoId: null 
      }, { status: 400 });
    }

    // Use external Python transcript service
    const externalEndpoint = process.env.NEXT_PUBLIC_TRANSCRIPT_ENDPOINT || 'https://rvice-pfuk-f2trhoo27.vercel.app/api/youtube_transcript';
    
    console.log('🔗 Forwarding to external transcript service:', externalEndpoint);
    
    const response = await fetch(externalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ youtubeUrl }),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });

  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 