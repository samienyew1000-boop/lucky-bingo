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

def cleanup_stale_processes():
    """Kills any previous orphaned cloudflared processes to prevent port conflicts."""
    try:
        subprocess.run(["taskkill", "/F", "/IM", "cloudflared.exe"], capture_output=True, timeout=5)
    except Exception:
        pass

def push_tunnel_config_to_github():
    git_exe = r"C:\Users\HP\AppData\Local\GitHubDesktop\app-3.6.5\resources\app\git\cmd\git.exe"
    if not os.path.exists(git_exe):
        # Fallback to system git
        git_exe = "git"
    try:
        subprocess.run([git_exe, "add", "app-config.js"], cwd=BASE_DIR, capture_output=True, timeout=10)
        subprocess.run([git_exe, "commit", "-m", "chore: auto-sync tunnel url for all devices"], cwd=BASE_DIR, capture_output=True, timeout=10)
        subprocess.run([git_exe, "push", "origin", "main"], cwd=BASE_DIR, capture_output=True, timeout=25)
        print("[✓] Pushed active tunnel URL to GitHub & Vercel successfully.")
    except Exception as e:
        print(f"[!] Git push notice: {e}")

def update_api_config(tunnel_url: str):
    """Updates app-config.js so every phone connects to this active tunnel URL."""
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

class ResilientTunnelManager:
    """Manages cloudflared tunnel lifecycle with automatic health monitoring and reconnection."""

    def __init__(self):
        self.tunnel_proc = None
        self.tunnel_url = None
        self._lock = threading.Lock()
        self._running = True

    def start_tunnel(self) -> str:
        cleanup_stale_processes()
        time.sleep(1)

        print("[1/3] Establishing secure public HTTPS tunnel...")
        self.tunnel_proc = subprocess.Popen(
            [CLOUDFLARED_EXE, "tunnel", "--url", "http://127.0.0.1:3000"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        detected_url = None
        start_time = time.time()
        while time.time() - start_time < 35:
            line = self.tunnel_proc.stderr.readline()
            if not line:
                time.sleep(0.2)
                continue
            m = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
            if m and "api.trycloudflare.com" not in m.group(0):
                detected_url = m.group(0)
                break

        def drain_output(proc):
            try:
                for _ in iter(proc.stderr.readline, ''):
                    pass
            except Exception:
                pass
        threading.Thread(target=drain_output, args=(self.tunnel_proc,), daemon=True).start()

        if detected_url:
            self.tunnel_url = detected_url
            os.environ["TUNNEL_API_URL"] = detected_url
            print(f"[✓] Tunnel active: {detected_url}")
            update_api_config(detected_url)
            print("[✓] Updated app-config.js with active backend URL.")
        else:
            print("[!] Could not detect tunnel URL in time. Local server on port 3000.")

        return self.tunnel_url

    def start_watchdog(self):
        """Continuously tests tunnel health. If broken, automatically restarts it."""
        def watchdog_loop():
            consecutive_failures = 0
            while self._running:
                time.sleep(25)
                if not self.tunnel_url:
                    continue
                try:
                    req = urllib.request.Request(
                        f"{self.tunnel_url}/api/rooms",
                        headers={"User-Agent": "LuckyBingoWatchdog/1.0"}
                    )
                    with urllib.request.urlopen(req, timeout=8) as res:
                        if res.status == 200:
                            consecutive_failures = 0
                        else:
                            consecutive_failures += 1
                except Exception as e:
                    consecutive_failures += 1
                    print(f"[Watchdog] Tunnel check warning ({consecutive_failures}/3): {e}")

                if consecutive_failures >= 3:
                    print("[Watchdog] Tunnel failure threshold reached! Reconnecting...")
                    with self._lock:
                        try:
                            if self.tunnel_proc:
                                self.tunnel_proc.kill()
                        except Exception:
                            pass
                        self.start_tunnel()
                        consecutive_failures = 0

        t = threading.Thread(target=watchdog_loop, daemon=True)
        t.start()

def main():
    print("=" * 65)
    print("🎯 STARTING LUCKY BINGO GLOBAL MULTI-DEVICE SYNC SERVER")
    print("=" * 65)

    tunnel_mgr = ResilientTunnelManager()
    tunnel_url = tunnel_mgr.start_tunnel()
    tunnel_mgr.start_watchdog()

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
