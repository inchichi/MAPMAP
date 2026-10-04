# Decoration extraction routing

New Planner rows include `extraction` from `decoration_policy.py`. This is a
versioned keyword-based bootstrap, not an LLM or semantic image segmentation.
Explicit decoration words take precedence over Christmas/Halloween suggestions.
Negative or unknown requests are routed conservatively to review.

- Snow/lights: select only their existing material masks, independently of theme.
- Pumpkins/webs/garlands: semantic extraction is not implemented. Difference
  images are diagnostic candidates only, not validated decoration masks.
- New policy runs end in `awaiting_review`; existing apply endpoints require
  `ready`, so these candidates cannot be applied. There is not yet a new review
  approval UI. Do not manually change status to bypass visual validation.
- Each processed asset saves `extraction-policy.json`. Old rows without a policy
  retain legacy behavior for reproducibility. Saved experiments are untouched.

Scope: the existing 1F automatic Planner/crypt plan execution path. The offline
0F comparison scripts do not use this routing yet. Palette planning, independent
generation/anchor placement, semantic masks, retry and approval UI remain work.

## Recorded semantic pilot

Run `1a8967fde9194d3aa55421af7885e8ba` tested the existing remote
GroundingDINO-tiny + SAM-vit-base service against one saved house generation.
Four pumpkins were detected; cobweb was not. Cropped RGBA assets were aligned
with the recorded affine transform and composited over the unchanged-shape
palette base. Requests, response, raw input, timing and crops are retained.
This pilot is not yet integrated into automatic generation or approval UI.
Missing requested labels prevent claiming a complete extraction.
