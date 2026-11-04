#!/usr/bin/env bash
# MEOW SYSTEM launcher for Linux (and macOS terminals).
# Starts server.py, prints local + LAN URLs, and keeps data in ./data.json.

set -u
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "需要 python3。请先安装 Python 3，再运行这个脚本。"
  exit 1
fi

if [ ! -f "server.py" ]; then
  echo "找不到 server.py，请在 meow-system 文件夹里运行。"
  exit 1
fi

get_lan_ip() {
  # Linux: default route source address
  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null \
      | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}'
  fi

  # Linux: first non-loopback IPv4
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null \
      | awk '{for (i = 1; i <= NF; i++) if ($i ~ /^[0-9]+\./ && $i !~ /^127\./) {print $i; exit}}'
  fi

  # macOS fallback
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null
  fi

  # Generic fallback
  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig 2>/dev/null \
      | awk '/inet / && $2 !~ /^127\./ {print $2; exit}'
  fi
}

port_busy() {
  local p="$1"

  if command -v ss >/dev/null 2>&1; then
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${p}$"; then
      return 0
    fi
  fi

  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
  fi

  python3 - "$p" <<'PY' >/dev/null 2>&1
import socket
import sys

port = int(sys.argv[1])
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
busy = False
try:
    sock.bind(("0.0.0.0", port))
except OSError:
    busy = True
finally:
    sock.close()
sys.exit(0 if busy else 1)
PY
}

IP="$(get_lan_ip | head -n 1 | tr -d '\r')"
if ! [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IP=""
fi

if [ -n "${PORT:-}" ]; then
  if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    echo "PORT 必须是数字，例如：PORT=8080 ./start-phone.sh"
    exit 1
  fi
  if port_busy "$PORT"; then
    echo "端口 $PORT 已被占用，请换一个，例如：PORT=8088 ./start-phone.sh"
    exit 1
  fi
else
  PORT=""
  for candidate in 8080 8088 8000 8008; do
    if ! port_busy "$candidate"; then
      PORT="$candidate"
      break
    fi
  done
  if [ -z "$PORT" ]; then
    echo "8080 / 8088 / 8000 / 8008 都被占用了。"
    echo "可以手动指定端口，例如：PORT=8090 ./start-phone.sh"
    exit 1
  fi
fi

LOCAL_URL="http://127.0.0.1:${PORT}/meow-system.html"
LAN_URL=""
if [ -n "$IP" ]; then
  LAN_URL="http://${IP}:${PORT}/meow-system.html"
fi

# Copy the phone URL to the desktop clipboard when possible.
if [ -n "$LAN_URL" ]; then
  if command -v wl-copy >/dev/null 2>&1; then
    printf '%s' "$LAN_URL" | wl-copy >/dev/null 2>&1 || true
  elif command -v xclip >/dev/null 2>&1; then
    printf '%s' "$LAN_URL" | xclip -selection clipboard >/dev/null 2>&1 || true
  elif command -v xsel >/dev/null 2>&1; then
    printf '%s' "$LAN_URL" | xsel --clipboard --input >/dev/null 2>&1 || true
  elif command -v pbcopy >/dev/null 2>&1; then
    printf '%s' "$LAN_URL" | pbcopy >/dev/null 2>&1 || true
  fi
fi

echo ""
echo "┌──────────────────────────────────────────────┐"
echo "│  喵档 · MEOW SYSTEM                          │"
echo "│  本地服务已启动                              │"
echo "└──────────────────────────────────────────────┘"
echo ""
echo "电脑打开："
echo "  $LOCAL_URL"
echo ""
if [ -n "$LAN_URL" ]; then
  echo "手机打开（同一 Wi-Fi / 热点）："
  echo "  $LAN_URL"
else
  echo "没有检测到局域网 IP，手机可能无法访问。"
  echo "请检查网络后重新运行，或用 PORT=8080 ./start-phone.sh。"
fi
echo ""
echo "数据文件：$PWD/data.json"
echo "Mac 和手机共用这份数据；迁移时请复制整个 meow-system 文件夹。"
if [ -n "$LAN_URL" ]; then
  echo "如果手机打不开，请检查 Linux 防火墙是否放行 TCP ${PORT}。"
fi
echo "保持这个终端开着。按 Control+C 停止服务。"
echo ""

if [ "${NO_OPEN:-0}" != "1" ]; then
  if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
    if command -v xdg-open >/dev/null 2>&1; then
      xdg-open "$LOCAL_URL" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
      open "$LOCAL_URL" >/dev/null 2>&1 &
    fi
  elif command -v open >/dev/null 2>&1; then
    open "$LOCAL_URL" >/dev/null 2>&1 &
  fi
fi

exec python3 server.py "$PORT"
