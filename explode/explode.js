/* Exploded-view viewer for the GO-M8010-6 model (three.js, vendored, MIT).
   Usage: <div class="explode" data-model="../models/go-m8010-6.glb" data-set="module|motor"></div>
   Parts are named in the glTF as "real_…" (from Unitree's STEP), "motor_…" (reconstructed) or "placeholder_…";
   underscores because three.js strips spaces and colons from node names. The exporter writes one primitive per
   CAD face, so the loader merges each named group into a single mesh.
   View: isometric (orthographic camera on the (1, 1, 1) diagonal, the module's axis vertical). The slider moves each
   part along the axis by its offset in the EXPLODE table (mm at full explosion) and fades in drawing-style callouts:
   a dot on the part, a leader line, a label in the margin. */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

const EXPLODE = {
  module: [
    [/^real_cover_screw/, -64], [/^real_washer/, -58], [/^real_cover$/, -44], [/^real_XT30/, -44], [/^real_GH/, -44], [/^real_small_part/, -44],
    [/^real_driver_board/, -32], [/^placeholder_encoder_magnet/, -22],
    [/^motor_/, -8],
    [/^placeholder_planetary/, 22], [/^real_housing/, 36], [/^real_front_face/, 36], [/^real_output_flange/, 52],
    [/^real_centre_nut/, 58], [/^real_flange_screw/, 64], [/^real_circlip/, 70],
  ],
  motor: [[/^motor_rotor/, -34], [/^motor_magnets/, -8], [/^motor_stator/, 10], [/^motor_coils/, 28]],
};
const offsetFor = (set, name) => { for (const [re, o] of EXPLODE[set]) if (re.test(name)) return o; return 0; };
const origin = name => name.startsWith('real_') ? 'Unitree CAD' : name.startsWith('motor_') ? 'reconstructed' : 'placeholder';
const pretty = name => name.replace(/^(real|motor|placeholder)_/, '').replace(/_\d+$/, '').replace(/_/g, ' ');
// callouts: one label per group; a group may span several meshes (the motor in the module view)
const LABELS = {
  module: [['housing', /^real_housing$/], ['planetary gearbox', /^placeholder_planetary/], ['motor', /^motor_/], ['encoder', /^placeholder_encoder/], ['driver board', /^real_driver_board/], ['back cover', /^real_cover$/]],
  motor: [['stator, fixed', /^motor_stator/], ['coils', /^motor_coils/], ['magnets', /^motor_magnets/], ['rotor, turns', /^motor_rotor/]],
};

