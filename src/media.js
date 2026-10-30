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
    g.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 900; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    const bar = (h - w / 2.39) / 2; g.fillStyle = '#000'; g.fillRect(0, 0, w, bar); g.fillRect(0, h - bar, w, bar);
  }
  drawPoster(t) {
    const g = this.ctx, w = this.canvas.width, h = this.canvas.height, p = this.poster;
    /* blurred, darkened poster fills the frame (rendered once and cached: canvas blur is expensive) */
    if (!this.bgCache || this.bgCache.src !== p) {
      const bg = document.createElement('canvas'); bg.width = w; bg.height = h; const bgx = bg.getContext('2d');
      bgx.filter = 'blur(28px) brightness(.45)';
      const cover = Math.max(w / p.width, h / p.height) * 1.15;
      bgx.drawImage(p, (w - p.width * cover) / 2, (h - p.height * cover) / 2, p.width * cover, p.height * cover);
      this.bgCache = { src: p, canvas: bg };
    }
    g.drawImage(this.bgCache.canvas, 0, 0);
    const ph = h * 0.86, pw = ph * p.width / p.height, px = (w - pw) / 2, py = (h - ph) / 2;
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 40; g.fillStyle = '#000'; g.fillRect(px, py, pw, ph); g.shadowBlur = 0;
    g.drawImage(p, px, py, pw, ph);
    g.textAlign = 'left'; g.fillStyle = 'rgba(255,248,230,.95)'; g.font = "800 44px 'Noto Sans Tamil',sans-serif"; g.fillText('மெய்யழகன்', px + pw + 50, h * 0.42);
    g.fillStyle = 'rgba(255,248,230,.75)'; g.font = '600 24px Inter,sans-serif'; g.fillText('MEIYAZHAGAN', px + pw + 52, h * 0.48);
    g.font = '400 18px Inter,sans-serif'; g.fillText('Karthi · Arvind Swamy', px + pw + 52, h * 0.54); g.fillText('A film by C. Prem Kumar', px + pw + 52, h * 0.585);
    g.fillStyle = 'rgba(255,248,230,.6)'; g.font = '500 20px Inter,sans-serif'; g.fillText('NOW SHOWING', px + pw + 52, h * 0.34);
    const dot = 0.5 + 0.5 * Math.sin(t * 2); g.fillStyle = `rgba(229,49,74,${dot})`; g.beginPath(); g.arc(px + pw + 40, h * 0.33, 6, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '600 34px Inter,sans-serif'; g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 6;
    const sub = 'If you can read this subtitle easily, the seat is fine.';
    g.strokeText(sub, w / 2, h * 0.95); g.fillText(sub, w / 2, h * 0.95);
  }
}
