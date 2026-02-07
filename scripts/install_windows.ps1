$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
$pyEnv = Join-Path $ROOT "backend/.venv"
$defaultAce = [System.IO.Path]::GetFullPath((Join-Path $ROOT "..\ACE-Step-1.5"))
$aceRepo = if ($env:ACE_STEP_REPO_PATH) { $env:ACE_STEP_REPO_PATH } else { $defaultAce }
$nodeDir = Join-Path $ROOT "frontend"

function New-ProjectVenv {
  param([string]$Path)

  $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
  if ($pyLauncher) {
    & py -3.11 -c "import sys; assert sys.version_info[:2] == (3, 11)"
    if ($LASTEXITCODE -eq 0) {
      & py -3.11 -m venv $Path
      if ($LASTEXITCODE -eq 0) {
        return
      }
      throw "Failed to create virtualenv with Python 3.11."
    }
  }

  try {
    $version = (& python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')").Trim()
  } catch {
    throw "Python 3.11 x64 is required. Install it, then rerun this script."
  }

  if ($version -ne "3.11") {
    throw "Python 3.11 x64 is required. Current python is $version. Install 3.11 and rerun."
  }

  & python -m venv $Path
}

Write-Host "==> Creating Python 3.11 virtual environment at $pyEnv"
New-ProjectVenv -Path $pyEnv
if (-not (Test-Path "$pyEnv\Scripts\Activate.ps1")) {
  throw "Virtual environment was not created. Install Python 3.11 x64 and rerun. Example: winget install --id Python.Python.3.11 -e"
}
& "$pyEnv/Scripts/Activate.ps1"
python -m pip install --upgrade pip
python -m pip install "numpy<2"

Write-Host "==> Select accelerator:"
Write-Host "   1) CPU / Apple (default)"
Write-Host "   2) NVIDIA CUDA 12.1"
Write-Host "   3) CPU only"
$choice = Read-Host "Choose option [1/2/3]"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }
switch ($choice) {
  "2" { python -m pip install torch==2.1.2+cu121 torchvision==0.16.2+cu121 torchaudio==2.1.2+cu121 --index-url https://download.pytorch.org/whl/cu121 }
  "3" { python -m pip install torch==2.1.2 torchvision==0.16.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cpu }
  default { python -m pip install torch==2.1.2 torchvision==0.16.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cpu }
}

if (-not (Test-Path $aceRepo)) {
  $reply = Read-Host "ACE-Step repo not found at $aceRepo. Clone now? [Y/n]"
  if ([string]::IsNullOrWhiteSpace($reply) -or $reply -match "^[Yy]") {
    git clone https://github.com/ace-step/ACE-Step-1.5 $aceRepo
  } else {
    Write-Error "ACE-Step repo required. Set ACE_STEP_REPO_PATH or clone manually."
    exit 1
  }
}

Write-Host "==> Installing backend"
python -m pip install -e "$ROOT/backend"

Write-Host "==> Installing ACE-Step runtime dependencies (without vllm)"
$aceCoreDeps = @(
  "transformers>=4.51.0,<4.58.0",
  "diffusers",
  "gradio",
  "matplotlib>=3.7.5",
  "scipy>=1.10.1",
  "soundfile>=0.13.1",
  "loguru>=0.7.3",
  "einops>=0.8.1",
  "accelerate>=1.12.0",
  "diskcache",
  "numba>=0.63.1",
  "vector-quantize-pytorch>=1.27.15",
  "torchao",
  "modelscope"
)
python -m pip install @aceCoreDeps

Write-Host "==> Installing ACE-Step editable package (no transitive deps)"
python -m pip install -e "$aceRepo" --no-deps

Write-Host "==> Seeding runtime config"
$runtimeScript = @'
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
'@
python -c $runtimeScript

Deactivate

Write-Host "==> Installing frontend dependencies"
Set-Location $nodeDir
npm install
Write-Host "Install complete. Activate venv via backend/.venv/Scripts/Activate.ps1"
