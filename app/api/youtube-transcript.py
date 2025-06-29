#!/usr/bin/env python3
"""
Vercel Python API endpoint for YouTube transcript extraction
"""

import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    VideoUnavailable, 
    NoTranscriptFound,
    YouTubeRequestFailed,
    InvalidVideoId
)


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
        
        # Fetch transcript using the Python API
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'en-US', 'auto'])
        
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
        return {
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read the request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            # Parse JSON data
            data = json.loads(post_data.decode('utf-8'))
            youtube_url = data.get('youtubeUrl')
            
            if not youtube_url:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {'error': 'YouTube URL is required'}
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Get transcript
            result = get_transcript(youtube_url)
            
            # Send response
            status_code = 200 if result.get('success') else 404
            self.send_response(status_code)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'error': f'Internal server error: {str(e)}'}
            self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers() 