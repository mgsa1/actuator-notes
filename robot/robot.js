/* Where the actuator lives: the Unitree Go2 drawn from Unitree's own robot description (unitree_ros, BSD-3),
   with its twelve joint modules marked and one leg's three motors labelled. A stride animation drives the joints
   within the limits given in the URDF. Separate from the exploded-view viewer on purpose.
   Usage: <div class="robot" data-model="models/go2.glb" data-tree="models/go2.json"></div> */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

const MOTOR = { d: 0.0965, h: 0.0423 };   // GO-M8010-6 envelope, metres
const LEG = 'FL';                           // the leg whose motors are labelled
const LABELS = [['hip motor: swings the leg out', 'FL_hip_rotor'], ['thigh motor: swings the leg forward', 'FL_thigh_rotor'], ['calf motor: bends the knee', 'FL_calf_rotor']];

function rpyToQuat(r, p, y) {   // URDF fixed-axis roll, pitch, yaw
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(r, p, y, 'ZYX');   // apply yaw, then pitch, then roll about fixed axes = intrinsic ZYX
  return q.setFromEuler(e);
}

export function mountRobot(root) {
  root.innerHTML = `
    <div class="rb-toolbar">
      <button class="btn on rb-play">pause</button>
      <label class="rb-speed">stride <input type="range" min="0" max="1" step="0.001" value="0"></label>
      <span class="rb-hover">drag to orbit · scroll to zoom</span>
    </div>
    <div class="rb-canvas"><svg class="rb-leaders"></svg><div class="rb-labels"></div></div>`;
  const canvasHost = root.querySelector('.rb-canvas'), playBtn = root.querySelector('.rb-play'), phaseIn = root.querySelector('input'), hover = root.querySelector('.rb-hover');
  const leaders = root.querySelector('.rb-leaders'), labelsHost = root.querySelector('.rb-labels');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { hover.textContent = 'This view needs WebGL, which your browser has turned off.'; canvasHost.remove(); return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  canvasHost.insertBefore(renderer.domElement, leaders);
  const scene = new THREE.Scene();
  // URDF frame: x forward, y left, z up. Keep z up on screen.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  camera.up.set(0, 0, 1);
  let controls = null, halfH = 0.45, W = 1, H = 1;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(1.5, 2.5, 3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.0); fill.position.set(-2, -2, -1); scene.add(fill);
  // ground shadow disc for orientation
  const ground = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.06 }));
  ground.position.set(0.02, 0, -0.34); scene.add(ground);

  const nodes = {}, revolute = [], motors = [];
  Promise.all([fetch(root.dataset.tree).then(r => r.json()), new Promise((res, rej) => new GLTFLoader().load(root.dataset.model, res, undefined, rej))]).then(([tree, gltf]) => {
    const meshes = {};
    gltf.scene.traverse(o => { if (o.isMesh) meshes[o.parent && o.parent.name ? o.parent.name : o.name] = o; });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc4c6ca, metalness: 0.1, roughness: 0.6 });
    // the modules are drawn a little larger than their real envelope so they stand proud of the housing mesh around them
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x8e949c, metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    const hiMat = new THREE.MeshStandardMaterial({ color: 0xe06a2c, metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    // links
    for (const L of tree.links) {
      const g = new THREE.Group(); g.name = L.name; nodes[L.name] = g;
      if (L.mesh && meshes[L.mesh]) {
        const m = meshes[L.mesh].clone(); m.material = bodyMat;
        if (!m.geometry.attributes.normal) { m.geometry = m.geometry.clone(); m.geometry.computeVertexNormals(); }
        m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(...L.scale);
        const v = new THREE.Group(); v.position.set(...L.vxyz); v.quaternion.copy(rpyToQuat(...L.vrpy)); v.add(m); g.add(v);
      }
    }
    // joints: child group sits in parent at origin, revolute ones rotate about their axis
    for (const J of tree.joints) {
      const p = nodes[J.parent], c = nodes[J.child]; if (!p || !c) continue;
      const pivot = new THREE.Group(); pivot.position.set(...J.xyz); pivot.quaternion.copy(rpyToQuat(...J.rpy));
      pivot.add(c); p.add(pivot);
      if (J.type === 'revolute') revolute.push({ J, node: c, axis: new THREE.Vector3(...J.axis).normalize() });
      if (/_rotor$/.test(J.child)) {   // a motor sits here: draw the GO-M8010-6 envelope, axis along the joint it drives
        const leg = J.child.slice(0, 2), part = J.child.split('_')[1];
        const driven = tree.joints.find(k => k.name === `${leg}_${part}_joint`);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(MOTOR.d / 2 + 0.007, MOTOR.d / 2 + 0.007, MOTOR.h + 0.012, 48), leg === LEG ? hiMat : motorMat);
        const ax = new THREE.Vector3(...driven.axis).normalize();
        cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
        // the rotor frame of the hip motor sits inside the body; shift the drawn module outward along its axis so it shows
        if (part === 'hip') cyl.position.add(ax.clone().multiplyScalar(0.0));
        c.add(cyl); motors.push({ name: J.child, mesh: cyl, leg });
      }
    }
    scene.add(nodes['base']);
    for (const [text, node] of LABELS) {
      const el = document.createElement('div'); el.className = 'rb-label'; el.innerHTML = `<b>${text}</b>`; labelsHost.appendChild(el);
      labels.push({ el, mesh: motors.find(m => m.name === node).mesh });
    }
    camera.position.set(1.0, 1.0, 0.75).normalize().multiplyScalar(5);    // isometric, from the front-left (+y is the robot's left)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.target.set(0, 0, -0.05);
    resize(); pose(0);
  }).catch(err => { hover.textContent = 'model failed to load: ' + (err && err.message ? err.message : err); });

  // ---- stride: a trot, each joint a smooth function of phase, inside the URDF limits ----
  const STAND = { hip: 0.0, thigh: 0.8, calf: -1.55 };
  const PHASE = { FL: 0, RR: 0, FR: 0.5, RL: 0.5 };   // diagonal pairs move together
  function jointAngle(leg, part, t) {
    const ph = (t + PHASE[leg]) % 1, s = Math.sin(2 * Math.PI * ph), swing = Math.max(0, Math.sin(2 * Math.PI * ph));
    if (part === 'hip') return STAND.hip + (leg[1] === 'L' ? 1 : -1) * 0.06 * Math.sin(2 * Math.PI * t * 2);
    if (part === 'thigh') return STAND.thigh - 0.45 * s + 0.15 * swing;          // forward on the swing, back on the stance
    return STAND.calf + 0.55 * swing;                                               // knee folds up when the foot is in the air
  }
  function pose(t) {
    for (const r of revolute) {
      const [leg, part] = r.J.name.split('_');
      let a = jointAngle(leg, part, t);
      a = Math.max(r.J.limit.lower, Math.min(r.J.limit.upper, a));
      r.node.quaternion.setFromAxisAngle(r.axis, a);
    }
    // body bob: lift the base a little when the legs push
    if (nodes['base']) nodes['base'].position.z = 0.012 * Math.sin(4 * Math.PI * t);
  }

  let playing = true, t = 0, last = performance.now();
  playBtn.addEventListener('click', () => { playing = !playing; playBtn.textContent = playing ? 'pause' : 'play'; playBtn.classList.toggle('on', playing); });
  phaseIn.addEventListener('input', () => { playing = false; playBtn.textContent = 'play'; playBtn.classList.remove('on'); t = parseFloat(phaseIn.value); pose(t); });

  // ---- labels on the three highlighted motors ----
  const labels = [], _v = new THREE.Vector3();
  function layoutLabels() {
    if (!labels.length) return;
    const rows = labels.map(l => {
      l.mesh.updateMatrixWorld();
      _v.setFromMatrixPosition(l.mesh.matrixWorld).project(camera);
      return { l, ax: (_v.x + 1) / 2 * W, ay: (1 - _v.y) / 2 * H };
    }).sort((a, b) => a.ay - b.ay);
    let lastY = -Infinity;
    const col = Math.max(...rows.map(r => r.ax)) + 70;
    rows.forEach(r => { r.y = Math.max(r.ay, lastY + r.l.el.offsetHeight + 6); lastY = r.y; r.l.el.style.left = Math.min(col, W - r.l.el.offsetWidth - 8) + 'px'; r.l.el.style.top = r.y + 'px'; r.lx = Math.min(col, W - r.l.el.offsetWidth - 8) - 4; });
    leaders.setAttribute('viewBox', `0 0 ${W} ${H}`);
    leaders.innerHTML = rows.map(r => `<line x1="${r.lx}" y1="${r.y}" x2="${r.ax}" y2="${r.ay}" stroke="var(--ink-2)" stroke-width="1"/><circle cx="${r.ax}" cy="${r.ay}" r="2.6" fill="var(--ink)"/>`).join('');
  }

  function resize() {
    W = canvasHost.clientWidth; H = Math.max(320, Math.min(560, Math.round(W * 0.6)));
    renderer.setSize(W, H, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = H + 'px';
    const a = W / H; camera.left = -halfH * a; camera.right = halfH * a; camera.top = halfH; camera.bottom = -halfH; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvasHost); resize();

  function frame(now) {
    if (playing) { t = (t + (now - last) / 1000 / 3.2) % 1; phaseIn.value = t.toFixed(3); pose(t); }
    last = now;
    if (controls) controls.update();
    renderer.render(scene, camera);
    layoutLabels();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  root.__robot = { nodes, revolute, motors, pose, camera, get t() { return t; } };
}

document.querySelectorAll('.robot').forEach(mountRobot);
