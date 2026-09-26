# Theme-independent experiment path

New automatic requests use `dsl_general.py`: bounded verbatim prompt forwarding,
not an LLM semantic parser. No theme allowlist or implicit winter palette.
Crypt preparation starts from original-map.png with an empty overlay and revision
set. Prior results remain on disk. Existing runs retain their recorded legacy path.

New decoration extraction uses color-independent reference differences within a
three-pixel margin. Base sprite alpha and source hash checks remain in place.
This heuristic can mistake generated structural changes for decorations; it does
not establish general visual quality. Automatic color interpretation and twinkle
are disabled rather than silently guessed. Explicit DSL settings remain available.

Tests cover prompt forwarding for Halloween/autumn/underwater, purple decoration
extraction, unchanged source alpha, and removal of inherited winter overlays.
Actual multi-theme FLUX generation and comparative visual QA are still required.
