# Town object metadata audit

2026-09-29: Removed eight duplicate TMX object annotations, not rendered tiles.

| Incorrect standalone entry | Actual owner |
| --- | --- |
| lamp_1, prop_1 | tree_1 |
| lamp_4 | tree_2 |
| lamp_14, prop_9 | tree_3 |
| lamp_2, prop_6, prop_7 | clock_tower |

The lamp entries contain canopy or clock-roof fragments. The four prop entries
produce empty prop-family crops. All fragments already belong to complete parent
objects. Legacy PARTS aliases remain for older experiment records.

That first repair left 29 objects, all with matching extraction profiles and nonempty
source crops. Tile layers, remaining object bounds, NPCs, portals and tileset
collision metadata are unchanged. Existing experiment files are retained; their
old TMX source hash intentionally fails the approval gate after this source edit.
Generate a new plan before applying a new result.

This fixes confirmed duplicate metadata, not every possible semantic label issue.
Use `python scripts/audit-town-objects.py` to inspect the contact sheet and bounds.

Building sidebar hover previews now render original visible layers in order, keeping
walls below windows instead of taking a single topmost tile per cell. Preview-only
family filtering removes surrounding fountains, planters, trees and the visually
confirmed barrel mislabeled `market_prop_411`. The game and generation assets are
not rewritten by this preview fix. Check with `python scripts/check-building-hover.py`.

Follow-up: split prop_2/3/4 (three pots per rectangle) into nine single-pot
annotations, for 35 total instances. Tile GIDs and rendered map pixels are unchanged:
these pots already share the same atlas tile. The automatic sidebar cluster pass
now suppresses known canopy/clock fragment aliases inside their complete parent.
Layered previews cover all six object categories and include the mislabelled clock
and canopy tiles. Source extraction uses the same clock fix and excludes the barrel
mislabelled market_prop_411 from buildings.

The town vision planner groups exact RGBA sources into 13 representatives. It calls
recognition/prompt generation/FLUX once per representative, then places the same
result at each recorded instance. Different pixels or dimensions are not guessed
to be equivalent. Existing experiments are not rewritten or automatically applied.

Streetlamps 5–13 also reuse clocktower_face_mid_02 and clocktower_face_lower_02;
the layered sidebar renderer now includes both, matching backend extraction.
The misleading flower_4 label is now a generic edge decoration (prop); its tile
classifier is updated too, so automatic discovery does not recreate a flower entry.
Lower-map wall and banner clusters are real architecture, not missing-object errors;
their labels now identify them as wall/brick decoration and wall banners.
