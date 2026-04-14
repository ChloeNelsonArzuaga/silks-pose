#!/usr/bin/env python3
"""
Local dev server with byte-range support for video scrubbing.

Usage:
    python3 utils/serve.py
"""
import os
import re
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
ROOT = os.path.join(os.path.dirname(__file__), '..')

class RangeHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        range_header = self.headers.get('Range')
        if not range_header:
            return super().do_GET()

        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().do_GET()

        file_size = os.path.getsize(path)
        m = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if not m:
            return super().do_GET()

        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
        self.send_header('Content-Length', str(length))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()

        with open(path, 'rb') as f:
            f.seek(start)
            self.wfile.write(f.read(length))

if __name__ == '__main__':
    os.chdir(ROOT)
    server = HTTPServer(('', PORT), RangeHTTPRequestHandler)
    print(f'Serving at http://localhost:{PORT} (with byte-range support)')
    server.serve_forever()
