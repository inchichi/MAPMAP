# Town single-object pipeline

Open `/editor.html?game=my-sample-rpg&map=town`; use the style link to
`/editor.html?workspace=style&map=town`. Crypt data is not changed.

The editor composer has Content Request and Style Results/Review tabs. Switching
tabs preserves content input and does not apply results. The review tab exposes
saved results and the existing change list, with DSL/asset details in the right
sidebar and a link to the full style generation workspace.

## Implemented path

1. Existing town TMX/profile extraction isolates object families.
2. `/town-vision/plan` asks Qwen3-VL for theme direction, classifies isolated
   nearest-neighbor enlarged crops (no surrounding map), then writes a per-object
   English FLUX prompt from the recognized features and user theme.
3. Recognition cache is keyed by source pixels and dimensions. Raw outputs and
   unreviewed labels are retained. Multiple/fragment/unknown objects are not selectable.
4. The user reviews recognition and prompts, selects objects, and submits a stored
   plan ID. The server rechecks source hashes, asset membership and eligibility.
5. Palette/luminance blending changes original RGB only, preserving exact alpha and size.
   FLUX generates attached decorations. Known snow/light/garland materials use existing
   surface masks; other materials use experimental registered interior difference masks.
6. Results pause at `review_required`. Explicit visual acceptance changes status to ready;
   failed objects or stale sources prevent approval. Applying backs up/replaces the town
   theme using the existing placement store. No Crypt state is modified.

The generic difference extractor is NOT semantic segmentation and may omit/cut ornaments.
Review is mandatory; the pipeline connection does not imply solved extraction quality.
Full-map overlays currently store native-resolution decorations. High-resolution mask
quality and identical-object reuse beyond selected town profiles need further improvement.

## Services

- Local API 8773: `THEME_FLUX_URL=http://127.0.0.1:18765 npm run theme:dev`
- `THEME_VISION_URL` defaults to `http://127.0.0.1:18776` (SSH tunnel).
- Remote `scripts/serve-town-vision.py`: loopback 8776, GPU 2, existing isolated Python
  runtime and downloaded Qwen3-VL-8B model. It does not change FLUX dependencies.
- FLUX continues on its existing service/GPU. Never restart unrelated services.

Tests: `python -m unittest discover -s experiments/prompt-theme-server -p test_town_vision_pipeline.py`.
