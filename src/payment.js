// Plotopia checkout: a UPI QR with the amount prefilled, Google Pay as the only app option (test mode),
// then a ticket with its own QR. There is no bank callback here, so "I've paid" is the confirmation.
const UPI = { pa: 'nightriderpraneet@okaxis', pn: 'Plotopia' };
const $ = id => document.getElementById(id);

function upiLink(scheme, { amount, note, ref }) {
  const q = new URLSearchParams({ pa: UPI.pa, pn: UPI.pn, am: amount.toFixed(2), cu: 'INR', tn: note, tr: ref });
  return `${scheme}?${q}`;
}
async function drawQr(canvas, text, size) {
  await loadQrLib();
  const qr = window.qrcode(0, 'H'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), cell = Math.floor(size / (n + 2)), pad = Math.floor((size - cell * n) / 2);
  canvas.width = canvas.height = size; const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#111';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(pad + c * cell, pad + r * cell, cell, cell);
}
let qrLib;
function loadQrLib() {
  return (qrLib ??= new Promise((res, rej) => { if (window.qrcode) return res(); const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));
}
const isPhone = () => matchMedia('(pointer:coarse)').matches && /Android|iPhone|iPad/i.test(navigator.userAgent);
const newRef = () => 'PLT-' + Date.now().toString(36).toUpperCase().slice(-4) + Math.random().toString(36).slice(2, 4).toUpperCase();

export function openCheckout(order, onPaid) {
  const ref = newRef(); const note = `Plotopia ${order.movie} ${order.seat}`;
  const link = upiLink('upi://pay', { amount: order.amount, note, ref });
  const gpay = upiLink('tez://upi/pay', { amount: order.amount, note, ref });
  $('payMovie').textContent = order.movie; $('paySeat').textContent = `${order.hall} · Seat ${order.seat} · ${order.cat}`;
  $('payTime').textContent = order.time; $('payAmount').textContent = `₹${order.amount}`; $('payUpi').textContent = UPI.pa; $('payRef').textContent = ref;
  $('payStep').hidden = false; $('ticketStep').hidden = true; $('checkout').hidden = false;
  drawQr($('payQr'), link, 220).catch(() => { $('payQr').replaceWith(Object.assign(document.createElement('p'), { textContent: 'QR unavailable offline. Pay to the UPI ID below.' })); });

  let secs = 8 * 60; const timer = setInterval(() => { secs--; $('payTimer').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`; if (secs <= 0) { clearInterval(timer); close(); } }, 1000);
  const close = () => { clearInterval(timer); $('checkout').hidden = true; };
  $('payClose').onclick = close; $('payCancel').onclick = close;

  const gbtn = $('gpayBtn');
  gbtn.textContent = isPhone() ? 'Pay with Google Pay' : 'Scan with Google Pay';
  gbtn.onclick = () => {
    if (!isPhone()) { $('payHint').textContent = 'Open Google Pay on your phone, tap Scan, and point it at this code.'; return; }
    const t = Date.now(); location.href = gpay;                       // Google Pay's own scheme first
    setTimeout(() => { if (document.visibilityState === 'visible' && Date.now() - t < 2500) location.href = link; }, 1200);   // fall back to the generic UPI chooser
  };
  $('copyUpi').onclick = async () => { try { await navigator.clipboard.writeText(UPI.pa); $('copyUpi').textContent = 'Copied'; setTimeout(() => $('copyUpi').textContent = 'Copy', 1500); } catch {} };

  $('paidBtn').onclick = async () => {
    clearInterval(timer);
    const ticket = { ref, ...order, paidAt: new Date().toISOString(), upi: UPI.pa };
    $('payStep').hidden = true; $('ticketStep').hidden = false;
    $('tkMovie').textContent = order.movie; $('tkSeat').textContent = order.seat; $('tkHall').textContent = order.hall; $('tkTime').textContent = order.time; $('tkRef').textContent = ref; $('tkAmount').textContent = `₹${order.amount}`;
    drawQr($('ticketQr'), JSON.stringify({ t: 'plotopia-ticket', ref, seat: order.seat, hall: order.hallId, show: order.time }), 160).catch(() => {});
    try { const all = JSON.parse(localStorage.getItem('plotopia.tickets') || '[]'); all.push(ticket); localStorage.setItem('plotopia.tickets', JSON.stringify(all)); } catch {}
    onPaid?.(ticket);
  };
  $('ticketDone').onclick = close;
}
