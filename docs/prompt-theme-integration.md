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

`restore_first_overlaps.py PARENT_RUN_ID` creates a logged partial restore of the original four demo objects (hall, stall, left fountain, upper tree), preserving the recorded PNG bytes and padded placement coordinates. Its approval contains only those four targets and no theme settings, so unrelated objects and current global night/twinkle settings remain untouched. Approvals replace global settings only when they actually supply new settings.

Every status transition is appended to the run's `events.jsonl`; browser approval and successful browser-save receipts are logged separately. PNGs, raw FLUX responses, prompts and timings remain in the unique run directory. Reuse/corrections create a new run with `parent_run_id`, never overwrite the original experiment. These files are local and git-ignored, not a cloud backup. Run history exposes all retained runs.

`/theme-runs/<id>/review.html` is served through the API with a shared **Apply to editor** button, including older review pages. It enables only for ready results, validates source hashes, preloads artifacts, backs up browser placements, persists the selected targets, records a browser application receipt, then opens `/editor.html`. A logging failure is distinguished from a successful browser apply and remains visible instead of silently redirecting. The style workspace uses the same apply function. Application is local to that browser origin.

`reuse_town_decorations.py PARENT_RUN_ID` creates a reviewed Christmas revision: exact `basket_flowers` tiles receive the existing `prop_5` decoration, including unregistered occurrences. Hidden pixels are clipped against the rendered source map. Trees include TSX-mislabeled `town_prop_325` and `streetlamp_unlit_top_02` canopy fragments; complete original tree sprites plus the existing `tree_3` FLUX decoration cover the lower tree's erroneous window overlap. The composite tree bases use this run's night shade. This is reuse, not a new model generation; timings and provenance say so. It does not edit TMX, change collision, or change differently shaped window planters. The decoration switch hides the revision and reveals the original map again.

1. Interpret a prompt, review the settings and select registered objects.
2. Generate each object with FLUX using its fixed source profile. No source asset is overwritten.
3. Inspect the saved original/generated preview.
4. Approve: the API checks ready status, source hashes and artifact files, then returns placements without touching the remote game's shared state.
5. The browser backs up placements and updates localStorage for `town`. Only selected generated objects and global theme settings are replaced; other objects and maps remain. The game reacts to the storage event, including across editor tabs.

The decoration switch controls color correction, night shading, decorations and lights. Turning it off restores original rendering. Generated settings now drive the renderer instead of forcing night for every result. The original geometry, alpha, doors/windows and collision coordinates remain unchanged.

Records and PNGs remain in `public/theme-runs/` (git-ignored). Placement state belongs to the browser origin: port 15173 and port 15174 intentionally do not share it. Keep the API and artifact directory available when reopening a saved run. The first-quality demo remains available and replaces prompt-theme decorations when explicitly selected.

The parser is rule-based and the profiles currently support snow/lights/garlands. Pixel masks remain heuristic and require visual review. Partial object updates preserve other decorations, but theme-wide color/night settings follow the newest approved run. No claim is made that automatic extraction always matches the first hand-reviewed result.

## Checks

### Full-town attached-material batch

Per-object timing shows pending/running/completed/reused states. New batches record wall-clock start/end plus monotonic elapsed time; `request-timing.json` measures the FLUX HTTP round trip (server computation, transfer and decode), not GPU inference alone. Overall object time includes extraction/placement. Failures retain request timing too. For a batch already running without instrumentation, `watch_batch_timings.py RUN_FOLDER` writes a separate `timings.json` using input/output modification times, explicitly labeled estimated. It never overwrites worker status or interrupts generation. `client/timing-ui.js` displays these values and updates live elapsed time.

`run_town_attached.py` processes all 29 registered placements without stopping on an individual failure. `town_attached_materials.py` isolates same-family TMX tiles instead of cropping all rendered layers; explicit mislabel exceptions restore the hall's roof corner/door and exclude neighboring fountain edges. The hall input matches the first recorded building PNG pixel-for-pixel. Other sources require visual review. FLUX attached decorations include snow, lights and garlands; masks retain connected shading/cables where allowed, with actual generated bulb material relocated only when light extraction misses the source surface. Missing components and failures are recorded, not silently approved. Identical sources and profiles may reuse one generated result.

The batch writes `object_results`, separate processed/succeeded counts, source PNGs, raw FLUX outputs, overlays, a live `review.html`, and a final map/approval manifest. A `.batch.lock` prevents other local API generation submissions during execution. Never restart the API or launch another direct FLUX worker while this batch runs. Game application remains manual. A process crash may leave the lock; inspect worker/process state before recovering it.

### Recorded first-demo replay

`replay_attached_building.py REFERENCE_DIRECTORY` uses the recorded building-only RGBA input, verifies its opaque pixels against the current TMX, and repeats the original attached-decoration prompt at 28 steps / alpha 1.0. It deliberately excludes neighboring fountains/pots that the rectangular all-layer crop includes. The output pauses at `awaiting_review`.

After visually selecting one bulb from the new FLUX output, run `compose_attached_building.py RUN_ID X0 Y0 X1 Y1`. It extracts snow and the central wreath, repeats the selected FLUX bulb at the original 21 eave coordinates, protects windows/doors, checks unchanged original pixels outside the overlay, and writes the review page and browser approval manifest. This is a building-specific reviewed experiment, not the generic 29-object automatic path. Original generation and source records remain separate from the composite. No automatic game apply occurs.

For an already-running batch using the former positional strip extractor, run `python experiments/prompt-theme-server/finalize_town_batch.py RUN_ID`. It waits for completion, re-extracts snow/lights by their color regions from saved FLUX images, rebuilds the preview, and preserves before/after artifacts. This migration helper is for the no-recolor Christmas-night batch only.

`town_profiles.py` extends the four original profiles to 29 static placement targets. Eight overlapping TMX fragment labels belong to their parent sprite, covering all 37 building/tree/fountain/lamp/flower/prop records without duplicate overlays. NPCs and portals are excluded. Additional surface masks are experimental and require visual review.

`python experiments/prompt-theme-server/generate_town_batch.py` creates a Christmas snow/light batch using `THEME_FLUX_URL`. It preserves both attempts, reuses results only when source pixels and local profile settings match, and saves a combined preview and approval manifest. Failed objects are explicitly recorded and omitted, never reported as successful. It does not apply to the game. Run it only while the API is idle; this standalone experiment does not share the API's in-process lock.

The style workspace uses the theme laboratory's charcoal/gold layout: prompt and object selection on the left, comparison and approval on the right, with four progress steps. Detailed logs and previous runs are collapsible. Mobile stacks the panels. This presentation does not change generation, approval, persistence, or the editor sidebar.

`npm run build`, `vitest run src/editor/placementStore.test.ts`, and `python -m unittest discover -s experiments/prompt-theme-server -p 'test_*.py'` cover compilation, partial updates, backup failure, UTF-8 records, source preservation and approval without remote state writes. Browser checks must also cover the asset list, FLUX generation, approval, reload and the decoration toggle.
