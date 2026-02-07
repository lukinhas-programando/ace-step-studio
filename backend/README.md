# ACE-Step Studio Backend

FastAPI backend for the ACE-Step powered Suno-style music studio. Mirrors the architecture of the Qwen TTS project with SQLite persistence and filesystem audio storage.

## Development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
# Link ACE-Step repo so inference modules can be imported
pip install -e ../ACE-Step-1.5
uvicorn app.main:app --reload --host 127.0.0.1 --port 8788
```

Environment variables (prefixed with `ACE_STEP_`):

| Variable | Default | Description |
| --- | --- | --- |
| `ACE_STEP_HOST` | `0.0.0.0` | Bind address (set to your Tailscale IP for LAN-only access) |
| `ACE_STEP_PORT` | `8788` | HTTP port |
| `ACE_STEP_ACE_REPO_PATH` | `../ACE-Step-1.5` | Path to ACE-Step repo |
| `ACE_STEP_LM_ENABLED` | `true` | Toggle ACE 5Hz LM usage |
| `ACE_STEP_OPENAI_ENABLED` | `false` | Enable OpenAI-compatible endpoint |
| `ACE_STEP_OPENAI_ENDPOINT` | _None_ | Base URL to `/v1/completions` compatible server |

The optional OpenAI-compatible endpoint is used for prompt & lyrics expansion when configured. Otherwise, ACE LM stubs are used until the local LM hook is complete.
