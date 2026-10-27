#!/bin/sh
# ============================================================
# SuperButler 超级管家 —— Linux 服务器 Agent
# 采集 CPU / 内存 / Swap / 磁盘 / 负载 / 网络 / 流量 / 温度 /
# 进程数 / TCP·UDP 连接数 / 运行时长，定时上报到 Worker。
#
# 安装（root）：
#   curl -fsSL https://你的域名/agent/sb-agent.sh -o /tmp/sb-agent.sh
#   sudo sh /tmp/sb-agent.sh install --url https://你的域名 --token TOKEN
#
# 卸载：
#   sudo sh /usr/local/bin/sb-agent.sh uninstall
# ============================================================

set -u

AGENT_VERSION="1.0.0"
CONF_FILE="/etc/superbutler-agent.env"
BIN_PATH="/usr/local/bin/sb-agent.sh"
SERVICE_NAME="superbutler-agent"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
STATE_DIR="/var/lib/superbutler-agent"

SB_URL="${SB_URL:-}"
SB_TOKEN="${SB_TOKEN:-}"
SB_INTERVAL="${SB_INTERVAL:-60}"
SB_RESET_DAY="${SB_RESET_DAY:-1}"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [sb-agent] $*" >&2
}

need_val() {
  if [ $# -lt 2 ]; then
    log "参数 $1 缺少值"
    exit 1
  fi
}

download() {
  _url="$1"
  _out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 30 "$_url" -o "$_out"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 30 -O "$_out" "$_url"
  else
    log "需要 curl 或 wget 才能下载 Agent"
    return 1
  fi
}

# ---------------- 安装 / 卸载 ----------------

do_install() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --url) need_val "$@"; SB_URL="$2"; shift 2 ;;
      --token) need_val "$@"; SB_TOKEN="$2"; shift 2 ;;
      --interval) need_val "$@"; SB_INTERVAL="$2"; shift 2 ;;
      --reset-day) need_val "$@"; SB_RESET_DAY="$2"; shift 2 ;;
      *) log "未知参数：$1"; exit 1 ;;
    esac
  done

  if [ "$(id -u)" != "0" ]; then
    log "安装需要 root 权限，请使用 sudo 运行"
    exit 1
  fi
  case "$SB_URL" in
    http://*|https://*) ;;
    *) log "请用 --url 指定面板地址（http/https）"; exit 1 ;;
  esac
  if [ -z "$SB_TOKEN" ]; then
    log "请用 --token 指定服务器 Token"
    exit 1
  fi

  log "下载 Agent 到 $BIN_PATH ..."
  download "$SB_URL/agent/sb-agent.sh" "${BIN_PATH}.new" || {
    log "下载失败，请检查面板地址"
    rm -f "${BIN_PATH}.new"
    exit 1
  }
  chmod 755 "${BIN_PATH}.new"
  mv -f "${BIN_PATH}.new" "$BIN_PATH"

  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"

  umask 077
  cat > "$CONF_FILE" <<EOF
SB_URL="$SB_URL"
SB_TOKEN="$SB_TOKEN"
SB_INTERVAL="$SB_INTERVAL"
SB_RESET_DAY="$SB_RESET_DAY"
EOF
  chmod 600 "$CONF_FILE"

  if ! command -v systemctl >/dev/null 2>&1; then
    log "未检测到 systemd，已写入配置。可手动后台运行："
    log "  nohup $BIN_PATH run >/var/log/sb-agent.log 2>&1 &"
    exit 0
  fi

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=SuperButler Server Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=$CONF_FILE
ExecStart=$BIN_PATH run
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
  systemctl restart "$SERVICE_NAME"

  sleep 2
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "安装成功，Agent 已启动（每 ${SB_INTERVAL} 秒上报一次）"
    log "查看状态：systemctl status $SERVICE_NAME"
  else
    log "服务启动失败，请执行：journalctl -u $SERVICE_NAME -n 50 --no-pager"
    exit 1
  fi
}

do_uninstall() {
  if command -v systemctl >/dev/null 2>&1; then
    systemctl disable --now "$SERVICE_NAME" >/dev/null 2>&1
  fi
  rm -f "$SERVICE_FILE" "$BIN_PATH" "$CONF_FILE"
  rm -rf "$STATE_DIR"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload
  fi
  log "已卸载 SuperButler Agent"
}

# ---------------- 指标采集 ----------------

cpu_usage() {
  set -- $(awk '/^cpu /{t=0;for(i=2;i<=9;i++)t+=$i;print t, $5+$6;exit}' /proc/stat)
  _t1="${1:-0}"
  _i1="${2:-0}"
  sleep 1
  set -- $(awk '/^cpu /{t=0;for(i=2;i<=9;i++)t+=$i;print t, $5+$6;exit}' /proc/stat)
  _t2="${1:-0}"
  _i2="${2:-0}"
  _dt=$((_t2 - _t1))
  _di=$((_i2 - _i1))
  if [ "$_dt" -le 0 ]; then
    echo "0"
  else
    awk -v d="$_dt" -v i="$_di" 'BEGIN{printf "%.2f", 100 * (d - i) / d}'
  fi
}

