#!/bin/sh
# VNC watcher v2.2: keeps VNC servable even when no browser session is running.
# - Maintains a fallback Xvfb (:99) so port 5900 is ALWAYS reachable.
# - Re-attaches x11vnc when the target display changes OR x11vnc dies.
# - Cleans stale X sockets + lock files left by dead Xvfb processes.
#
# v2.1 change: x11vnc liveness is judged by PORT LISTENING, not pid kill -0.
#   kill -0 returns success for zombie (defunct) processes, so a dead x11vnc
#   that nobody reaped would permanently block re-attach (v2 bug -> 104).
# v2.2 change: ps|awk self-exclusion. Our own awk process shows up in ps output
#   and its cmdline contains "Xvfb"/display/resolution tokens, which made the
#   matcher "find" a phantom Xvfb and skip socket cleanup (recurring 104).
#
# Called by the VNC plugin via child_process.spawn. Not meant to run standalone.
#
# Env vars (set by the plugin):
#   VNC_PASSWORD    If set, x11vnc requires this password
#   VIEW_ONLY       "1" for view-only mode
#   VNC_PORT        VNC port (default: 5900)
#   NOVNC_PORT      noVNC websocket port (default: 6080)

set -e

VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"
VNC_RESOLUTION="${VNC_RESOLUTION:-1920x1080x24}"
FALLBACK_DISPLAY="${FALLBACK_DISPLAY:-:99}"

log() { printf '[vnc-watcher] %s\n' "$*" >&2; }

CURRENT_DISPLAY=""

# ps with awk/grep self-exclusion: our own awk process shows up in ps output
# and its cmdline contains "Xvfb"/display/resolution tokens, which would make
# the awk matcher "find" a phantom Xvfb and skip cleanup (v2.1 bug -> 104).
ps_clean() {
  ps -eo stat=,args= 2>/dev/null | grep -v 'awk'
}

# Prepare password file if requested
PASSFILE=""
if [ -n "${VNC_PASSWORD:-}" ]; then
  mkdir -p /tmp/.vnc
  x11vnc -storepasswd "$VNC_PASSWORD" /tmp/.vnc/passwd >/dev/null 2>&1
  PASSFILE="/tmp/.vnc/passwd"
  log "x11vnc: password protected"
else
  log "x11vnc: NO password (bind $NOVNC_PORT to 127.0.0.1 on host + SSH tunnel)"
fi

# Start noVNC (websockify) -- proxies to x11vnc regardless of whether it's up yet
NOVNC_DIR="/usr/share/novnc"
if [ ! -d "$NOVNC_DIR" ]; then
  log "ERROR: $NOVNC_DIR not found; noVNC cannot start"
  exit 1
fi
VNC_BIND="${VNC_BIND:-127.0.0.1}"
log "Starting noVNC (websockify) on $VNC_BIND:$NOVNC_PORT -> 127.0.0.1:$VNC_PORT"
websockify --web "$NOVNC_DIR" "$VNC_BIND:$NOVNC_PORT" "127.0.0.1:$VNC_PORT" >/var/log/novnc.log 2>&1 &

# Real liveness proof: a listening port. Zombie processes pass kill -0 but
# cannot hold a socket, so port check is the only reliable signal.
x11vnc_alive() {
  ss -tln 2>/dev/null | grep -q ":$VNC_PORT " || \
    netstat -tln 2>/dev/null | grep -q ":$VNC_PORT "
}

xvfb_running() {
  # fallback display is always :99; match "Xvfb :99 " exactly to avoid :990
  # exclude zombie Xvfb (STAT Z) -- dead processes must not count
  ps_clean | awk -v fb="$FALLBACK_DISPLAY" '
    /Xvfb/ && $1 !~ /Z/ && index($0, " " fb " ") > 0 { found=1 }
    END { exit !found }
  '
}

ensure_fallback_xvfb() {
  if ! xvfb_running; then
    # stale socket AND lock file from a previous (possibly SIGKILLed) run
    # would make Xvfb fail to bind -- remove both before starting
    rm -f "/tmp/.X11-unix/X${FALLBACK_DISPLAY#:}" "/tmp/.X${FALLBACK_DISPLAY#:}-lock" 2>/dev/null || true
    log "starting fallback Xvfb on $FALLBACK_DISPLAY ($VNC_RESOLUTION)"
    Xvfb "$FALLBACK_DISPLAY" -screen 0 "$VNC_RESOLUTION" \
      -ac -nolisten tcp -extension RENDER +extension GLX \
      -extension COMPOSITE -extension XVideo -extension XVideo-MotionCompensation \
      -extension XINERAMA -fp built-ins -nocursor -br \
      >/var/log/xvfb-fallback.log 2>&1 &
    sleep 1
    xvfb_running || log "WARNING: fallback Xvfb :$FALLBACK_DISPLAY did not stay up (see /var/log/xvfb-fallback.log)"
  fi
}

