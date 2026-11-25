# Abyssal Garden integration

Original work: **Abyssal Garden**, copyright © 2026 Maksymilian Dendura, MIT.
The full original license is preserved in [LICENSE](LICENSE).

- `math.js` retains the original noise, random, quaternion and mesh-building helpers, with ES module exports added.
- `meshes.js` retains the original rock, sponge, coral, stone whale fluke, shipwreck, manta and fish generators from `source/src/world.js`. The whale fluke uses a coarser voxel grid to reduce startup work alongside the meadow.
- `../underwater.js` adapts those meshes and the original kelp column/leaf distribution to the meadow's Three.js renderer and existing lake floor. Lighting, instancing, lake boundaries and swimming are integrated locally; the separate WebGPU renderer and original page navigation are not used.
- `audio.js` adapts the original synthesized soundscape to the meadow's AudioContext, master volume, camera position and immersion fade, without adding another audio timer or context.

In the meadow, press **2** to reach the lakeshore, then **E** or the dive button. Swim with **WASD**, rise with **Space**, descend with **C / Q**, and press **E** to surface and return directly to the dry bank used for entry. Surfacing with Space also returns to shore. If entry starts while already swimming, a nearby dry return point is selected first. Frozen lakes cannot be entered. Returning to shore or teleporting restores the previous camera mode; quick travel keeps its own destination.

For changes to these modules, regenerate the original double-click fallback with `python3 tools/build_underwater_offline.py`. Normal HTTP startup loads the readable modules directly.

The source project in `临时/abyssal-garden` is kept unchanged.
