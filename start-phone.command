#!/bin/zsh
# 喵档 · 本地服务启动器
# 双击运行后，会启动一个小服务，把数据写入同目录的 data.json。
# 电脑和手机访问同一个地址，共用同一份数据。

set -u
cd "$(dirname "$0")"

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
LOCAL="$(scutil --get LocalHostName 2>/dev/null || true)"

if [[ -z "$IP" ]]; then
  echo ""
  echo "没有检测到局域网 IP。"
  echo "请先让 Mac 连接 Wi-Fi，或连接 iPhone 的个人热点，然后重新运行。"
  echo ""
  read -r "?按回车退出..."
  exit 1
fi

PORT="${PORT:-8080}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  PORT=8088
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  PORT=8000
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "8080 / 8088 / 8000 都被占用了，请先关闭占用这些端口的程序。"
  read -r "?按回车退出..."
  exit 1
fi

URL_IP="http://$IP:$PORT/meow-system.html"
URL_LOCAL="http://$LOCAL.local:$PORT/meow-system.html"

if [[ -n "$LOCAL" ]]; then
  printf '%s' "$URL_IP" | pbcopy 2>/dev/null || true
fi

echo ""
echo "┌──────────────────────────────────────────────┐"
echo "│  喵档 · MEOW SYSTEM                          │"
echo "│  本地服务已启动                              │"
echo "└──────────────────────────────────────────────┘"
echo ""
echo "1. 让 iPhone 和 Mac 连接同一个 Wi-Fi / 热点"
echo "2. 在 iPhone Safari 打开："
echo ""
echo "   $URL_IP"
echo ""
if [[ -n "$LOCAL" ]]; then
  echo "   如果上面的 IP 打不开，试试："
  echo "   $URL_LOCAL"
  echo ""
fi
echo "3. 想更像 App：Safari → 分享 → 添加到主屏幕"
echo ""
echo "提示：地址已经复制到 Mac 剪贴板，可以通过通用剪贴板粘贴到 iPhone。"
echo "数据文件：$PWD/data.json"
echo "Mac 和手机共用这份数据；换电脑或迁移时，仍建议在「我的」里导出 JSON 备份。"
echo ""
echo "保持这个窗口开着。按 Control+C 停止服务。"
echo ""

python3 "$PWD/server.py" "$PORT" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; echo ""; echo "本地服务已停止。"; exit 0' INT TERM
sleep 0.5
open "http://127.0.0.1:$PORT/meow-system.html" >/dev/null 2>&1 || true
wait "$SERVER_PID"
