# Registered decoration extraction (experimental)

Run `python experiments/prompt-theme-server/review_registered_decoration.py` with
OpenCV, NumPy and Pillow installed. It reuses saved FLUX outputs for house,
fence and column from `14108377af854127a990463f567719c0`.

The experiment registers the generated image to the original using multiscale
affine ECC, rejects low correlation or excessive drift, and removes differences
that match neighboring original colors. Original edge bands and exterior pixels
are excluded conservatively. Original RGBA and logical placement remain unchanged.

This is NOT semantic segmentation or a general production fix. House duplicate
edges were reduced, but some decorations are incomplete. The fence failed the
alignment gate; the column loses exterior ornaments. These candidates must not
be auto-applied. Regeneration or semantic masks are needed for rejected or
over-filtered examples. The existing production extractor is unchanged.

Every invocation creates a separate run with copied inputs, raw generation,
settings/timings, candidates, comparison image and validation report. No previous
run or current game selection is overwritten. Open its `comparison.html` in Vite.
