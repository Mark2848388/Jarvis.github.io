"""Локальный сервер для проверки Vektor 5.0 в браузере: python3 server.py → http://localhost:8080
Отдаёт ui/ и пробрасывает /api в настоящий Python-движок и C++ ядро."""
import http.server, os, subprocess, sys, re, urllib.parse, shutil
ROOT = os.path.dirname(os.path.abspath(__file__))
# Minimal .env loader (stdlib only). Existing process environment always wins.
def load_env(path):
    try:
        with open(path, encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key, value = key.strip(), value.strip().strip("\\\"").strip("'")
                if key and key.replace("_", "").isalnum():
                    os.environ.setdefault(key, value)
    except OSError:
        pass
load_env(os.path.join(ROOT, ".env"))
# Read only the public endpoint; never read or expose API secrets from the UI.
try:
    cfg = open(os.path.join(ROOT, "ui", "config.js"), encoding="utf-8").read()
    m = re.search(r'^\s*window\.VEKTOR_CLOUD\s*=\s*[\'"]([^\'"]+)', cfg, re.M)
    if m: os.environ.setdefault("VEKTOR_CLOUD_BASE", m.group(1).rstrip("/"))
except OSError:
    pass
sys.path.insert(0, os.path.join(ROOT, "engine")); os.environ.setdefault("VEKTOR_LIB_DIR", ROOT)
lib = os.path.join(ROOT, "libvcore.so")
if not os.path.exists(lib):
    print("Собираю C++ ядро…")
    compiler = shutil.which("g++") or shutil.which("clang++")
    try:
        if not compiler: raise FileNotFoundError("g++/clang++ не найден")
        subprocess.check_call([compiler, "-std=c++17", "-O2", "-shared", "-fPIC", "-o", lib, os.path.join(ROOT, "core", "vcore.cpp")])
    except Exception as e: print("C++ компилятор недоступен — работаю на Python-запасном варианте:", e)
from vektor import Engine
E = Engine(os.path.join(ROOT, "data"))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=os.path.join(ROOT, "ui"), **k)
    def do_GET(s):
        if s.path.startswith("/download/"):
            name=urllib.parse.unquote(s.path[len("/download/"):])
            if not re.fullmatch(r"[a-zA-Zа-яА-Я0-9_-]{1,60}\.zip", name): return s.send_error(400)
            path=os.path.abspath(os.path.join(ROOT,"data","workspace","projects",name))
            base=os.path.abspath(os.path.join(ROOT,"data","workspace","projects"))
            if not path.startswith(base+os.sep) or not os.path.isfile(path): return s.send_error(404)
            s.send_response(200); s.send_header("content-type","application/zip"); s.send_header("content-length",str(os.path.getsize(path))); s.send_header("content-disposition",f'attachment; filename="{name}"'); s.end_headers()
            with open(path,"rb") as f: s.wfile.write(f.read())
            return
        return super().do_GET()
    def do_POST(s):
        if s.path != "/api": return s.send_error(404)
        out = E.handle(s.rfile.read(int(s.headers.get("content-length", 0))).decode()).encode()
        s.send_response(200); s.send_header("content-type", "application/json"); s.send_header("content-length", str(len(out))); s.end_headers(); s.wfile.write(out)
    def log_message(s, *a): pass
PORT = int(os.getenv("VEKTOR_PORT", "8080"))
print(f"Vektor 5.0 → http://localhost:{PORT}   (Ctrl+C — стоп)")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
