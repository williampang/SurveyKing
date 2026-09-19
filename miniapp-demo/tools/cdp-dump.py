#!/usr/bin/env python3
"""
用 Chrome DevTools Protocol 打开页面，等 SPA 的 JS 完全跑完，再 dump 渲染后的 DOM。
用法：python3 cdp-dump.py <url> <out.html> [wait_seconds]
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.parse
import websocket  # pip install websocket-client


CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
      "Mobile/15E148 Safari/604.1 MicroMessenger/8.0.40")


def wait_devtools(port, timeout=15):
    url = f"http://127.0.0.1:{port}/json/version"
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(0.3)
    raise RuntimeError(f"DevTools not ready on port {port}")


def new_tab(port, target_url):
    """通过 HTTP 端点开一个新 tab"""
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/json/new?{urllib.parse.quote(target_url, safe=':/?&=%')}",
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    target = sys.argv[1]
    out = sys.argv[2]
    wait_after_load = float(sys.argv[3]) if len(sys.argv) > 3 else 8.0
    port = 9222

    # 清理旧进程
    subprocess.run(["pkill", "-f", f"remote-debugging-port={port}"],
                   stderr=subprocess.DEVNULL)
    time.sleep(0.5)

    # 启动 chrome headless
    proc = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
         f"--remote-debugging-port={port}",
         "--remote-allow-origins=*",
         "--user-data-dir=/tmp/chrome-cdp-profile",
         "--window-size=414,3200",
         f"--user-agent={UA}",
         "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        wait_devtools(port)
        tab = new_tab(port, target)
        ws_url = tab["webSocketDebuggerUrl"]
        print(f"[cdp] tab={tab['id']} ws={ws_url[:80]}")

        ws = websocket.create_connection(ws_url, timeout=60)
        msg_id = [0]

        def send(method, params=None):
            msg_id[0] += 1
            ws.send(json.dumps({"id": msg_id[0], "method": method,
                                "params": params or {}}))
            return msg_id[0]

        def wait_event(name, timeout=30):
            t0 = time.time()
            while time.time() - t0 < timeout:
                ws.settimeout(max(0.5, timeout - (time.time() - t0)))
                try:
                    m = json.loads(ws.recv())
                except websocket.WebSocketTimeoutException:
                    return None
                if m.get("method") == name:
                    return m
            return None

        send("Page.enable")
        send("Runtime.enable")
        send("Network.enable")
        send("Page.navigate", {"url": target})

        # 等 load 事件
        load = wait_event("Page.loadEventFired", timeout=30)
        print(f"[cdp] loadEventFired={bool(load)}")

        # 额外等 SPA 路由 & XHR
        print(f"[cdp] sleep {wait_after_load}s for SPA to finish…")
        time.sleep(wait_after_load)

        # 拿完整 DOM
        rid = send("Runtime.evaluate", {
            "expression": "document.documentElement.outerHTML",
            "returnByValue": True,
        })
        html = None
        while True:
            ws.settimeout(30)
            m = json.loads(ws.recv())
            if m.get("id") == rid:
                html = m["result"]["result"]["value"]
                break

        with open(out, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"[cdp] wrote {out} ({len(html)} bytes)")

        # 拿页面标题和 URL
        for expr in ["document.title", "location.href",
                     "document.body ? document.body.innerText.length : 0"]:
            rid = send("Runtime.evaluate", {"expression": expr,
                                             "returnByValue": True})
            while True:
                m = json.loads(ws.recv())
                if m.get("id") == rid:
                    print(f"[cdp] {expr} = {m['result']['result']['value']!r}")
                    break

        ws.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()
