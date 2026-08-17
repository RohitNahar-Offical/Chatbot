import os
import sys
import socket
import webbrowser
import uvicorn

def is_port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False

def find_available_port(host: str = "127.0.0.1", default_port: int = 8000) -> int:
    port = default_port
    while port < default_port + 100:
        if is_port_available(host, port):
            return port
        port += 1
    return default_port

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)

    host = "127.0.0.1"
    port = find_available_port(host=host, default_port=8000)

    print("=" * 60)
    print("  STRA AI — Defense & Cyber Intelligence Platform v1.0")
    print(f"  Starting server at http://{host}:{port}")
    print("=" * 60)

    # Open browser automatically after launch
    webbrowser.open(f"http://{host}:{port}")

    # Launch Uvicorn Server
    uvicorn.run("app.server:app", host=host, port=port, reload=True)

