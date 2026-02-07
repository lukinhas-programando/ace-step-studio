# ACE-Step Studio Frontend

React + Vite single-page interface modeled after Suno's workflow. Key panels:

- **Create** (left) — Simple/Custom prompting, ACE LM + OpenAI-compatible expansion, placeholders for future lego/extract/complete modes.
- **Library** (center) — Workspace feed of generations.
- **Song View** (right) — Per-song metadata & lyrics.
- **Playback Bar** (bottom) — Player controls and queue hints.
- **Settings modal** — Model selector, LM toggles, OpenAI endpoint config summary.

## Development

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5175
```

Vite dev server proxies `/api` to the FastAPI backend on port 8788 by default.
