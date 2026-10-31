# Plotopia — see the screen from your seat

A 3D seat-preview for movie-booking sites. Tap any seat and the camera drops into that seat's eye position, looking at the screen, with a view score, head-occlusion check, compare mode and a UPI checkout (Google Pay, test mode).

Live: https://praneet-admin.github.io/plotopia/

## Develop
```bash
npm install
npm run build      # bundles src/ + three.js into dist/app.js (what index.html loads)
npm run dev        # serves on http://localhost:8792
```
Edit files under `src/`, run `npm run build`, commit `dist/app.js` with the change. No CDN is needed at runtime except Google Fonts and the film poster.

- `src/halls.js` hall geometry and price tiers (data; add a venue here)
- `src/scene.js` builds the hall (merged geometry, proxies for picking and sightlines)
- `src/metrics.js` sightline maths and scoring (SMPTE/THX angles, raycast occlusion)
- `src/media.js` what plays on the screen (poster, drop-in image or video)
- `src/payment.js` UPI QR checkout and ticket
- `src/app.js` controller, modes, seat map, share links, lite mode

## Audience models
The seated audience is baked from Quaternius's CC0 **Universal Base Characters** and **Universal Animation Library** (`Sitting_Idle_Loop`, `Sitting_Talking_Loop`). See `assets/people/CREDITS.md`. To rebake: `cd tools && npm install && RATIO=1 node bake.mjs <UniversalBaseCharacters dir> <UAL1_Standard.glb> out-hi` (and `RATIO=0.22 … out-lo`), then copy `out-*/people.*` to `assets/people/people-hi.*` / `people-lo.*`.

Phones start in lite graphics (no shadows or bloom); toggle under the ⋯ menu. The URL hash carries hall, seat and mode, e.g. `#hall=imax&seat=L5&view=seat`.
