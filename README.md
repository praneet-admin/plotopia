# Show — see the screen from your seat

A 3D seat-preview for movie-booking sites. Click any seat on the map (or in the hall) and the camera drops into that seat's eye position, looking at the screen, so a buyer knows exactly what they are paying for.

## Run

```bash
python3 -m http.server 8792 --directory .
```
Open http://localhost:8792. ES modules need http, not file://. Three.js loads from jsDelivr (r160), nothing to install.

## What it does
- **Halls** are data (`src/halls.js`): screen size and aspect, first-row distance, row pitch, riser height, flat rows, categories and prices. Three presets ship: Audi 3 (standard), Audi 1 (large, scope screen) and IMAX (steep rake).
- **Seat view**: drag to look around, arrow keys hop to neighbouring free seats, Esc returns to the hall. On phones a Gyro button lets you look around by moving the phone.
- **Sightline score** (`src/metrics.js`): horizontal viewing angle (SMPTE ≥30° / THX ≥36°, ideal 34–58°), off-axis angle, look-up angle to the centre and the top of the screen (SMPTE ≤35°), distance, and **screen visible past heads**, computed by raycasting from the eye to a grid of points on the screen through the occupants and seat backs in front. Occupants are real meshes, so what blocks the screen in the 3D view is what the number says.
- **Heatmap** colours every seat by score. **Best available** jumps to the top seat and outlines the top six.
- **Compare**: pin a seat, pick another, see both points of view side by side (top/bottom on phones).
- **Trailer**: drop an image or video onto the hall, or use the Trailer button, to put your own content on the screen. The default is a procedural animated frame with a subtitle line, so legibility from the back rows is judged honestly.
- **Share**: the URL hash carries hall, seat, pinned seat and mode, so a link reopens the exact view.

## Integrating with a booking site
Booking pages already know the hall and the seat ids. Render Show in an iframe or a modal, pass `#hall=<id>&seat=<id>`, and listen for the Book button (currently a demo toast in `src/app.js`). Replace the hall presets with the venue's real geometry: screen width, row distances and riser heights are all a cinema already has on its drawings.

## Files
- `index.html`, `style.css`: shell and layout (desktop: map on the right; phones: map below).
- `src/app.js`: modes, picking, seat map, compare renderer, gyro, media, share links.
- `src/scene.js`: builds the hall meshes, lights and shadows for a hall definition.
- `src/metrics.js`: pure sightline maths and scoring.
- `src/media.js`: what plays on the screen.
