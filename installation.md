# Installation Guide (Beginner-Friendly)

This guide is for someone with minimal technical experience.

## Quick Install (Fast Path)

Use this if you just want to run it quickly.

### macOS

```bash
git clone https://github.com/<your-user>/<your-repo>.git
cd ACE
./scripts/install_mac.sh
./scripts/start.sh
```

Open: http://localhost:5175

### Windows (PowerShell)

```powershell
git clone https://github.com/<your-user>/<your-repo>.git
cd ACE
./scripts/install_windows.ps1
./scripts/start.bat
```

Open: http://localhost:5175

If this fails, continue with the full steps below.

---

## Requirements

Install these first:
- Git
- Node.js LTS (includes npm)
- Python **3.11 x64**

Optional but recommended:
- NVIDIA GPU drivers/CUDA (Windows, if you want CUDA acceleration)

Important:
- Use Python 3.11 for this project.
- Do not use Python 3.13.

---

## 1. Get the Project Files

Open Terminal (macOS) or PowerShell (Windows), then run:

```bash
git clone https://github.com/<your-user>/<your-repo>.git
cd ACE
```

If your repo name is not `ACE`, use the folder name that was created.

---

## 2. Install on macOS

Inside the project folder:

```bash
./scripts/install_mac.sh
```

When prompted for accelerator:
- `1` = Apple Silicon (recommended for M-series Macs)
- `3` = CPU-only fallback

---

## 3. Install on Windows

Inside the project folder in PowerShell:

```powershell
./scripts/install_windows.ps1
```

When prompted for accelerator:
- `2` = NVIDIA CUDA
- `1` or `3` = CPU fallback

If installer says Python 3.11 is missing:
- Install Python 3.11 x64
- Close and reopen PowerShell
- Run installer again

---

## 4. Start the App

macOS:

```bash
./scripts/start.sh
```

Windows:

```powershell
./scripts/start.bat
```

Open in browser:
- UI: http://localhost:5175
- Backend health: http://localhost:8788/health

---

## 5. Point to Existing ACE Models (Optional)

If models are already downloaded elsewhere, set env vars before start.

macOS:

```bash
ACE_STEP_ACE_REPO_PATH="/path/to/ACE-Step-1.5" \
ACE_STEP_CHECKPOINTS_PATH="/path/to/ACE-Step-1.5/checkpoints" \
./scripts/start.sh
```

Windows PowerShell:

```powershell
$env:ACE_STEP_ACE_REPO_PATH="C:\path\to\ACE-Step-1.5"
$env:ACE_STEP_CHECKPOINTS_PATH="C:\path\to\ACE-Step-1.5\checkpoints"
./scripts/start.bat
```

---

## 6. First-Run Inside the App

1. Open Settings.
2. Verify model paths and providers.
3. Download/select required models if missing.
4. Generate a short test song.

---

## 7. Clean Reset (If Needed)

This removes local DB/runtime/media cache.

macOS:

```bash
rm -rf ./data
```

Windows PowerShell:

```powershell
Remove-Item -Recurse -Force .\data
```

---

## 8. Common Problems and Fixes

### Python version error
Install Python 3.11 x64 and rerun installer.

### Torch install fails
Rerun installer and pick the correct accelerator option.

### Backend starts but songs fail instantly
Rerun install once in a clean terminal to restore missing dependencies.

### Frontend says proxy/backend error
Confirm backend is running on port `8788` and not blocked by another process.

---

## 9. Optional Network Binding (Tailscale/LAN)

To bind both backend/frontend to a specific IP:

macOS:

```bash
ACE_STEP_HOST=100.101.132.71 ./scripts/start.sh
```

Windows PowerShell:

```powershell
$env:ACE_STEP_HOST="100.101.132.71"
./scripts/start.bat
```

---

If you get stuck, share:
- OS version
- Python version (`python --version`)
- The full install/start error text
