#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PY_ENV="$ROOT_DIR/backend/.venv"
NODE_DIR="$ROOT_DIR/frontend"
ACE_REPO="${ACE_STEP_REPO_PATH:-$ROOT_DIR/../ACE-Step-1.5}"

resolve_python311() {
  if command -v python3.11 >/dev/null 2>&1; then
    echo "python3.11"
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    version="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
    if [ "$version" = "3.11" ]; then
      echo "python3"
      return
    fi
  fi
  echo ""
}

PYTHON_BIN="$(resolve_python311)"
if [ -z "$PYTHON_BIN" ]; then
  echo "Python 3.11 is required by ACE-Step (found incompatible default python)."
  echo "Install Python 3.11 and rerun."
  echo "Example (Homebrew): brew install python@3.11"
  exit 1
fi

echo "==> Setting up Python 3.11 virtualenv at $PY_ENV (using $PYTHON_BIN)"
"$PYTHON_BIN" -m venv "$PY_ENV"
source "$PY_ENV/bin/activate"
python -m pip install --upgrade pip
python -m pip install "numpy<2"

echo "==> Selecting torch build"
echo "   1) Apple Silicon (M-series, mps)"
echo "   2) NVIDIA/CUDA (CUDA 12.1 wheels)"
echo "   3) CPU only"
read -r -p "Choose accelerator [1/2/3, default 1]: " ACC_CHOICE
ACC_CHOICE=${ACC_CHOICE:-1}
case "$ACC_CHOICE" in
  2)
    echo "CUDA wheels are not supported by this macOS installer."
    echo "Use option 1 (Apple Silicon) or option 3 (CPU only)."
    exit 1
    ;;
  3)
    python -m pip install torch torchvision torchaudio
    ;;
  *)
    # On macOS, use the latest compatible wheels from PyPI rather than pinned legacy builds.
    python -m pip install torch torchvision torchaudio
    ;;
esac

if [ ! -d "$ACE_REPO" ]; then
  read -r -p "ACE-Step repo not found at $ACE_REPO. Clone now? [Y/n] " CLONE_REPLY
  CLONE_REPLY=${CLONE_REPLY:-Y}
  if [[ "$CLONE_REPLY" =~ ^[Yy]$ ]]; then
    git clone https://github.com/ace-step/ACE-Step-1.5 "$ACE_REPO"
  else
    echo "ACE-Step repo is required. Set ACE_STEP_REPO_PATH or clone manually."
    exit 1
  fi
fi

echo "==> Installing backend"
python -m pip install -e "$ROOT_DIR/backend"
python -m pip install -e "$ACE_REPO"

echo "==> Seeding runtime config"
python <<'PY'
from backend.app.runtime_config import update_runtime_config
update_runtime_config(
    lm_enabled=True,
    default_model_variant="turbo",
    base_inference_steps=32,
    turbo_inference_steps=8,
    shift_inference_steps=8,
    image_generation_provider="none",
    a1111_base_url="http://127.0.0.1:7860",
)
print("Runtime config initialized at data/runtime_config.json")
PY

deactivate

echo "==> Installing frontend dependencies"
cd "$NODE_DIR"
npm install

echo "Install complete. Activate backend venv with 'source backend/.venv/bin/activate'."
