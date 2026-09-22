# Run-folder contracts (양찬팀 x 세리팀)

Each style run writes its files into one run folder (`public/theme-runs/<run-id>/`).
These six files are the interface between the two teams' modules.

| File in run folder | Schema | Written by | Read by |
|---|---|---|---|
| `dsl.json` | `dsl.schema.json` | DSL step (request text -> Visual DSL) | Planner |
| `group-manifest.json` | `group-manifest.schema.json` | Group extractor (`tsx` type names, `cc` connected components, `tile` single tiles) | Planner, generator |
| `labels.json` | `labels.schema.json` | Kind cache for `cc` groups, keyed by crop SHA-256 | Group extractor |
| `plan.json` | `plan.schema.json` | Planner | Generator, compose, editor Change List |
| `validation.json` | `validation.schema.json` | Validator (L1 rule checks) | Editor, apply |
| `crypt-manifest.json` | `manifest.schema.json` | Compose | Runtime layer, apply |

Actions in `plan.json`: `decorate` (separate decoration layer), `recolor` (colour/shade only),
`add` (new prop on an empty, non-colliding cell), `cover` (hide with the overlay, reversible), `skip`.
세리팀 `MODIFY` maps to `decorate` or `recolor`, `REMOVE` to `cover`, `ADD` to `add`.

Rules
- Extra keys are allowed, so each team can add fields without breaking the other. Required keys are not optional.
- `seed` is written only when the backend really used and reported it. Never guess a seed.
- `manifest`: new runs write `layers.decoration` (and `layers.recolor` when used). `overlay` is the legacy single layer and stays valid.
- Coordinates are map pixels, top-left origin.

The schemas are generated from `experiments/prompt-theme-server/contracts.py`:

```sh
cd experiments/prompt-theme-server
python contracts.py schemas              # rewrite contracts/*.schema.json from the models
python contracts.py check <run-folder>   # validate the contract files present in a run folder
python -m unittest test_contracts        # samples valid + schema files up to date
```

Samples
- `samples/crypt-floor-1-ruins/`: reduced copy of the applied 1F result (run `66d2311c`). `validation.json` and
  `crypt-manifest.json` are the real files (bulbs cut to 5). Group hashes are real crop hashes; the prompts are the real
  generation prompts. `dsl.json`, `labels.json` (kinds) and `plan.json` were written by hand from that run, because the run
  predates these files.
- `samples/town/`: hand-written inputs for the town MVP. Tile ids and instance positions come from `town-32.tsx` and `town.tmx`.
  No output files yet.