export function mountExplode(root) {
  const set = root.dataset.set || 'module';
  const url = root.dataset.model;
  root.innerHTML = `
    <div class="xp-toolbar">
      <label class="xp-slider">Exploded <input type="range" min="0" max="1" step="0.01" value="0"></label>
      ${set === 'module' ? '<span class="xp-filter"><button class="btn on" data-show="all">all parts</button><button class="btn" data-show="cad">Unitree CAD only</button></span>' : ''}
      <span class="xp-hover">drag to orbit · scroll to zoom · hover a part</span>
    </div>
    <div class="xp-canvas"><svg class="xp-leaders"></svg><div class="xp-labels"></div></div>`;
  const canvasHost = root.querySelector('.xp-canvas'), slider = root.querySelector('input'), hover = root.querySelector('.xp-hover');
  const leaders = root.querySelector('.xp-leaders'), labelsHost = root.querySelector('.xp-labels');

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { hover.textContent = 'This view needs WebGL, which your browser has turned off.'; canvasHost.remove(); slider.disabled = true; return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  canvasHost.insertBefore(renderer.domElement, leaders);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  let controls = null;      // created after the model loads, once the camera's up vector is known (OrbitControls caches it)
  let halfH = 60;           // orthographic half-height in mm, set from the model
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(80, 120, 160); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-120, -60, -80); scene.add(fill);

  const parts = [];   // { mesh, name, p0 (rest position along the axis), offset, label? }
  let axis = 'z';     // which world axis the module's axis ended up on, decided after loading
  const group = new THREE.Group(); scene.add(group);
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(-2, -2);
  let W = 1, H = 1;

  new GLTFLoader().load(url, gltf => {
    let rootNode = null; gltf.scene.traverse(o => { if (!rootNode && o.name === 'GO-M8010-6') rootNode = o; });
    const named = (rootNode ? rootNode.children : []).filter(o => /^(real|motor|placeholder)_/.test(o.name));
    for (const node of named) {
      const n = node.name;
      const keep = set === 'motor' ? n.startsWith('motor_') : true;
      if (!keep) { node.visible = false; continue; }
      const meshes = []; node.traverse(o => { if (o.isMesh) meshes.push(o); });
      if (!meshes.length) continue;
      node.updateWorldMatrix(true, true);
      const geos = meshes.map(m => { let g = m.geometry.clone(); if (g.index) g = g.toNonIndexed(); g.applyMatrix4(m.matrixWorld); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; });
      const merged = mergeGeometries(geos, false);
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      const color = meshes[0].material.color;
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.55, transparent: n.startsWith('placeholder_'), opacity: n.startsWith('placeholder_') ? 0.35 : 1 });
      const mesh = new THREE.Mesh(merged, mat);
      mesh.userData.name = n;
      group.add(mesh);
      parts.push({ mesh, name: n, offset: offsetFor(set, n) * 1.4 });
      node.visible = false;
    }
    gltf.scene.visible = false;
    const box = new THREE.Box3();
    parts.forEach(p => box.expandByObject(p.mesh));
    const c = box.getCenter(new THREE.Vector3());
    group.position.sub(c);
    const ext = box.getSize(new THREE.Vector3());
    axis = ext.x < ext.y && ext.x < ext.z ? 'x' : ext.y < ext.z ? 'y' : 'z';
    parts.forEach(p => { p.p0 = p.mesh.position[axis]; });
    const size = ext.length();
    halfH = size * (set === 'motor' ? 0.62 : 0.92);
    const up = new THREE.Vector3(); up[axis] = 1; camera.up.copy(up);
    const [a, b] = ['x', 'y', 'z'].filter(k => k !== axis);
    const pos = new THREE.Vector3(); pos[a] = 1; pos[b] = -1; pos[axis] = 1;   // isometric: equal angles to all three axes
    camera.position.copy(pos.normalize().multiplyScalar(size * 4));
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
    controls.target.set(0, 0, 0);
    resize();
    buildLabels();
    applyExplode();
  }, undefined, err => { hover.textContent = 'model failed to load: ' + (err && err.message ? err.message : err); });

  function applyExplode() {
    const t = parseFloat(slider.value);
    parts.forEach(p => { p.mesh.position[axis] = p.p0 + t * p.offset; });
  }
  slider.addEventListener('input', applyExplode);
  // module view: compare the whole model with the parts that come from Unitree's STEP alone
  root.querySelectorAll('.xp-filter .btn').forEach(btn => btn.addEventListener('click', () => {
    const cadOnly = btn.dataset.show === 'cad';
    parts.forEach(p => { p.mesh.visible = cadOnly ? p.name.startsWith('real_') : true; });
    root.querySelectorAll('.xp-filter .btn').forEach(b => b.classList.toggle('on', b === btn));
  }));

  // ---- callouts: one label per labelled part, alternating sides by order along the axis.
  // Each leader ends on a real surface vertex of the part (a subsample of its mesh), the one nearest the label,
  // so the dot always sits on the part and the line is as short as it can be.
  const labels = [];
  function buildLabels() {
    const groups = LABELS[set].map(([text, re]) => ({ text, meshes: parts.filter(p => re.test(p.name)) })).filter(g => g.meshes.length);
    // order along the axis decides the side: alternate, so the two columns stay balanced
    groups.sort((g, h) => Math.min(...g.meshes.map(p => p.p0 + p.offset)) - Math.min(...h.meshes.map(p => p.p0 + p.offset)));
    groups.forEach((g, i) => {
      const el = document.createElement('div'); el.className = 'xp-label';
      el.innerHTML = `<b>${g.text}</b>`;
      labelsHost.appendChild(el);
      // sample surface vertices of every mesh in the group
      const chunks = g.meshes.map(p => { const pos = p.mesh.geometry.attributes.position, stride = Math.max(1, Math.floor(pos.count / 500)); const n = Math.floor(pos.count / stride); const a = new Float32Array(n * 3); for (let k = 0; k < n; k++) { a[3 * k] = pos.getX(k * stride); a[3 * k + 1] = pos.getY(k * stride); a[3 * k + 2] = pos.getZ(k * stride); } return { mesh: p.mesh, samples: a, n }; });
      const total = chunks.reduce((t, c) => t + c.n, 0);
      labels.push({ meshes: g.meshes, chunks, el, side: i % 2 ? 'left' : 'right', sx: new Float32Array(total), sy: new Float32Array(total) });
    });
  }
  const _v = new THREE.Vector3();
  function projectSamples(l) {   // screen coordinates of the group's sample vertices; returns the screen extent
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, i = 0;
    for (const c of l.chunks) {
      c.mesh.updateMatrixWorld();
      for (let k = 0; k < c.n; k++, i++) {
        _v.set(c.samples[3 * k], c.samples[3 * k + 1], c.samples[3 * k + 2]).applyMatrix4(c.mesh.matrixWorld).project(camera);
        const x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * H;
        l.sx[i] = x; l.sy[i] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return { x0, x1, y0, y1, cy: (y0 + y1) / 2 };
  }
  function nearestSample(l, px, py) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < l.sx.length; k++) { const dx = l.sx[k] - px, dy = l.sy[k] - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } }
    return [l.sx[best], l.sy[best]];
  }
  function layoutLabels() {
    const t = parseFloat(slider.value);
    const alpha = Math.max(0, Math.min(1, (t - 0.08) / 0.3));   // fade in as the view opens
    if (alpha <= 0) { labelsHost.style.opacity = 0; leaders.innerHTML = ''; return; }
    labelsHost.style.opacity = alpha; leaders.style.opacity = alpha;
    let mx0 = Infinity, mx1 = -Infinity;
    const ext = new Map();
    for (const l of labels) { if (!l.meshes.some(p => p.mesh.visible)) continue; const e = projectSamples(l); ext.set(l, e); mx0 = Math.min(mx0, e.x0); mx1 = Math.max(mx1, e.x1); }
    const PAD = 26, rowsAll = [];
    for (const side of ['left', 'right']) {
      const rows = labels.filter(l => ext.has(l) && l.side === side).map(l => ({ l, want: ext.get(l).cy })).sort((p, q) => p.want - q.want);
      let last = -Infinity;
      for (const r of rows) { const gap = r.l.el.offsetHeight + 6; r.y = Math.max(r.want, last + gap); last = r.y; }
      const over = rows.length ? rows[rows.length - 1].y - (H - 14) : 0;
      if (over > 0) rows.forEach(r => { r.y -= over; });
      for (const r of rows) {
        const el = r.l.el, w = el.offsetWidth; el.style.display = ''; el.style.top = r.y + 'px'; el.style.right = '';
        if (side === 'right') { const left = Math.min(W - w - 8, mx1 + PAD); el.style.left = left + 'px'; r.lx = left - 4; }
        else { const left = Math.max(8, mx0 - PAD - w); el.style.left = left + 'px'; r.lx = left + w + 4; }
        [r.ax, r.ay] = nearestSample(r.l, r.lx, r.y);
        rowsAll.push(r);
      }
    }
    labels.filter(l => !ext.has(l)).forEach(l => { l.el.style.display = 'none'; });
    leaders.setAttribute('viewBox', `0 0 ${W} ${H}`);
    leaders.innerHTML = rowsAll.map(r => `<line x1="${r.lx}" y1="${r.y}" x2="${r.ax}" y2="${r.ay}" stroke="var(--ink-2)" stroke-width="1"/><circle cx="${r.ax}" cy="${r.ay}" r="2.6" fill="var(--ink)"/>`).join('');
  }

  renderer.domElement.addEventListener('pointermove', e => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  renderer.domElement.addEventListener('pointerleave', () => pointer.set(-2, -2));

  function resize() {
    W = canvasHost.clientWidth; H = Math.max(340, Math.min(600, Math.round(W * 0.66)));
    renderer.setSize(W, H, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = H + 'px';
    const aspect = W / H;
    camera.left = -halfH * aspect; camera.right = halfH * aspect; camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvasHost); resize();

  let last = null;
  function frame() {
    if (controls) controls.update();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(parts.filter(p => p.mesh.visible).map(p => p.mesh), false);
    const hit = hits.length ? hits[0].object : null;
    if (hit !== last) {
      if (last) last.material.emissive.setHex(0x000000);
      if (hit) { hit.material.emissive.setHex(0x334455); hover.innerHTML = `<b>${pretty(hit.userData.name)}</b>`; }
      else hover.textContent = 'drag to orbit · scroll to zoom · hover a part';
      last = hit;
    }
    renderer.render(scene, camera);
    if (labels.length) layoutLabels();
    requestAnimationFrame(frame);
  }
  frame();
  root.__explode = { parts, slider, camera, labels };   // for scripted QA
}

document.querySelectorAll('.explode').forEach(mountExplode);
