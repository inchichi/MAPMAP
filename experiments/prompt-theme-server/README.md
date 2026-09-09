# Prompt-theme server experiments

This is a source snapshot of the live server experiments, not a wired-in generation backend for this branch. The branch editor's **첫 결과 복원 · 크리스마스** button uses the reviewed PNGs under `public/experiments/flux-decorations-20260909`. It works without a GPU, preserves original sprites, and supports decoration/night/twinkle toggling.

## Included logic

- `decoration_profiles.json`, `profile_decorations.py`: active `object-profiles-v1` path. Four explicit object profiles own the generation layout, protected regions and decoration extraction. FLUX produces RGB; code constructs RGBA. No Qwen-Image-Layered dependency.
- `client/`: standalone style-page and shared-placement client snapshots from the live server. They are deliberately outside `src/` to preserve the branch editor and its original left sidebar. The branch still uses the reviewed restoration demo, not this page.
- `building_quality_experiment.py`: archived single-building quality studies; no automatic application. See `docs/building-quality-experiment.md` for the unsuccessful results and limitations.

- `theme_pipeline.py`: rule-based prompt parsing, TMX composition, RGB gain/bias, per-object FLUX calls, preview and explicit application with backups.
- `object_decorations.py`: object-specific source surfaces and decoration extraction; buildings use roof/eaves, trees foliage, fountains a game-specific rim profile; stalls use strips.
- `refine_object_surfaces.py`: reprocess saved references into a new trial without deleting prior results.
- `restore_approved_decorations.py`: create a new record reusing the original reviewed FLUX PNGs and their exact placement coordinates. This is restoration, not fresh generation.
- `test_*.py`: 30 source-preservation, profile, extraction and validation tests.

The automated generation trials were judged worse than the original hand-tuned decorations. Restoring the reviewed assets fixes the current demo, not arbitrary future generation quality. The generated reference, RGB masks and resizing can still lose shading, wires or fine details.

## Server-only dependencies

Set `THEME_PROJECT` to the repository's absolute path before importing these modules (their snapshot location differs from the live `style-service` location). Install FastAPI, uvicorn, Pillow, NumPy and requests in a dedicated Python environment. The tests use the repository's town TMX and do not call the GPU.

```powershell
$env:THEME_PROJECT = (Get-Location).Path
python -m unittest discover -s experiments/prompt-theme-server -p 'test_*.py'
```

The image generation service is external; running these tests does not download models or call FLUX. To start the experimental API from the repository root after setting `THEME_PROJECT`:

```sh
python -m uvicorn theme_pipeline:app --app-dir experiments/prompt-theme-server --host 127.0.0.1 --port 8772
```

The archived client requires `/api/prompt-theme` and `/theme-runs` proxies plus the live `__map-workflow-state` GET/POST service. Its settings placement includes color/night/twinkle metadata that the branch demo renderer does not yet consume. Do not copy the old editor shell or renderer over the newer branch to connect it. Port the state adapter and settings handling separately while retaining the existing sidebar. The current server Apply operation replaces all decoration placements for `town`; a one-object preview is **not** a partial update. Review and back up before applying.

Type-check the archived client separately:

```sh
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM,DOM.Iterable experiments/prompt-theme-server/client/createPromptThemePanel.ts
```

Real generation additionally requires a running FLUX `/style-transfer` service (`THEME_FLUX_URL`). Applying a server trial requires the live shared-state API (`THEME_STATE_URL`, GET state and POST placements), which is **not supplied by this branch's demo**. Do not start it expecting the demo's localStorage state to synchronize automatically. In the live editor, Vite proxies `/api/prompt-theme` to port 8772 and `/theme-runs` to `/artifacts` on that server. The artifact route must return `image/png`, not a SPA HTML fallback.

## Current restored result

Live restoration ID: `321f30155d134d03ba3914c1e962d9da`. Its manifest and preview are archived under `public/experiments/restored-first-quality`. Manifest `/theme-runs/…` URLs are historical live-server provenance, not branch asset URLs. The working demo uses `public/experiments/flux-decorations-20260909/placements.json` instead. No credentials, service logs or user-state backups are included.
