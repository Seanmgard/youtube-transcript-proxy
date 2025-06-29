#!/usr/bin/env python3

import json
import re
import sys
import traceback
import time
import random
from http.server import BaseHTTPRequestHandler
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    VideoUnavailable, 
    NoTranscriptFound,
    YouTubeRequestFailed,
    InvalidVideoId
)

# Production-grade configuration
import socket
socket.setdefaulttimeout(45)

# Add realistic browser headers to avoid bot detection
import requests
from youtube_transcript_api._http_client import HttpClient

class ProductionHttpClient(HttpClient):
    """Custom HTTP client with browser-like headers for production"""
    
    def __init__(self):
        super().__init__()
        # Realistic browser headers to avoid bot detection
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        })

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

def get_transcript_with_retry(video_url, max_retries=3):
    """Get transcript with retry logic and production optimizations"""
    
    for attempt in range(max_retries):
        try:
            print(f"🔄 Attempt {attempt + 1}/{max_retries} for video: {video_url}")
            
            # Extract video ID
            video_id = extract_video_id(video_url)
            if not video_id:
                return {
                    'success': False,
                    'error': 'Invalid YouTube URL. Please provide a valid YouTube video URL or video ID.'
                }
            
            print(f"🎯 Extracting transcript for video ID: {video_id}")
            
            # Add small random delay to avoid rate limiting
            if attempt > 0:
                delay = (2 ** attempt) + random.uniform(0, 1)
                print(f"⏳ Waiting {delay:.1f}s before retry...")
                time.sleep(delay)
            
            # Try with custom HTTP client first
            try:
                http_client = ProductionHttpClient()
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id, http_client=http_client)
                
                # Try to get English transcript first
                try:
                    transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB'])
                    transcript_data = transcript.fetch()
                    print(f"✅ Found English transcript with {len(transcript_data)} segments")
                except NoTranscriptFound:
                    # Fallback to any available transcript
                    try:
                        transcript = transcript_list.find_manually_created_transcript(['en', 'en-US', 'en-GB'])
                        transcript_data = transcript.fetch()
                        print(f"✅ Found manual English transcript with {len(transcript_data)} segments")
                    except NoTranscriptFound:
                        # Last resort: get any transcript
                        available_transcripts = list(transcript_list)
                        if available_transcripts:
                            transcript = available_transcripts[0]
                            transcript_data = transcript.fetch()
                            print(f"✅ Found {transcript.language_code} transcript with {len(transcript_data)} segments")
                        else:
                            raise NoTranscriptFound(video_id, [], {})
                
            except Exception as custom_error:
                print(f"⚠️ Custom client failed: {str(custom_error)}, trying default...")
                # Fallback to default method
                transcript_data = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'en-US', 'en-GB'])
                print(f"✅ Found transcript with default client: {len(transcript_data)} segments")
            
            if not transcript_data:
                raise NoTranscriptFound(video_id, [], {})
            
            # Format transcript text
            transcript_text = ' '.join([entry['text'] for entry in transcript_data])
            transcript_text = re.sub(r'\s+', ' ', transcript_text).strip()
            
            # Calculate duration from last segment
            duration = 0
            if transcript_data:
                last_entry = transcript_data[-1]
                duration = int(last_entry.get('start', 0) + last_entry.get('duration', 0))
            
            print(f"🎉 Successfully extracted {len(transcript_text)} characters, {len(transcript_data)} segments")
            
            return {
                'success': True,
                'videoId': video_id,
                'videoTitle': f'Video {video_id}',
                'transcriptText': transcript_text,
                'wordCount': len(transcript_text.split()),
                'duration': duration,
                'segmentCount': len(transcript_data),
                'attempt': attempt + 1
            }
            
        except TranscriptsDisabled:
            return {
                'success': False,
                'error': 'Transcripts are disabled for this video.',
                'errorType': 'TranscriptsDisabled'
            }
        except VideoUnavailable:
            return {
                'success': False,
                'error': 'Video is unavailable. It may be private, deleted, or restricted in your region.',
                'errorType': 'VideoUnavailable'
            }
        except NoTranscriptFound:
            if attempt < max_retries - 1:
                print(f"⚠️ No transcript found on attempt {attempt + 1}, retrying...")
                continue
            return {
                'success': False,
                'error': 'No transcript available for this video. The video may not have captions or transcripts enabled.',
                'errorType': 'NoTranscriptFound'
            }
        except InvalidVideoId:
            return {
                'success': False,
                'error': 'Invalid video ID provided.',
                'errorType': 'InvalidVideoId'
            }
        except YouTubeRequestFailed as e:
            if attempt < max_retries - 1:
                print(f"⚠️ YouTube request failed on attempt {attempt + 1}: {str(e)}, retrying...")
                continue
            return {
                'success': False,
                'error': f'YouTube request failed: {str(e)}',
                'errorType': 'YouTubeRequestFailed'
            }
        except Exception as e:
            error_details = traceback.format_exc()
            print(f"💥 Unexpected error on attempt {attempt + 1}: {str(e)}")
            print(f"🔍 Full traceback: {error_details}")
            
            if attempt < max_retries - 1:
                print(f"🔄 Retrying after unexpected error...")
                continue
            
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
            elif "blocked" in error_msg.lower():
                error_msg = "Request was blocked. This may be due to regional restrictions or bot detection."
            
            return {
                'success': False,
                'error': f'Unexpected error: {error_msg}',
                'errorType': 'UnexpectedError',
                'debug': {
                    'original_error': str(e),
                    'python_version': sys.version,
                    'attempt': attempt + 1,
                    'traceback': error_details[-1000:] if len(error_details) > 1000 else error_details
                }
            }
    
    # If we get here, all retries failed
    return {
        'success': False,
        'error': f'Failed to extract transcript after {max_retries} attempts',
        'errorType': 'MaxRetriesExceeded'
    }

class handler(BaseHTTPRequestHandler):
    """Vercel Python function handler using BaseHTTPRequestHandler"""
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        try:
            print("🚀 Production YouTube transcript API called")
            print(f"🌍 Environment: Production")
            print(f"🐍 Python version: {sys.version}")
            
            # Read the request body
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                post_data = self.rfile.read(content_length)
                try:
                    data = json.loads(post_data.decode('utf-8'))
                except json.JSONDecodeError:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    response = {'error': 'Invalid JSON in request body'}
                    self.wfile.write(json.dumps(response).encode())
                    return
            else:
                data = {}
            
            youtube_url = data.get('youtubeUrl', '')
            
            print(f"📺 Processing URL: {youtube_url}")
            
            if not youtube_url:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response = {'error': 'YouTube URL is required'}
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Get transcript with retry logic
            result = get_transcript_with_retry(youtube_url)
            
            # Send response
            status_code = 200 if result.get('success') else 422  # Use 422 for business logic errors
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            # Add production info to response
            result['production'] = True
            result['timestamp'] = time.time()
            
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            print(f"💥 Handler error: {str(e)}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                'error': f'Internal server error: {str(e)}',
                'production': True,
                'timestamp': time.time()
            }
            self.wfile.write(json.dumps(response).encode()) 