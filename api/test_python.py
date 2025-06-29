from http.server import BaseHTTPRequestHandler
import json
import sys
import time

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Simple GET test"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            'status': 'success',
            'message': 'Python function is working!',
            'python_version': sys.version,
            'timestamp': time.time()
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def do_POST(self):
        """Simple POST test"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        response = {
            'status': 'success',
            'message': 'Python POST function is working!',
            'python_version': sys.version,
            'timestamp': time.time()
        }
        
        self.wfile.write(json.dumps(response).encode()) 