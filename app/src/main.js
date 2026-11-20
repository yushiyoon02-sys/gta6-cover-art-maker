// Neon Sunset Cover Studio — the editor wiring.
//
// State lives in one object (photos, panels, layout, size, grade and the
// caption), and every control edits it and redraws the live preview.
// Photos are read from the person's own machine with FileReader and kept
// as in-memory images; nothing is uploaded anywhere. Panels are picked
// by clicking them on the canvas, dragged to pan, and zoomed with the
// slider, the mouse wheel or the arrow keys. Export renders the same
// cover to an offscreen canvas at the full post size and saves a PNG.

import { SIZES, LAYOUTS, GRADES, CAPTION_STYLES, drawCover, renderExport, panelAt, panelsForLayout, freshPanel } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const thumbs = document.getElementById('thumbs');
const zoomSlider = document.getElementById('zoom');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const captionPosSelect = document.getElementById('caption-pos');
const captionSizeSlider = document.getElementById('caption-size');
const captionStyleSelect = document.getElementById('caption-style');

const state = {
  photos: [],          // HTMLImageElement[], in load order
  photoNames: [],      // a label per photo, for the thumbnail strip
  panels: panelsForLayout('grid'),
  layout: 'grid',
  size: 'square',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'welcome to the coast',
  captionPos: 'bottom',
  captionSize: 1,
  captionStyle: 'sunset',
  selected: 0,
};

/** Loads an image from a URL or data URI, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Reads one local file with FileReader and resolves to a drawable image. */
function readPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => loadImage(reader.result).then(resolve, reject);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Redraws the preview at the current post size and syncs the controls. */
function redraw() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  canvas.style.aspectRatio = `${size.w} / ${size.h}`;
  drawCover(canvas, state);
  const panel = state.panels[state.selected];
  if (panel) zoomSlider.value = String(panel.zoom);
  markActiveButtons();
}

/** Highlights the button of the current layout, size and grade. */
function markActiveButtons() {
  for (const [group, current] of [['layout', state.layout], ['size', state.size], ['grade', state.grade]]) {
    document.querySelectorAll(`[data-${group}]`).forEach((btn) => {
      btn.classList.toggle('active', btn.dataset[group] === current);
    });
  }
}

/** Rebuilds the thumbnail strip; clicking a thumb fills the selected panel. */
function refreshThumbs() {
  thumbs.replaceChildren();
  state.photos.forEach((img, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    btn.title = `Put ${state.photoNames[i]} in the selected panel`;
    const pic = document.createElement('img');
    pic.src = img.src;
    pic.alt = state.photoNames[i];
    btn.append(pic);
    btn.addEventListener('click', () => {
      const panel = state.panels[state.selected];
      if (panel) panel.photo = i;
      redraw();
    });
    thumbs.append(btn);
  });
}

/** Adds a loaded photo, fills empty panels in order, and redraws. */
function addPhoto(img, name) {
  state.photos.push(img);
  state.photoNames.push(name);
  const index = state.photos.length - 1;
  state.panels.forEach((panel, i) => {
    if (i === index % state.panels.length && state.photos.length <= state.panels.length) panel.photo = index;
  });
  refreshThumbs();
  redraw();
}

/** Loads one of the built-in sample photos by name (samples/<name>.jpg). */
export async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  addPhoto(img, name);
  return img;
}

