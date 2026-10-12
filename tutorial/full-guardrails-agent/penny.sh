#!/usr/bin/env bash
# Start, stop and check Penny. Reads settings from .env next to this script.
#
#   ./penny.sh start | stop | restart | status | logs | test
set -euo pipefail
cd "$(dirname "$0")"

PID_FILE=penny.pid
LOG_FILE=penny.log

load_env() {
    if [[ -f .env ]]; then
        set -a
        # shellcheck disable=SC1091
        source .env
        set +a
    fi
}

running() {
    [[ -f $PID_FILE ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

case "${1:-}" in
    start)
        if running; then echo "Penny is already running (pid $(cat "$PID_FILE"))."; exit 0; fi
        load_env
        nohup node --import tsx penny.ts >"$LOG_FILE" 2>&1 &
        echo $! >"$PID_FILE"
        sleep 2
        if running; then
            echo "Penny started (pid $(cat "$PID_FILE")). Logs: ./penny.sh logs"
        else
            echo "Penny failed to start:"; tail -n 20 "$LOG_FILE"; rm -f "$PID_FILE"; exit 1
        fi
        ;;
    stop)
        if ! running; then echo "Penny is not running."; rm -f "$PID_FILE"; exit 0; fi
        kill "$(cat "$PID_FILE")"
        for _ in 1 2 3 4 5; do running || break; sleep 1; done
        if running; then kill -9 "$(cat "$PID_FILE")"; fi
        rm -f "$PID_FILE"
        echo "Penny stopped."
        ;;
    restart)
        "$0" stop
        "$0" start
        ;;
    status)
        if running; then echo "Penny is running (pid $(cat "$PID_FILE"))."; else echo "Penny is not running."; fi
        ;;
    logs)
        tail -f "$LOG_FILE"
        ;;
    test)
        # The tests live with the SDK's other tests, two directories up.
        cd ../.. && npx vitest run tests/tutorial/penny
        ;;
    *)
        echo "usage: $0 start|stop|restart|status|logs|test"; exit 2
        ;;
esac
