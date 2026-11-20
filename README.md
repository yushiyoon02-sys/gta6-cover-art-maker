# Neon Sunset Cover Studio

An original cover-art maker built for the make.fun bounty
[gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01): it turns a
person's own photos and a caption into multi-panel, sunset-graded poster
art — bold display lettering, a glowing script subtitle, and a Vice City
sunset or neon colour wash — and exports it as a PNG ready to post.

## What it does

- **Any photo, several panels.** Add photos from your own machine (they
  are read locally with FileReader and never uploaded), or start from the
  three built-in samples. One photo can fill every panel, or each panel
  can carry its own.
- **Four poster layouts.** 2 × 2 grid, hero + two, three vertical strips,
  and full bleed, all with the thin white gutters of a game box.
- **Frame each panel.** Click a panel to select it, drag to pan, scroll
  or use the slider to zoom; arrow keys nudge. Every photo is cover-fit
  into its panel, so corners are never left empty.
- **Caption lettering.** A big auto-fitting title in Anton with a dark
  outline, drop shadow and a sunset or neon gradient fill, plus a
  Pacifico script subtitle with a neon glow. Position (top, center,
  bottom) and title size are adjustable. Both fonts are SIL Open Font
  License and ship with the app under `app/fonts/`.
- **Three colour grades.** Vice sunset (warm pink and orange), neon
  night (cyan and magenta), and clean — applied as a per-photo canvas
  filter plus a gradient wash and vignette over the whole poster.
- **Post-ready export.** One click saves a PNG at 1080 × 1080,
  1080 × 1350 or 1920 × 1080, rendered offscreen at full size. The live
  preview is the same drawing, so what you see is what you save.

## Run it

The app is plain static files under `app/` — no build step, no network.
Serve it with any static server, or use the kit's:

```sh
node serve.ts   # then open http://localhost:8080
```

Hand it in the make.fun way:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `buildDossier`.

## Notes

- Original throughout: no Rockstar Games logo, wordmark, artwork,
  characters or fonts anywhere in the app or its output.
- The three sample photos in `app/samples/` were made with an image
  model for this app and are free to use.
- Everything the page loads is a file under `app/`; it works fully
  offline in desktop Chrome.

More about the competition: <https://make.fun>
