import { NextRequest, NextResponse } from 'next/server';
import { promisify } from 'util';
import { execFile } from 'child_process';
import path from 'path';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl } = await request.json();

    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    // Resolve path to the python script in the repo
    const scriptPath = path.join(process.cwd(), 'api', 'youtube_transcript.py');

    // Helper to try various python commands in order
    const pythonCandidates: [string, string[]][] = [
      ['python3', []],
      ['python', []],
      // Windows launcher with explicit version flag
      ['py', ['-3']],
    ];
    let stdout: string | undefined;
    let started = false;
    for (const [cmd, extraArgs] of pythonCandidates) {
      try {
        ({ stdout } = await execFileAsync(cmd, [...extraArgs, scriptPath, youtubeUrl], { maxBuffer: 10 * 1024 * 1024 }));
        started = true;
        break;
      } catch (err: any) {
        const notFound = err.code === 'ENOENT' || err.code === 9009 || (err.stderr && /Python was not found/i.test(err.stderr));
        if (notFound) {
          continue; // try next interpreter
        }
        // If python ran but script failed, surface the error
        throw err;
      }
    }

    if (!started) {
      return NextResponse.json({
        error: 'Python interpreter not found. Please install Python 3 and make sure it is in your PATH.'
      }, { status: 500 });
    }

    if (stdout === undefined) {
      throw new Error('Transcript service returned no output');
    }

    let result;
    try {
      result = JSON.parse(stdout);
    } catch {
      // stdout may contain log lines before JSON; attempt to extract last JSON object
      const idx = stdout.lastIndexOf('{');
      if (idx !== -1) {
        try {
          result = JSON.parse(stdout.slice(idx));
        } catch (e) {
          console.error('Failed JSON extraction from stdout:', stdout);
          throw new Error('Invalid response from transcript service');
        }
      } else {
        console.error('No JSON object found in stdout:', stdout);
        throw new Error('Invalid response from transcript service');
      }
    }

    // If the python script indicated failure, pass it through with 400
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('YouTube proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 