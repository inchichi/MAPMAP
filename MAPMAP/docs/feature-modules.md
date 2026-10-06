# Feature Modules

This document tells you how to add a new feature as its own module.
Read it before you add a new game feature, such as a weapon motion, a skill, a monster pattern, an effect, or a UI window.

## Core Rule

- One feature lives in one module. Do not spread its logic as `if (featureX)` branches across many existing files.
- Existing files only **call** the new module. They should gain a few lines (an import and a call), not the feature itself.
- If you remove the feature, you should be able to delete its module and a few call sites. Nothing else should break.

## Where Each Part Goes

Split a feature by responsibility, not by file type.

| Part | Place | Example (weapon melee motions) |
| --- | --- | --- |
| Game data and rules (what a thing is) | Pure TS under `src/games/my-sample-rpg/` (no Pixi, no DOM) | `meleeMotion: 'thrust'` on the item definition and `getEquippedPlayerMeleeMotion` in `playerEquipment.ts` |
| Feature visuals, timing, and hit rules for the live scene | One new file in `rendering/mapView/` | `rendering/mapView/meleeMotions/thrust.ts` (one file per weapon motion) |
| Variants of one feature | One shared contract, one module per variant, and one registry | `meleeMotions/meleeMotion.ts` (contract), `thrust.ts` / `cleave.ts` / `crush.ts` / `quickSlash.ts`, and `playerMeleeMotions.ts` (registry) |
| Wiring | The existing module that owns the flow | `playerActions.ts` plays the effect, `combat.ts` asks for the hit window and hit area |
| Pure logic tests | `*.test.ts` next to the module | `playerEquipment.test.ts`, `meleeMotions/meleeMotion.test.ts` |

## Rules

- **Keep the feature's constants, textures, sprites, and cleanup inside its module.** Do not add feature-only constants to `mapView/constants.ts` or feature-only textures to `mapView/resources.ts` or `mapView/types.ts`. Those files are for values shared by many features.
- **Game rules must not depend on rendering data.** Decide "which weapon thrusts", "how much damage", or "which skill does what" from game data (for example `playerEquipment.ts`), not from sprite manifests or LPC sheet info. Rendering may read game data. Game data must not read rendering data.
- **Use a registry for variants.** When several items share one kind of behavior (weapon motions, monster patterns), define one contract type, write one module per variant, and list them in one registry. Callers ask the registry. Adding a variant must not add a new `if` branch in callers.
- **Ask one function, not many copies.** If two modules need the same check (for example "which motion does the equipped weapon use?"), add one named function in the module that owns that data and call it from both places. Do not copy the lookup.
- **Own your lifecycle.** A module that creates sprites or timers must also clear them. Hook its clear function into the existing cleanup path (death, respawn, scene change, `destroy`) so nothing is left behind.
- **Use the `createX(ctx)` pattern for scene modules.** A `mapView/` module takes only the values and getters it needs through a small `ctx` type and returns the functions others call. Keep internal state (`let` sprites, timers) private to the module.
- **Export pure helpers separately.** Small rules that need no scene state (for example `isMeleeMotionHitWindowOpen(motion, elapsedMilliseconds)`) should be plain exported functions, so other modules can use them without creating the whole module.
- **Name the file after the feature.** Use names like `playerMeleeMotions.ts`, `meleeMotions/cleave.ts`, or `bossEncounter.ts`. Do not use generic names like `helpers.ts`, `utils.ts`, or `manager.ts`.
- **Start the file with a short header comment** that says what the module owns and where its inputs come from.

## Checklist Before You Finish

- [ ] The feature's own logic is in one new module (plus pure data or rules in the game layer when needed).
- [ ] Existing files only gained imports and calls, not feature logic.
- [ ] No game rule reads rendering-only data.
- [ ] Shared checks are one function, not copied code.
- [ ] Created sprites and timers are cleared on death, respawn, and scene teardown.
- [ ] Pure rules have tests. `tsc --noEmit` passes.
- [ ] `docs/architecture.md` lists the new module.
