import os
import sys
import webbrowser
import uvicorn

if __name__ == "__main__":
    host = "127.0.0.1"
    port = 8000
    print("=" * 60)
    print("  STRA AI — Defense & Cyber Intelligence Platform v1.0")
    print(f"  Starting server at http://{host}:{port}")
    print("=" * 60)

    # Open browser automatically after launch
    webbrowser.open(f"http://{host}:{port}")

    # Launch Uvicorn Server
    uvicorn.run("app.server:app", host=host, port=port, reload=True)
