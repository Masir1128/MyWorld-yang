# Abyssal Garden integration

Original work: **[Abyssal Garden](https://github.com/Noniv/abyssal-garden)**, copyright © 2026 **Maksymilian Dendura** ([Noniv](https://github.com/Noniv)), **MIT**.
The full original license is preserved in [LICENSE](LICENSE).

The underwater garden reuses and adapts the original project's code. Credit for its original procedural models, kelp distribution, math helpers and synthesized soundscape belongs to the upstream author. This project's contribution is integration into the meadow's Three.js / WebGL renderer, lake layout and interactions; it does not claim the upstream underwater work as its own original creation.

湖底花园复用并改编了原项目的程序化模型、海藻分布、数学工具和合成音景代码，原作贡献归原作者。本项目负责将这些内容接入草原已有的 Three.js / WebGL 场景、湖泊布局及下潜和返回岸边等交互。

## Source mapping and adaptations

- Upstream source snapshot inspected for attribution: [`a596354eff400d458bc2aeb9bdf5e0a9734b2bcf`](https://github.com/Noniv/abyssal-garden/tree/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf).
- Upstream source files: [`source/src/math.js`](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/source/src/math.js), [`source/src/world.js`](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/source/src/world.js), and [`source/src/audio.js`](https://github.com/Noniv/abyssal-garden/blob/a596354eff400d458bc2aeb9bdf5e0a9734b2bcf/source/src/audio.js).

- `math.js` retains the original noise, random, quaternion and mesh-building helpers, with ES module exports added.
- `meshes.js` retains the original rock, sponge, coral, stone whale fluke, shipwreck, manta and fish generators from `source/src/world.js`. The whale fluke uses a coarser voxel grid to reduce startup work alongside the meadow.
- `../underwater.js` adapts those meshes and the original kelp column/leaf distribution to the meadow's Three.js renderer and existing lake floor. Lighting, instancing, lake boundaries and swimming are integrated locally; the separate WebGPU renderer and original page navigation are not used.
- `audio.js` adapts the original synthesized soundscape to the meadow's AudioContext, master volume, camera position and immersion fade, without adding another audio timer or context.

In the meadow, press **2** to reach the lakeshore, then **E** or the dive button. Swim with **WASD**, rise with **Space**, descend with **C / Q**, and press **E** to surface and return directly to the dry bank used for entry. Surfacing with Space also returns to shore. If entry starts while already swimming, a nearby dry return point is selected first. Frozen lakes cannot be entered. Returning to shore or teleporting restores the previous camera mode; quick travel keeps its own destination.

For changes to these modules, regenerate the original double-click fallback with `python3 tools/build_underwater_offline.py`. Normal HTTP startup loads the readable modules directly.

The upstream reference checkout is outside this repository; use the source links above to inspect the original work. Its original WebGPU renderer and page navigation are not included in this integration. Upstream and adapted MIT-covered code retain their original license; this repository's reserved-rights notice for its own content does not override it.
