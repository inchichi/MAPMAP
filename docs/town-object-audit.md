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

The catalog now has 29 objects, all with matching extraction profiles and nonempty
source crops. Tile layers, remaining object bounds, NPCs, portals and tileset
collision metadata are unchanged. Existing experiment files are retained; their
old TMX source hash intentionally fails the approval gate after this source edit.
Generate a new plan before applying a new result.

This fixes confirmed duplicate metadata, not every possible semantic label issue.
Use `python scripts/audit-town-objects.py` to inspect the contact sheet and bounds.
