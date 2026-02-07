#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PY_ENV="$ROOT_DIR/backend/.venv"
BACKEND_PORT=${ACE_STEP_PORT:-8788}
FRONTEND_PORT=${ACE_STEP_UI_PORT:-5175}
HOST=${ACE_STEP_HOST:-0.0.0.0}

if [ ! -d "$PY_ENV" ]; then
  echo "Python venv missing: $PY_ENV"
  exit 1
fi

source "$PY_ENV/bin/activate"
export PYTHONPATH="$ROOT_DIR/backend:${PYTHONPATH:-}"

trap 'kill 0' SIGINT SIGTERM EXIT

uvicorn app.main:app --app-dir "$ROOT_DIR/backend" --host "$HOST" --port "$BACKEND_PORT" &
BACKEND_PID=$!

echo "Backend running (PID $BACKEND_PID) on $HOST:$BACKEND_PORT"

cd "$ROOT_DIR/frontend"
npm run dev -- --host "$HOST" --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

echo "Frontend running (PID $FRONTEND_PID) on $HOST:$FRONTEND_PORT"

wait
