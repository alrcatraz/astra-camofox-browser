#!/bin/sh
# VNC watcher v2.3: keeps VNC servable even when no browser session is running.
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
# v2.3 change: display-aware liveness. A listening :5900 alone is not proof the
#   right display is served: a stale x11vnc (e.g. on fallback :99) keeps the
#   port, fresh attaches fail with "could not obtain listening port", and the
#   old port-only check then misreports success forever (black-screen bug).
#   Now we identify the socket holder via netstat -tlnp (its PID can never be a
#   zombie -- zombies hold no sockets, so the v1 pgrep/kill -0 trap does not
#   return), confirm it is an x11vnc, and compare the display it serves with
#   the target. Mismatch -> graceful kill of the stale holder, wait for the
#   port to free (<=5s), then attach the new display.
# v2.3.1 change: port_pid awk anchor fixed ("$" not trailing space — a field
#   value never ends with a space, so the old pattern matched nothing).
# v2.3.2 change: socket staleness judged by socket OWNER (netstat -xlp), not
#   ps cmdline — displayfd-mode Xvfb ("-displayfd 3") never shows its display
#   number in cmdline, so cmdline matching deleted the browser's live socket
#   and the watcher flapped between browser display and fallback.
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
  netstat -tln 2>/dev/null | grep -q ":$VNC_PORT "
}

# PID currently listening on $VNC_PORT ("" if none). From the SOCKET table
# (netstat -tlnp), so the PID can never be a zombie -- zombies hold no socket.
# NOTE: $4 is the Local Address FIELD ("0.0.0.0:5900") -- the anchor must be
# "$", not a trailing space (grep-on-whole-line style) which never matches a
# field value. Pattern ":5900$" also covers the tcp6 ":::5900" form.
port_pid() {
  netstat -tlnp 2>/dev/null | awk -v p=":$VNC_PORT" '$4 ~ (p "$") { n=split($NF, a, "/"); print a[1]; exit }'
}

# Display served by PID $1, but ONLY if $1 is an x11vnc ("" otherwise).
# /proc/<pid>/cmdline is a snapshot taken right before use; the kill path is
# guarded by the x11vnc check so a reused PID can never be killed blindly.
x11vnc_display_of() {
  local pid="$1" args
  [ -n "$pid" ] || return 0
  args=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null) || return 0
  echo "$args" | grep -q 'x11vnc' || return 0
  echo "$args" | grep -o -- '-display [^ ]*' | awk '{print $2}'
}

# True iff an x11vnc serving exactly $1 is listening on $VNC_PORT
x11vnc_serving() {
  local pid cur
  pid=$(port_pid)
  [ -n "$pid" ] || return 1
  cur=$(x11vnc_display_of "$pid")
  [ -n "$cur" ] && [ "$cur" = "$1" ]
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
  local disp="$1" pid cur i
  CURRENT_DISPLAY="$disp"
  log "Attaching x11vnc to DISPLAY=$CURRENT_DISPLAY"

  # v2.3: if :$VNC_PORT is held by an x11vnc serving a DIFFERENT display,
  # the fresh instance cannot bind ("could not obtain listening port").
  # Gracefully kill the stale holder, then wait for the port to free (<=5s).
  pid=$(port_pid)
  if [ -n "$pid" ]; then
    cur=$(x11vnc_display_of "$pid")
    if [ -n "$cur" ] && [ "$cur" != "$disp" ]; then
      log "port :$VNC_PORT held by x11vnc on $cur — killing pid $pid to re-attach $disp"
      kill "$pid" 2>/dev/null || true
      i=0
      while [ $i -lt 10 ] && [ -n "$(port_pid)" ]; do sleep 0.5; i=$((i+1)); done
      [ $i -ge 10 ] && log "WARNING: :$VNC_PORT still held 5s after kill"
    fi
  fi

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
  x11vnc_serving "$CURRENT_DISPLAY" && log "x11vnc serving :$VNC_PORT on DISPLAY=$CURRENT_DISPLAY" || log "WARNING: :$VNC_PORT not serving $CURRENT_DISPLAY after attach attempt"
}

# PID of the Xvfb listening on /tmp/.X11-unix/X$1 ("" if none/stale).
# displayfd-mode Xvfb cmdlines carry NO explicit :N ("Xvfb -displayfd 3"),
# so ps-cmdline matching fails for them -- reverse-lookup the socket owner
# instead. $NF is the socket path, $(NF-1) the "PID/name" column.
socket_owner() {
  netstat -xlp 2>/dev/null | awk -v s="/tmp/.X11-unix/X$1" '$NF == s { n=split($(NF-1), a, "/"); print a[1]; exit }'
}

clean_stale_sockets() {
  for sock in /tmp/.X11-unix/X*; do
    [ -e "$sock" ] || continue
    num="${sock#/tmp/.X11-unix/X}"
    # skip fallback socket (managed by ensure_fallback_xvfb)
    [ "$num" = "${FALLBACK_DISPLAY#:}" ] && continue
    # v2.3.2: judge staleness by socket OWNER (netstat -xlp), not by ps
    # cmdline -- displayfd Xvfb never shows its display number in cmdline,
    # so a cmdline match would delete the browser's live socket (flapping)
    if [ -z "$(socket_owner "$num")" ]; then
      log "cleaning stale X socket/lock for :$num"
      rm -f "$sock" "/tmp/.X${num}-lock" 2>/dev/null || true
    fi
  done
}

log "VNC watcher v2.3 started -- maintaining VNC on :$VNC_PORT always"

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
    if [ "$FOUND" != "$CURRENT_DISPLAY" ] || ! x11vnc_serving "$FOUND"; then
      start_x11vnc "$FOUND"
    fi
  else
    # No browser Xvfb right now -> fall back to the always-on display
    ensure_fallback_xvfb
    if [ "$CURRENT_DISPLAY" != "$FALLBACK_DISPLAY" ] || ! x11vnc_serving "$FALLBACK_DISPLAY"; then
      start_x11vnc "$FALLBACK_DISPLAY"
    fi
  fi

  sleep 2
done
