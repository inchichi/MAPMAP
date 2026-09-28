# Object recognition pilot

This is a read-only classification experiment, not the live Planner.

- Input: preserved TMX object crops and original map pixels; verify source hashes.
- Select 6 town and 6 ruins assets. Names and existing labels are not sent to the model.
- Compare crop-only against the same crop plus a nearby map crop with a red target box.
- Enlarge with nearest-neighbor interpolation; keep native coordinates in the manifest.
- Use Qwen3-VL-8B-Instruct, BF16, deterministic decoding. Record the downloaded model revision.
- Use the existing isolated Qwen Python environment without changing its dependencies.
- Run on GPU 2 only after a free-memory check. Never stop FLUX or another service.
- Save every raw response, validated JSON, timing, input hashes and model settings.
- Labels remain unreviewed. Unknown and ambiguous objects must be checked by a person.
- No changes to filenames, game state, Planner, FLUX prompts or existing experiments.

`scripts/object-recognition-pilot.py prepare <new-folder>` prepares evidence.
Copy the folder and script to the server, run `infer <folder>`, copy results back,
then use `report <folder>` to build the comparison page.

Before production integration, manually review labels and compare both modes against
those labels. Agreement between the two model outputs is not classification accuracy.
Cache future approved labels by source hash, not only sequential asset names.
