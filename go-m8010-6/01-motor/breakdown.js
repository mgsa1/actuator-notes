/* Chapter 1: the brushless motor inside the Unitree GO-M8010-6, drawn from numbers.
   Counts (36 teeth, 42 magnets) and the module envelope (96.5 mm diameter, 42.3 mm depth) are from sources;
   the internal radii are estimates and are labelled as such on the page. Units are millimetres. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const TAU = Math.PI * 2;
  const PH = { A: 'var(--s2)', B: 'var(--s3)', C: 'var(--s7)' };

  // ---- the module and the motor inside it, in millimetres ----
  const M = {
    od: 96.5, depth: 42.3,             // vendor
    canOd: 93.4, magIn: 82, magT: 3,   // can wall 1.2 + back iron 1.5 behind 3 mm magnets; 0.5 mm air gap
    statorOd: 81, bore: 58.5, stack: 10, // 8110-class lamination (catalogue part); stack length unknown, class value
    Q: 36, P2: 42,                     // counted (Simplexity)
    sun: 9, planet: 19, ring: 48, module: 0.9,   // gearbox, chapter 2; drawn faded here for orientation only
  };

  // ---- star of slots: phase of each coil, generated, not looked up (same rule as field.js) ----
  function winding(Q, P2) {
    const p = P2 / 2, D2R = Math.PI / 180;
    const slot = k => (k * p * 360 / Q) % 360;
    const vec = k => { const a0 = slot(k) * D2R, a1 = slot((k + 1) % Q) * D2R; return [Math.cos(a0) - Math.cos(a1), Math.sin(a0) - Math.sin(a1)]; };
    const SECT = ['A', 'b', 'C', 'a', 'B', 'c'];
    const coils = [];
    for (let k = 0; k < Q; k++) {
      const v = vec(k), ang = ((Math.atan2(v[1], v[0]) / D2R) + 360) % 360;
      const L = SECT[Math.floor(((ang + 30 + 1e-6) % 360) / 60)];
      coils.push({ phase: L.toUpperCase(), sign: L === L.toUpperCase() ? 1 : -1 });
    }
    return coils;
  }

  // ---- helpers ----
  const pt = (cx, cy, r, a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  function annulus(cx, cy, r0, r1, a0, a1) {
    const big = (a1 - a0) > Math.PI ? 1 : 0;
    return `M${pt(cx, cy, r0, a0)}L${pt(cx, cy, r1, a0)}A${r1},${r1},0,${big},1,${pt(cx, cy, r1, a1)}L${pt(cx, cy, r0, a1)}A${r0},${r0},0,${big},0,${pt(cx, cy, r0, a0)}Z`;
  }
  const label = (x, y, t, anchor = 'middle', size = 3.2, fill = 'var(--ink)') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" font-family="inherit">${t}</text>`;
  const num = (x, y, n) => `<circle cx="${x}" cy="${y}" r="2.6" fill="var(--surface)" stroke="var(--ink)" stroke-width=".35"/><text x="${x}" y="${y + 1.05}" text-anchor="middle" font-size="3" font-weight="700" fill="var(--ink)" font-family="inherit">${n}</text>`;
  const dim = (x0, y0, x1, y1, t) => {
    const horiz = y0 === y1; const tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
    return `<g stroke="var(--muted)" stroke-width=".3" fill="none"><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>
      ${horiz ? `<line x1="${x0}" y1="${y0 - 2}" x2="${x0}" y2="${y0 + 2}"/><line x1="${x1}" y1="${y1 - 2}" x2="${x1}" y2="${y1 + 2}"/>` : `<line x1="${x0 - 2}" y1="${y0}" x2="${x0 + 2}" y2="${y0}"/><line x1="${x1 - 2}" y1="${y1}" x2="${x1 + 2}" y2="${y1}"/>`}</g>
      ${horiz ? label(tx, ty - 1.5, t, 'middle', 3, 'var(--muted)') : label(x0 + 1, Math.min(y0, y1) - 2.5, t, 'end', 3, 'var(--muted)')}`;
  };

  // ---- face-on views of the two motor parts ----
  const face = document.getElementById('bd-face');
  const faceCap = document.getElementById('bd-face-cap');
  const cx = 60, cy = 60;   // viewBox 0 0 128 128, 1 unit = 1 mm

  function viewStator() {
    const Q = M.Q, coils = winding(Q, M.P2);
    const rOut = M.statorOd / 2, rIn = M.bore / 2, pitch = TAU / Q;
    let h = `<circle cx="${cx}" cy="${cy}" r="${M.od / 2}" fill="none" stroke="var(--line)" stroke-width=".3" stroke-dasharray="1 1"/>`;
    h += `<circle cx="${cx}" cy="${cy}" r="${rIn + 3}" fill="var(--surface-2)" stroke="var(--ink-2)" stroke-width=".4"/>`;   // yoke, 3 mm
    for (let k = 0; k < Q; k++) {
      const a = -Math.PI / 2 + k * pitch, c = coils[k];
      const hs = pitch * 0.18, ht = pitch * 0.44;
      h += `<path d="M${pt(cx, cy, rIn + 3, a - hs)}L${pt(cx, cy, rOut - 2.2, a - hs)}L${pt(cx, cy, rOut - 2.2, a - ht)}L${pt(cx, cy, rOut, a - ht)}A${rOut},${rOut},0,0,1,${pt(cx, cy, rOut, a + ht)}L${pt(cx, cy, rOut - 2.2, a + ht)}L${pt(cx, cy, rOut - 2.2, a + hs)}L${pt(cx, cy, rIn + 3, a + hs)}Z" fill="var(--line)" stroke="var(--ink-2)" stroke-width=".2"/>`;
      h += `<path d="${annulus(cx, cy, rIn + 5, rOut - 3.2, a - pitch * 0.4, a + pitch * 0.4)}" fill="${PH[c.phase]}" fill-opacity="${c.sign > 0 ? .85 : .5}"/>`;
      if (k % 6 === 0) h += label(cx + (rOut + 3.5) * Math.cos(a), cy + (rOut + 3.5) * Math.sin(a) + 1, c.phase + (c.sign > 0 ? '' : '′'), 'middle', 2.6, 'var(--ink-2)');
    }
    h += `<circle cx="${cx}" cy="${cy}" r="${rIn}" fill="var(--bg)" stroke="var(--ink-2)" stroke-width=".4"/>`;
    h += label(cx, cy + 1, 'hub', 'middle', 2.6, 'var(--muted)');
    const str = coils.map(c => c.sign > 0 ? c.phase : c.phase.toLowerCase()).join('');
    h += label(cx, cy + M.od / 2 + 6, `36 teeth, one coil each · phases ${str.slice(0, 12)} repeated three times`, 'middle', 3, 'var(--ink-2)');
    h += label(cx, cy + M.od / 2 + 10.5, 'colour = phase, pale = coil wound the other way · lamination 81 / 58.5 mm, catalogue part', 'middle', 2.6, 'var(--muted)');
    h += num(cx + 21, cy - 21, 2) + num(cx - (rOut - 1) * 0.707, cy + (rOut - 1) * 0.707, 1);
    return [h, 'The stator (1): a laminated ring of 36 teeth pressed onto the aluminium hub, with one coil (2) on every tooth, coloured by phase from the star-of-slots rule; coils of the same phase wound in opposite directions are drawn paler. The pattern of twelve repeats three times around the ring. None of this moves.'];
  }
  function viewRotor() {
    const rCan = M.canOd / 2, rMagOut = M.magIn / 2 + M.magT, rMagIn = M.magIn / 2;
    let h = `<circle cx="${cx}" cy="${cy}" r="${M.od / 2}" fill="none" stroke="var(--line)" stroke-width=".3" stroke-dasharray="1 1"/>`;
    h += `<circle cx="${cx}" cy="${cy}" r="${rCan}" fill="var(--surface-2)" stroke="var(--ink-2)" stroke-width=".4"/>`;
    h += `<path d="${annulus(cx, cy, rMagOut, rCan - 1.2, 0, TAU - 1e-4)}" fill="var(--line)"/>`;   // back iron
    for (let k = 0; k < M.P2; k++) {
      const a0 = -Math.PI / 2 + k * TAU / M.P2 + 0.012, a1 = a0 + TAU / M.P2 - 0.024;
      h += `<path d="${annulus(cx, cy, rMagIn, rMagOut, a0, a1)}" fill="${k % 2 ? 'var(--s1)' : 'var(--s8)'}" fill-opacity=".85"/>`;
    }
    h += `<circle cx="${cx}" cy="${cy}" r="${rMagIn}" fill="var(--bg)"/>`;
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + Math.PI / 6; h += `<line x1="${cx + 9 * Math.cos(a)}" y1="${cy + 9 * Math.sin(a)}" x2="${cx + (rMagIn - 1) * Math.cos(a)}" y2="${cy + (rMagIn - 1) * Math.sin(a)}" stroke="var(--surface-2)" stroke-width="4.5" stroke-linecap="round"/><line x1="${cx + 9 * Math.cos(a)}" y1="${cy + 9 * Math.sin(a)}" x2="${cx + (rMagIn - 1) * Math.cos(a)}" y2="${cy + (rMagIn - 1) * Math.sin(a)}" stroke="var(--ink-2)" stroke-width=".3" fill="none"/>`; }
    h += `<circle cx="${cx}" cy="${cy}" r="9" fill="var(--surface-2)" stroke="var(--ink-2)" stroke-width=".4"/><circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--bg)" stroke="var(--ink-2)" stroke-width=".3"/>`;
    h += label(cx, cy + M.od / 2 + 6, `42 magnets, north and south alternating · 21 pole pairs`, 'middle', 3, 'var(--ink-2)');
    h += label(cx, cy + M.od / 2 + 10.5, 'magnets 5 × 3 × 12 mm on a 0.5 mm air gap; can and web estimated', 'middle', 2.6, 'var(--muted)');
    h += num(cx + rCan * 0.72 + 3, cy - rCan * 0.72 - 3, 3) + num(cx + 20, cy + 4, 4);
    return [h, 'The rotor (4), seen from the back: a spoked cast web joined to the shaft, an outer can, and inside it a steel ring carrying the 42 magnets (3). The whole bell spins around the stator.'];
  }
  const VIEWS = { stator: viewStator, rotor: viewRotor };
  function showView(name) {
    const [h, cap] = VIEWS[name]();
    face.innerHTML = h; faceCap.textContent = cap;
    document.querySelectorAll('#bd-tabs .btn').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  }
  document.querySelectorAll('#bd-tabs .btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  showView('stator');

  // ---- axial section of the whole module, motor parts in colour, everything else faded for orientation ----
  (function section() {
    const svg = document.getElementById('bd-section'); if (!svg) return;
    const ox = 50, oy = 66;
    const X = x => ox + x, Y = r => oy - r;
    const R = M.od / 2, D = M.depth;
    const m = M.module, rr = m * M.ring / 2, rp = m * M.planet / 2, rs = m * M.sun / 2, rc = (rr - rp + rs + rp) / 2;
    const xs0 = 18, xs1 = xs0 + M.stack, xHub0 = 14, xHub1 = 30, xWeb0 = 32, xWeb1 = 35, xCov = 37, rCan = M.canOd / 2;
    const parts = [];
    const FADE = 'fill-opacity=".45" stroke-opacity=".45"';
    const ctx = (x0, x1, r0, r1, fill, dash) => parts.push([x0, x1, r0, r1, fill, 'var(--ink-2)', FADE + (dash ? ' stroke-dasharray=".8 .5"' : '')]);
    const motor = (x0, x1, r0, r1, fill, stroke = 'var(--ink-2)', extra = '') => parts.push([x0, x1, r0, r1, fill, stroke, extra]);
    // context: housing, gearbox, hub, bearings, cover, board, encoder
    ctx(0, 5, 25, R, 'var(--surface-2)'); ctx(5, xCov, R - 4, R, 'var(--surface-2)'); ctx(5, xHub0, rr + 3, 30, 'var(--surface-2)');
    ctx(5, 14, rr - 0.4, rr + 3, 'var(--surface)'); ctx(1, 5.5, 21, 25, 'var(--surface)', true); ctx(0, 6.5, 0, 21, 'var(--surface)');
    ctx(6.5, 13.5, rc - rp, rc + rp, 'var(--surface)'); ctx(6.5, 13.5, 0, rs, 'var(--surface)');
    motor(xHub0, xHub1, 7.5, M.bore / 2, 'var(--surface-2)');                                       // hub, part of the stator (1)
    ctx(xHub0 + 0.5, xHub0 + 3.5, 3.2, 6.2, 'var(--surface)', true); ctx(xHub1 - 3.5, xHub1 - 0.5, 3.2, 6.2, 'var(--surface)', true);
    ctx(xCov, D, 30, R, 'var(--surface-2)'); ctx(38, 39.6, 0, 40, 'var(--ink-2)'); ctx(36.5, 38, 0, 3, 'var(--accent)'); ctx(35.2, 36.5, 0, 3.5, 'var(--accent)'); ctx(39.6, 41.5, 20, 30, 'var(--ink-2)');
    // the motor
    motor(xs0, xs1, M.bore / 2, M.statorOd / 2, 'var(--line)');                                            // stator laminations (1)
    motor(xs0 - 2.5, xs1 + 2.5, M.bore / 2 + 3.6, M.statorOd / 2 - 2.2, PH.A, 'none', 'fill-opacity=".8"');   // coils (2)
    motor(6.5, 36.5, 0, 3.2, 'var(--line)');                                                               // shaft, part of the rotor (3)
    motor(xWeb0, xWeb1, 3.2, rCan, 'var(--surface-2)');                                                    // web (3)
    motor(xHub0, xWeb1, rCan - 1.2, rCan, 'var(--surface-2)');                                             // can (3)
    motor(xs0 - 2, xs1 + 2, M.magIn / 2 + M.magT, rCan - 1.2, 'var(--line)');                              // back iron, part of the rotor (4)
    motor(xs0 - 1, xs1 + 1, M.magIn / 2, M.magIn / 2 + M.magT, 'var(--s8)', 'none', 'fill-opacity=".85"'); // magnets (3)
    const draw = (mirror) => parts.map(([x0, x1, r0, r1, fill, stroke, extra]) => `<rect x="${X(x0)}" y="${mirror ? oy + r0 : Y(r1)}" width="${x1 - x0}" height="${r1 - r0}" fill="${fill}" stroke="${stroke}" stroke-width=".3" ${extra}/>`).join('');
    let h = draw(false) + draw(true);
    h += `<line x1="${X(-8)}" y1="${Y(0)}" x2="${X(D + 8)}" y2="${Y(0)}" stroke="var(--muted)" stroke-width=".3" stroke-dasharray="3 1.5 .6 1.5"/>`;
    const C = [[1, 23, 25], [2, 23, 33], [3, 20, 41.6, 20, 56], [4, 33.5, 20]];
    for (const [n, px, pr, lx, lr] of C) {
      const hasLeader = lx !== undefined, x = X(hasLeader ? lx : px), y = Y(hasLeader ? lr : pr);
      if (hasLeader) h += `<line x1="${X(px)}" y1="${Y(pr)}" x2="${x}" y2="${y}" stroke="var(--ink-2)" stroke-width=".25"/><circle cx="${X(px)}" cy="${Y(pr)}" r=".5" fill="var(--ink-2)"/>`;
      h += num(x, y, n);
    }
    h += label(X(9.5), Y(53), 'gearbox', 'middle', 2.6, 'var(--muted)') + label(X(39), Y(53), 'board', 'middle', 2.6, 'var(--muted)');
    h += dim(X(0), Y(61), X(D), Y(61), '42.3 mm') + dim(X(D) + 18, Y(0), X(D) + 18, Y(R), 'radius 48.25');
    h += label(X(0), Y(-R) + 7, 'output side', 'start', 3, 'var(--muted)') + label(X(D), Y(-R) + 7, 'board side', 'end', 3, 'var(--muted)');
    h += label(80, 128, 'Motor in colour, the rest of the module faded. Envelope and counts from sources; other dimensions estimated.', 'middle', 2.6, 'var(--muted)');
    svg.innerHTML = h;
  })();
});
