/* Phone-only figure viewer: tap a slide figure (not a video) to open it full screen, pinch or
 * double-tap to zoom, drag to pan. website.js reports taps as "paper-tap" because slides ignore
 * pointer events. Nothing here runs on wide screens. */
(() => {
  const narrow = matchMedia('(max-width: 760px), (max-width: 900px) and (orientation: portrait)');
  const MAX_SCALE = 6, DOUBLE_TAP_SCALE = 2.5;
  let box, view, pan, state;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function apply() {
    const vw = view.clientWidth, vh = view.clientHeight;
    const limitX = Math.max(0, (pan.offsetWidth * state.s - vw) / 2), limitY = Math.max(0, (pan.offsetHeight * state.s - vh) / 2);
    state.x = clamp(state.x, -limitX, limitX);
    state.y = clamp(state.y, -limitY, limitY);
    pan.style.transform = `translate(${state.x}px,${state.y}px) scale(${state.s})`;
  }
  // Zoom to `s`, keeping the point under (px, py) in place.
  function zoomAt(s, px, py) {
    const r = view.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, k = s / state.s;
    state.x = px - cx - k * (px - cx - state.x);
    state.y = py - cy - k * (py - cy - state.y);
    state.s = s;
    apply();
  }
  function build() {
    box = document.createElement('dialog');
    box.className = 'figure-lightbox';
    box.setAttribute('aria-label', 'Figure');
    box.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close figure">×</button><div class="lightbox-view"><div class="lightbox-pan"></div></div><p class="lightbox-hint">Pinch or double-tap to zoom</p>';
    document.body.append(box);
    view = box.querySelector('.lightbox-view');
    pan = box.querySelector('.lightbox-pan');
    box.querySelector('.lightbox-close').addEventListener('click', () => box.close());
    // The page's own touch handler would turn these gestures into page changes.
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) box.addEventListener(type, e => e.stopPropagation(), {passive: false});
    let gesture = null, lastTap = {time: 0, x: 0, y: 0};
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    view.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        const [mx, my] = mid(e.touches);
        gesture = {kind: 'pinch', d: dist(e.touches), s: state.s, x: state.x, y: state.y, mx, my};
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        gesture = {kind: 'drag', sx: t.clientX, sy: t.clientY, x: state.x, y: state.y, moved: false, time: performance.now()};
      }
    }, {passive: true});
    view.addEventListener('touchmove', e => {
      if (!gesture) return;
      if (e.cancelable) e.preventDefault();
      if (gesture.kind === 'pinch' && e.touches.length === 2) {
        const s = clamp(gesture.s * dist(e.touches) / gesture.d, 1, MAX_SCALE), [mx, my] = mid(e.touches);
        const r = view.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, k = s / gesture.s;
        state.s = s;
        state.x = mx - cx - k * (gesture.mx - cx - gesture.x);
        state.y = my - cy - k * (gesture.my - cy - gesture.y);
        apply();
      } else if (gesture.kind === 'drag' && e.touches.length === 1) {
        const t = e.touches[0], dx = t.clientX - gesture.sx, dy = t.clientY - gesture.sy;
        if (Math.hypot(dx, dy) > 8) gesture.moved = true;
        if (state.s > 1) {state.x = gesture.x + dx; state.y = gesture.y + dy; apply();}
      }
    }, {passive: false});
    view.addEventListener('touchend', e => {
      const g = gesture;
      if (e.touches.length) {gesture = null; return;}
      gesture = null;
      if (g?.kind === 'drag' && !g.moved && performance.now() - g.time < 300) {
        const now = performance.now();
        if (now - lastTap.time < 320 && Math.hypot(g.sx - lastTap.x, g.sy - lastTap.y) < 30) {
          if (state.s > 1) {state.s = 1; state.x = state.y = 0; apply();}
          else zoomAt(DOUBLE_TAP_SCALE, g.sx, g.sy);
          lastTap.time = 0;
        } else lastTap = {time: now, x: g.sx, y: g.sy};
      }
    }, {passive: true});
    box.addEventListener('click', e => {if (e.target === box) box.close();});
    box.addEventListener('close', () => pan.replaceChildren());
    narrow.addEventListener('change', () => {if (!narrow.matches && box.open) box.close();});
  }
  function open(figure) {
    if (!box) build();
    const copy = figure.cloneNode(true);
    copy.removeAttribute('hidden');
    copy.removeAttribute('style');
    copy.style.cssText = 'display:block;width:100%;height:auto;max-height:none';
    pan.replaceChildren(copy);
    state = {s: 1, x: 0, y: 0};
    pan.style.transform = '';
    box.showModal();
  }
  document.addEventListener('paper-tap', e => {
    if (!narrow.matches || (box?.open)) return;
    const {x, y, target} = e.detail;
    if (target?.closest?.('button,a,dialog,.page-nav')) return;
    for (const page of document.querySelectorAll('.animation-page')) {
      const stage = page.querySelector('.slide-stage'), bounds = stage.getBoundingClientRect();
      if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
      for (const figure of page.querySelectorAll('.slide-mobile > svg.mobile-art')) {
        if (figure.hidden || !figure.querySelector('image')) continue;
        const r = figure.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {open(figure); return;}
      }
    }
  });
})();
