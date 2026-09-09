# FLUX prompt-theme editor

The editor's **스타일 변환** link opens `/editor.html?workspace=style`. The original compact asset sidebar is restored; generation lives on a separate page, not in the sidebar.

The sidebar also retains the original hover previews: expand a kind and hover an asset row to see its enlarged sprite or TMX-composed object beside the list. Leaving the row hides the preview. This reuses `createHoverPreview` and the original tileset/cell lookup rather than a generated thumbnail.

## Start

Install FastAPI, uvicorn, Pillow, NumPy and requests in your Python environment. Start the existing FLUX `/style-transfer` service separately; no Qwen or image-generation fallback is used.

```powershell
# Optional: point at an existing FLUX service or SSH-forwarded local port.
$env:THEME_FLUX_URL = 'http://127.0.0.1:18765'
npm run theme:dev
```

In a second terminal, run `npm run dev -- --host 127.0.0.1 --port 15174 --strictPort`. The editor proxies `/api/prompt-theme` to the isolated local API on port 8773 and `/theme-runs` to its artifact endpoint. `THEME_API_URL` can override that API address. `PYTHON` and `THEME_PORT` can override the launcher defaults. Do not configure `THEME_STATE_URL` for browser-local operation.

## Flow and persistence

1. Interpret a prompt, review the settings and select registered objects.
2. Generate each object with FLUX using its fixed source profile. No source asset is overwritten.
3. Inspect the saved original/generated preview.
4. Approve: the API checks ready status, source hashes and artifact files, then returns placements without touching the remote game's shared state.
5. The browser backs up placements and updates localStorage for `town`. Only selected generated objects and global theme settings are replaced; other objects and maps remain. The game reacts to the storage event, including across editor tabs.

The decoration switch controls color correction, night shading, decorations and lights. Turning it off restores original rendering. Generated settings now drive the renderer instead of forcing night for every result. The original geometry, alpha, doors/windows and collision coordinates remain unchanged.

Records and PNGs remain in `public/theme-runs/` (git-ignored). Placement state belongs to the browser origin: port 15173 and port 15174 intentionally do not share it. Keep the API and artifact directory available when reopening a saved run. The first-quality demo remains available and replaces prompt-theme decorations when explicitly selected.

The parser is rule-based and the four profiles currently support snow/lights/garlands. Pixel masks remain heuristic and require visual review. Partial object updates preserve other decorations, but theme-wide color/night settings follow the newest approved run. No claim is made that automatic extraction always matches the first hand-reviewed result.

## Checks

The style workspace uses the theme laboratory's charcoal/gold layout: prompt and object selection on the left, comparison and approval on the right, with four progress steps. Detailed logs and previous runs are collapsible. Mobile stacks the panels. This presentation does not change generation, approval, persistence, or the editor sidebar.

`npm run build`, `vitest run src/editor/placementStore.test.ts`, and `python -m unittest discover -s experiments/prompt-theme-server -p 'test_*.py'` cover compilation, partial updates, backup failure, UTF-8 records, source preservation and approval without remote state writes. Browser checks must also cover the asset list, FLUX generation, approval, reload and the decoration toggle.
