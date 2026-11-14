# Visual preview (design check only)

`common.js` re-implements the SAME geometry formulas as the Unity code
(`MeshKit.PuffyStar`, `StarFace`, `SaltatoryTunnelView`) and a port of the `NerveRunner/ToonRim`
shading in three.js, so proportions, faces and the tunnel layout can be checked without Unity.

- `star_compare.html` - STAR-01 1.0 (top row) vs 2.0 expressions
- `tunnel.html` - saltatory tunnel 1.0 (left) vs 2.0 (right), chase-camera view

These are **not Unity renders**: lighting, bloom, fog, particles and exact colours will differ.
Open the HTML files in a browser (three.js r160 loads from jsDelivr).
