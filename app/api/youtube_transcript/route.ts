import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // direct ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl } = await request.json();
    if (!youtubeUrl) {
      return NextResponse.json({ error: 'youtubeUrl required' }, { status: 400, headers: corsHeaders });
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400, headers: corsHeaders });
    }

    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptArray || transcriptArray.length === 0) {
      return NextResponse.json({ error: 'No transcript available' }, { status: 404, headers: corsHeaders });
    }

    const transcriptText = transcriptArray.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
    const wordCount = transcriptText.split(/\s+/).length;
    const duration = transcriptArray[transcriptArray.length - 1].offset || 0;

    return NextResponse.json(
      {
        success: true,
        videoId,
        videoTitle: `YouTube Video ${videoId}`,
        transcriptText,
        wordCount,
        duration,
        segmentCount: transcriptArray.length
      },
      { headers: corsHeaders }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500, headers: corsHeaders });
  }
} 