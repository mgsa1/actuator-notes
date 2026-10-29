document.addEventListener('DOMContentLoaded', () => {
  const { plot, bindRanges, fmt, animate } = AA;
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const setv = (id, v, d) => { document.getElementById(id).firstChild.textContent = typeof v === 'string' ? v : fmt(v, d); };
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const lcm = (a, b) => a / gcd(a, b) * b;
  const PH = { A: 'var(--s2)', B: 'var(--s3)', C: 'var(--s7)' };
  const ARROW = (id, col) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="${col}"/></marker>`;

  // ---------- Star of slots: the one computation both widgets share ----------
  // Double-layer concentrated winding: coil k sits on tooth k, goes down slot k and up slot k+1.
  function winding(Q, P2) {
    const p = P2 / 2;
    const slot = k => (k * p * 360 / Q) % 360;                         // electrical angle of slot k
    const coilVec = (k, nu) => {                                       // phasor of coil k for harmonic nu
      const a0 = nu * slot(k) * D2R, a1 = nu * slot((k + 1) % Q) * D2R;
      return [Math.cos(a0) - Math.cos(a1), Math.sin(a0) - Math.sin(a1)];
    };
    const SECT = ['A', 'b', 'C', 'a', 'B', 'c'];                        // 60° sectors from -30°, hobby convention
    let coils = [];
    for (let k = 0; k < Q; k++) {
      const v = coilVec(k, 1);
      const ang = ((Math.atan2(v[1], v[0]) / D2R) + 360) % 360;
      const s = Math.floor(((ang + 30 + 1e-6) % 360) / 60);   // epsilon: coils exactly on a sector edge go to the sector that starts there
      const L = SECT[s];
      coils.push({ k, ang, phase: L.toUpperCase(), sign: L === L.toUpperCase() ? 1 : -1, letter: L });
    }
    // rotate so the string starts at the first "A" that begins a group (matches the usual hobby strings)
    let off = 0;
    for (let k = 0; k < Q; k++) { const prev = coils[(k - 1 + Q) % Q]; if (coils[k].phase === 'A' && prev.phase !== 'A') { off = k; break; } }
    coils = coils.map((_, i) => coils[(i + off) % Q]);
    // conventions: the first coil is wound "forward" (capital), and phase B follows phase A around the stator
    if (coils[0].sign < 0) coils.forEach(c => { c.sign = -c.sign; });
    const firstOther = coils.find(c => c.phase !== 'A');
    if (firstOther && firstOther.phase === 'C') coils.forEach(c => { c.phase = c.phase === 'B' ? 'C' : c.phase === 'C' ? 'B' : 'A'; });
    coils.forEach(c => { c.letter = c.sign > 0 ? c.phase : c.phase.toLowerCase(); });
    const kw = nu => {
      let x = 0, y = 0, n = 0;
      for (const c of coils) if (c.phase === 'A') { const v = coilVec(c.k, nu); x += c.sign * v[0]; y += c.sign * v[1]; n++; }
      return { kw: n ? Math.hypot(x, y) / (2 * n) : 0, n, len: Math.hypot(x, y), max: 2 * n };
    };
    const t = gcd(Q, p);
    const rules = [
      { ok: Q % 3 === 0, text: 'Q is a multiple of 3 (three phases need equal coil counts)' },
      { ok: (Q / t) % 3 === 0, text: 'Q / gcd(Q, p) is divisible by 3 (balanced phases)' },
      { ok: Q !== P2, text: 'Q ≠ 2p (equal counts give zero winding factor)' },
    ];
    const nA = coils.filter(c => c.phase === 'A').length, nB = coils.filter(c => c.phase === 'B').length, nC = coils.filter(c => c.phase === 'C').length;
    const balanced = nA === nB && nB === nC && nA > 0;
    return { Q, P2, p, t, coils, coilVec, kw, rules, valid: rules.every(r => r.ok) && balanced, balanced, q: Q / (3 * P2) };
  }
  // Draw a stator (teeth + coils) and a magnet ring into an svg. opts.tooth(k, coil) returns
  // { fill, opacity, label, labelFill, tip } per tooth; opts.rotor is the rotor's mechanical angle in radians.
  function drawMotorInto(svg, w, opts) {
    const { Q, P2, coils } = w;
    const cx = 200, cy = 200;
    const rIn = 70, rTooth = 158, rMagIn = 164, rMagOut = 186, rBack = 198;
    const arc = (r0, r1, a0, a1) => {
      const p0 = [cx + r0 * Math.cos(a0), cy + r0 * Math.sin(a0)], p1 = [cx + r1 * Math.cos(a0), cy + r1 * Math.sin(a0)];
      const p2 = [cx + r1 * Math.cos(a1), cy + r1 * Math.sin(a1)], p3 = [cx + r0 * Math.cos(a1), cy + r0 * Math.sin(a1)];
      const big = (a1 - a0) > Math.PI ? 1 : 0;
      return `M${p0}L${p1}A${r1},${r1},0,${big},1,${p2}L${p3}A${r0},${r0},0,${big},0,${p0}Z`;
    };
    let html = `<circle cx="${cx}" cy="${cy}" r="${rBack}" fill="none" stroke="var(--ink-2)" stroke-width="3"/>`;
    const rot = opts.rotor || 0;
    for (let m = 0; m < P2; m++) {
      const a0 = -Math.PI / 2 + rot + m * TAU / P2 + 0.01, a1 = -Math.PI / 2 + rot + (m + 1) * TAU / P2 - 0.01;
      html += `<path d="${arc(rMagIn, rMagOut, a0, a1)}" fill="${m % 2 ? 'var(--s1)' : 'var(--s8)'}" fill-opacity=".85"/>`;
      if (P2 <= 24) { const am = (a0 + a1) / 2, r = (rMagIn + rMagOut) / 2; html += `<text x="${cx + r * Math.cos(am)}" y="${cy + r * Math.sin(am) + 4}" text-anchor="middle" font-size="${P2 > 16 ? 9 : 11}" font-weight="700" fill="#fff">${m % 2 ? 'S' : 'N'}</text>`; }
    }
    html += `<circle cx="${cx}" cy="${cy}" r="${rIn}" fill="var(--surface-2)" stroke="var(--line)" stroke-width="2"/>`;
    const pitch = TAU / Q, half = pitch * 0.5, toothHalf = Math.min(half * 0.42, 0.11), tipHalf = half * 0.82;
    for (let k = 0; k < Q; k++) {
      const c = coils[k], a = -Math.PI / 2 + (k + 0.5) * pitch;
      const t = opts.tooth(k, c);
      const pt = (r, da) => `${(cx + r * Math.cos(a + da)).toFixed(1)},${(cy + r * Math.sin(a + da)).toFixed(1)}`;
      // tooth: a stem plus a tip whose inner and outer edges are arcs, so wide tips (few teeth) stay round
      const A = (r, sweep) => `A${r},${r},0,0,${sweep},`;
      html += `<path d="M${pt(rIn - 2, -toothHalf * 0.55)}L${pt(rTooth - 10, -toothHalf * 0.55)}${A(rTooth - 10, 0)}${pt(rTooth - 10, -tipHalf)}L${pt(rTooth, -tipHalf)}${A(rTooth, 1)}${pt(rTooth, tipHalf)}L${pt(rTooth - 10, tipHalf)}${A(rTooth - 10, 0)}${pt(rTooth - 10, toothHalf * 0.55)}L${pt(rIn - 2, toothHalf * 0.55)}Z" fill="var(--line)" stroke="var(--ink-2)" stroke-width=".8"/>`;
      if (t.tip) html += `<path d="M${pt(rTooth - 9, -tipHalf)}L${pt(rTooth, -tipHalf)}${A(rTooth, 1)}${pt(rTooth, tipHalf)}L${pt(rTooth - 9, tipHalf)}${A(rTooth - 9, 0)}${pt(rTooth - 9, -tipHalf)}Z" fill="${t.tip.fill}" fill-opacity="${t.tip.opacity}"/>`;
      const r0 = rIn + 12, r1 = rTooth - 16;
      html += `<path d="M${pt(r0, -toothHalf)}L${pt(r1, -toothHalf)}L${pt(r1, toothHalf)}L${pt(r0, toothHalf)}Z" fill="${t.fill}" fill-opacity="${t.opacity}" stroke="${t.fill}" stroke-width="1"/>`;
      if (t.label && Q <= 36) { const rl = (r0 + r1) / 2; html += `<text x="${cx + rl * Math.cos(a)}" y="${cy + rl * Math.sin(a) + 4}" text-anchor="middle" font-size="${Q > 24 ? 9 : 12}" font-weight="700" fill="${t.labelFill}">${t.label}</text>`; }
    }
    html += `<circle cx="${cx}" cy="${cy}" r="18" fill="var(--bg)" stroke="var(--line)"/>`;
    html += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="var(--muted)">${Q}N${P2}P</text>`;
    svg.innerHTML = html + (opts.overlay || '');
  }
  // ---------- Rotating field ----------
  (function () {
    const root = document.getElementById('rf'), svg = document.getElementById('rfsvg');
    const pl1 = document.getElementById('rfplot1'), pl2 = document.getElementById('rfplot2'), gap = document.getElementById('rfgap');
    let M = null;                              // the motor: winding + calibration
    const st = bindRanges(root, (s, inp) => { if (inp.name === 'motor') setMotor(); });
    let thE = 0, wE = 0, pushUntil = 0, slow = false, tNow = 0;   // rotor electrical angle and speed
    let iInt = 0, iCmd = 0;                                          // speed loop: integral state and current command
    const i0Input = root.querySelector('input[name=i0]'), i0Out = i0Input.parentElement.querySelector('output');
    const syncCtrl = () => { const sp = st.ctrl === 'speed'; i0Input.disabled = sp; root.querySelector('input[name=wset]').disabled = !sp; };
    root.querySelector('select[name=ctrl]').addEventListener('change', () => { iInt = 0; syncCtrl(); });
    const J = 0.12, B = 0.12;
    const buf = [], WIN = 4;
    document.getElementById('rf-push').addEventListener('click', () => { pushUntil = tNow + 1.5; });
    document.getElementById('rf-slow').addEventListener('click', (e) => { slow = !slow; e.currentTarget.classList.toggle('on', slow); });
    const SIX = [[1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1], [1, -1, 0]];   // field angles 30°, 90°, ... 330°

    // MMF of every tooth from the three phase currents, and its fundamental (p-th spatial harmonic)
    function mmf(w, ia, ib, ic) {
      const I = { A: ia, B: ib, C: ic };
      const F = w.coils.map(c => c.sign * I[c.phase]);
      let a = 0, b = 0;
      for (let k = 0; k < w.Q; k++) { const th = (k + 0.5) * TAU / w.Q; a += F[k] * Math.cos(w.p * th); b += F[k] * Math.sin(w.p * th); }
      a *= 2 / w.Q; b *= 2 / w.Q;
      return { F, amp: Math.hypot(a, b), ang: Math.atan2(b, a), a, b };   // ang: electrical angle of the fundamental's peak
    }
    const sineSet = (I, th) => [I * Math.cos(th), I * Math.cos(th - TAU / 3), I * Math.cos(th - 2 * TAU / 3)];
    function setMotor() {
      const [Q, P2] = st.motor.split(',').map(Number);
      const w = winding(Q, P2);
      // calibrate: where does the fundamental sit for a sine set at angle 0, and which way does it travel?
      let m0 = mmf(w, ...sineSet(1, 0)), m1 = mmf(w, ...sineSet(1, 0.2));
      let d = Math.atan2(Math.sin(m1.ang - m0.ang), Math.cos(m1.ang - m0.ang));
      const swap = d < 0;                                   // phase sequence runs the other way: swap B and C
      const set = (I, th) => { const [a, b, c] = sineSet(I, th); return swap ? [a, c, b] : [a, b, c]; };
      m0 = mmf(w, ...set(1, 0));
      M = { w, set, swap, off: m0.ang, amp0: m0.amp };            // amp0: fundamental amplitude for a sine set of amplitude 1
      buf.length = 0;
    }
    setMotor(); syncCtrl();

    animate((dtReal) => {
      const dt = slow ? dtReal * 0.15 : dtReal; tNow += dt;
      const { w, set, off, amp0 } = M; const p = w.p;
      // controller: wants the fundamental 90° + advance ahead of the rotor's S-pole axis (electrical)
      // current amplitude: set by hand, or by a PI speed loop that may not exceed the drive's current limit (1 per unit)
      let I = st.i0;
      if (st.ctrl === 'speed') {
        const e = st.wset * TAU - wE;
        iInt += e * dt; iInt = Math.max(-2, Math.min(2, iInt));
        iCmd = Math.max(0, Math.min(1, 0.25 * e + 0.6 * iInt));
        if (iCmd >= 1 || iCmd <= 0) iInt -= e * dt;                   // anti-windup: stop integrating at the limit
        I = iCmd; i0Input.value = I.toFixed(2); i0Out.textContent = I.toFixed(2) + ' per unit (controller)';
      }
      const want = thE + Math.PI / 2 + st.adv * D2R;
      let ia, ib, ic;
      if (st.mode === 'six') {
        const k = ((Math.round(((want - off) / D2R - 30) / 60) % 6) + 6) % 6;
        const [a, b, c] = SIX[k].map(v => v * I); [ia, ib, ic] = M.swap ? [a, c, b] : [a, b, c];
      } else { [ia, ib, ic] = set(I, want - off); }
      const m = mmf(w, ia, ib, ic);
      let delta = m.ang - thE; delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      const tq = (m.amp / amp0) * Math.sin(delta);
      const load = st.load + (tNow < pushUntil ? 0.5 : 0);
      wE += (tq - load - B * wE) / J * dt; thE += wE * dt;
      buf.push({ t: tNow, ia, ib, ic, tq, w: wE / TAU });
      while (buf.length && buf[0].t < tNow - WIN) buf.shift();

      // ---- the motor ----
      const thMech = thE / p;                                    // S-pole axis, mechanical. Magnet 0 (N) sits at -90°+rot, so S axis = rot + π/p
      const rot = thMech - Math.PI / p;
      const ph = { A: ia, B: ib, C: ic };
      drawMotorInto(svg, w, {
        rotor: rot,
        tooth: (k, c) => { const i = ph[c.phase], f = m.F[k]; const a = Math.min(1, Math.abs(i)); return { fill: PH[c.phase], opacity: 0.15 + 0.8 * a, label: w.Q <= 24 ? (c.phase + (Math.abs(i) > 0.05 ? (i * c.sign > 0 ? '⊗' : '⊙') : '')) : '', labelFill: a > 0.5 ? '#fff' : 'var(--ink)', tip: { fill: f > 0 ? 'var(--s8)' : 'var(--s1)', opacity: Math.min(1, Math.abs(f)) * 0.95 } }; },
        overlay: (() => {
          // fundamental's peak direction (mechanical) and the torque-angle arc, drawn at the centre
          const aR = -Math.PI / 2 + thMech, aF = aR + delta / p;   // nearest of the p equivalent peaks of the fundamental
          const L = 74 * Math.min(1.2, m.amp / amp0);
          const arcR = 40; const dMech = delta / p;
          const arc = Math.abs(delta) > 0.05 ? `<path d="M${200 + arcR * Math.cos(aR)},${200 + arcR * Math.sin(aR)}A${arcR},${arcR},0,0,${dMech > 0 ? 1 : 0},${200 + arcR * Math.cos(aF)},${200 + arcR * Math.sin(aF)}" fill="none" stroke="var(--s4)" stroke-width="2.5"/>` : '';
          return `<defs>${ARROW('pf', 'var(--ink)')}${ARROW('pr', 'var(--s1)')}</defs>
            <line x1="200" y1="200" x2="${200 + 44 * Math.cos(aR)}" y2="${200 + 44 * Math.sin(aR)}" stroke="var(--s1)" stroke-width="3" marker-end="url(#pr)"/>
            ${m.amp > 0.02 * amp0 ? `<line x1="200" y1="200" x2="${200 + L * Math.cos(aF)}" y2="${200 + L * Math.sin(aF)}" stroke="var(--ink)" stroke-width="3.5" marker-end="url(#pf)"/>` : ''}
            ${arc}<circle cx="200" cy="200" r="4" fill="currentColor"/>`;
        })(),
      });

      // ---- traces ----
      if (buf.length > 2) {
        const ser = key => buf.map(b => [b.t - tNow, b[key]]);
        plot(pl1, { x: [-WIN, 0], y: [-1.1, 1.1], xlabel: 'time (s)', ylabel: 'phase current', series: [{ pts: ser('ia'), color: 'var(--s2)' }, { pts: ser('ib'), color: 'var(--s3)' }, { pts: ser('ic'), color: 'var(--s7)' }] });
        let wmax = 0; for (const b of buf) wmax = Math.max(wmax, Math.abs(b.w));
        const ys = Math.max(1.2, Math.ceil(wmax * 1.1 * 2) / 2, st.ctrl === 'speed' ? Math.ceil(st.wset * 1.2 * 2) / 2 : 0);
        plot(pl2, { x: [-WIN, 0], y: [-ys, ys], xlabel: 'time (s)', ylabel: 'torque · speed', series: [{ pts: ser('tq'), color: 'var(--s4)' }, { pts: ser('w'), color: 'var(--ink-2)', dash: '5 4' }], hlines: [{ y: load, label: 'load torque', color: 'var(--warn)' }].concat(st.ctrl === 'speed' ? [{ y: st.wset, label: 'target speed', color: 'var(--accent)' }] : []), texts: [{ x: -WIN + 0.1, y: ys * 0.88, text: 'torque (per unit)', color: 'var(--s4)' }, { x: -WIN + 0.1, y: ys * 0.72, text: 'electrical speed (cycles/s, dashed)', color: 'var(--ink-2)' }] });
      }
      // ---- around the air gap ----
      {
        const Q = w.Q, step = [], fund = [];
        for (let k = 0; k < Q; k++) { const a0 = k * 360 / Q, a1 = (k + 1) * 360 / Q; step.push([a0, m.F[k]], [a1, m.F[k]]); }
        for (let i = 0; i <= 180; i++) { const th = i * 2; fund.push([th, m.a * Math.cos(p * th * D2R) + m.b * Math.sin(p * th * D2R)]); }
        const ymax = Math.max(1.2, 1.1 * Math.max(...m.F.map(Math.abs), m.amp));
        const { sx, sy } = plot(gap, { x: [0, 360], y: [-ymax, ymax], xlabel: 'angle around the air gap (° mechanical, clockwise from the top)', ylabel: 'stator MMF', series: [{ pts: step, color: 'var(--muted)', width: 1.5 }, { pts: fund, color: 'var(--ink)', width: 2.5 }], texts: [{ x: 4, y: ymax * 0.85, text: 'tooth by tooth (grey) and fundamental (black)', color: 'var(--ink-2)' }] });
        // magnets as a band along the bottom; north where a tooth-north would be repelled, so the rotor seeks the blue-on-red overlap
        let band = '';
        for (let mm = 0; mm < w.P2; mm++) {
          let a0 = ((rot / D2R) + mm * 360 / w.P2) % 360; if (a0 < 0) a0 += 360; const wdt = 360 / w.P2;
          const col = mm % 2 ? 'var(--s1)' : 'var(--s8)';
          const seg = (x0, x1) => x1 - x0 < 0.5 ? '' : `<rect x="${sx(x0)}" y="${sy(-ymax) - 10}" width="${sx(x1) - sx(x0)}" height="8" fill="${col}" fill-opacity=".8"/>`;
          band += a0 + wdt <= 360 ? seg(a0 + 0.3, a0 + wdt - 0.3) : seg(a0 + 0.3, 360) + seg(0, a0 + wdt - 360 - 0.3);
        }
        gap.insertAdjacentHTML('beforeend', band + `<text x="${sx(358)}" y="${sy(-ymax) - 14}" text-anchor="end" font-size="10" fill="var(--muted)">magnets</text>`);
      }
      // ---- readouts ----
      const period = Math.abs(wE) > 0.5 ? TAU / Math.abs(wE) : 1;
      const rec = buf.filter(b => b.t > tNow - Math.min(period, WIN));
      let mn = Infinity, mx = -Infinity, sum = 0; for (const b of rec) { mn = Math.min(mn, b.tq); mx = Math.max(mx, b.tq); sum += b.tq; }
      const mean = sum / Math.max(1, rec.length);
      document.getElementById('rf-cap').innerHTML = `<span style="color:var(--s4)">torque angle ${(delta / D2R).toFixed(0)}° electrical = ${(delta / p / D2R).toFixed(1)}° mechanical</span>`;
      setv('rf-d', delta / D2R, 0); setv('rf-t', tq, 2); setv('rf-w', wE / TAU, 2); setv('rf-wm', wE / TAU / p, 3); setv('rf-i', I, 2);
      setv('rf-r', Math.abs(mean) > 0.02 ? 100 * (mx - mn) / Math.abs(mean) : NaN, 1);
    });
  })();
});
