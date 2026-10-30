// What plays on the screen: a procedural animated trailer frame by default, or any image / video the user drops in.
import * as THREE from 'three';

export class ScreenMedia {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = 1280; this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d');
    this.canvasTex = new THREE.CanvasTexture(this.canvas); this.canvasTex.colorSpace = THREE.SRGBColorSpace;
    this.texture = this.canvasTex; this.video = null; this.last = 0;
    this.onchange = null;
  }
  tick(now) {
    if (this.video) return;                       // VideoTexture updates itself
    if (now - this.last < 80) return; this.last = now;
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
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1b3a'); sky.addColorStop(.55, '#d9663a'); sky.addColorStop(1, '#f7c56a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const sx = w * 0.5 + Math.sin(t * 0.15) * w * 0.12, sy = h * 0.58 + Math.cos(t * 0.1) * 14;
    const sun = g.createRadialGradient(sx, sy, 10, sx, sy, 180);
    sun.addColorStop(0, 'rgba(255,240,200,1)'); sun.addColorStop(.3, 'rgba(255,180,90,.8)'); sun.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = ['#2b1a2c', '#1d1220', '#120b14'][layer]; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 40) g.lineTo(x, h * (0.62 + layer * 0.1) - Math.abs(Math.sin(x * 0.011 + layer * 2 + t * 0.02)) * 120 * (1 - layer * 0.2));
      g.lineTo(w, h); g.closePath(); g.fill();
    }
    const rx = w * 0.2 + ((t * 25) % (w * 0.6)), ry = h * 0.74;
    g.fillStyle = '#000'; g.beginPath(); g.ellipse(rx, ry, 10, 26, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(rx, ry - 36, 9, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,.92)'; g.font = '700 86px Georgia,serif'; g.fillText('THE LAST HORIZON', w / 2, h * 0.3);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '300 28px sans-serif'; g.fillText('A SHOW STUDIOS PICTURE', w / 2, h * 0.36);
    g.fillStyle = '#fff'; g.font = '600 34px sans-serif'; g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 6;
    const sub = 'If you can read this subtitle easily, the seat is fine.';
    g.strokeText(sub, w / 2, h * 0.86); g.fillText(sub, w / 2, h * 0.86);
    /* cinematic finish: vignette, film grain and 2.39:1 letterbox bars */
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 900; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    const bar = (h - w / 2.39) / 2; g.fillStyle = '#000'; g.fillRect(0, 0, w, bar); g.fillRect(0, h - bar, w, bar);
  }
}