mem_value() {
  awk -v k="$1" '$1 == k ":" {print $2 * 1024; exit}' /proc/meminfo
}

net_sum() {
  awk 'NR>2 {gsub(/^[ ]+/, ""); split($0, f, /[: ]+/); if (f[1] != "lo") {rx += f[2]; tx += f[10]}} END {print rx+0, tx+0}' /proc/net/dev
}

max_temp() {
  _max=""
  for _f in /sys/class/thermal/thermal_zone*/temp; do
    [ -r "$_f" ] || continue
    _v=$(cat "$_f" 2>/dev/null) || continue
    case "$_v" in
      ''|*[!0-9-]*) continue ;;
    esac
    if [ -z "$_max" ] || [ "$_v" -gt "$_max" ]; then
      _max="$_v"
    fi
  done
  echo "$_max"
}

collect_metrics() {
  M_CPU=$(cpu_usage)
  [ -n "$M_CPU" ] || M_CPU="0"

  M_MEM_TOTAL=$(mem_value MemTotal)
  M_MEM_AVAIL=$(mem_value MemAvailable)
  if [ -z "$M_MEM_AVAIL" ]; then
    M_MEM_AVAIL=$(mem_value MemFree)
  fi
  M_MEM_TOTAL=${M_MEM_TOTAL:-0}
  M_MEM_AVAIL=${M_MEM_AVAIL:-0}
  M_MEM_USED=$((M_MEM_TOTAL - M_MEM_AVAIL))
  [ "$M_MEM_USED" -ge 0 ] || M_MEM_USED=0

  M_SWAP_TOTAL=$(mem_value SwapTotal)
  M_SWAP_FREE=$(mem_value SwapFree)
  M_SWAP_TOTAL=${M_SWAP_TOTAL:-0}
  M_SWAP_FREE=${M_SWAP_FREE:-0}
  M_SWAP_USED=$((M_SWAP_TOTAL - M_SWAP_FREE))
  [ "$M_SWAP_USED" -ge 0 ] || M_SWAP_USED=0

  set -- $(df -kP / 2>/dev/null | awk 'NR==2{print $3*1024, $2*1024}')
  M_DISK_USED=${1:-0}
  M_DISK_TOTAL=${2:-0}

  set -- $(awk '{print $1, $2, $3}' /proc/loadavg)
  M_LOAD1=${1:-0}
  M_LOAD5=${2:-0}
  M_LOAD15=${3:-0}

  M_UPTIME=$(awk '{printf "%d", $1}' /proc/uptime 2>/dev/null)
  M_UPTIME=${M_UPTIME:-0}

  M_PROCESSES=$(ls -d /proc/[0-9]* 2>/dev/null | wc -l | tr -d ' ')
  M_PROCESSES=${M_PROCESSES:-0}

  if command -v ss >/dev/null 2>&1; then
    M_TCP=$(ss -Htan 2>/dev/null | wc -l | tr -d ' ')
    M_UDP=$(ss -Huan 2>/dev/null | wc -l | tr -d ' ')
  else
    M_TCP=0
    M_UDP=0
    for _f in /proc/net/tcp /proc/net/tcp6; do
      [ -r "$_f" ] || continue
      _n=$(wc -l < "$_f")
      M_TCP=$((M_TCP + _n - 1))
    done
    for _f in /proc/net/udp /proc/net/udp6; do
      [ -r "$_f" ] || continue
      _n=$(wc -l < "$_f")
      M_UDP=$((M_UDP + _n - 1))
    done
  fi
  M_TCP=${M_TCP:-0}
  M_UDP=${M_UDP:-0}

  _temp=$(max_temp)
  if [ -n "$_temp" ]; then
    M_TEMP=$(awk -v t="$_temp" 'BEGIN{printf "%.1f", t/1000}')
  else
    M_TEMP="null"
  fi

  M_OS=$(. /etc/os-release 2>/dev/null; printf '%s' "${PRETTY_NAME:-Linux}")
  M_OS=$(printf '%s' "$M_OS" | tr -d '"\\' | tr '\n\r' '  ' | cut -c1-100)
  M_ARCH=$(uname -m 2>/dev/null)
  M_ARCH=${M_ARCH:-unknown}
}

# ---------------- 网络速率与月流量（状态文件） ----------------

