# Architecture

This document is a short guide for module boundaries and code placement.

## Current Structure

- `src/main.ts`: web entry point. Compose the application, bootstrap scenes, and route portal-driven scene transitions here.
- `src/games/my-sample-rpg/assets/`: runtime assets that are imported by the web client.
- `src/games/my-sample-rpg/assets/lua/`: project Lua controller scripts that are loaded by the web client at runtime.
- `src/game/`: pure game or engine logic that should stay easy to test with Vitest.
- `src/game/characterState.ts`: shared character state, optional monster level metadata, optional fixed sign text, controller decisions, and movement rules for both the player and NPCs.
- `src/game/createCharacterControllerRuntime.ts`: controller attachment lifecycle, shared movement dispatch, and Lua script hot-update coordination.
- `src/game/events/`: small central queue models for frame-level game events.
- `src/game/interaction/`: target resolution and event processing for interaction flow.
- `src/game/lua/`: Lua wasm bridge code that loads controller modules, exposes the public `engine.*` Lua API, and evaluates scripts for runtime characters.
- `src/game/lua/luaControllerApi.ts`: source of truth for the Lua-visible controller contract.
- `src/game/blacksmithShop.ts`: blacksmith merchant inventory, buy/sell trade rules, and stock initialization for the shop NPC.
- `src/game/monsterCombat.ts`: monster HP, contact damage, and defeat-state rules shared by combat scenes.
- `src/game/monsterDisplayName.ts`: monster name formatting for on-map labels and HUD badges.
- `src/game/monsterRewards.ts`: monster reward amounts such as beginner gold, experience, and level-based skill-point drops.
- `src/game/questLog.ts`: pure quest definitions, quest progress state transitions, prerequisite checks, objective event matching, tracker visibility, NPC badge state, dialogue text formatting, and reward data for the 느티골 beginner quest arc.
- `src/game/playerExperience.ts`: player experience gain, level-up application, and the level 100 cap.
- `src/game/playerEquipment.ts`: player-facing equipment state, starter gear data, blacksmith gear data, item price metadata, and item icon metadata used by the combined player panel.
- `src/game/playerProfile.ts`: player-facing name, starter beginner class, 10-level promotion check, level 100 cap, future job-to-primary-stat mapping, resource, exp, stat, and skill data used by the HUD, plus available and total skill-point tracking for the skill window.
- `src/games/my-sample-rpg/playerWeaponSkills.ts`: weapon-line skill data (weapon line, chapter, unlock level, cooldown, power table). The weapon line, not a job, decides which skills can be used. See `docs/weapon-balance.md`.
- `src/game/playerSkills.ts`: executable skill metadata, including skill-bar display lookup helpers, skill-level-based mana costs, smash damage, protect duration, skill unlock checks, and icon lookup data.
- `src/games/my-sample-rpg/rendering/mapView/skillCooldowns.ts`: records when each skill cooldown starts (called from `playerActions.ts`, `playerCombatEffects.ts`, `playerWeaponSkills.ts`) so the bottom HUD can show a clockwise dark sweep and the remaining seconds on Q/W/E/R slots. Each module still owns its own ready time.
- `src/games/my-sample-rpg/rendering/mapView/combatIndicators.ts`: UI markers over monsters, not attack effects — a gold arrow over the monster the player is fighting (set by `combat.ts` when player damage lands and by magic target selection; clears after 5 s, on death, or out of range) and a red `!` over monsters that are aggroed on the player (read from `isAggroed`).
- `src/games/my-sample-rpg/rendering/mapView/portalVortex.ts`: MapleStory-style portal look (animated blue vortex, ground glow, rising sparkles) drawn once as 8 pixel frames and shared by every portal. Portals are entered with the up-move key while standing on one, or the `portal` key (`F`), in `mapView/inputHandlers.ts`.
- `src/games/my-sample-rpg/worldMap.ts`: world map (`M`) data — region grid layout, routes between regions (must match TMX portals; a test checks this), and terrain per region. Visited regions are saved in `worldSaveState.visitedSceneIds`; unvisited regions are covered by fog. `rendering/worldMapView.ts` draws it as one MapleStory-style pixel-art continent (terrain, decorations, dotted routes, town/field/dungeon icons, fog clouds; hover tooltips show the region's preview from `assets/world-map/`, rebuilt with `scripts/capture-world-map-thumbnails.mjs` after map edits), and `rendering/createMapOverlay.ts` shows it when expanded, next to the top-left minimap (whole current map; -/+ resize it MapleStory-style, smallest step folds it to the title bar).
- `src/game/playerSkillSlots.ts`: Q/W/E/R skill bar slot state, slot assignment helpers, and keyboard slot lookup helpers used by the HUD and world input handler.
- `src/game/playerInventory.ts`: shared gold-and-slot inventory shape, including the player backpack and NPC trade inventories, plus slot mutation helpers.
- `src/game/playerQuickslots.ts`: quickslot bindings for inventory consumables, including assignment, clearing, and slot lookup helpers used by the HUD and inventory view.
- `src/game/playerControls.ts`: default player control bindings, key-code matching, display labels, and remap helpers used by the pause menu and world input handler.
- `src/game/playerLoadout.ts`: pure equip and unequip transitions between the backpack and the starter gear slots.
- `src/game/playerProgression.ts`: level-up rewards, stat-point spending, monster skill-point rewards, skill-user-level and mana-cap helpers, and level-based skill-point spending for the player profile.
- `src/game/playerStatEffects.ts`: derived player stat effects for physical attack, movement speed, and evade chance.
- `src/game/sceneIntro.ts`: scene-id to localized intro text mapping for the temporary map transition banner.
- `src/games/my-sample-rpg/bossTraining/`: headless trial-boss fight simulator, rule-based player bots (novice/normal/expert), and the fun score used for boss RL. Pure TS, no DOM or Pixi. Reuses `bossSkills.ts`. See `docs/boss-rl-design.md`. `bossEnv.ts` wraps the simulator as an RL environment (one step = one boss decision). `bossObservation.ts` (policy inputs and actions) and `bossPolicyNetwork.ts` (runs exported weights) are also used by the live game.
- `src/games/my-sample-rpg/bossSimViewer/`: standalone page (`boss-sim.html`) that shows trial-boss fights from the headless simulator, side by side for two boss policies, plus a batch evaluation table. Separate from the game and the editor. It only reads `bossTraining/`.
- `src/game/tiled/`: TMX/TSX parsing, tile metadata, and event-layer data extraction.
- `src/game/tiled/createNpcCharactersFromEventLayers.ts`: translate `character` object-layer events plus `controller.*`, `monster.level`, and optional `displayText` TMX properties into shared NPC character state.
- `src/game/tiled/createMapPortalsFromEventLayers.ts`: translate `portal` object-layer events into scene transition data for map exits and entrances.
- `src/editor/`: a standalone, LLM-powered game-content editor served as its own page (`editor.html` → `src/editorPage.ts`), separate from the game runtime. It opens any game folder, uses an LLM to understand it, generates content per a game adapter, and (for this game) reflects it live into the running game shown in an embedded preview. It depends on the game only through the `HolidayDialogueEventSpec` / `applyEventDraft` contract.
- `src/editor/createEditorApp.ts`: the editor IDE shell — a three-pane layout (project entity tree, generation panel, live game preview iframe) styled by `src/editor.css` (Tailwind only). Drives the full pipeline — open-folder, LLM analysis, generation, deterministic Validation, binary human Evaluation, apply, export — plus an in-session generation history, a session metrics readout, and reset-to-bundled-game.
- `src/editor/entityLinesValidator.ts`, `src/editor/eventEvaluator.ts`, `src/editor/sessionMetrics.ts`: the generation/validation/evaluation contract used by the live editor. `entityLinesValidator` is the deterministic Validator for the generic/legend `{entity, lines}` output (the rpg path uses `eventJsonSchema`); `eventEvaluator` records the human binary acceptable/not verdict and its `acceptance_rate`; `sessionMetrics` composes the per-session Validator pass rate and acceptance rate (with the 60% goal). All pure and unit-tested.
- `src/editor/gameAdapter.ts`: per-game adapters (my-sample-rpg, legend-of-lua, and a generic LLM-analyzed fallback). Each adapter detects its game, extracts entities from TMX objects, and exposes a generic `generate(request)` that returns `{label, preview, issues, apply}`. New game support = new adapter.
- `src/editor/questJsonGenerator.ts`, `src/editor/questJsonSchema.ts`, `src/editor/dryRunQuestApply.ts`: the my-sample-rpg quest generation contract. The final quest JSON now uses the selected NPC when available, falls back to the candidate target hint when no NPC is selected, `talk` objectives can surface their target NPC in the world, `scene-enter` is recorded for both normal map transitions and editor scene switches, `item-acquire` is validated against monster-drop items, and the editor apply flow keeps only the latest pending quest snapshot while the game preview scopes quest visibility to that snapshot and consumes it once on boot.
- `src/editor/analyzeGame.ts`: feeds deterministic TMX object evidence to the LLM so it can describe an arbitrary game (name, engine, editable entity groups, content model, apply strategy) — the generic-editor / GUS core. Grounded by real parsing to avoid hallucinated entities.
- `src/editor/tmxObjects.ts`, `src/editor/loadGame.ts`: a tolerant tileset-free TMX object reader, and the loader that detects the adapter for an opened folder and builds its entity tree.
- `src/editor/localLlmGenerate.ts`, `src/editor/llmProvider.ts`: the live editor uses the fixed OpenAI-compatible vLLM model `qwen36-27b-int4-best` through the `/api/llm` dev proxy. It uses JSON mode with thinking disabled and validates the returned object against the requested top-level fields.
- `src/editor/editorActionGenerator.ts`: routes natural-language editor requests to `create_npc`, `delete_npc`, `create_quest`, `switch_scene`, `generate_content`, or `other`; ids and scenes are grounded to the loaded project, and delete targets are restricted to editor-generated NPCs before `npcStore.removeNpc` is called by Apply.
- `src/editor/anthropicGenerate.ts`, `src/editor/openaiGenerate.ts`, and the older single-game generators: legacy direct provider paths retained for presentation/game flows; the live editor does not select Claude/GPT.
- `src/games/my-sample-rpg/scenario/`: scenario v2 node-graph runtime. `scenarioTypes.ts` is the shared contract (7 node kinds: say/choice/branch/set_flag/reward/goto/end), `scenarioRuntime.ts` is the pure TS-host interpreter (see `docs/scenario-interpreter-decision.md` for why it is not in Lua), `scenarioStore.ts` holds registered scenarios plus the in-memory flag store. The renderer intercepts talk interactions for registered NPCs before quest handling and drives the dialogue overlay (now with choice buttons).
- `src/editor/scenarioSchema.ts`, `src/editor/scenarioValidator.ts`, `src/editor/scenarioGenerator.ts`, `src/editor/scenarioRegistry.ts`, `src/editor/pendingScenarios.ts`: the scenario generation pipeline. Schema builders emit xgrammar-compatible JSON Schemas (anyOf + const discriminator, registry enums). The validator is a deterministic graph checker (reachability, end-reachability/livelock, speaker resolution, flag consistency) gating Apply. The generator runs two stages (outline frozen first, then per-scene calls with narrowed enums) and retries only failing scenes with validation feedback. `pendingScenarios` is the localStorage handoff the game consumes on boot and via storage events — it is intentionally never cleared by the game (flags are in-memory; the stored definitions are the only persistence).
- `src/editor/scenarioGoldExample.ts`: the hand-written shell-game scenario — few-shot example, runtime test fixture, and demo fallback in one.
- `src/editor/pendingEvents.ts`, `src/editor/safeStorage.ts`: the localStorage handoff — the editor saves generated events and the game applies them on scene boot and on a `storage` event (live, no reload); `safeStorage` wraps every read/write so a blocked or quota-exceeded store degrades gracefully instead of throwing.
- `src/editor/openProjectDirectory.ts`: opens a game folder via the File System Access API (Chrome/Edge) and returns the relevant files.
- `src/editor/eventJsonSchema.ts`, `src/editor/eventEvaluator.ts`, `src/editor/gusCalculator.ts`, `src/editor/createLlmPanel.ts`, etc.: deterministic event validator (used by the rpg adapter) plus older single-game-panel modules kept for the presentation; the live editor is `createEditorApp`.
- `src/rendering/`: PixiJS rendering code and asset-to-view adaptation.
- `src/rendering/`: map tile rendering, depth sorting, event character presentation, and fixed-screen HUD overlays.
- `src/rendering/loadMonsterSheetTextures.ts`: shared sheet slicing and background-keying helper for monster sprite sheets.
- `src/rendering/loadMonsterPigAnimationTextures.ts`, `src/rendering/loadMonsterSlimeAnimationTextures.ts`: sprite-sheet slicing for the beginner monster appearances.
- `src/rendering/getResponsiveUiScale.ts`: shared viewport-based UI scale used by all fixed-screen overlays so they scale together across viewport sizes, with the current default tuned to 1.2x.
- `src/rendering/createPixiTiledMapView.ts`: composition root of the live world scene. It owns the shared scene state (characters, player inventory/equipment/quest log, open-window flags, timers), boots the Pixi app and viewport, wires the `mapView/` modules together through `ctx` objects, and tears everything down in `destroy`.
- `src/rendering/mapView/`: parts of the live world scene. Each `createX(ctx)` module gets the shared state it needs through `ctx` (values, getters, setters) and returns the functions the scene uses.
  - Map: `tileLayers` (tile layers, flowing water, coin piles), `mapLightLayer` (light glows), `editorPlacement` (editor placement mode and placed NPCs).
  - Characters: `characterNodes` (boot-time render nodes and label layers), `characterSprites` (LPC sprites and per-frame sprite, badge, and bar sync), `playerGearVisuals` (weapon and protect shield sprites), `characterMessages`, `characterDamageTexts`.
  - Player: `playerActions` (roll, skills, smash/protect skill effects, footsteps; basic weapon attacks draw no effect), `playerWeaponSkills` (weapon-line skills: weapon check, cooldown, timed hits, effects; one file per weapon line in `weaponSkills/`), `playerMeleeMotions` (registry of per-weapon melee motions; one module per motion in `meleeMotions/`: axe `cleave`, drawn with the LPC `chop` pose from `scripts/generate-axe-chop-sheets.py`, sharing the `meleeMotion` contract for hit timing, hit area, and cooldown; reach per motion comes from the game-layer table `playerMeleeReach.ts`), `playerCombatEffects` (projectiles and magic; casts use the LPC `spellcast` pose), `lpcMagicEffects` (hand-drawn Extended LPC Magic Pack sheets for fireball, ice bolt, chain lightning, blizzard, meteor; no code-drawn magic shapes), `skillFx` (pixel effect sheets for weapon skills, impacts, energy ball, focus and dash: Ninja Adventure FX, LPC earth spikes and arrow; plays a sheet at a point, optionally flying to a target; no code-drawn skill shapes), `playerRewards` (experience, quest rewards, consumables), `environmentHazards` (poison fog, blizzard, status pills).
  - Monsters and combat: `monsterBehavior` (animation modes, pig behavior, knockback), `combat` (hit areas, damage, monster respawn, player death and respawn), `bossEncounter`, `trialBossPolicy` (trained skill choice for the trial boss), `monsterDrops`.
  - World flow: `movement` (camera: the canvas is viewport-sized and the camera moves the Pixi `world` container, not DOM scroll; collision, corner assist), `miniMapSnapshot` (minimap terrain drawn once from tile data into a 2D canvas; never read back from the WebGL canvas), `sceneTransitions` (portals and waystones), `npcInteractions` (scenario, waystone, quest dialogue, shop opening), `editorEventApply` (editor event drafts and Lua scripts).
  - UI and input: `uiOverlays` (creates HUD, windows, shops, trackers; every overlay `syncFrame` runs each frame, so it must rebuild its content only when its inputs change — a content key or object identity — because rebuilding calls Lua through JSON and made dragging windows stutter), `uiState` (window open/close, audio, quest log updates), `overlayControls` (close-all, map expand, key binding capture), `inputHandlers` (keyboard, wheel, resize, visibility), `frameUpdate` (per-frame update loop).
- `src/rendering/createPlayerHudOverlay.ts`: compact fixed-screen character status bar anchored near the bottom center with bag icon, Q/W/E/R skill slots, and the experience bar. The bag icon opens the backpack panel, and the skill slots accept dragged skills from the skill window.
- `src/rendering/createPlayerInventoryOverlay.ts`: fixed-screen backpack window that uses compact Maple-style category tabs, shows the backpack grid and current gold, shows item details only in a hover tooltip, supports click-to-equip plus drag-to-equip for gear and quickslot dragging for consumables, and stays non-modal.
- `src/rendering/createPlayerEquipmentOverlay.ts`: fixed-screen equipment window opened with `U` that shows the current loadout, portrait preview, and accepts dragged gear from the backpack anywhere in the window in addition to click-to-unequip behavior, and it stays non-modal.
- `src/rendering/createPlayerStatOverlay.ts`: compact fixed-screen player stat side panel opened with `S` that spends stat points on strength, agility, intelligence, and luck, and stays non-modal so other player windows and gameplay can continue.
- `src/rendering/createPlayerSkillOverlay.ts`: fixed-screen player skill window opened with `K` that groups skills into tabs (common, sword, axe, bow, staff; opens on the equipped weapon's tab, no scrolling) and spends available skill points on individual skill levels while staying non-modal, shows the user level derived from total skill points earned, and exposes only unlocked skills as drag sources for the Q/W/E/R slots.
- `src/rendering/createBlacksmithShopOverlay.ts`: fixed-screen blacksmith service overlay that starts with a service menu and then shows the blacksmith trade view with portrait headers, category tabs, and side-by-side purchase/sale lists without blocking the rest of the game UI.
- `src/rendering/createPauseMenuOverlay.ts`: fixed-screen pause/audio menu overlay with resume, BGM volume, SFX volume, and a separate key-binding editor screen.
- `src/rendering/createQuestLogOverlay.ts`: fixed-screen quest window opened with `B`, showing accepted quest lists, quest details, objective progress, tracker toggles, and abandon confirmation.
- `src/rendering/createQuestTrackerOverlay.ts`: fixed-screen quest tracker panel that displays quests whose per-quest tracker visibility is enabled, with a close button that hides tracker entries without changing quest progress.
- `scripts/`: project automation scripts such as third-party fetch/build steps.
- `rl/`: offline boss RL training in Python (`boss_env.py`, `train.py`, `evaluate.py`). `npm run rl:build` writes the bundled Node env server and arena data to `rl/dist/` (git-ignored). Training runs go to `rl/runs/` (git-ignored).
- `third_party/`: vendored external source code kept in-repo for deterministic builds.
- `public/vendor/`: generated static artifacts served as-is by Vite.

## Lua Controller Interface

- `src/games/my-sample-rpg/assets/lua/`: each Lua controller script should return one controller table.
- Reserved controller methods:
  - `register`: optional setup when the runtime attaches the script to one character
  - `unregister`: optional cleanup when the runtime detaches the script from one character
  - `step`: required movement-intent update
  - `interact`: optional response when another character interacts with this character
- `src/main.ts`: map only `scriptId -> source`. Do not repeat Lua method names in the app entry point.
- TMX owns which NPC uses which controller.
  Use `controller.kind`, `controller.scriptId`, `controller.radiusInTiles`, and `controller.moveSpeedTilesPerSecond` on `character` events.
  Treat other `controller.*` properties as controller config values.
- `src/game/lua/createLuaCharacterControllerRuntime.ts`: own Lua module loading, method dispatch, script reload, and wasm bridge details.
- `src/game/lua/luaControllerApi.ts`: own the public Lua-visible contract and reserved method names.
- `docs/lua-controller-api.md`: explain the same contract in human-readable form for AI and script authors.
- Validate Lua controller scripts before first load and hot reload. Use compile checking plus isolated contract validation so a broken script does not replace the active runtime.
- Keep the public Lua surface narrow. Expose new data or actions through `engine.*` only after updating both the TypeScript contract and the Lua API document.
- Let Lua return movement intent and request explicit `engine.*` actions only. Keep collision, target resolution, cooldown, event ordering, and final rendering effects outside Lua.
- Use `engine.self.get_controller_config()` when Lua needs TMX-authored per-character settings such as dialogue lists or small behavior flags.

## Boundary Rules

- Build each new feature as its own module. See `docs/feature-modules.md`.

- Keep browser DOM code out of `src/game/` when possible.
- Prefer pure data and pure functions in game logic so tests stay small and stable.
- Keep controller definitions as plain data on the character state. Put attach, detach, and runtime-side script management in the controller runtime layer.
- When a rendering library is introduced later, keep rendering concerns separate from core game rules.
