# Crypt map preview

Imported `public/crypt-maps` and its referenced Ninja Dungeon tileset from `develop-chich` at `c91e3c8bafb1b209836d00a1e19700dfcad13f7c`.

Open `/editor.html?game=crypt` for the Crypt Crawler editor. The normal `/editor.html` remains the town RPG. The Crypt adapter loads six TMX files and their tileset, lists actual map entities with 16-pixel tile coordinates, and supports map switching through an origin/source-validated message bridge. Completed scene changes update the sidebar and selected tab.

The runtime starts on `floor-1-ruins`. `floor-0-town` is registered above the five dungeon floors with its own memory slot. All six are selectable; adjacent stairs connect town and floor 1. The renderer includes the imported `depth` tile layer. Compatible HUD, map overlay, pixel-font styling and map-switch code are imported from the same branch, without overwriting the custom town editor/FLUX implementation.

Crypt supports its existing movement, combat, chest/item interactions, HUD and exploration map. The 32-pixel town FLUX workflow remains hidden; Crypt has a separate visual-only style contract described below. NPC/scenario application remains unsupported (`applyMode: none`).

Pre-import maps and tileset are backed up locally under `notes/crypt-import-before-20260910/`. No commits or pushes are made by the import workflow.

Editor-embedded Crypt sessions start muted and persist that setting; the existing audio mute key can re-enable sound. Standalone game defaults are unchanged.

`crypt_christmas.py` prepares a 16px TMX source snapshot and small connected prop crops under a unique `public/theme-runs` ID. `crypt_christmas.py RUN_ID OBJECT_ID` runs the existing FLUX service for a recorded Christmas attached-decoration pilot. Raw output, prompt, timings, aligned reference and extracted overlay are retained. Completion is `awaiting_review`, not game-ready: this pilot does not use the town-only approval/install contract. Large connected forest regions require separate pattern-aware extraction. Neither TMX nor collision data is overwritten.

## Full village decorations

`crypt_full_style.py` prepares the current village: connected houses/fences, exact repeated 2×2 forest tile patterns, and remaining small prop clusters. Identical objects share one FLUX request. Run the printed ID as `crypt_full_style.py RUN_ID` with `THEME_FLUX_URL` pointing to the existing FLUX service. Requests are serial under `.batch.lock` because the shared diffusion scheduler is not concurrency-safe.

FLUX decorates an enlarged original sprite, not an isolated ornament. Snow/bulb/garland colors are extracted **before** reduction to source resolution. The source sprite is unchanged; only snow may extend two native pixels around its alpha silhouette, within the original canvas. Lower doors/trunks remain protected. This is a color-mask heuristic, not semantic segmentation; inspect raw, aligned, overlay and composite images before marking a run `ready`. Native 16px assets still limit visible detail.

`crypt-manifest.json` records the exact map dimensions, source hashes, transparent full-map overlay, night strength, bounded twinkle points and instance count. The runtime renders it above source tiles and below actors. It does not replace tiles, TMX, atlas or collisions. One overlay texture and at most 512 batched lights avoid creating a sprite per forest tree.

`POST /runs/RUN_ID/crypt-apply` validates reviewed status, source hashes, image dimensions and paths, backs up the previous selection in the run folder, writes local `public/crypt-style/active.json`, and appends an application event. The result-page button calls this endpoint. The Crypt village refreshes that selection every five seconds; `?game=crypt&map=floor-0-town` opens it directly. Header `장식 켜기/끄기` toggles both night and ornaments without touching source tiles. The selection is local and gitignored because its generated images are also local.

All raw outputs, settings, request duration and events remain under `public/theme-runs/RUN_ID`; never overwrite earlier experiments. Timing measures HTTP/server/transfer, not pure GPU inference. The service does not expose the random seed, so exact regeneration is not promised. Tests: `python -m unittest discover -s experiments/prompt-theme-server -p test_crypt_style.py`, TypeScript checks and Crypt/editor regression tests.

### Floor 1 winter pass

`crypt_ruins_style.py` prepares `floor-1-ruins` (384 × 384 tiles, 6144 × 6144 pixels). Connected prop components are hashed and deduplicated; 45 forms cover 1,193 placements / 1,714 prop tiles. A second sheet holds 43 ground, vegetation, wall and fixture tiles. Two recorded FLUX requests edit the source sheets in place, not the full maze layout. Run `crypt_ruins_style.py RUN_ID`, inspect the raw sheets, then `crypt_ruins_style.py RUN_ID compose`. Generated snow/lights are masked onto source props; generated material detail and original shading are combined for surfaces. Original alpha, dimensions, TMX and collisions stay unchanged. Empty extracted decorations are explicitly reported for review, not silently counted as decorated.

The 1st-floor selection uses `public/crypt-style/active-floor-1-ruins.json`; the 0th-floor selection remains `active.json`. The renderer and apply endpoint support both separately. The review button opens the corresponding map. The generated 6144-square layer requires a browser/GPU texture limit of at least 6144; render and map-switch checks are required before declaring it applied. Sheet generation time is shown as shared request time, never divided into fictional per-object timings.

For stronger festive lighting, run `crypt_ruins_style.py RUN_ID fixture` before composition. It edits the original red banner individually; only extracted attached decorations are used at the original wall-fixture positions. Bare twig variants with no detected snow receive explicitly labeled frost recoloring, not invented generated ornaments. Raw FLUX sheets can contain unwanted backgrounds or extra empty-cell contents: they are never installed directly; only recorded source slots and original alpha are used.

### Snow ground and frozen plants

Selection writes retry Windows file-replacement locks. If replacement remains blocked, the backed-up selection is written directly; the runtime keeps its previous valid layer during any incomplete read and retries on the next poll.

`crypt_snow_ground.py` extends the currently selected Crypt style in a new run. It extracts the ground and `ground_deco` sprites into a sheet for one recorded FLUX snow/ice material request. Generated luminance supplies material detail; original plant alpha and some source shading retain the small silhouettes. The current village has twelve plant tile variants reused at 78 positions.

Only green ground pixels receive snow. Soil paths, foreground prop alpha, source TMX/atlas and collisions remain unchanged. Frozen plants occupy their original tile coordinates. The existing decoration image/twinkle positions are inherited and composited above this addition, so houses, forest trees and bulbs are not regenerated or discarded. Both source and previous-style previews are retained. Review and application use the same Crypt-only manifest contract and project selection backup.
