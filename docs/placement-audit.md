# Ruins placement audit

Run `python experiments/prompt-theme-server/audit_ruins_placements.py RUN_ID` from the repository root.

The read-only audit compares decoration alpha against all other extracted original instance alpha and checks map boundaries. Each execution creates a unique `public/theme-runs/RUN_ID/audits/UUID/` containing `report.json`, `review.html`, and a context crop for every selected placement. It never changes the active selection, marks an experiment as failed, or overwrites previous audits.

On 2026-09-26, run `f3d2dfa8a0524ba1a5151458924c14a3` had 126 decorated placements checked against 1,193 original instances: zero foreign-object overlap candidates and zero boundary candidates. Audit ID: `326014e5df2242f2882adea31eed4c75`.

An extended audit also checks selected decorations against each other. Audit `0be43d5759874e75b7470848a205fce9` found zero candidates in all three categories across the same 126 placements.

This is not a visual-quality approval. Walls, characters, and inherited decorations are outside the current check. The 126 context crops support subsequent visual review. Only user-designated failures may enter the failure archive.

## Completion boundary

The current floor-1 Christmas/winter prop MVP has prompt planning, group selection, generation/recoloring, padded decoration composition, preview, explicit apply, persistence and original-view toggle. The two-group production revision is applied; this is not a claim that all 45 prop groups were freshly generated through the new path.

Remaining extensions are semantic object labels, additional themes/time changes, wall/ground editing, and scene-aware occlusion checks. These are not silently approximated by the MVP. Current validation: 78 Python service tests and TypeScript/Vite production build passed on 2026-09-26. Build warnings remain for CSS import order, mixed static/dynamic imports and bundle size.
