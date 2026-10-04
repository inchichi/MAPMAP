# ComfyUI workflows (API format)

`comfy_backend.py` fills three inputs in any workflow here: the single `LoadImage` image, the text of the
prompt node that feeds the sampler's `positive` input, and the sampler `seed` / `noise_seed` (a random seed
chosen per request and recorded in `generation.json`). Steps and models stay as saved in the workflow.

- `flux-kontext-edit.json`: FLUX.1 Kontext dev edit, 28 steps (same as the FLUX 8765 baseline).
  The model file names follow the ComfyUI example names. Replace them with the names on the ComfyUI you use
  (check `/object_info/UNETLoader`), or replace the whole file with the 세리팀 export (Workflow -> Export (API)).

Use: `STYLE_BACKEND=comfy THEME_COMFY_URL=http://127.0.0.1:18188 THEME_COMFY_WORKFLOW=flux-kontext-edit`.
If ComfyUI fails, the request falls back to the FLUX service and `generation.json` records why
(set `THEME_COMFY_FALLBACK=0` to fail instead).