// --- Photo picking -------------------------------------------------------
document.getElementById('photos').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    try {
      addPhoto(await readPhotoFile(file), file.name.replace(/\.[^.]+$/, ''));
    } catch {
      status.textContent = `Could not read ${file.name}`;
    }
  }
  e.target.value = '';
  if (files.length) status.textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded — click a panel, then a photo, to place it.`;
});

document.querySelectorAll('[data-sample]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await loadSample(btn.dataset.sample);
    status.textContent = `Sample “${btn.dataset.sample}” loaded.`;
  });
});

document.getElementById('fill-all').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  const photo = panel ? panel.photo : 0;
  state.panels = state.panels.map((p) => ({ ...p, photo }));
  redraw();
});

document.getElementById('spread').addEventListener('click', () => {
  state.panels = state.panels.map((p, i) => ({ ...p, photo: state.photos.length ? i % state.photos.length : 0 }));
  redraw();
});

// --- Layout, size, grade -------------------------------------------------
document.querySelectorAll('[data-layout]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.layout = btn.dataset.layout;
    state.panels = panelsForLayout(state.layout, state.panels);
    state.selected = Math.min(state.selected, state.panels.length - 1);
    redraw();
  });
});

document.querySelectorAll('[data-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.size = btn.dataset.size;
    redraw();
  });
});

document.querySelectorAll('[data-grade]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.grade = btn.dataset.grade;
    redraw();
  });
});

// --- Panel picking, panning, zooming -------------------------------------
let dragging = null;

function canvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    nx: (event.clientX - box.left) / box.width,
    ny: (event.clientY - box.top) / box.height,
    box,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  const { nx, ny } = canvasPoint(event);
  const index = panelAt(state.layout, nx, ny);
  if (index < 0) return;
  state.selected = index;
  const panel = state.panels[index];
  dragging = { x: event.clientX, y: event.clientY, panX: panel.panX, panY: panel.panY };
  canvas.setPointerCapture(event.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const { box } = canvasPoint(event);
  const panel = state.panels[state.selected];
  const rect = LAYOUTS[state.layout].panels[state.selected];
  // Dragging moves the photo with the pointer; pan is in -1..1 of the slack.
  panel.panX = dragging.panX - ((event.clientX - dragging.x) / box.width) / Math.max(0.05, rect.w) * 0.9;
  panel.panY = dragging.panY - ((event.clientY - dragging.y) / box.height) / Math.max(0.05, rect.h) * 0.9;
  panel.panX = Math.min(1, Math.max(-1, panel.panX));
  panel.panY = Math.min(1, Math.max(-1, panel.panY));
  redraw();
});

canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('pointercancel', () => { dragging = null; });

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * (event.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}, { passive: false });

zoomSlider.addEventListener('input', () => {
  const panel = state.panels[state.selected];
  if (panel) panel.zoom = Number(zoomSlider.value);
  redraw();
});

document.getElementById('reset-panel').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (panel) Object.assign(panel, freshPanel(panel.photo));
  redraw();
});

canvas.addEventListener('keydown', (event) => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  const step = 0.06;
  if (event.key === 'ArrowLeft') panel.panX -= step;
  else if (event.key === 'ArrowRight') panel.panX += step;
  else if (event.key === 'ArrowUp') panel.panY -= step;
  else if (event.key === 'ArrowDown') panel.panY += step;
  else if (event.key === '+' || event.key === '=') panel.zoom = Math.min(3, panel.zoom * 1.08);
  else if (event.key === '-') panel.zoom = Math.max(1, panel.zoom * 0.93);
  else return;
  event.preventDefault();
  panel.panX = Math.min(1, Math.max(-1, panel.panX));
  panel.panY = Math.min(1, Math.max(-1, panel.panY));
  redraw();
});

// --- Caption -------------------------------------------------------------
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
captionPosSelect.addEventListener('change', () => { state.captionPos = captionPosSelect.value; redraw(); });
captionSizeSlider.addEventListener('input', () => { state.captionSize = Number(captionSizeSlider.value); redraw(); });
captionStyleSelect.addEventListener('change', () => { state.captionStyle = captionStyleSelect.value; redraw(); });

// --- Export --------------------------------------------------------------
document.getElementById('export').addEventListener('click', () => {
  const out = renderExport(state, state.size);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-cover-${out.width}x${out.height}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved neon-cover-${out.width}x${out.height}.png`;
  }, 'image/png');
});

// --- Drag and drop -------------------------------------------------------
for (const type of ['dragenter', 'dragover']) {
  canvas.addEventListener(type, (event) => { event.preventDefault(); canvas.classList.add('dropping'); });
}
for (const type of ['dragleave', 'drop']) {
  canvas.addEventListener(type, (event) => { event.preventDefault(); canvas.classList.remove('dropping'); });
}
canvas.addEventListener('drop', async (event) => {
  for (const file of event.dataTransfer.files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      addPhoto(await readPhotoFile(file), file.name.replace(/\.[^.]+$/, ''));
    } catch {
      status.textContent = `Could not read ${file.name}`;
    }
  }
});

// --- Start ---------------------------------------------------------------
const query = new URLSearchParams(location.search);
if (query.get('shot')) {
  runShot(query, { state, redraw, loadSample, refreshThumbs, controls: { titleInput, subtitleInput, captionPosSelect, captionSizeSlider, captionStyleSelect } });
} else {
  redraw();
}
