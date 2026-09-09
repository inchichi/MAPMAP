# Prompt-theme server experiments

This is a source snapshot of the live server experiments, not a wired-in generation backend for this branch. The branch editor's **첫 결과 복원 · 크리스마스** button uses the reviewed PNGs under `public/experiments/flux-decorations-20260909`. It works without a GPU, preserves original sprites, and supports decoration/night/twinkle toggling.

## Included logic

- `theme_pipeline.py`: rule-based prompt parsing, TMX composition, RGB gain/bias, per-object FLUX calls, preview and explicit application with backups.
- `object_decorations.py`: object-specific source surfaces and decoration extraction; buildings use roof/eaves, trees foliage, fountains a game-specific rim profile; stalls use strips.
- `refine_object_surfaces.py`: reprocess saved references into a new trial without deleting prior results.
- `restore_approved_decorations.py`: create a new record reusing the original reviewed FLUX PNGs and their exact placement coordinates. This is restoration, not fresh generation.
- `test_theme_pipeline.py`: 18 source-preservation, extraction and validation tests.

The automated generation trials were judged worse than the original hand-tuned decorations. Restoring the reviewed assets fixes the current demo, not arbitrary future generation quality. The generated reference, RGB masks and resizing can still lose shading, wires or fine details.

## Server-only dependencies

Set `THEME_PROJECT` to the repository's absolute path before importing these modules (their snapshot location differs from the live `style-service` location). Install FastAPI, uvicorn, Pillow, NumPy and requests in a dedicated Python environment. The tests use the repository's town TMX and do not call the GPU.

```powershell
$env:THEME_PROJECT = (Get-Location).Path
python -m unittest discover -s experiments/prompt-theme-server -p test_theme_pipeline.py
```

Real generation additionally requires a running FLUX `/style-transfer` service (`THEME_FLUX_URL`). Applying a server trial requires the live shared-state API (`THEME_STATE_URL`, GET state and POST placements), which is **not supplied by this branch's demo**. Do not start it expecting the demo's localStorage state to synchronize automatically. In the live editor, Vite proxies `/api/prompt-theme` to port 8772 and `/theme-runs` to `/artifacts` on that server. The artifact route must return `image/png`, not a SPA HTML fallback.

## Current restored result

Live restoration ID: `321f30155d134d03ba3914c1e962d9da`. Its manifest and preview are archived under `public/experiments/restored-first-quality`. Manifest `/theme-runs/…` URLs are historical live-server provenance, not branch asset URLs. The working demo uses `public/experiments/flux-decorations-20260909/placements.json` instead. No credentials, service logs or user-state backups are included.
