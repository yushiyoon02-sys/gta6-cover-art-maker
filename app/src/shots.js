// Fixed scenes for screenshots, driven by the query string so a headless
// browser can photograph the real app: ?shot=cover hides the controls and
// shows only the finished poster (the app's own drawing of an exported
// cover), ?shot=editor shows the whole studio at work. The scene is set
// with layout, size, grade, title, subtitle, captionpos, captionstyle and
// photos (a comma list of sample names, one per panel in order). The
// display fonts are awaited before painting, and window.__shotReady is
// set once the scene is on screen.

import { panelsForLayout } from './cover.js';

export async function runShot(query, app) {
  const { state, redraw, loadSample, controls } = app;
  const shot = query.get('shot');
  if (shot === 'cover') document.body.classList.add('shot-cover');

  state.layout = query.get('layout') ?? 'grid';
  state.size = query.get('size') ?? 'square';
  state.grade = query.get('grade') ?? 'sunset';
  state.title = query.get('title') ?? 'Sunset Heist';
  state.subtitle = query.get('subtitle') ?? 'welcome to the coast';
  state.captionPos = query.get('captionpos') ?? 'bottom';
  state.captionStyle = query.get('captionstyle') ?? 'sunset';
  state.captionSize = Number(query.get('captionsize') ?? '1') || 1;
  state.selected = shot === 'cover' ? -1 : 0;

  controls.titleInput.value = state.title;
  controls.subtitleInput.value = state.subtitle;
  controls.captionPosSelect.value = state.captionPos;
  controls.captionStyleSelect.value = state.captionStyle;
  controls.captionSizeSlider.value = String(state.captionSize);

  const names = (query.get('photos') ?? 'boulevard').split(',').map((s) => s.trim()).filter(Boolean);
  for (const name of names) await loadSample(name);

  state.panels = panelsForLayout(state.layout);
  state.panels.forEach((panel, i) => {
    panel.photo = state.photos.length ? i % state.photos.length : 0;
  });

  await Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('60px Pacifico'),
  ]).catch(() => {});

  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
