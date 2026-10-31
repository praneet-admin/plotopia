// Hall definitions. Every number is in metres. The screen is centred on x=0 at z=0,
// facing +z; the audience sits at z > 0. Rows are listed front to back.
export const CATEGORIES = {
  classic:  { name: 'Classic',  price: 180, color: 0x5ec8ff, css: '#5ec8ff', pitch: 0.56, depth: 0.52, backH: 0.60 },
  prime:    { name: 'Prime',    price: 250, color: 0xf5c451, css: '#f5c451', pitch: 0.56, depth: 0.52, backH: 0.60 },
  recliner: { name: 'Recliner', price: 550, color: 0xc58bff, css: '#c58bff', pitch: 0.76, depth: 0.72, backH: 0.78 },
};

export const HALLS = {
  audi3: {
    id: 'audi3', name: 'Audi 3 · Standard', venue: 'PVR Phoenix',
    screenW: 12, screenBottom: 0.35, aspect: 16 / 9,
    firstRowZ: 6, rowPitch: 1.1, riser: 0.24, flatRows: 2,
    hallW: 17, hallH: 8.5, aisle: 1.3,
    rows: 'ABCDEFGHIJKLM', perSide: 8,
    bands: [['ABC', 'classic'], ['DEFGHIJ', 'prime'], ['KLM', 'recliner']],
    occupancy: r => (r < 2 ? 0.2 : r < 7 ? 0.55 : 0.7),
  },
  audi1: {
    id: 'audi1', name: 'Audi 1 · Large', venue: 'PVR Phoenix',
    screenW: 15, screenBottom: 0.5, aspect: 2.39,
    firstRowZ: 7, rowPitch: 1.05, riser: 0.24, flatRows: 3,
    hallW: 21, hallH: 9.5, aisle: 1.4,
    rows: 'ABCDEFGHIJKLMNOPQ', perSide: 10,
    bands: [['ABCD', 'classic'], ['EFGHIJKLMN', 'prime'], ['OPQ', 'recliner']],
    occupancy: r => (r < 3 ? 0.15 : r < 9 ? 0.5 : 0.7),
  },
  imax: {
    id: 'imax', name: 'IMAX · Steep rake', venue: 'PVR Phoenix',
    screenW: 22, screenBottom: 0.6, aspect: 1.9,
    firstRowZ: 7.5, rowPitch: 1.15, riser: 0.42, flatRows: 0,
    hallW: 26, hallH: 16, aisle: 1.6,
    rows: 'ABCDEFGHIJKLMNOP', perSide: 11,
    bands: [['ABC', 'classic'], ['DEFGHIJKLM', 'prime'], ['NOP', 'recliner']],
    occupancy: r => (r < 3 ? 0.2 : 0.6),
  },
};

export function screenOf(h) {
  const w = h.screenW, hh = w / h.aspect;
  return { w, h: hh, bottom: h.screenBottom, top: h.screenBottom + hh, cy: h.screenBottom + hh / 2 };
}

// Front rows sit on a gentle slope; from `flatRows` on, every row steps up by `riser`.
export function floorY(h, r) {
  if (r < h.flatRows) return r * 0.08;
  return h.flatRows * 0.08 + (r - h.flatRows + 1) * h.riser;
}

export function categoryOf(h, rowLetter) {
  for (const [letters, cat] of h.bands) if (letters.includes(rowLetter)) return cat;
  return 'prime';
}

// Deterministic PRNG so the demo's "sold" pattern is identical on every load.
function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/** Build the flat seat list for a hall. */
export function layoutSeats(h) {
  const rnd = lcg(20261030 + h.id.length * 7919);
  const seats = [];
  [...h.rows].forEach((row, r) => {
    const catId = categoryOf(h, row), cat = CATEGORIES[catId];
    const z = h.firstRowZ + r * h.rowPitch, y = floorY(h, r);
    const stagger = (r % 2) ? cat.pitch * 0.4 : 0;     // alternate rows offset half a seat: better sightlines
    const perSide = catId === 'recliner' ? Math.round(h.perSide * 0.75) : h.perSide;
    const rowSeats = [];
    for (let side = -1; side <= 1; side += 2)
      for (let i = 0; i < perSide; i++)
        rowSeats.push({ row, r, x: side * (h.aisle / 2 + cat.pitch * (i + 0.5)) + stagger, y, z, cat: catId, sold: rnd() < h.occupancy(r) });
    rowSeats.sort((a, b) => a.x - b.x).forEach((s, i) => { s.num = i + 1; s.id = row + (i + 1); s.aisleAfter = i === perSide - 1; seats.push(s); });
  });
  return seats;
}
