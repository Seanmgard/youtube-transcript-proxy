# YouTube Transcript Proxy

A serverless function that extracts transcripts from YouTube videos using the Python `youtube-transcript-api` library.

## Deployment

1. Deploy this folder as a separate Vercel project:
   - In Vercel Dashboard → "Add New Project"
   - Import this directory/repository
   - Deploy with default settings

2. After deployment, you'll get an endpoint like:
   ```
   https://your-proxy-name.vercel.app/api/youtube_transcript
   ```

3. Update the main QuizLab AI project with this endpoint:
   - Set environment variable: `NEXT_PUBLIC_TRANSCRIPT_ENDPOINT=https://your-proxy-name.vercel.app/api/youtube_transcript`
   - Or update the fallback URL in `YouTubeUrlModal.tsx`

## Usage

**POST** `/api/youtube_transcript`

Request body:
```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

Response (success):
```json
{
  "success": true,
  "transcript": "The full transcript text...",
  "videoTitle": "Video Title",
  "videoId": "VIDEO_ID",
  "language": "en",
  "wordCount": 1234
}
```

Response (error):
```json
{
  "success": false,
  "error": "Error message",
  "videoId": "VIDEO_ID"
}
```

## Features

- Supports both manual and auto-generated transcripts
- Prefers manual transcripts for better accuracy
- Falls back to auto-generated if manual not available
- Handles multiple YouTube URL formats
- Includes CORS headers for cross-origin requests 