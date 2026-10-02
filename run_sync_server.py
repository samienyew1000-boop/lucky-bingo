import os
import sys
import re
import time
import shutil
import threading
import subprocess
import urllib.request
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MIRROR_DIR = r"C:\Users\HP\Desktop\telegram bot bingo"
CLOUDFLARED_EXE = os.path.join(BASE_DIR, "cloudflared.exe")

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def push_tunnel_config_to_github():
    git_exe = r"C:\Users\HP\AppData\Local\GitHubDesktop\app-3.6.5\resources\app\git\cmd\git.exe"
    if os.path.exists(git_exe):
        try:
            subprocess.run([git_exe, "add", "app-config.js"], cwd=BASE_DIR, capture_output=True, timeout=10)
            subprocess.run([git_exe, "commit", "-m", "chore: auto-sync tunnel url for all devices"], cwd=BASE_DIR, capture_output=True, timeout=10)
            subprocess.run([git_exe, "push", "origin", "main"], cwd=BASE_DIR, capture_output=True, timeout=25)
            print("[✓] Pushed active tunnel URL to GitHub & Vercel successfully.")
        except Exception as e:
            print(f"[!] Git push notice: {e}")

def update_api_config(tunnel_url: str):
    """Updates api-config.js so every phone connects to this tunnel URL."""
    config_content = f'''// Lucky Bingo API Configuration
// Authoritative backend URL for multi-device sync
(function () {{
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const apiParam = params.get("api");
  if (apiParam) {{
    try {{
      localStorage.setItem("lb_api_url", apiParam.replace(/\\/+$/, ""));
    }} catch (e) {{}}
  }}

  // Pre-configured cloud or tunnel backend URL
  const DEFAULT_BACKEND_URL = "{tunnel_url}";

  if (apiParam) {{
    window.LUCKY_BINGO_API_URL = apiParam;
  }} else {{
    window.LUCKY_BINGO_API_URL = DEFAULT_BACKEND_URL;
    try {{
      localStorage.setItem("lb_api_url", DEFAULT_BACKEND_URL);
    }} catch (e) {{}}
  }}
}})();
'''
    config_path = os.path.join(BASE_DIR, "app-config.js")
    with open(config_path, "w", encoding="utf-8") as f:
        f.write(config_content)
    
    if os.path.isdir(MIRROR_DIR):
        try:
            shutil.copy2(config_path, os.path.join(MIRROR_DIR, "app-config.js"))
        except Exception:
            pass

    threading.Thread(target=push_tunnel_config_to_github, daemon=True).start()

def main():
    print("=" * 65)
    print("🎯 STARTING LUCKY BINGO GLOBAL MULTI-DEVICE SYNC SERVER")
    print("=" * 65)

    # 1. Start cloudflared tunnel
    tunnel_proc = None
    tunnel_url = None
    if os.path.exists(CLOUDFLARED_EXE):
        print("[1/3] Establishing secure public HTTPS tunnel...")
        tunnel_proc = subprocess.Popen(
            [CLOUDFLARED_EXE, "tunnel", "--url", "http://127.0.0.1:3000"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        start_time = time.time()
        while time.time() - start_time < 30:
            line = tunnel_proc.stderr.readline()
            if not line:
                time.sleep(0.2)
                continue
            m = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
            if m and "api.trycloudflare.com" not in m.group(0):
                tunnel_url = m.group(0)
                break
        
        # Drain pipe continuously in a daemon thread to prevent buffer deadlock!
        def drain_tunnel_output(proc):
            try:
                for _ in iter(proc.stderr.readline, ''):
                    pass
            except Exception:
                pass
        threading.Thread(target=drain_tunnel_output, args=(tunnel_proc,), daemon=True).start()

        if tunnel_url:
            print(f"[✓] Tunnel active: {tunnel_url}")
            os.environ["TUNNEL_API_URL"] = tunnel_url
            update_api_config(tunnel_url)
            print("[✓] Updated app-config.js with active backend URL.")
        else:
            print("[!] Could not detect tunnel URL in time. Local server will still run on port 3000.")
    else:
        print("[!] cloudflared.exe not found. Running local server only.")

    # 2. Print instructions & player links
    print("\n" + "=" * 65)
    print("🚀 ALL SYSTEMS ONLINE & FULLY SYNCHRONIZED!")
    print("=" * 65)
    if tunnel_url:
        print(f"🌐 Public Backend API: {tunnel_url}")
        print(f"🎮 Player Game URL:    https://lucky-bingo-iota.vercel.app/?api={tunnel_url}")
        print(f"🛡️ Admin Console:       https://lucky-bingo-iota.vercel.app/admin.html?api={tunnel_url}")
        print("\n💡 NOTE FOR PLAYERS:")
        print(f"   Opening the link with '?api={tunnel_url}' once automatically")
        print("   saves the backend address to that phone so all devices stay in sync!")
    else:
        print("🌐 Local Server: http://127.0.0.1:3000")
    print("=" * 65 + "\n")

    # 3. Start bot.py in main thread
    print("[3/3] Starting Telegram Bot & authoritative game engine...\n")
    import bot
    bot.main()

if __name__ == "__main__":
    main()
