/* Actuator Atlas — shared behaviour: nav, theme, sliders, SVG plots, quizzes. */
(function () {
  'use strict';

  // ---- Site map (single source of truth for nav + pager) ----
  const PAGES = [
    { file: 'index.html',         num: '',  title: 'Start here',              group: 'Overview' },
    { file: 'motors.html',        num: '1', title: 'Motor fundamentals',      group: 'How they work' },
    { file: 'brushless.html',     num: '2', title: 'Brushless motors',        group: 'How they work' },
    { file: 'electronics.html',   num: '3', title: 'Drive electronics',       group: 'How they work' },
    { file: 'sensing.html',       num: '4', title: 'Sensing & control',       group: 'How they work' },
    { file: 'transmissions.html', num: '5', title: 'Transmissions',           group: 'The parts' },
    { file: 'design.html',        num: '6', title: 'Actuator architectures',  group: 'The parts' },
    { file: 'muscles.html',       num: '7', title: 'Beyond motors',           group: 'The parts' },
    { file: 'manufacturing.html', num: '8', title: 'How they are made',       group: 'Making them' },
    { file: 'build.html',         num: '9', title: 'Build your own',          group: 'Making them' },
    { file: 'sources.html',       num: '',  title: 'Sources & further reading', group: 'Reference' },
    { file: 'glossary.html',      num: '',  title: 'Glossary',                group: 'Reference' },
  ];
  const here = location.pathname.split('/').pop() || 'index.html';

  function buildNav() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    let group = null, html = '';
    for (const p of PAGES) {
      if (p.group !== group) { group = p.group; html += `<div class="nav-group">${group}</div>`; }
      html += `<a href="${p.file}" class="${p.file === here ? 'active' : ''}"><span class="num">${p.num}</span>${p.title}</a>`;
    }
    nav.innerHTML = html;
  }
  function buildPager() {
    const el = document.querySelector('.pager');
    if (!el) return;
    const i = PAGES.findIndex(p => p.file === here);
    if (i < 0) return;
    const prev = PAGES[i - 1], next = PAGES[i + 1];
    el.innerHTML =
      (prev ? `<a href="${prev.file}" class="prev"><small>Previous</small>${prev.num ? prev.num + '. ' : ''}${prev.title}</a>` : '') +
      (next ? `<a href="${next.file}" class="next"><small>Next</small>${next.num ? next.num + '. ' : ''}${next.title}</a>` : '');
  }

  // ---- Theme ----
  function initTheme() {
    try { const t = localStorage.getItem('aa-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.addEventListener('click', () => {
        const cur = document.documentElement.dataset.theme ||
          (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('aa-theme', next); } catch (e) {}
        document.dispatchEvent(new CustomEvent('themechange'));
      });
    });
    document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
    }));
  }

  // ---- Range helper: <input type=range data-out="id" data-fmt="2" data-unit="V"> ----
  function fmt(v, d) {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    if (d === undefined) d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
    return Number(v).toFixed(d);
  }
  function bindRanges(root, onChange) {
    const inputs = [...(root || document).querySelectorAll('input[type=range]')];
    const state = {};
    const update = (inp) => {
      const v = parseFloat(inp.value);
      state[inp.name || inp.id] = v;
      const out = inp.parentElement.querySelector('output');
      if (out) out.textContent = (inp.dataset.pre || '') + fmt(v, inp.dataset.fmt !== undefined ? +inp.dataset.fmt : undefined) + (inp.dataset.unit ? ' ' + inp.dataset.unit : '');
    };
    inputs.forEach(inp => {
      update(inp);
      inp.addEventListener('input', () => { update(inp); onChange && onChange(state, inp); });
    });
    (root || document).querySelectorAll('select, input[type=checkbox]').forEach(s => {
      state[s.name || s.id] = s.type === 'checkbox' ? s.checked : s.value;
      s.addEventListener('change', () => { state[s.name || s.id] = s.type === 'checkbox' ? s.checked : s.value; onChange && onChange(state, s); });
    });
    return state;
  }

  // ---- Minimal SVG plot ----
  // plot(svg, { x:[0,1], y:[0,1], xlabel, ylabel, series:[{pts:[[x,y],...], color:'var(--s1)', label, dash}], marks:[{x,y,color,label}], vlines:[{x,label}], hlines:[{y,label}] })
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function ticks(min, max, n) {
    const span = max - min; if (span <= 0) return [min];
    const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n) || mag * 10;
    const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function plot(svg, o) {
    const W = +svg.getAttribute('data-w') || 640, H = +svg.getAttribute('data-h') || 320;
    const m = { l: 56, r: 16, t: 14, b: 44 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.classList.add('plot');
    svg.innerHTML = '';
    const [x0, x1] = o.x, [y0, y1] = o.y;
    const sx = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r);
    const sy = y => H - m.b - (y - y0) / (y1 - y0) * (H - m.t - m.b);
    const g = el('g', { class: 'grid' }), ax = el('g', { class: 'axis' });
    for (const tx of ticks(x0, x1, 6)) {
      g.appendChild(el('line', { x1: sx(tx), x2: sx(tx), y1: m.t, y2: H - m.b }));
      ax.appendChild(el('text', { x: sx(tx), y: H - m.b + 16, 'text-anchor': 'middle' }, fmtTick(tx)));
    }
    for (const ty of ticks(y0, y1, 5)) {
      g.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: sy(ty), y2: sy(ty) }));
      ax.appendChild(el('text', { x: m.l - 8, y: sy(ty) + 4, 'text-anchor': 'end' }, fmtTick(ty)));
    }
    ax.appendChild(el('path', { d: `M${m.l},${m.t}V${H - m.b}H${W - m.r}`, fill: 'none' }));
    svg.appendChild(g); svg.appendChild(ax);
    if (o.xlabel) svg.appendChild(el('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'lbl' }, o.xlabel));
    if (o.ylabel) svg.appendChild(el('text', { x: 14, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'lbl', transform: `rotate(-90 14 ${(m.t + H - m.b) / 2})` }, o.ylabel));
    const clip = (v, a, b) => Math.max(a, Math.min(b, v));
    for (const s of o.series || []) {
      let d = '', pen = false;
      for (const [x, y] of s.pts) {
        if (!isFinite(y) || y < y0 - (y1 - y0) || y > y1 + (y1 - y0) || x < x0 || x > x1) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + sx(x).toFixed(1) + ',' + sy(clip(y, y0, y1)).toFixed(1); pen = true;
      }
      const p = el('path', { d, class: 'series', stroke: s.color || 'var(--s1)' });
      if (s.dash) p.setAttribute('stroke-dasharray', s.dash);
      if (s.width) p.setAttribute('stroke-width', s.width);
      if (s.fill) { p.setAttribute('fill', s.fill); p.setAttribute('fill-opacity', '0.12'); }
      svg.appendChild(p);
    }
    for (const v of o.vlines || []) {
      svg.appendChild(el('line', { x1: sx(v.x), x2: sx(v.x), y1: m.t, y2: H - m.b, stroke: v.color || 'var(--muted)', 'stroke-dasharray': '4 4' }));
      if (v.label) svg.appendChild(el('text', { x: sx(v.x) + 4, y: m.t + 12 }, v.label));
    }
    for (const h of o.hlines || []) {
      svg.appendChild(el('line', { x1: m.l, x2: W - m.r, y1: sy(h.y), y2: sy(h.y), stroke: h.color || 'var(--muted)', 'stroke-dasharray': '4 4' }));
      if (h.label) svg.appendChild(el('text', { x: W - m.r - 4, y: sy(h.y) - 4, 'text-anchor': 'end' }, h.label));
    }
    for (const mk of o.marks || []) {
      svg.appendChild(el('circle', { cx: sx(mk.x), cy: sy(clip(mk.y, y0, y1)), r: 5, fill: mk.color || 'var(--ink)', class: 'marker' }));
      if (mk.label) svg.appendChild(el('text', { x: sx(mk.x) + 8, y: sy(clip(mk.y, y0, y1)) - 8, class: 'lbl' }, mk.label));
    }
    for (const t of o.texts || []) svg.appendChild(el('text', { x: sx(t.x), y: sy(t.y), 'text-anchor': t.anchor || 'start', fill: t.color || 'var(--ink-2)' }, t.text));
    return { sx, sy };
  }
  function fmtTick(v) { const a = Math.abs(v); return a >= 1000 ? (v / 1000) + 'k' : (a < 1 && a > 0 ? +v.toFixed(3) : +v.toFixed(2)) + ''; }
  function legend(container, items) {
    container.innerHTML = items.map(i => `<span style="--c:${i.color}">${i.label}</span>`).join('');
  }

  // ---- Quiz: <div class="quiz" data-answer="1"><div class="q">..</div><div class="opts"><button>..</button>..</div><div class="expl">..</div></div> ----
  function initQuizzes() {
    document.querySelectorAll('.quiz').forEach(q => {
      const ans = +q.dataset.answer, btns = [...q.querySelectorAll('.opts button')];
      btns.forEach((b, i) => b.addEventListener('click', () => {
        btns.forEach(x => x.classList.remove('right', 'wrong'));
        b.classList.add(i === ans ? 'right' : 'wrong');
        if (i !== ans) btns[ans].classList.add('right');
        q.querySelector('.expl')?.classList.add('show');
      }));
    });
  }

  // ---- Animation loop helper ----
  function animate(fn) {
    let last = performance.now(), raf;
    const step = (t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; fn(dt, t / 1000); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf); else { last = performance.now(); raf = requestAnimationFrame(step); }
    });
  }

  document.addEventListener('DOMContentLoaded', () => { buildNav(); buildPager(); initTheme(); initQuizzes(); });
  window.AA = { plot, legend, bindRanges, fmt, animate, el, PAGES };
})();
