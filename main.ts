// Neon Sunset Cover Studio — the hand-in program for gta6-cover-art-01 (Node 22, standard library only).
//
// The entry is the app/ folder beside this file: a static, offline web app (app/index.html plus its ES modules,
// two OFL display fonts under app/fonts/, and four sample photos under app/samples/) that turns a person's own
// photos and a caption into multi-panel, sunset-graded cover art and exports it as a PNG at 1080 x 1080,
// 1080 x 1350 or 1920 x 1080. This program copies app/ and screenshots/ into /output and writes
// /output/dossier.json with the kit's buildDossier, exactly as the starter's plumbing did.
//
// Try the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

console.log(`Neon Sunset Cover Studio handed in: app/ and screenshots/ copied to ${out}, dossier.json written.`);