compute_network() {
  _now=$(date +%s)
  set -- $(net_sum)
  _rx=${1:-0}
  _tx=${2:-0}

  _rst_day=$SB_RESET_DAY
  case "$_rst_day" in
    ''|*[!0-9]*) _rst_day=1 ;;
  esac
  [ "$_rst_day" -lt 1 ] && _rst_day=1
  [ "$_rst_day" -gt 31 ] && _rst_day=31

  _day=$(date +%d)
  _period=$(date +%Y-%m)
  if [ "$_day" -lt "$_rst_day" ]; then
    _prev=$(date -d "$(date +%Y-%m-01) -1 day" +%Y-%m 2>/dev/null)
    [ -n "$_prev" ] && _period="$_prev"
  fi

  _state_file="$STATE_DIR/net.state"
  _prev_ts=0
  _prev_rx=0
  _prev_tx=0
  _prev_period=""
  _month_rx=0
  _month_tx=0

  if [ -r "$_state_file" ]; then
    read -r _prev_ts _prev_rx _prev_tx _prev_period _month_rx _month_tx < "$_state_file" 2>/dev/null || true
  fi
  _prev_ts=${_prev_ts:-0}
  _prev_rx=${_prev_rx:-0}
  _prev_tx=${_prev_tx:-0}
  _prev_period=${_prev_period:-}
  _month_rx=${_month_rx:-0}
  _month_tx=${_month_tx:-0}

  _elapsed=$((_now - _prev_ts))
  if [ "$_prev_ts" -eq 0 ] || [ "$_elapsed" -le 0 ]; then
    _net_rx=0
    _net_tx=0
    _d_rx=0
    _d_tx=0
  else
    _d_rx=$((_rx - _prev_rx))
    _d_tx=$((_tx - _prev_tx))
    [ "$_d_rx" -lt 0 ] && _d_rx=0
    [ "$_d_tx" -lt 0 ] && _d_tx=0
    _net_rx=$((_d_rx / _elapsed))
    _net_tx=$((_d_tx / _elapsed))
  fi

  if [ "$_prev_period" != "$_period" ]; then
    _month_rx=$_d_rx
    _month_tx=$_d_tx
  else
    _month_rx=$((_month_rx + _d_rx))
    _month_tx=$((_month_tx + _d_tx))
  fi

  printf '%s %s %s %s %s %s\n' "$_now" "$_rx" "$_tx" "$_period" "$_month_rx" "$_month_tx" > "$_state_file" 2>/dev/null || true

  M_NET_RX=$_net_rx
  M_NET_TX=$_net_tx
  M_MONTH_RX=$_month_rx
  M_MONTH_TX=$_month_tx
}

# ---------------- 上报 ----------------

report_once() {
  collect_metrics
  compute_network

  _payload=$(cat <<EOF
{"agent_version":"$AGENT_VERSION","os":"$M_OS","arch":"$M_ARCH","uptime":$M_UPTIME,"cpu":$M_CPU,"mem":{"used":$M_MEM_USED,"total":$M_MEM_TOTAL},"swap":{"used":$M_SWAP_USED,"total":$M_SWAP_TOTAL},"disk":{"used":$M_DISK_USED,"total":$M_DISK_TOTAL},"load":[$M_LOAD1,$M_LOAD5,$M_LOAD15],"net":{"rx":$M_NET_RX,"tx":$M_NET_TX,"month_rx":$M_MONTH_RX,"month_tx":$M_MONTH_TX},"temp":$M_TEMP,"processes":$M_PROCESSES,"tcp":$M_TCP,"udp":$M_UDP}
EOF
)

  _resp=$(curl -fsS --max-time 20 -X POST "$SB_URL/api/agent/report" \
    -H "Content-Type: application/json" \
    -H "X-Agent-Token: $SB_TOKEN" \
    --data "$_payload" 2>&1) || {
    log "上报失败：${_resp:-网络错误}"
    return 1
  }
  return 0
}

do_run() {
  if [ -r "$CONF_FILE" ]; then
    . "$CONF_FILE"
  fi
  if [ -z "$SB_URL" ] || [ -z "$SB_TOKEN" ]; then
    log "缺少配置：请先执行 install，或设置 SB_URL / SB_TOKEN"
    exit 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    log "缺少 curl，无法上报指标"
    exit 1
  fi

  case "$SB_INTERVAL" in
    ''|*[!0-9]*) SB_INTERVAL=60 ;;
  esac
  [ "$SB_INTERVAL" -lt 15 ] && SB_INTERVAL=15
  [ "$SB_INTERVAL" -gt 3600 ] && SB_INTERVAL=3600

  if ! mkdir -p "$STATE_DIR" 2>/dev/null; then
    STATE_DIR="$HOME/.superbutler-agent"
    mkdir -p "$STATE_DIR" 2>/dev/null || true
  fi

  log "Agent $AGENT_VERSION 启动，上报地址 $SB_URL，间隔 ${SB_INTERVAL}s"
  trap 'log "收到退出信号"; exit 0' INT TERM
  while :; do
    report_once || true
    sleep "$SB_INTERVAL"
  done
}

case "${1:-run}" in
  install)
    shift
    do_install "$@"
    ;;
  uninstall)
    do_uninstall
    ;;
  run)
    shift || true
    do_run
    ;;
  version|--version|-v)
    echo "$AGENT_VERSION"
    ;;
  *)
    echo "用法：$0 {install|uninstall|run|version} [选项]"
    exit 1
    ;;
esac
