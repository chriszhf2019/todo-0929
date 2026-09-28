# VoxFlow Todo — Development Notes

Overview:
- This repo implements an Android-friendly capture-to-todo pipeline.
- Key modules:
  - `src/App.tsx` — UI glue (now slimmed down; pipeline and native sync are modular).
  - `src/lib/aiPipeline.ts` — AI processing pipeline (on-device → local → remote → local fallback).
  - `src/lib/extraction.worker.ts` — Web Worker wrapper for `extractLocally`.
  - `src/hooks/useNativeSync.ts` — Encapsulates native sync and permissions logic.

Run tests:

```bash
npm install
npm test
```

Notes:
- Worker import uses `new Worker(new URL('./extraction.worker.ts', import.meta.url))` and requires bundler support (Vite supports this).
- Tests are basic smoke/unit tests using `vitest`.
