# Document text and image ingestion

Requirements undergo an intent audit before object planning. Geometry, layout, gameplay, UI, unsupported and ambiguous requirements are retained as deferred work rather than executable ornaments. Each decoration command is independently routed and audited. Mixed ground/attached requests keep separate batches through generation; only ground batches consume safe ground anchors, while attached batches use source-preserving registration. Existing validation thresholds remain unchanged.

Route repair is limited to one attempt with the rejected candidate and failure reason. Repair feedback is not injected into the independent audit. An attached route correctly has no standalone sprite items: its original command is rendered on the host. Ground routes must retain the requested identity and pass physical-support checks. Failure still blocks generation; representative model success is not proof of full-map visual quality.

DOCX body paragraphs and tables retain stable paragraph IDs. Embedded DrawingML and VML image relationships are resolved in document order, including image-only paragraphs. Each occurrence has an image ID and nearby paragraph IDs. Broken, unsupported and externally linked images fail explicitly; external content is never fetched automatically.

Before requirement normalization, every image occurrence is sent to the existing vision model with nearby text. The model records visible details, readable image text, scope and uncertainty. Only context-supported map references become visual-evidence blocks. UI, character, mixed and unknown references remain in the analysis report for manual review, not automatic decoration requests. Text negations override visual motifs. Reference counts are observations, not mandatory generation counts.

Image-based requirements must cite both an image and supporting paragraph context. User-reviewed text requirements remain intact; additional visual requirements are normalized and validated separately. Both input modes then use the existing object Planner, DSL and generation pipeline. Image analysis failures stop planning rather than silently downgrading to text-only.

Raw image bytes are used in memory and removed before the analyzed document is persisted. Analysis files still contain private document-derived information and must not be uploaded blindly. Existing saved text-only experiments are not rewritten; re-upload the DOCX for multimodal planning.

Limits: 64 image occurrences, 24,000 text characters, 20 megapixels per image, and the existing archive size limits. Header/footer art, non-image drawing shapes and linked pages are not interpreted. The vision model can misread images and requires review; successful extraction is not successful semantic analysis.
