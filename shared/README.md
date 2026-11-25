# Shared runtime dependencies

The meadow and local previews load their common Three.js engine, add-ons and lil-gui from this directory.

- `vendor/three/`: Three.js r169 and its add-ons. Original MIT license is retained in `vendor/three/LICENSE`.
- `vendor/lil-gui.esm.min.js`: lil-gui, with its original license header retained.
- `offline-modules.js`: existing bundled engine for double-clicking local HTML files, with the lake module import map extension.

This directory contains engine dependencies only. Scene code stays with each scene.
