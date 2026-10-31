// What plays on the screen: a procedural animated trailer frame by default, or any image / video the user drops in.
import * as THREE from 'three';

export class ScreenMedia {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = 1280; this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d');
    this.canvasTex = new THREE.CanvasTexture(this.canvas); this.canvasTex.colorSpace = THREE.SRGBColorSpace;
    this.texture = this.canvasTex; this.video = null; this.last = 0;
    this.onchange = null;
    this.poster = null;
  }
  /** Official poster, fetched at runtime (not stored in this repo). Falls back to the drawn title card. */
  loadPoster(url) {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { this.poster = img; };
    img.src = url;
  }
  /** Average colour of what is on screen, for lighting the room like the film does. */
  averageColor() {
    try {
      this.avg ??= document.createElement('canvas'); this.avg.width = this.avg.height = 1; const g = this.avg.getContext('2d', { willReadFrequently: true });
      g.drawImage(this.video || this.canvas, 0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data;
      const c = new THREE.Color(d[0] / 255, d[1] / 255, d[2] / 255).convertSRGBToLinear();
      const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; if (l > 0) c.multiplyScalar(0.55 / Math.max(l, 0.2));   // keep brightness steady, take only the hue
      return c.lerp(new THREE.Color(0xc8dcff), 0.6);   // mostly neutral screen-white, with a hint of the film's hue
    } catch { return null; }
  }
  tick(now) {
    if (this.video) return;                       // VideoTexture updates itself
    if (now - this.last < (this.poster ? 250 : 80)) return; this.last = now;
    this.drawFrame(now / 1000); this.canvasTex.needsUpdate = true;
  }
  async load(file) {
    this.video?.pause(); this.video = null;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video'); v.src = url; v.loop = true; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
      await v.play(); this.video = v;
      const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace; this.swap(t);
    } else {
      const bmp = await createImageBitmap(file);
      const t = new THREE.CanvasTexture(bmp); t.colorSpace = THREE.SRGBColorSpace; this.swap(t);
    }
  }
  swap(t) { this.texture = t; this.onchange?.(t); }
  drawFrame(t) {
    const g = this.ctx, w = this.canvas.width, h = this.canvas.height;
    if (this.poster) return this.drawPoster(t);
    /* late-afternoon Thanjavur: warm sky, paddy fields, palms, two figures walking home */
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2a1a3a'); sky.addColorStop(.45, '#e0683a'); sky.addColorStop(.72, '#f6c35e'); sky.addColorStop(1, '#f9e2a0');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const sx = w * 0.62 + Math.sin(t * 0.08) * 20, sy = h * 0.64;
    const sun = g.createRadialGradient(sx, sy, 8, sx, sy, 160);
    sun.addColorStop(0, 'rgba(255,245,210,1)'); sun.addColorStop(.25, 'rgba(255,200,110,.85)'); sun.addColorStop(1, 'rgba(255,150,70,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f5a2a'; g.fillRect(0, h * 0.7, w, h * 0.3);                       // fields
    const field = g.createLinearGradient(0, h * 0.7, 0, h); field.addColorStop(0, 'rgba(255,200,90,.35)'); field.addColorStop(1, 'rgba(20,40,20,.6)');
    g.fillStyle = field; g.fillRect(0, h * 0.7, w, h * 0.3);
    g.strokeStyle = 'rgba(20,50,20,.5)'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(w * 0.5 + (i - 7) * 10, h * 0.7); g.lineTo(w * 0.5 + (i - 7) * 160, h); g.stroke(); }
    const palm = (x, y, sc) => {                                                           // palm silhouettes
      g.strokeStyle = '#1a1210'; g.lineWidth = 6 * sc; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10 * sc, y - 120 * sc, x + 25 * sc, y - 220 * sc); g.stroke();
      g.fillStyle = '#1a1210';
      for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42 + Math.sin(t * 0.6 + k) * 0.03; g.beginPath(); g.moveTo(x + 25 * sc, y - 220 * sc); g.quadraticCurveTo(x + 25 * sc + Math.cos(a) * 60 * sc, y - 220 * sc + Math.sin(a) * 60 * sc - 20 * sc, x + 25 * sc + Math.cos(a) * 110 * sc, y - 220 * sc + Math.sin(a) * 110 * sc + 30 * sc); g.lineTo(x + 25 * sc + Math.cos(a) * 80 * sc, y - 220 * sc + Math.sin(a) * 80 * sc + 10 * sc); g.fill(); }
    };
    palm(w * 0.08, h * 0.72, 1.1); palm(w * 0.18, h * 0.71, 0.8); palm(w * 0.9, h * 0.72, 1.0);
    const walk = (x, y, sc) => { g.fillStyle = '#1a1210'; g.beginPath(); g.ellipse(x, y, 9 * sc, 24 * sc, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x, y - 33 * sc, 8 * sc, 0, Math.PI * 2); g.fill(); };
    const wx = w * 0.3 + ((t * 14) % (w * 0.5));
    walk(wx, h * 0.78, 1.0); walk(wx + 34, h * 0.785, 1.05);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,248,230,.95)'; g.font = "800 92px 'Noto Sans Tamil',sans-serif"; g.fillText('மெய்யழகன்', w / 2, h * 0.31);
    g.fillStyle = 'rgba(255,248,230,.8)'; g.font = '600 30px Inter,sans-serif'; g.fillText('M E I Y A Z H A G A N', w / 2, h * 0.38);
    g.fillStyle = 'rgba(255,248,230,.7)'; g.font = '400 20px Inter,sans-serif'; g.fillText('KARTHI · ARVIND SWAMY   ·   A FILM BY C. PREM KUMAR   ·   MUSIC GOVIND VASANTHA', w / 2, h * 0.43);
    g.fillStyle = '#fff'; g.font = '600 34px Inter,sans-serif'; g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 6;
    const sub = 'If you can read this subtitle easily, the seat is fine.';
    g.strokeText(sub, w / 2, h * 0.86); g.fillText(sub, w / 2, h * 0.86);
    /* cinematic finish: vignette, film grain and 2.39:1 letterbox bars */
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }
  /** Cover-fit the poster into the frame, keeping the top (where the faces are), then unsharp-mask once. */
  buildCover(p, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
    const cover = Math.max(w / p.width, h / p.height); const dw = p.width * cover, dh = p.height * cover;
    g.imageSmoothingQuality = 'high'; g.filter = 'contrast(1.1) saturate(1.06)';
    g.drawImage(p, (w - dw) / 2, Math.min(0, -(dh - h) * 0.08), dw, dh);   // anchor near the top: faces, not shirts
    g.filter = 'none';
    const sharp = g.getImageData(0, 0, w, h), b = document.createElement('canvas'); b.width = w; b.height = h; const bg = b.getContext('2d');
    bg.filter = 'blur(2px)'; bg.drawImage(c, 0, 0); const blur = bg.getImageData(0, 0, w, h).data, d = sharp.data;
    for (let i = 0; i < d.length; i += 4) { for (let k = 0; k < 3; k++) { const v = d[i + k] + (d[i + k] - blur[i + k]) * 0.8; d[i + k] = v < 0 ? 0 : v > 255 ? 255 : v; } }
    g.putImageData(sharp, 0, 0); return c;
  }
  drawPoster(t) {
    const g = this.ctx, w = this.canvas.width, h = this.canvas.height, p = this.poster;
    /* the film fills the whole screen edge to edge (cover crop), like projection, not a slide */
    if (!this.coverCache || this.coverCache.src !== p) this.coverCache = { src: p, canvas: this.buildCover(p, w, h) };
    g.drawImage(this.coverCache.canvas, 0, 0);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '600 34px Inter,sans-serif'; g.strokeStyle = 'rgba(0,0,0,.95)'; g.lineWidth = 7; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 8;
    const sub = 'If you can read this subtitle easily, the seat is fine.';
    g.strokeText(sub, w / 2, h * 0.92); g.fillText(sub, w / 2, h * 0.92); g.shadowBlur = 0;
  }
}
