"""Preview the exported Pages build on loopback only, with its real base path."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1] / "out"
BASE = "/vocabflow-6004"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path != BASE and not path.startswith(BASE + "/"):
            self.send_error(404)
            return
        self.path = self.path[len(BASE):] or "/"
        super().do_GET()


if __name__ == "__main__":
    if not (ROOT / "index.html").is_file():
        raise SystemExit("Run npm.cmd run build first")
    print("Static preview: http://localhost:3001/vocabflow-6004/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 3001), Handler).serve_forever()
