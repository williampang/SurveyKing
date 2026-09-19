#!/usr/bin/env python3
"""CDP 截长图。用法：python3 cdp-shot.py <url> <out.png> [wait_sec] [height]"""
import base64, json, subprocess, sys, time, urllib.parse, urllib.request
import websocket

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
      "Mobile/15E148 Safari/604.1 MicroMessenger/8.0.40")
PORT = 9223


def main():
    url = sys.argv[1]
    out = sys.argv[2]
    wait = float(sys.argv[3]) if len(sys.argv) > 3 else 15
    height = int(sys.argv[4]) if len(sys.argv) > 4 else 4800

    subprocess.run(["pkill", "-f", f"remote-debugging-port={PORT}"],
                   stderr=subprocess.DEVNULL)
    time.sleep(0.5)
    proc = subprocess.Popen(
        [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
         f"--remote-debugging-port={PORT}", "--remote-allow-origins=*",
         "--user-data-dir=/tmp/chrome-shot-profile",
         "--window-size=414,896", f"--user-agent={UA}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try:
                urllib.request.urlopen(
                    f"http://127.0.0.1:{PORT}/json/version", timeout=1)
                break
            except Exception:
                time.sleep(0.3)
        req = urllib.request.Request(
            f"http://127.0.0.1:{PORT}/json/new?"
            f"{urllib.parse.quote(url, safe=':/?&=%')}", method="PUT")
        tab = json.loads(urllib.request.urlopen(req, timeout=5).read())
        ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=60)
        mid = [0]

        def send(m, p=None):
            mid[0] += 1
            ws.send(json.dumps({"id": mid[0], "method": m, "params": p or {}}))
            return mid[0]

        def wait_id(rid, timeout=90):
            ws.settimeout(timeout)
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == rid:
                    return r

        send("Page.enable")
        send("Runtime.enable")
        send("Emulation.setDeviceMetricsOverride",
             {"width": 414, "height": 896, "deviceScaleFactor": 2,
              "mobile": True})
        send("Page.navigate", {"url": url})
        time.sleep(wait)
        # 先取实际内容高度
        rid = send("Runtime.evaluate", {
            "expression": "Math.max(document.body.scrollHeight,"
                          "document.documentElement.scrollHeight)",
            "returnByValue": True})
        r = wait_id(rid)
        real_h = int(r["result"]["result"]["value"] or height)
        print(f"[shot] content height = {real_h}")
        send("Emulation.setDeviceMetricsOverride",
             {"width": 414, "height": min(real_h + 100, 15000),
              "deviceScaleFactor": 2, "mobile": True})
        time.sleep(1.5)
        rid = send("Page.captureScreenshot",
                   {"format": "png", "captureBeyondViewport": True})
        r = wait_id(rid)
        data = base64.b64decode(r["result"]["data"])
        with open(out, "wb") as f:
            f.write(data)
        print(f"[shot] wrote {out} ({len(data)} bytes)")
        ws.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()
