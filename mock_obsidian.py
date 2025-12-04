import http.server
import socketserver
import os

PORT = 27124
API_KEY = "test_key_123"
VAULT_DIR = "mock_vault"

class ObsidianRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_PUT(self):
        # 1. Check Authorization
        auth_header = self.headers.get('Authorization')
        if not auth_header or auth_header != f"Bearer {API_KEY}":
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"Unauthorized")
            return

        # 2. Parse filename from path (e.g., /vault/MyNote.md)
        path_parts = self.path.strip("/").split("/")
        if len(path_parts) < 2 or path_parts[0] != "vault":
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Invalid path. Use /vault/{filename}")
            return

        filename = "/".join(path_parts[1:])
        filepath = os.path.join(VAULT_DIR, filename)

        # 3. Read content length and body
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        # 4. Save file
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'wb') as f:
            f.write(post_data)

        print(f"Saved file to: {filepath}")

        # 5. Send success response
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"File saved successfully")

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Obsidian Local REST API Mock Server Running")

if __name__ == "__main__":
    os.makedirs(VAULT_DIR, exist_ok=True)
    with socketserver.TCPServer(("127.0.0.1", PORT), ObsidianRequestHandler) as httpd:
        print(f"Mock Obsidian Server serving at http://127.0.0.1:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
