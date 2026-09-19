#!/bin/bash
# 用 Chrome 无头模式 dump 问卷渲染 DOM + 截图
# 用法：bash dump-survey.sh <url> [output-html]
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="${1:-https://test.huaiyu.cn/s/VEb4hf}"
OUT="${2:-/tmp/survey-rendered.html}"
ERR=/tmp/chrome.err
SHOT="${OUT%.html}.png"
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 MicroMessenger/8.0.40'

echo "Target: $URL"
echo "Output: $OUT"
echo "Shot:   $SHOT"
echo

"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --virtual-time-budget=25000 \
  --run-all-compositor-stages-before-draw \
  --hide-scrollbars --window-size=414,2400 \
  --user-agent="$UA" \
  --dump-dom "$URL" > "$OUT" 2> "$ERR"

echo "DOM: $(wc -c < "$OUT") bytes, $(wc -l < "$OUT") lines"

"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --virtual-time-budget=25000 \
  --hide-scrollbars --window-size=414,2400 \
  --user-agent="$UA" \
  --screenshot="$SHOT" "$URL" > /dev/null 2>> "$ERR"

echo "PNG: $(wc -c < "$SHOT") bytes"
