#!/usr/bin/env python3

import json
import re
import sys
import traceback
from urllib.parse import parse_qs
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    VideoUnavailable, 
    NoTranscriptFound,
    YouTubeRequestFailed,
    InvalidVideoId
)

# Set longer timeouts for network requests
import socket
socket.setdefaulttimeout(30)

# Force UTF-8 for stdout/stderr to handle emoji on Windows pipes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='ignore')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='ignore')

def extract_video_id(url):
    """Extract video ID from various YouTube URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)',
        r'^([a-zA-Z0-9_-]{11})$'  # Direct video ID
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

def get_transcript(video_url):
    """Get transcript for a YouTube video"""
    try:
        # Extract video ID
        video_id = extract_video_id(video_url)
        if not video_id:
            return {
                'success': False,
                'error': 'Invalid YouTube URL. Please provide a valid YouTube video URL or video ID.'
            }
        
        print(f"🎯 Extracting transcript for video ID: {video_id}")
        
        # Fetch transcript using the Python API (try multiple language options)
        transcript_list = None
        languages_to_try = ['en', 'en-US', 'en-GB', 'auto']
        
        for lang in languages_to_try:
            try:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=[lang])
                print(f"✅ Found transcript in language: {lang}")
                break
            except NoTranscriptFound:
                continue
            except Exception as e:
                print(f"⚠️ Failed to get transcript in {lang}: {str(e)}")
                continue
        
        if not transcript_list:
            # Try getting any available transcript
            try:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
                print("✅ Found transcript in default language")
            except Exception as e:
                raise NoTranscriptFound(f"No transcript found in any language: {str(e)}")
        
        if not transcript_list:
            return {
                'success': False,
                'error': 'No transcript available for this video.'
            }
        
        # Format transcript text
        transcript_text = ' '.join([entry['text'] for entry in transcript_list])
        transcript_text = re.sub(r'\s+', ' ', transcript_text).strip()
        
        # Calculate duration from last segment
        duration = 0
        if transcript_list:
            last_entry = transcript_list[-1]
            duration = int(last_entry.get('start', 0) + last_entry.get('duration', 0))
        
        print(f"🎉 Successfully extracted {len(transcript_text)} characters, {len(transcript_list)} segments")
        
        return {
            'success': True,
            'videoId': video_id,
            'videoTitle': f'Video {video_id}',
            'transcriptText': transcript_text,
            'wordCount': len(transcript_text.split()),
            'duration': duration,
            'segmentCount': len(transcript_list)
        }
        
    except TranscriptsDisabled:
        return {
            'success': False,
            'error': 'Transcripts are disabled for this video.'
        }
    except VideoUnavailable:
        return {
            'success': False,
            'error': 'Video is unavailable. It may be private, deleted, or restricted in your region.'
        }
    except NoTranscriptFound:
        return {
            'success': False,
            'error': 'No transcript available for this video. The video may not have captions or transcripts enabled.'
        }
    except InvalidVideoId:
        return {
            'success': False,
            'error': 'Invalid video ID provided.'
        }
    except YouTubeRequestFailed as e:
        return {
            'success': False,
            'error': f'YouTube request failed: {str(e)}'
        }
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"💥 Unexpected error: {str(e)}")
        print(f"🔍 Full traceback: {error_details}")
        
        # Provide more specific error messages for common issues
        error_msg = str(e)
        if "timeout" in error_msg.lower():
            error_msg = "Request timed out. The video may be too long or YouTube is experiencing issues."
        elif "connection" in error_msg.lower():
            error_msg = "Connection failed. Please check your internet connection and try again."
        elif "http" in error_msg.lower() and "403" in error_msg:
            error_msg = "Access forbidden. The video may be private or region-restricted."
        elif "http" in error_msg.lower() and "404" in error_msg:
            error_msg = "Video not found. Please check the URL and try again."
        
        return {
            'success': False,
            'error': f'Unexpected error: {error_msg}',
            'debug': {
                'original_error': str(e),
                'python_version': sys.version,
                'traceback': error_details[-500:] if len(error_details) > 500 else error_details  # Limit traceback size
            }
        }

def handler(request):
    """Vercel Python function handler"""
    try:
        print("🚀 Python YouTube transcript API called")
        
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                'body': ''
            }
        
        if request.method != 'POST':
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Method not allowed'})
            }
        
        # Parse request data
        try:
            if hasattr(request, 'json') and request.json:
                data = request.json
            elif hasattr(request, 'data'):
                data = json.loads(request.data.decode('utf-8')) if request.data else {}
            elif hasattr(request, 'body'):
                data = json.loads(request.body) if request.body else {}
            else:
                data = {}
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Invalid JSON in request body'})
            }
        
        youtube_url = data.get('youtubeUrl', '')
        
        print(f"📺 Processing URL: {youtube_url}")
        
        if not youtube_url:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'YouTube URL is required'})
            }
        
        # Get transcript
        result = get_transcript(youtube_url)
        
        # Return response
        status_code = 200 if result.get('success') else 404
        return {
            'statusCode': status_code,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        print(f"💥 Handler error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        } 

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fetch YouTube transcript and return JSON")
    parser.add_argument("youtube_url", help="Full YouTube video URL or 11-char video ID")
    args = parser.parse_args()

    result = get_transcript(args.youtube_url)
    import json, sys
    sys.stdout.write(json.dumps(result)) 