// Neon Sunset Cover Studio — the cover renderer.
//
// Everything the poster is made of is drawn here onto a 2D canvas at the
// export's own pixel size: the multi-panel layout with its white gutters,
// each photo cover-fitted into its panel (zoom + pan, and an optional
// per-panel colour grade), the poster's colour grade (a canvas filter per
// photo plus a gradient wash and vignette over the whole poster), and the
// caption — either a big display title with an outline, a drop shadow and
// a sunset-gradient fill under a glowing script subtitle, or the same
// title set on a solid dark band with plain small capitals. The editor
// preview and the exported PNG come from this one function, so what you
// see is exactly what you save.

/** The three post sizes the studio exports, in pixels. */
export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  landscape: { label: 'Landscape 1920 x 1080', w: 1920, h: 1080 },
};

/**
 * Panel layouts as rectangles in 0..1 poster coordinates. Panels tile the
 * whole poster; a thin white gutter is cut between them at draw time.
 */
export const LAYOUTS = {
  grid: {
    label: '2 x 2 grid',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  hero: {
    label: 'Hero + two',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
  strips: {
    label: 'Three strips',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  single: {
    label: 'Full bleed',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
};

/** Colour grades: a per-photo canvas filter plus a wash over the poster. */
export const GRADES = {
  sunset: {
    label: 'Vice sunset',
    filter: 'saturate(1.45) contrast(1.12) brightness(1.05) hue-rotate(-8deg)',
    wash: [
      [0, 'rgba(255, 150, 60, 0.20)'],
      [0.55, 'rgba(255, 90, 120, 0.16)'],
      [1, 'rgba(190, 30, 115, 0.38)'],
    ],
    vignette: 0.38,
  },
  neon: {
    label: 'Neon night',
    filter: 'saturate(1.9) contrast(1.28) brightness(0.99) hue-rotate(12deg)',
    wash: [
      [0, 'rgba(0, 215, 255, 0.22)'],
      [0.5, 'rgba(120, 60, 255, 0.14)'],
      [1, 'rgba(255, 0, 165, 0.32)'],
    ],
    vignette: 0.52,
  },
  clean: {
    label: 'Clean',
    filter: 'saturate(1.12) contrast(1.06) brightness(1.01)',
    wash: null,
    vignette: 0.18,
  },
  dusk: {
    label: 'Muted dusk',
    filter: 'saturate(0.8) contrast(1.08) brightness(0.94)',
    wash: [
      [0, 'rgba(40, 60, 110, 0.10)'],
      [1, 'rgba(10, 16, 40, 0.22)'],
    ],
    vignette: 0.3,
  },
};

/** Caption fill styles for the big title. */
export const CAPTION_STYLES = {
  sunset: { label: 'Sunset gradient', stops: ['#ffe259', '#ffa751', '#ff4e8a'] },
  neon: { label: 'Neon gradient', stops: ['#7df9ff', '#4d7cff', '#ff4dd8'] },
  white: { label: 'Clean white', stops: ['#ffffff', '#ffffff'] },
};

/** A fresh panel: first photo, cover-fit zoom, centred. */
export function freshPanel(photoIndex = 0) {
  return { photo: photoIndex, zoom: 1, panX: 0, panY: 0 };
}

/** Panels for a layout, keeping any existing panel settings that still fit. */
export function panelsForLayout(layoutKey, previous = []) {
  return LAYOUTS[layoutKey].panels.map((_, i) => previous[i] ?? freshPanel(Math.min(i, 0)));
}

/**
 * The pixel rectangle of panel `index` on a `w` x `h` poster, inset by
 * half the gutter on every side so neighbouring panels share one line.
 */
export function panelRect(layoutKey, index, w, h) {
  const p = LAYOUTS[layoutKey].panels[index];
  const gutter = Math.max(4, Math.round(Math.min(w, h) * 0.009));
  const half = gutter / 2;
  return {
    x: p.x * w + half,
    y: p.y * h + half,
    w: p.w * w - gutter,
    h: p.h * h - gutter,
  };
}

/** Which panel (if any) sits under poster-normalised point (nx, ny)? */
export function panelAt(layoutKey, nx, ny) {
  const panels = LAYOUTS[layoutKey].panels;
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    if (nx >= p.x && nx < p.x + p.w && ny >= p.y && ny < p.y + p.h) return i;
  }
  return -1;
}

/**
 * Cover-fit maths: where to draw `img` so it fills `rect` at `zoom`
 * (1 = just covering) shifted by `panX`/`panY`, each in -1..1 across the
 * slack the zoom leaves. Pan is clamped so the photo never uncovers a
 * corner of its panel.
 */
export function coverFit(rect, img, zoom, panX, panY) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * Math.max(1, zoom);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const slackX = Math.max(0, (dw - rect.w) / 2);
  const slackY = Math.max(0, (dh - rect.h) / 2);
  const cx = Math.min(1, Math.max(-1, panX));
  const cy = Math.min(1, Math.max(-1, panY));
  return {
    x: rect.x + rect.w / 2 - dw / 2 - cx * slackX,
    y: rect.y + rect.h / 2 - dh / 2 - cy * slackY,
    w: dw,
    h: dh,
  };
}

/** Draws one panel: its photo (or a sunset placeholder), clipped to the panel.
 *  `tone.boost` appends an extra filter (the hero panel runs brighter);
 *  `tone.dim` lays a dark veil over the photo (the side panels step back). */
function drawPanel(ctx, rect, img, panel, grade, tone = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (img) {
    const fit = coverFit(rect, img, panel.zoom, panel.panX, panel.panY);
    ctx.filter = grade.filter + (tone.boost ?? '');
    ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
    ctx.filter = 'none';
    if (tone.dim) {
      ctx.fillStyle = `rgba(8, 2, 20, ${tone.dim})`;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  } else {
    const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    sky.addColorStop(0, '#3b1d5e');
    sky.addColorStop(0.55, '#c73e7d');
    sky.addColorStop(1, '#ff9a3d');
    ctx.fillStyle = sky;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `${Math.round(Math.min(rect.w, rect.h) * 0.09)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  ctx.restore();
}

/** The grade's wash and vignette over the whole poster. */
function drawGradeWash(ctx, w, h, grade) {
  if (grade.wash) {
    const wash = ctx.createLinearGradient(0, 0, w * 0.35, h);
    for (const [at, colour] of grade.wash) wash.addColorStop(at, colour);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(10, 4, 24, 0)');
  vig.addColorStop(1, `rgba(10, 4, 24, ${grade.vignette})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** A soft dark fade behind the caption so the lettering always reads.
 *  Drawn only across the caption's own span (x0..x1): in the hero layout
 *  that is the big panel alone, so the side panels stay untouched. */
function drawCaptionShade(ctx, w, h, position, x0 = 0, x1 = w) {
  const depth = h * 0.42;
  const span = x1 - x0;
  let shade;
  if (position === 'top') {
    shade = ctx.createLinearGradient(0, 0, 0, depth);
    shade.addColorStop(0, 'rgba(12, 4, 28, 0.62)');
    shade.addColorStop(1, 'rgba(12, 4, 28, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(x0, 0, span, depth);
  } else if (position === 'center') {
    shade = ctx.createLinearGradient(0, h / 2 - depth / 2, 0, h / 2 + depth / 2);
    shade.addColorStop(0, 'rgba(12, 4, 28, 0)');
    shade.addColorStop(0.5, 'rgba(12, 4, 28, 0.5)');
    shade.addColorStop(1, 'rgba(12, 4, 28, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(x0, h / 2 - depth / 2, span, depth);
  } else {
    shade = ctx.createLinearGradient(0, h - depth, 0, h);
    shade.addColorStop(0, 'rgba(12, 4, 28, 0)');
    shade.addColorStop(1, 'rgba(12, 4, 28, 0.66)');
    ctx.fillStyle = shade;
    ctx.fillRect(x0, h - depth, span, depth);
  }
}

/**
 * Where the caption may sit, per layout: a centre x and a max width for
 * the big title and for the script subtitle, plus the shade's span. The
 * subtitle is kept inside one panel's span so it never straddles a
 * gutter line; in the hero layout the whole caption — shade included —
 * lives on the big panel. The title re-typesets to its zone on every
 * canvas size, so each export size gets its own fitting.
 */
function captionZones(layoutKey, w) {
  const full = { cx: w / 2, maxW: w * 0.92 };
  if (layoutKey === 'hero') {
    const heroW = LAYOUTS.hero.panels[0].w * w;
    const zone = { cx: heroW / 2, maxW: heroW * 0.92 };
    return { title: zone, subtitle: zone, shade: { x0: 0, x1: heroW } };
  }
  if (layoutKey === 'strips') {
    return { title: full, subtitle: { cx: w / 2, maxW: (w / 3) * 0.94 }, shade: { x0: 0, x1: w } };
  }
  if (layoutKey === 'grid') {
    return { title: full, subtitle: { cx: w * 0.25, maxW: w * 0.5 * 0.92 }, shade: { x0: 0, x1: w } };
  }
  return { title: full, subtitle: full, shade: { x0: 0, x1: w } };
}

/** A soft dark backdrop behind the script subtitle, so it always sits on
 *  a clean patch of poster however busy the photo underneath is. */
function drawSubtitleBackdrop(ctx, cx, baselineY, textW, subSize) {
  const padX = subSize * 0.55;
  const padTop = subSize * 1.05;
  const padBottom = subSize * 0.42;
  const x = cx - textW / 2 - padX;
  const y = baselineY - padTop;
  const bw = textW + padX * 2;
  const bh = padTop + padBottom;
  ctx.save();
  ctx.shadowColor = 'rgba(12, 4, 28, 0.55)';
  ctx.shadowBlur = subSize * 0.5;
  ctx.fillStyle = 'rgba(12, 4, 28, 0.38)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, bw, bh, bh / 2);
  else ctx.rect(x, y, bw, bh);
  ctx.fill();
  ctx.restore();
}

/**
 * Fits the big title into `maxWidth`: wraps onto at most two lines at the
 * split that keeps the widest line narrowest, then shrinks the Anton size
 * until every line fits. Returns the lines and the fitted size. Shared by
 * the overlay caption and the dark-band caption so both re-typeset the
 * same way on every canvas size.
 */
function fitTitle(ctx, title, maxWidth, baseSize) {
  let size = baseSize;
  const setFont = (s) => { ctx.font = `${s}px Anton, sans-serif`; };
  setFont(size);
  let lines = [title];
  if (ctx.measureText(title).width > maxWidth) {
    const words = title.split(/\s+/);
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const widest = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
      if (!best || widest < best.widest) best = { lines: [a, b], widest };
    }
    if (best && best.widest < ctx.measureText(title).width) lines = best.lines;
    while (size > 20 && Math.max(...lines.map((l) => ctx.measureText(l).width)) > maxWidth) {
      size -= 4;
      setFont(size);
    }
  }
  return { lines, size };
}

/**
 * Draws the caption: the script subtitle glowing over the big display
 * title. Both are typeset into their layout zone (see captionZones) and
 * fitted to the canvas at hand, so every export size re-typesets from
 * scratch. The title auto-fits its zone width, then the size slider
 * scales it; long titles wrap onto two lines. The subtitle shrinks to
 * its own zone so it stays inside one panel, on its clean backdrop.
 */
function drawCaption(ctx, w, h, state) {
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim();
  if (!title && !subtitle) return;
  const zones = captionZones(state.layout, w);
  drawCaptionShade(ctx, w, h, state.captionPos, zones.shade.x0, zones.shade.x1);

  const scale = state.captionSize ?? 1;
  const baseSize = Math.min(w, h) * 0.16 * scale;
  const maxWidth = zones.title.maxW;
  const setTitleFont = (s) => { ctx.font = `${s}px Anton, sans-serif`; };

  let lines = [title];
  let size = baseSize;
  if (title) {
    ({ lines, size } = fitTitle(ctx, title, maxWidth, baseSize));
  }

  const lineHeight = size * 1.04;
  let subSize = Math.max(18, size * 0.42);
  if (subtitle) {
    ctx.font = `${subSize}px Pacifico, cursive`;
    const subW = ctx.measureText(subtitle).width;
    if (subW > zones.subtitle.maxW) {
      subSize = Math.max(14, subSize * (zones.subtitle.maxW / subW));
      ctx.font = `${subSize}px Pacifico, cursive`;
    }
  }
  const blockH = (title ? lines.length * lineHeight : 0) + (subtitle ? subSize * 1.25 : 0);
  const margin = h * 0.055;
  let top;
  if (state.captionPos === 'top') top = margin;
  else if (state.captionPos === 'center') top = (h - blockH) / 2;
  else top = h - margin - blockH;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = top;

  if (subtitle) {
    ctx.font = `${subSize}px Pacifico, cursive`;
    y += subSize;
    drawSubtitleBackdrop(ctx, zones.subtitle.cx, y, ctx.measureText(subtitle).width, subSize);
    ctx.save();
    ctx.shadowColor = '#ff4dd8';
    ctx.shadowBlur = subSize * 0.55;
    ctx.fillStyle = '#fff6ff';
    ctx.fillText(subtitle, zones.subtitle.cx, y);
    ctx.restore();
    y += subSize * 0.25;
  }

  if (title) {
    setTitleFont(size);
    const style = CAPTION_STYLES[state.captionStyle] ?? CAPTION_STYLES.sunset;
    for (const line of lines) {
      y += lineHeight;
      const grad = ctx.createLinearGradient(0, y - size, 0, y);
      style.stops.forEach((colour, i) => grad.addColorStop(style.stops.length === 1 ? 0 : i / (style.stops.length - 1), colour));
      ctx.save();
      ctx.shadowColor = 'rgba(8, 2, 20, 0.65)';
      ctx.shadowBlur = size * 0.16;
      ctx.shadowOffsetY = size * 0.07;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1a0b2e';
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.strokeText(line, zones.title.cx, y);
      ctx.fillStyle = grad;
      ctx.fillText(line, zones.title.cx, y);
      ctx.restore();
    }
  }
}

/**
 * The dark-band caption: the title (at most two lines) sits on a solid
 * dark band across the poster's foot (or head, per captionPos), with the
 * subtitle as small plain capitals inside the band — no script lettering
 * over the photos. The band is a near-opaque vertical gradient with a
 * thin sunset accent rule on its inner edge, so the lettering stays
 * readable however small the poster is shown.
 */
function drawCaptionBand(ctx, w, h, state) {
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim().toUpperCase();
  if (!title && !subtitle) return;

  const scale = state.captionSize ?? 1;
  const maxWidth = w * 0.9;
  let lines = [];
  let size = Math.min(w, h) * 0.13 * scale;
  if (title) ({ lines, size } = fitTitle(ctx, title, maxWidth, size));
  const lineHeight = size * 1.06;
  const subSize = Math.max(16, size * 0.3);
  const padY = size * 0.42;
  const bandH = padY * 2 + lines.length * lineHeight + (subtitle ? subSize * 1.5 : 0);
  const atTop = state.captionPos === 'top';
  const bandY = atTop ? 0 : h - bandH;

  // The band itself: dark gradient, denser at the outer edge.
  const band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (atTop) {
    band.addColorStop(0, 'rgba(9, 4, 20, 0.96)');
    band.addColorStop(1, 'rgba(9, 4, 20, 0.86)');
  } else {
    band.addColorStop(0, 'rgba(9, 4, 20, 0.86)');
    band.addColorStop(1, 'rgba(9, 4, 20, 0.96)');
  }
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);

  // A thin sunset rule on the band's inner edge.
  const ruleY = atTop ? bandY + bandH : bandY;
  const rule = ctx.createLinearGradient(0, 0, w, 0);
  rule.addColorStop(0, '#ff4e8a');
  rule.addColorStop(0.5, '#ffa751');
  rule.addColorStop(1, '#ffe259');
  ctx.fillStyle = rule;
  ctx.fillRect(0, atTop ? ruleY - Math.max(3, h * 0.004) : ruleY, w, Math.max(3, h * 0.004));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = bandY + padY;

  if (title) {
    ctx.font = `${size}px Anton, sans-serif`;
    const style = CAPTION_STYLES[state.captionStyle] ?? CAPTION_STYLES.sunset;
    for (const line of lines) {
      y += lineHeight;
      const grad = ctx.createLinearGradient(0, y - size, 0, y);
      style.stops.forEach((colour, i) => grad.addColorStop(style.stops.length === 1 ? 0 : i / (style.stops.length - 1), colour));
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = size * 0.12;
      ctx.shadowOffsetY = size * 0.05;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#12061f';
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.strokeText(line, w / 2, y);
      ctx.fillStyle = grad;
      ctx.fillText(line, w / 2, y);
      ctx.restore();
    }
  }

  if (subtitle) {
    y += subSize * 1.5;
    ctx.save();
    ctx.font = `${subSize}px Anton, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.18)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#f5ead9';
    ctx.fillText(subtitle, w / 2, y);
    ctx.restore();
  }
}

/**
 * Draws the whole cover onto `canvas` at the canvas's own size.
 * `state`: { photos, panels, layout, grade, title, subtitle, captionPos,
 * captionSize, captionStyle, captionMode, selected }. A panel may carry
 * its own `grade` key to override the poster's grade for that photo.
 * With `forExport` the selection outline is left off.
 */
export function drawCover(canvas, state, forExport = false) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;

  ctx.fillStyle = '#f5f1e8';
  ctx.fillRect(0, 0, w, h);

  const count = LAYOUTS[state.layout].panels.length;
  const heroLayout = state.layout === 'hero';
  for (let i = 0; i < count; i++) {
    const rect = panelRect(state.layout, i, w, h);
    const panel = state.panels[i] ?? freshPanel(0);
    const img = state.photos[panel.photo] ?? state.photos[0] ?? null;
    // A panel may override the poster's grade (e.g. one muted panel
    // among saturated ones); the wash still comes from the poster grade.
    const panelGrade = GRADES[panel.grade] ?? grade;
    // In the hero layout the big panel is the poster's focal point: it
    // runs a touch brighter while the side panels step back under a veil.
    const tone = heroLayout ? (i === 0 ? { boost: ' brightness(1.07)' } : { dim: 0.13 }) : {};
    drawPanel(ctx, rect, img, panel, panelGrade, tone);
  }

  drawGradeWash(ctx, w, h, grade);
  if (state.captionMode === 'band') drawCaptionBand(ctx, w, h, state);
  else drawCaption(ctx, w, h, state);

  if (!forExport && state.selected >= 0 && state.selected < count) {
    const rect = panelRect(state.layout, state.selected, w, h);
    ctx.save();
    ctx.strokeStyle = '#ff4dd8';
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.005);
    ctx.setLineDash([Math.min(w, h) * 0.02, Math.min(w, h) * 0.012]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

/** Renders the cover to a fresh offscreen canvas at full export size. */
export function renderExport(state, sizeKey) {
  const size = SIZES[sizeKey];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state, true);
  return canvas;
}
