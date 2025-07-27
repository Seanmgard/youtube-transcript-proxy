import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { youtubeUrl } = await req.json();
    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL required' }, { status: 400 });
    }
    const id = extractVideoId(youtubeUrl);
    if (!id) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }
    const transcript = await YoutubeTranscript.fetchTranscript(id);
    const text = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
    return NextResponse.json({
      success: true,
      videoId: id,
      transcriptText: text,
      wordCount: text.split(/\s+/).length,
      segmentCount: transcript.length
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to fetch transcript' }, { status: 500 });
  }
} 