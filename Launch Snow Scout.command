#!/bin/bash
set -euo pipefail

APP_DIR="/Users/nnaugle/Sites/snow scout"
PORT="${SNOW_SCOUT_PORT:-4173}"
URL="http://127.0.0.1:${PORT}"
OPEN_URL="${URL}/?reload=$(date +%s)"
PIDFILE="${TMPDIR:-/tmp}/snow-scout-${PORT}.pid"
LOGFILE="${TMPDIR:-/tmp}/snow-scout-${PORT}.log"

show_error() {
  local message="$1"
  osascript -e "display dialog \"$message\" buttons {\"OK\"} default button \"OK\" with title \"Snow Scout\""
}

is_expected_server() {
  curl -fsS "${URL}/" 2>/dev/null | grep -q "<title>Snow Scout</title>"
}

port_in_use() {
  lsof -tiTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1
}

start_server() {
  cd "${APP_DIR}"
  nohup python3 -m http.server "${PORT}" --bind 127.0.0.1 > "${LOGFILE}" 2>&1 &
  echo "$!" > "${PIDFILE}"
}

if ! command -v python3 >/dev/null 2>&1; then
  show_error "python3 is not installed or not on your PATH."
  exit 1
fi

if is_expected_server; then
  :
elif port_in_use; then
  show_error "Port ${PORT} is already in use by another app. Free that port or set SNOW_SCOUT_PORT before launching."
  exit 1
else
  start_server
  for _ in {1..24}; do
    sleep 0.25
    if is_expected_server; then
      break
    fi
  done

  if ! is_expected_server; then
    show_error "Snow Scout did not start correctly. Check ${LOGFILE} for details."
    exit 1
  fi
fi

if [ "${SNOW_SCOUT_NO_OPEN:-0}" != "1" ]; then
  open "${OPEN_URL}"
fi
