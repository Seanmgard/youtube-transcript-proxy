#!/usr/bin/env python3
"""
YouTube Transcript Extractor using the reliable Python youtube-transcript-api package
This script is called by the Node.js application to extract YouTube transcripts
"""

import sys
import json
import re
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


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python youtube_transcript.py <youtube_url>'
        }))
        sys.exit(1)
    
    youtube_url = sys.argv[1]
    result = get_transcript(youtube_url)
    print(json.dumps(result)) 