start_x11vnc() {
  local disp="$1"
  CURRENT_DISPLAY="$disp"
  log "Attaching x11vnc to DISPLAY=$CURRENT_DISPLAY"

  X11VNC_ARGS="-display $CURRENT_DISPLAY -forever -shared -rfbport $VNC_PORT -noxdamage -quiet -bg -o /var/log/x11vnc.log"
  [ "${VIEW_ONLY:-0}" = "1" ] && X11VNC_ARGS="$X11VNC_ARGS -viewonly"
  if [ -n "$PASSFILE" ]; then
    X11VNC_ARGS="$X11VNC_ARGS -rfbauth $PASSFILE"
  else
    X11VNC_ARGS="$X11VNC_ARGS -nopw"
  fi

  # shellcheck disable=SC2086
  x11vnc $X11VNC_ARGS || log "x11vnc attach failed on $CURRENT_DISPLAY (will retry)"
  sleep 1
  x11vnc_alive && log "x11vnc listening on :$VNC_PORT (DISPLAY=$CURRENT_DISPLAY)" || log "WARNING: :$VNC_PORT not listening after attach attempt"
}

clean_stale_sockets() {
  for sock in /tmp/.X11-unix/X*; do
    [ -e "$sock" ] || continue
    num="${sock#/tmp/.X11-unix/X}"
    # skip fallback socket (managed by ensure_fallback_xvfb)
    [ "$num" = "${FALLBACK_DISPLAY#:}" ] && continue
    # if no live Xvfb is bound to this display number, the socket+lock are stale
    if ! ps_clean | awk -v n=":$num" '
        /Xvfb/ && $1 !~ /Z/ && index($0, n) > 0 { found=1 }
        END { exit !found }
      '; then
      log "cleaning stale X socket/lock for :$num"
      rm -f "$sock" "/tmp/.X${num}-lock" 2>/dev/null || true
    fi
  done
}

log "VNC watcher v2.2 started -- maintaining VNC on :$VNC_PORT always"

# Boot: fallback display up immediately so port 5900 is servable right away
ensure_fallback_xvfb
start_x11vnc "$FALLBACK_DISPLAY"

while true; do
  # Find live browser Xvfb (excludes zombies and the :99 fallback)
  # Camoufox uses -displayfd <N> (dynamic display), not a fixed :<N> arg,
  # so also check /tmp/.X11-unix/ for X sockets when no explicit :<N> found.
  FOUND=$(ps_clean | awk -v res="$VNC_RESOLUTION" -v fb="$FALLBACK_DISPLAY" '
    /Xvfb/ && $1 !~ /Z/ && index($0, res) && index($0, " " fb " ") == 0 {
      for (i=2;i<=NF;i++) if ($i ~ /^:[0-9]+$/) { print $i; found=1; exit }
      found_xvfb=1
    }
    END { if (!found && found_xvfb) print "xvfb_running" }
  ' | head -1)

  # If Xvfb is running but no explicit :N was found, try non-fallback sockets
  if [ "$FOUND" = "xvfb_running" ]; then
    for sock in /tmp/.X11-unix/X*; do
      if [ -e "$sock" ]; then
        num="${sock#/tmp/.X11-unix/X}"
        [ "$num" = "${FALLBACK_DISPLAY#:}" ] && continue
        FOUND=":${num}"
        break
      fi
    done
  fi

  # Runtime cleanup: dead Xvfb leaves its socket + lock behind
  clean_stale_sockets

  if [ -n "$FOUND" ] && [ "$FOUND" != "xvfb_running" ]; then
    # Browser display exists -> make sure x11vnc serves it
    if [ "$FOUND" != "$CURRENT_DISPLAY" ] || ! x11vnc_alive; then
      start_x11vnc "$FOUND"
    fi
  else
    # No browser Xvfb right now -> fall back to the always-on display
    ensure_fallback_xvfb
    if [ "$CURRENT_DISPLAY" != "$FALLBACK_DISPLAY" ] || ! x11vnc_alive; then
      start_x11vnc "$FALLBACK_DISPLAY"
    fi
  fi

  sleep 2
done
