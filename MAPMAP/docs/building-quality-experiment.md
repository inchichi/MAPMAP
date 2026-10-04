# Building quality study

Scope: the original 512x480 `town_hall` object only. No automatic game application. Keep the reviewed restoration `321f30155d134d03ba3914c1e962d9da` active.

## Experiments

- `building-quality-d4796a568abe`: new snow-only FLUX request. Seed bright snow pixels and grow through connected gray/blue-gray pixels inside the original roof mask. Reuse the reviewed FLUX wire along three manually specified original eave paths. Result: wire is retained and night lighting is consistent, but the raw generation recolors roof tiles instead of making convincing snow mounds. Do not treat increased retained pixels as proof of visual quality.
- `building-quality-af70d1e80f3e`: use only the first reviewed snow coverage as an input guide, fill it with a flat pale color, then ask FLUX to regenerate its material and shading. Retain all output RGB inside that fixed region, not just white pixels. The original reviewed snow RGB is not copied. Reuse the reviewed wire at a lower bulb density.

The FLUX server does not accept an inpainting mask. The guide is painted into the input image and the exact region restriction happens during compositing. This distinction matters: diffusion itself is not spatially constrained, and generated structures outside the mask are discarded.

## Artifacts and checks

Each run is stored under `public/theme-runs/<experiment>/`: model prompt/input/raw result, original, roof/protection mask, eave guide, separate snow and wire PNGs, first/previous/new daytime comparisons, new night comparison, HTML gallery and experiment metadata. Source hashes and before/after shared-state comparison record preservation. These experiments are not normal ready-to-apply pipeline jobs.

Five tests in `test_building_quality_experiment.py` cover connected shading retention, roof exclusion, disconnected gray rejection, dark wire preservation and ambient-versus-emission separation. These test compositing rules, not artistic quality. Final acceptance requires visual comparison of structure, snow volume, wires, edges and pixel density.

## Visual review outcome

Both trials completed real FLUX inference and remain unapplied. The first raw output recolored roof tiles; extraction alone cannot turn it into volumetric snow. The second raw output mostly retained the flat painted guide without enough new shading. Its wire density adjustment also stretched/compressed the bulb shapes; do not adopt that transform. The field `added_shading_pixels` in these early metadata files counts retained non-seed pixels, not independently verified shadow pixels or a quality score.

The combined 23 related tests passed and both before/after shared-state comparisons were unchanged. Next bounded test should focus on generating one shaded snow patch at final sprite scale before reintegrating the building. Keep reviewed wire modules at native aspect ratio, adjust spacing by placement rather than anisotropic scaling, and do not promote a result merely because geometry tests pass. A fixed-layout automatic generation approach has not yet matched the reviewed result.
