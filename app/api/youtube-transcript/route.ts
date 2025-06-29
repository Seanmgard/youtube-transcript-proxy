import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

function executePythonScript(youtubeUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'youtube_transcript.py');
    
    console.log('🐍 Executing Python script:', scriptPath);
    console.log('📺 YouTube URL:', youtubeUrl);
    
    const pythonProcess = spawn('python', [scriptPath, youtubeUrl]);
    
    let dataString = '';
    let errorString = '';
    
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error('🐍 Python stderr:', data.toString());
    });
    
    pythonProcess.on('close', (code) => {
      console.log('🐍 Python process exited with code:', code);
      
      if (code !== 0) {
        console.error('🐍 Python error output:', errorString);
        reject(new Error(`Python script failed with code ${code}: ${errorString}`));
        return;
      }
      
      try {
        console.log('🐍 Python output:', dataString);
        const result = JSON.parse(dataString.trim());
        resolve(result);
      } catch (parseError) {
        console.error('🐍 Failed to parse Python output:', dataString);
        reject(new Error(`Failed to parse Python output: ${parseError}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('🐍 Failed to start Python process:', error);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

export async function POST(request: Request) {
  try {
    const { youtubeUrl } = await request.json();
    
    console.log('🔍 Received YouTube URL:', youtubeUrl);
    
    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    try {
      // Call the Python script to extract transcript
      console.log('🚀 Calling Python transcript extractor...');
      const result = await executePythonScript(youtubeUrl);
      
      console.log('✅ Python script result:', result);
      
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

    } catch (scriptError: any) {
      console.error('💥 Error running Python script:', scriptError);
      
      // Check if it's a Python not found error
      if (scriptError.message.includes('ENOENT') || scriptError.message.includes('not found')) {
        return NextResponse.json({
          error: 'Python is required but not found. Please install Python and the youtube-transcript-api package.',
          debug: {
            message: scriptError.message,
            suggestion: 'Run: pip install youtube-transcript-api'
          }
        }, { status: 500 });
      }
      
      return NextResponse.json({
        error: `Failed to extract transcript: ${scriptError.message}`,
        debug: {
          originalUrl: youtubeUrl,
          errorMessage: scriptError.message
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