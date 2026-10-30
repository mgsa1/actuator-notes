# Actuator notes · Taking apart the GO-M8010-6

Static site, no build step: https://actuators.gdsa.eu (GitHub Pages from `main`; a push deploys).

- `index.html` — home page: introduction, "Where it lives" (Go2 robot viewer), "The module, exploded", chapter list
- `go-m8010-6/01-motor/` — chapter 1, the brushless motor (part one of three); `breakdown.js` draws the section and
  face views from numbers
- `rotating-field/` — standalone interactive model of the rotating field (`field.js`, also embedded in chapter 1)
- `explode/` — exploded-view viewer (three.js, isometric, callouts); `robot/` — Go2 robot viewer with stride animation
- `models/go-m8010-6.glb` — the module: Unitree's customer STEP for the outer parts, reconstructed motor, placeholders
  for gearbox and encoder (built from `../cad/go-m8010-6/build_model.py`, outside this repo)
- `models/go2.glb`, `models/go2.json` — the Go2 from Unitree's `unitree_ros` robot description (BSD-3), meshes
  simplified; kinematic tree with joint limits
- `vendor/` — three.js r170 (MIT); `style.css`, `blog.css`, `app.js` — shared tokens and helpers; `fonts/`, `img/`

Pages that use the 3D viewers load `three` through an import map and need WebGL; they show a one-line notice without it.
Asset links carry `?v=N`; bump when a viewer changes.

Preview locally:

```bash
python3 -m http.server 8766 --bind 127.0.0.1
# open http://127.0.0.1:8766/
```
