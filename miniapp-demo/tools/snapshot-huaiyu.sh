#!/bin/bash
# 用 CDP 抓 https://test.huaiyu.cn/s/VEb4hf 的完整渲染 DOM + 长截图
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
OUTDIR="$DIR/../snapshots"
mkdir -p "$OUTDIR"

URL="${1:-https://test.huaiyu.cn/s/VEb4hf}"
NAME="${2:-huaiyu-VEb4hf}"

echo "=== 1. dump DOM ==="
python3 "$DIR/cdp-dump.py" "$URL" "$OUTDIR/$NAME.html" 15

echo
echo "=== 2. long screenshot ==="
python3 "$DIR/cdp-shot.py" "$URL" "$OUTDIR/$NAME.png" 15

echo
echo "=== 3. files ==="
ls -la "$OUTDIR/$NAME.html" "$OUTDIR/$NAME.png"
