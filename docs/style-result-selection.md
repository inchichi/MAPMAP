# Saved style selection

In the Crypt editor Change List, select a saved ready result to inspect its assets.
Selection alone does not change the game. Click **선택한 결과 적용** to validate and
activate the selected overlay, then reload the editor. Older results can be selected again.

The explicit `crypt-select` endpoint requires the active result ID observed by the
editor. A changed active selection rejects the request. Source hashes, RGBA dimensions
and planner contracts remain enforced. Default `crypt-apply` retains its parent check.
Previous selections are preserved in `public/crypt-style/selection-history/`.

The style workspace also exposes saved result selection when its inspected run is ready.
High-resolution runs are labelled with quality and completed object counts. Both the
Halloween town (9 assets, `14108377`) and ruins (45 assets, `3019d650`) are available
under their respective map; selecting a result does not apply it automatically.
