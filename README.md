# Actuator notes

Static site, no build step: https://actuators.gdsa.eu

- `index.html` — post list
- `rotating-field/` — "How three currents turn a rotor" (interactive model in `field.js`)
- `style.css`, `app.js` — shared tokens and helpers; `blog.css` — blog layout

Preview locally:

```bash
python3 -m http.server 8766 --bind 127.0.0.1
# open http://127.0.0.1:8766/
```

Published with GitHub Pages from the `main` branch; a push to `main` deploys.
