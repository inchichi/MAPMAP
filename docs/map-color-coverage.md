# Full-map color coverage

Full-map plans (`full_map_color`) grade the source atlas, not just eligible decoration objects. Every visible TMX GID is included. Targeted object pilots keep their existing scope.

Global grading retains material RGB differences through palette blending. Audited category colors override it using proven tile membership, including incomplete stamps. The first audited representative supplies a shared category palette; its asset and evidence are recorded. No category-specific color is invented for unclassified terrain. This is not semantic segmentation of every material.

Generated atlas dimensions, tile layout and alpha stay unchanged. The renderer loads it as map tile textures, retaining depth, collision and reuse, instead of covering the world with a screenshot. Atlas selection changes reload the game view. Night shade is applied once. Atlas-backed results do not install an additional recolor-map overlay.

`color-coverage.json` reports processed tiles, not visual-quality approval. Color replay preserves the original run, reuses decorations without FLUX calls and produces a review-required result. It never automatically applies the result.
