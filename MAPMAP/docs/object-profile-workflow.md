# Object-specific decoration workflow

The branch style page uses `experiments/prompt-theme-server/decoration_profiles.json` through the local API started by `npm run theme:dev`. The older remote installation uses the same profile under `style-service/`. See [editor integration](prompt-theme-integration.md). This supersedes category-wide shared generation/alignment. Registered IDs: `town_hall`, `tree_1`, `fountain_1`, `blacksmith_stall`.

Generation uses FLUX only. The extraction code constructs alpha masks from the generated RGB image; Qwen-Image-Layered is not used. Earlier Qwen comparisons remain historical experiments, not the active path.

## Fixed source information

Each entry owns its TMX box, generation canvas/scale/offset/strength, protected rectangles, and semantic placement regions. Buildings have roof polygons, eave paths and an ornament rectangle; trees have a foliage region and protected trunk; fountains have a cap and explicit elliptical rim; stalls retain the independently generated strip method with explicit top/awning-end rectangles.

Initial input settings are restored: building at native 512x480 with strength 1.0, tree/fountain at scale 2 on 320x320 gray with strength .5; stall strips use the original 320x320 input with strength 1.0. Prompt wording is assembled from the requested decorations and profile placement guidance; seeds remain service-generated and are not fixed.

Unknown objects and changed TMX boxes require review instead of silently falling back to generic geometry. Same-size source-art changes still require human profile review; a size/position check is not a complete shape validator. Each run records its profile snapshot and original RGBA hash for diagnosis.

## Dynamic generated-image extraction

Generated RGB is mapped back through the known input canvas transform. Decoration locations within allowed regions are detected anew per result rather than cropping a fixed generated-image rectangle. Snow seeds expand through connected gray shading; bulb seeds expand into adjacent dark cables/sockets; requested garlands use a separate ornament region. Protected regions are excluded, original source images are never overwritten, and artifacts include masks, aligned reference, extracted PNG, composite and per-decoration counts.

This is still heuristic extraction, not SAM segmentation, structural registration, or masked diffusion. Missing or excessive decoration pixels fail before application, but passing those checks does not establish artistic quality. Manual preview approval remains necessary. The live restored first-quality result is retained during development.

## Editing a profile

1. Copy the object's current TMX box and establish the original RGBA reference.
2. Specify source-space regions and protected landmarks in pixel coordinates; do not use generated-image coordinates.
3. Set the object-specific generation input layout and supported decorations.
4. Inspect the saved region PNGs and original/generated/composite triplet before applying.
5. If generation drifts, inspect the aligned reference rather than relaxing every mask or stretching the whole object.

From the repository root, set `THEME_PROJECT` to that root and run `python -m unittest discover -s experiments/prompt-theme-server -p "test_*.py" -v` (30 tests at integration). The archived client can be type-checked separately as described in its README. Real FLUX validation completed for tree run `b8432a220a324f5d94f4638eba8c6e8a` (1,421 snow pixels and 96 light pixels); these counts are not quality scores. The result was not applied. The other three entries require fresh visual review before declaring regeneration quality matched to the first result.
