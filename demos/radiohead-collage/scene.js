// How Radiohead Changed Alternative Rock Forever: a 9:16 paper-collage explainer, ~92 s.
// Everything is drawn here in Canvas 2D: torn paper, halftone photocopies, tape, rubber stamps, marker scribbles,
// ransom-note headlines. No photos, no album art. Cutouts "boil" at 12 poses a second like stop-motion.
// Timing comes from voice/timing.json (one entry per scene, sentence start/end times), so pictures land on the words.
const W = 1080, H = 1920, LEAD = 0.35, TAIL = 1.4, FPS_BOIL = 12
const C = document.createElement('canvas'); C.width = W; C.height = H; document.body.appendChild(C)
const g = C.getContext('2d')

// ---------- palette & type ----------
const P = { paper: '#efe7d6', news: '#ddd5c3', kraft: '#c7a77a', ink: '#151312', red: '#d8371f', blue: '#2b66b0', mustard: '#e3b23c', teal: '#3f8f88', pink: '#e98fa0', white: '#fbf8f1', grey: '#8d877c' }
const F = { head: 'Anton, Impact, sans-serif', block: '"Archivo Black", Arial Black, sans-serif', type: '"Special Elite", "Courier New", monospace', mark: '"Permanent Marker", cursive', serif: '"Playfair Display", Georgia, serif' }

// ---------- utils ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const lerp = (a, b, k) => a + (b - a) * k
const outBack = (k) => { k = clamp(k); const c = 1.7, v = k - 1; return 1 + (c + 1) * v * v * v + c * v * v }
const outCubic = (k) => 1 - Math.pow(1 - clamp(k), 3)
const inOut = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2 }
const P01 = (t, a, d = 0.35) => clamp((t - a) / d)
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')] }

// ---------- textures ----------
let GRAIN, DOTS, DOTS_FINE, NEWS
function buildTextures() {
  { const [c, x] = mk(256, 256), d = x.createImageData(256, 256), r = rng(3); for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 } x.putImageData(d, 0, 0); for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(90,70,40,${0.05 + r() * 0.08})`; x.beginPath(); const a = r() * 256, b = r() * 256; x.moveTo(a, b); x.lineTo(a + (r() - 0.5) * 40, b + (r() - 0.5) * 40); x.stroke() } GRAIN = g.createPattern(c, 'repeat') }
  { const [c, x] = mk(9, 9); x.fillStyle = '#000'; x.beginPath(); x.arc(4.5, 4.5, 2.6, 0, 7); x.fill(); DOTS = g.createPattern(c, 'repeat') }
  { const [c, x] = mk(6, 6); x.fillStyle = '#000'; x.beginPath(); x.arc(3, 3, 1.4, 0, 7); x.fill(); DOTS_FINE = g.createPattern(c, 'repeat') }
  { const [c, x] = mk(540, 960), r = rng(9); x.fillStyle = P.news; x.fillRect(0, 0, 540, 960)
    for (let col = 0; col < 3; col++) for (let y = 30; y < 940; y += 13) { if (r() < 0.06) { y += 20; continue } const w = 150 - (r() < 0.12 ? r() * 90 : 0); x.fillStyle = 'rgba(40,36,30,0.28)'; x.fillRect(20 + col * 172, y, w, 5) }
    NEWS = g.createPattern(c, 'repeat') }
}

// torn rectangle path centred on 0,0; jagged edges seeded by id
const pathCache = new Map()
function torn(id, w, h, amp = 5, step = 16) {
  const key = id + '|' + w + '|' + h + '|' + amp; if (pathCache.has(key)) return pathCache.get(key)
  const r = rng(hash(key)), p = new Path2D(), pts = []
  const edge = (x0, y0, x1, y1, nx, ny) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / step)); for (let i = 0; i < n; i++) { const k = i / n, j = (r() - 0.3) * amp; pts.push([lerp(x0, x1, k) + nx * j, lerp(y0, y1, k) + ny * j]) } }
  edge(-w / 2, -h / 2, w / 2, -h / 2, 0, 1); edge(w / 2, -h / 2, w / 2, h / 2, -1, 0); edge(w / 2, h / 2, -w / 2, h / 2, 0, -1); edge(-w / 2, h / 2, -w / 2, -h / 2, 1, 0)
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); pathCache.set(key, p); return p
}

// stop-motion boil: small seeded offsets that change 12 times a second
let NOW = 0
function boil(id, amt = 1) { const f = Math.floor(NOW * FPS_BOIL), r = rng(hash(id) + f * 7919); return { dx: (r() - 0.5) * 3 * amt, dy: (r() - 0.5) * 3 * amt, dr: (r() - 0.5) * 0.012 * amt } }

// A cutout card: torn paper with a shadow, optional white cut border, tape, grain. content(w, h) draws in local
// coordinates with the origin at the card's top-left. k = entry progress (0..1), mode = pop | slide | drop.
function card(id, x, y, w, h, o = {}, content) {
  const k = o.k ?? 1; if (k <= 0) return
  const e = o.mode === 'slide' ? outCubic(k) : outBack(k)
  const b = boil(id, o.boil ?? 1), rot = (o.rot ?? 0) * Math.PI / 180 + b.dr
  g.save()
  let tx = x + b.dx, ty = y + b.dy, s = 1
  if (o.mode === 'slide') { const [sx, sy] = o.from || [-1, 0]; tx += sx * (1 - e) * 1200; ty += sy * (1 - e) * 1200 }
  else if (o.mode === 'drop') { ty -= (1 - e) * 90; s = lerp(1.25, 1, e) }
  else s = lerp(0.55, 1, e)
  g.translate(tx, ty); g.rotate(rot + (o.mode === 'pop' || !o.mode ? (1 - e) * 0.25 : 0)); g.scale(s, s)
  g.globalAlpha = clamp(k * 3) * (o.alpha ?? 1)
  const border = o.border ?? 10, outer = torn(id + 'o', w + border * 2, h + border * 2, o.amp ?? 5)
  g.shadowColor = 'rgba(30,20,10,0.38)'; g.shadowBlur = 16; g.shadowOffsetX = 7; g.shadowOffsetY = 10
  g.fillStyle = o.edge ?? P.white; g.fill(outer); g.shadowColor = 'transparent'
  const inner = border ? torn(id + 'i', w, h, (o.amp ?? 5) * 0.4, 24) : outer
  g.save(); g.clip(inner)
  g.fillStyle = o.paper ?? P.paper; g.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40)
  g.translate(-w / 2, -h / 2); content && content(w, h); g.translate(w / 2, h / 2)
  g.globalCompositeOperation = 'multiply'; g.globalAlpha *= 0.16; g.fillStyle = GRAIN; g.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40); g.globalCompositeOperation = 'source-over'
  g.restore()
  g.globalAlpha = clamp(k * 3) * (o.alpha ?? 1)
  if (o.tape) tape(id, w, h, o.tape)
  g.restore()
}
function tape(id, w, h, where = 'top') {
  const r = rng(hash(id + 't')), strip = (x, y, rot, len = 150) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = 'rgba(236,220,170,0.72)'; g.fill(torn(id + 'tp' + x, len, 44, 3, 10)); g.restore() }
  if (where === 'top') strip((r() - 0.5) * w * 0.3, -h / 2 - 6, (r() - 0.5) * 0.3)
  if (where === 'corners') { strip(-w / 2 + 10, -h / 2 + 6, -0.7, 120); strip(w / 2 - 10, -h / 2 + 6, 0.7, 120) }
  if (where === 'sides') { strip(-w / 2, 0, Math.PI / 2 + 0.1, 110); strip(w / 2, 0, Math.PI / 2 - 0.1, 110) }
}
// halftone fill for "photocopied" shapes
function halftone(path, base, ink = P.ink, alpha = 0.55, fine = false) { g.fillStyle = base; g.fill(path); g.save(); g.clip(path); g.globalAlpha *= alpha; g.fillStyle = fine ? DOTS_FINE : DOTS; g.fillRect(-2000, -2000, 4000, 4000); g.restore(); g.strokeStyle = ink; g.lineWidth = 4; g.stroke(path) }

// ---------- type pieces ----------
function txt(s, x, y, { font = F.type, size = 40, color = P.ink, align = 'left', base = 'alphabetic', spacing = 0 } = {}) { g.font = `${size}px ${font}`; g.letterSpacing = spacing + 'px'; g.textAlign = align; g.textBaseline = base; g.fillStyle = color; g.fillText(s, x, y); g.letterSpacing = '0px' }
function label(id, s, x, y, { k = 1, size = 40, font = F.type, paper = P.white, color = P.ink, rot = 0, pad = 22, mode = 'pop', from } = {}) {
  g.font = `${size}px ${font}`; const w = g.measureText(s).width + pad * 2, h = size * 1.45
  card(id, x, y, w, h, { k, rot, border: 0, paper, amp: 4, mode, from }, () => txt(s, pad, h * 0.7, { font, size, color }))
}
const RANSOM_FONTS = [F.head, F.block, F.serif, F.type, F.head]
const RANSOM_COLS = [[P.white, P.ink], [P.ink, P.white], [P.red, P.white], [P.mustard, P.ink], [P.news, P.ink], [P.blue, P.white]]
function ransom(id, s, cx, cy, size, t0, t, { stagger = 0.05, maxW = 980, dark = false } = {}) {
  const cols = dark ? RANSOM_COLS.filter((c) => c[0] !== P.ink) : RANSOM_COLS
  const r = rng(hash(id)), letters = [...s].map((ch) => ({ ch, f: RANSOM_FONTS[Math.floor(r() * 5)], c: cols[Math.floor(r() * cols.length)], rot: (r() - 0.5) * 12, sz: size * (0.85 + r() * 0.3) }))
  let tw = 0; for (const L of letters) { g.font = `${L.sz}px ${L.f}`; L.w = L.ch === ' ' ? size * 0.35 : g.measureText(L.ch).width + size * 0.22; tw += L.w }
  const sc = Math.min(1, maxW / tw); let x = cx - (tw * sc) / 2
  letters.forEach((L, i) => {
    const k = P01(t, t0 + i * stagger, 0.22)
    if (L.ch !== ' ') card(id + i, x + (L.w * sc) / 2, cy + (r() - 0.5) * 10, L.w * sc - 4, L.sz * sc * 1.1, { k, rot: L.rot, border: 0, paper: L.c[0], amp: 3 }, (w, h) => txt(L.ch, w / 2, h * 0.84, { font: L.f, size: L.sz * sc, color: L.c[1], align: 'center' }))
    x += L.w * sc
  })
}
function stamp(s, x, y, rot, k, { color = P.red, size = 80 } = {}) {
  if (k <= 0) return
  const e = clamp(k / 0.5), sc = lerp(2.0, 1, outCubic(e))
  g.save(); g.translate(x, y); g.rotate(rot * Math.PI / 180); g.scale(sc, sc); g.globalAlpha = 0.86 * clamp(e * 2)
  g.font = `${size}px ${F.head}`; g.letterSpacing = '3px'; const w = g.measureText(s).width + 50, h = size * 1.35
  g.strokeStyle = color; g.lineWidth = 7; g.strokeRect(-w / 2, -h / 2, w, h); g.lineWidth = 3; g.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20)
  txt(s, 0, size * 0.36, { font: F.head, size, color, align: 'center', spacing: 3 })
  g.globalCompositeOperation = 'destination-out'; const r = rng(hash(s)); for (let i = 0; i < 70; i++) { g.globalAlpha = 0.5; g.beginPath(); g.arc((r() - 0.5) * w, (r() - 0.5) * h, 1 + r() * 4, 0, 7); g.fill() } g.globalCompositeOperation = 'source-over'
  g.restore()
}
// marker strokes that draw on with k
function scribble(pts, k, { color = P.red, width = 9 } = {}) {
  if (k <= 0) return; const n = Math.max(2, Math.floor(pts.length * clamp(k)))
  g.save(); g.strokeStyle = color; g.lineWidth = width; g.lineCap = g.lineJoin = 'round'; g.globalAlpha = 0.9; g.beginPath(); for (let i = 0; i < n; i++) (i ? g.lineTo : g.moveTo).call(g, ...pts[i]); g.stroke(); g.restore()
}
const ring = (x, y, rx, ry, k, o) => { const pts = []; for (let i = 0; i <= 70; i++) { const a = -2.2 + (i / 64) * Math.PI * 2.15, wob = 1 + 0.04 * Math.sin(i * 0.7); pts.push([x + Math.cos(a) * rx * wob, y + Math.sin(a) * ry * wob]) } scribble(pts, k, o) }
const underline = (x0, x1, y, k, o) => { const pts = []; for (let i = 0; i <= 30; i++) pts.push([lerp(x0, x1, i / 30), y + Math.sin(i * 0.5) * 3]); scribble(pts, k, o) }
function arrow(x0, y0, x1, y1, k, o = {}) {
  const cx = (x0 + x1) / 2 + (y1 - y0) * 0.25, cy = (y0 + y1) / 2 - (x1 - x0) * 0.25, pts = []
  for (let i = 0; i <= 30; i++) { const u = i / 30; pts.push([(1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1]) }
  scribble(pts, k, o); if (k > 0.95) { const a = Math.atan2(y1 - cy, x1 - cx); scribble([[x1 - Math.cos(a - 0.5) * 34, y1 - Math.sin(a - 0.5) * 34], [x1, y1], [x1 - Math.cos(a + 0.5) * 34, y1 - Math.sin(a + 0.5) * 34]], 1, o) }
}
function star(x, y, r, col, k = 1) { if (k <= 0) return; g.save(); g.translate(x, y); g.scale(outBack(k), outBack(k)); g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) } g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 3; g.stroke(); g.restore() }

// ---------- drawn objects (all generic) ----------
function crt(w, h, t, screen = 'OK') {
  const body = new Path2D(); body.roundRect(w * 0.06, h * 0.04, w * 0.88, h * 0.74, 26); halftone(body, '#d9d0b8', P.ink, 0.18)
  const sc = new Path2D(); sc.roundRect(w * 0.14, h * 0.11, w * 0.72, h * 0.54, 18); g.fillStyle = '#183058'; g.fill(sc)
  g.save(); g.clip(sc); g.fillStyle = 'rgba(120,200,255,0.12)'; for (let y = h * 0.11; y < h * 0.65; y += 6) g.fillRect(0, y, w, 2)
  txt(screen, w / 2, h * 0.45, { font: F.type, size: h * 0.16, color: '#9fe3ff', align: 'center' }); if (Math.floor(t * 2) % 2) g.fillRect(w * 0.5 + g.measureText(screen).width / 2 + 6, h * 0.33, h * 0.07, h * 0.13)
  g.restore(); g.lineWidth = 4; g.strokeStyle = P.ink; g.stroke(sc)
  const st = new Path2D(); st.moveTo(w * 0.36, h * 0.78); st.lineTo(w * 0.64, h * 0.78); st.lineTo(w * 0.72, h * 0.94); st.lineTo(w * 0.28, h * 0.94); st.closePath(); halftone(st, '#cfc5aa', P.ink, 0.25)
}
function silhouette(w, h, col = P.ink) {
  const p = new Path2D(); p.arc(w / 2, h * 0.28, w * 0.2, 0, 7); p.moveTo(w * 0.08, h); p.quadraticCurveTo(w * 0.1, h * 0.5, w / 2, h * 0.5); p.quadraticCurveTo(w * 0.9, h * 0.5, w * 0.92, h); p.closePath()
  halftone(p, col, P.ink, 0.6)
}
function mapOxford(w, h, t, k) {
  g.fillStyle = '#e8e2cf'; g.fillRect(0, 0, w, h)
  g.strokeStyle = '#b9b09a'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8 + 30); g.stroke() }
  g.strokeStyle = '#7fa6c8'; g.lineWidth = 12; g.beginPath(); g.moveTo(-10, h * 0.7); g.bezierCurveTo(w * 0.3, h * 0.4, w * 0.5, h * 0.9, w + 10, h * 0.55); g.stroke()
  g.strokeStyle = '#d6a55a'; g.lineWidth = 7; for (const [a, b, c, d] of [[0, 0.2, 1, 0.62], [0.2, 0, 0.62, 1], [0, 0.85, 0.9, 0.1]]) { g.beginPath(); g.moveTo(a * w, b * h); g.lineTo(c * w, d * h); g.stroke() }
  const px = w * 0.52, py = h * 0.44 - (1 - outBack(k)) * 80
  g.fillStyle = P.red; g.beginPath(); g.arc(px, py - 30, 22, Math.PI, 0); g.lineTo(px, py + 18); g.closePath(); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 3; g.stroke(); g.fillStyle = P.white; g.beginPath(); g.arc(px, py - 30, 8, 0, 7); g.fill()
  txt('OXFORD', px, py + 64, { font: F.block, size: 40, align: 'center' }); txt('ENGLAND', px, py + 100, { font: F.type, size: 26, align: 'center', color: P.grey })
}
function disc(cx, cy, r, t, labelText) {
  g.save(); g.translate(cx, cy); g.rotate(t * 2.2)
  const p = new Path2D(); p.arc(0, 0, r, 0, 7); const gr = g.createConicGradient(0, 0, 0); ['#cfd6dc', '#f1c9e0', '#bfe3f0', '#f4ecc0', '#cfd6dc'].forEach((c, i) => gr.addColorStop(i / 4, c)); g.fillStyle = gr; g.fill(p)
  g.save(); g.clip(p); g.globalAlpha = 0.25; g.fillStyle = DOTS_FINE; g.fillRect(-r, -r, r * 2, r * 2); g.restore()
  g.strokeStyle = P.ink; g.lineWidth = 4; g.stroke(p); g.fillStyle = P.white; g.beginPath(); g.arc(0, 0, r * 0.36, 0, 7); g.fill(); g.stroke(); g.fillStyle = P.paper; g.beginPath(); g.arc(0, 0, r * 0.08, 0, 7); g.fill(); g.stroke()
  g.restore(); if (labelText) txt(labelText, cx, cy + r * 0.2, { font: F.block, size: r * 0.13, align: 'center' })
}
function shed(w, h, t) {
  g.fillStyle = '#bcd3d8'; g.fillRect(0, 0, w, h); g.fillStyle = '#6f9a5a'; g.fillRect(0, h * 0.78, w, h)
  const wall = new Path2D(); wall.rect(w * 0.14, h * 0.38, w * 0.72, h * 0.42); halftone(wall, '#9a6b42', P.ink, 0.25)
  g.strokeStyle = 'rgba(40,24,10,.6)'; g.lineWidth = 3; for (let x = w * 0.14; x < w * 0.86; x += 26) { g.beginPath(); g.moveTo(x, h * 0.38); g.lineTo(x, h * 0.8); g.stroke() }
  const roof = new Path2D(); roof.moveTo(w * 0.08, h * 0.4); roof.lineTo(w * 0.5, h * 0.14); roof.lineTo(w * 0.92, h * 0.4); roof.closePath(); halftone(roof, '#5c5550', P.ink, 0.35)
  const door = new Path2D(); door.rect(w * 0.42, h * 0.52, w * 0.16, h * 0.28); halftone(door, '#6a4528', P.ink, 0.3)
  g.fillStyle = '#ffd27a'; g.fillRect(w * 0.2, h * 0.5, w * 0.14, h * 0.1); g.strokeRect(w * 0.2, h * 0.5, w * 0.14, h * 0.1)
  const r = rng(5); for (let i = 0; i < 9; i++) { const x = w * (0.08 + r() * 0.84), y = h * (0.84 + r() * 0.1), b = Math.abs(Math.sin(t * 3 + i)) * 4; g.fillStyle = i % 3 ? P.red : '#8fb43a'; g.beginPath(); g.arc(x, y - b, 16, 0, 7); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 3; g.stroke(); g.beginPath(); g.moveTo(x, y - b - 16); g.lineTo(x + 5, y - b - 26); g.stroke() }
}
function mixer(w, h, t) {
  const p = new Path2D(); p.roundRect(8, 8, w - 16, h - 16, 16); halftone(p, '#4a4a52', P.ink, 0.25)
  const n = 10; for (let i = 0; i < n; i++) {
    const x = 40 + i * (w - 80) / (n - 1)
    for (let j = 0; j < 3; j++) { g.fillStyle = [P.red, P.mustard, P.white][j]; g.beginPath(); g.arc(x, 44 + j * 40, 11, 0, 7); g.fill() }
    g.fillStyle = '#16161a'; g.fillRect(x - 4, h * 0.5, 8, h * 0.4)
    const v = 0.5 + 0.4 * Math.sin(Math.floor(t * FPS_BOIL) / FPS_BOIL * 2 + i * 1.3); g.fillStyle = P.white; g.fillRect(x - 15, h * 0.5 + (1 - v) * h * 0.36, 30, 14)
  }
}
function mansion(w, h) {
  g.fillStyle = '#c9d5d8'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a9a62'; g.fillRect(0, h * 0.84, w, h)
  const stone = '#cdb98e', body = new Path2D(); body.rect(w * 0.06, h * 0.36, w * 0.88, h * 0.5); halftone(body, stone, P.ink, 0.22)
  for (const [cx, ww] of [[0.2, 0.22], [0.5, 0.26], [0.8, 0.22]]) { const gb = new Path2D(); gb.moveTo(w * (cx - ww / 2), h * 0.37); gb.lineTo(w * (cx - ww / 2), h * 0.26); gb.lineTo(w * cx, h * 0.14); gb.lineTo(w * (cx + ww / 2), h * 0.26); gb.lineTo(w * (cx + ww / 2), h * 0.37); gb.closePath(); halftone(gb, stone, P.ink, 0.25); g.fillStyle = '#3c4048'; g.fillRect(w * cx - 12, h * 0.24, 24, 30) }
  for (let r = 0; r < 2; r++) for (let c = 0; c < 7; c++) { const x = w * (0.1 + c * 0.12), y = h * (0.42 + r * 0.2); g.fillStyle = (c + r) % 3 ? '#3c4a5a' : '#f2d48a'; g.fillRect(x, y, w * 0.06, h * 0.12); g.strokeStyle = P.ink; g.lineWidth = 3; g.strokeRect(x, y, w * 0.06, h * 0.12); g.beginPath(); g.moveTo(x + w * 0.03, y); g.lineTo(x + w * 0.03, y + h * 0.12); g.stroke() }
  g.fillStyle = '#4a3020'; g.fillRect(w * 0.46, h * 0.7, w * 0.08, h * 0.16)
  for (const x of [0.1, 0.9]) { g.fillStyle = '#3f6a3a'; g.beginPath(); g.arc(w * x, h * 0.8, w * 0.08, 0, 7); g.fill() }
}
function floorplan(w, h, t, s0) {
  g.fillStyle = '#e4ecf2'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(43,102,176,.25)'; g.lineWidth = 1; for (let x = 0; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() } for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  const rooms = [[0.05, 0.08, 0.5, 0.42, 'BALLROOM'], [0.57, 0.08, 0.38, 0.26, 'LIBRARY'], [0.57, 0.36, 0.38, 0.14, 'HALL'], [0.05, 0.52, 0.3, 0.4, 'STAIRS'], [0.37, 0.52, 0.58, 0.4, 'DINING ROOM']]
  rooms.forEach(([x, y, rw, rh, n], i) => { const k = P01(t, s0 + i * 0.35, 0.3); if (k <= 0) return; g.globalAlpha = k; g.strokeStyle = P.blue; g.lineWidth = 5; g.strokeRect(x * w, y * h, rw * w, rh * h); txt(n, (x + rw / 2) * w, (y + rh / 2) * h + 8, { font: F.type, size: 26, color: P.blue, align: 'center' }); mic((x + rw / 2) * w, (y + rh / 2) * h - 40, 0.55); g.globalAlpha = 1 })
}
function mic(x, y, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = P.ink; g.beginPath(); g.roundRect(-14, -30, 28, 46, 14); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 22, 0.1, Math.PI - 0.1); g.stroke(); g.beginPath(); g.moveTo(0, 22); g.lineTo(0, 40); g.stroke(); g.restore() }
function stairs(w, h, t) {
  g.fillStyle = '#b7b2a6'; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 9; i++) { const y = h * 0.95 - i * h * 0.095, x0 = w * (0.05 + i * 0.045), x1 = w * (0.95 - i * 0.045); const p = new Path2D(); p.rect(x0, y - h * 0.095, x1 - x0, h * 0.095); halftone(p, i % 2 ? '#d6cfbf' : '#c4bcab', P.ink, 0.2, true) }
  for (let i = 0; i < 4; i++) { const u = ((t * 0.7 + i / 4) % 1); g.strokeStyle = `rgba(216,55,31,${0.8 * (1 - u)})`; g.lineWidth = 6; g.beginPath(); g.arc(w * 0.5, h * 0.28, 30 + u * w * 0.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke() }
  mic(w * 0.5, h * 0.3, 1.2)
}
function ballroom(w, h, t) {
  g.fillStyle = '#2a2440'; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 3; i++) { const x = w * (0.12 + i * 0.3), p = new Path2D(); p.moveTo(x, h * 0.85); p.lineTo(x, h * 0.4); p.arc(x + w * 0.09, h * 0.4, w * 0.09, Math.PI, 0); p.lineTo(x + w * 0.18, h * 0.85); p.closePath(); halftone(p, '#3f5a8c', '#0e0c18', 0.3); g.fillStyle = '#f4f0d8'; g.beginPath(); g.arc(x + w * 0.13, h * 0.38, 7, 0, 7); g.fill() }
  g.fillStyle = '#5a3a2a'; g.fillRect(0, h * 0.85, w, h); g.strokeStyle = '#e3b23c'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h * 0.12); g.stroke()
  for (let i = -3; i <= 3; i++) { g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(w / 2 + i * 34, h * 0.18 + Math.abs(i) * -4, 9 + (Math.floor(t * 6 + i) % 2) * 2, 0, 7); g.fill() }
  g.strokeStyle = '#e3b23c'; g.beginPath(); g.ellipse(w / 2, h * 0.16, 120, 30, 0, 0, Math.PI); g.stroke()
}
function clock(cx, cy, r, t) {
  g.save(); g.translate(cx, cy); g.fillStyle = P.white; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 6; g.stroke()
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.lineWidth = i % 3 ? 3 : 6; g.beginPath(); g.moveTo(Math.sin(a) * r * 0.78, -Math.cos(a) * r * 0.78); g.lineTo(Math.sin(a) * r * 0.9, -Math.cos(a) * r * 0.9); g.stroke() }
  const mA = (Math.floor(t * 2) / 2) * 0.3, hA = Math.PI / 2 + mA / 12
  g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(hA) * r * 0.5, -Math.cos(hA) * r * 0.5); g.stroke()
  g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(mA) * r * 0.75, -Math.cos(mA) * r * 0.75); g.stroke(); g.restore()
}
function synth(w, h) { const p = new Path2D(); p.roundRect(4, 4, w - 8, h - 8, 12); halftone(p, '#2d2b30', P.ink, 0.2); for (let i = 0; i < 14; i++) { g.fillStyle = P.white; g.fillRect(20 + i * (w - 40) / 14, h * 0.45, (w - 40) / 14 - 4, h * 0.48) } for (let i = 0; i < 14; i++) if (![2, 6, 9, 13].includes(i % 14)) { g.fillStyle = P.ink; g.fillRect(20 + (i + 0.65) * (w - 40) / 14, h * 0.45, (w - 40) / 24, h * 0.28) } for (let i = 0; i < 6; i++) { g.fillStyle = [P.red, P.mustard, P.teal][i % 3]; g.beginPath(); g.arc(40 + i * 60, h * 0.22, 14, 0, 7); g.fill() } }
function pedal(w, h, col) { const p = new Path2D(); p.roundRect(6, 6, w - 12, h - 12, 18); halftone(p, col, P.ink, 0.3); for (const x of [0.3, 0.7]) { g.fillStyle = P.ink; g.beginPath(); g.arc(w * x, h * 0.25, w * 0.1, 0, 7); g.fill() } g.fillStyle = '#c8c8cc'; g.beginPath(); g.arc(w / 2, h * 0.7, w * 0.16, 0, 7); g.fill(); g.stroke(); g.fillStyle = P.red; g.beginPath(); g.arc(w / 2, h * 0.47, 8, 0, 7); g.fill() }
function reels(w, h, t) { const p = new Path2D(); p.roundRect(4, 4, w - 8, h - 8, 14); halftone(p, '#9a9488', P.ink, 0.2); for (const x of [0.28, 0.72]) { g.save(); g.translate(w * x, h * 0.42); g.rotate(t * 3); g.fillStyle = '#3a2a22'; g.beginPath(); g.arc(0, 0, w * 0.2, 0, 7); g.fill(); g.fillStyle = '#d8d2c4'; for (let i = 0; i < 3; i++) { g.rotate(Math.PI * 2 / 3); g.beginPath(); g.arc(w * 0.1, 0, w * 0.04, 0, 7); g.fill() } g.restore() } g.strokeStyle = '#3a2a22'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.28, h * 0.42 + w * 0.2); g.lineTo(w * 0.72, h * 0.42 + w * 0.2); g.stroke() }
function wave(x, y, w, amp, t, col = P.ink) { g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); for (let i = 0; i <= 120; i++) { const u = i / 120, v = Math.sin(u * 40 + t * 8) * Math.sin(u * 7 + t) * amp * (0.4 + 0.6 * Math.sin(u * Math.PI)); i ? g.lineTo(x + u * w, y + v) : g.moveTo(x + u * w, y + v) } g.stroke() }
function cart(w, h) { g.strokeStyle = P.ink; g.lineWidth = 8; g.lineJoin = 'round'; g.beginPath(); g.moveTo(w * 0.05, h * 0.15); g.lineTo(w * 0.22, h * 0.15); g.lineTo(w * 0.32, h * 0.65); g.lineTo(w * 0.85, h * 0.65); g.lineTo(w * 0.95, h * 0.28); g.lineTo(w * 0.26, h * 0.28); g.stroke(); for (const x of [0.38, 0.8]) { g.beginPath(); g.arc(w * x, h * 0.82, h * 0.08, 0, 7); g.stroke() } for (let i = 0; i < 14; i++) { g.fillStyle = P.ink; g.fillRect(w * 0.36 + i * w * 0.034, h * 0.34, i % 3 ? 4 : 8, h * 0.24) } }
function chip(w, h) { const p = new Path2D(); p.rect(w * 0.25, h * 0.25, w * 0.5, h * 0.5); halftone(p, '#2f6b58', P.ink, 0.3); g.fillStyle = '#c9b37a'; for (let i = 0; i < 5; i++) for (const [x, y, ww, hh] of [[w * 0.3 + i * w * 0.1, h * 0.12, 8, h * 0.13], [w * 0.3 + i * w * 0.1, h * 0.75, 8, h * 0.13], [w * 0.12, h * 0.3 + i * h * 0.1, w * 0.13, 8], [w * 0.75, h * 0.3 + i * h * 0.1, w * 0.13, 8]]) g.fillRect(x, y, ww, hh); txt('1997', w / 2, h * 0.55, { font: F.type, size: h * 0.12, color: P.white, align: 'center' }) }
function lonely(w, h) { g.fillStyle = '#1e2230'; g.fillRect(0, 0, w, h); const gr = g.createRadialGradient(w / 2, h * 0.75, 10, w / 2, h * 0.75, w * 0.5); gr.addColorStop(0, 'rgba(255,240,190,.8)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.save(); g.translate(w * 0.38, h * 0.42); silhouette(w * 0.24, h * 0.42, '#151312'); g.restore() }
function anxiety(w, h, t) { g.fillStyle = '#f2e0dc'; g.fillRect(0, 0, w, h); const r = rng(Math.floor(t * FPS_BOIL)); g.strokeStyle = P.ink; g.lineWidth = 4; g.beginPath(); let x = w / 2, y = h / 2; g.moveTo(x, y); for (let i = 0; i < 70; i++) { x = clamp(x + (r() - 0.5) * 90, 20, w - 20); y = clamp(y + (r() - 0.5) * 90, 20, h - 20); g.lineTo(x, y) } g.stroke() }
function calendar(w, h, mon, day, year) { g.fillStyle = P.red; g.fillRect(0, 0, w, h * 0.26); txt(mon, w / 2, h * 0.2, { font: F.block, size: h * 0.15, color: P.white, align: 'center' }); txt(day, w / 2, h * 0.74, { font: F.head, size: h * 0.46, align: 'center' }); txt(year, w / 2, h * 0.93, { font: F.type, size: h * 0.12, align: 'center' }); for (const x of [0.25, 0.75]) { g.fillStyle = '#555'; g.beginPath(); g.arc(w * x, 14, 9, 0, 7); g.fill() } }
function chartUp(w, h, k) { g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(30, i * h / 6); g.lineTo(w - 20, i * h / 6); g.stroke() } const pts = [[0.08, 0.86], [0.24, 0.78], [0.38, 0.8], [0.52, 0.6], [0.66, 0.52], [0.8, 0.3], [0.94, 0.1]].map(([x, y]) => [x * w, y * h]); scribble(pts, k, { color: P.teal, width: 12 }); if (k > 0.97) arrow(pts[5][0], pts[5][1] + 40, pts[6][0], pts[6][1], 1, { color: P.teal, width: 12 }) }
function guitarIcon(x, y, s, col) { g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-0.5); const b = new Path2D(); b.ellipse(0, 20, 28, 34, 0, 0, 7); b.ellipse(0, -18, 21, 24, 0, 0, 7); halftone(b, col, P.ink, 0.25); g.fillStyle = P.ink; g.fillRect(-5, -100, 10, 80); g.fillRect(-9, -116, 18, 20); g.beginPath(); g.arc(0, 8, 9, 0, 7); g.fill(); g.restore() }

// ---------- backgrounds ----------
function background(i) {
  const bgs = [P.news, P.kraft, '#cfdccf', '#d6cdbb', '#2a2a33', P.news, '#e3d3c0', '#d9cfba']
  g.fillStyle = bgs[i]; g.fillRect(0, 0, W, H)
  if (i !== 4) { g.globalAlpha = 0.5; g.fillStyle = NEWS; g.save(); g.rotate(-0.04); g.fillRect(-200, -200, W + 400, H + 400); g.restore(); g.globalAlpha = 1 }
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.25; g.fillStyle = GRAIN; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1
  // two torn coloured strips per scene for depth
  const r = rng(100 + i), cols = [P.mustard, P.pink, P.blue, P.teal, P.red, P.white]
  for (let j = 0; j < 2; j++) { g.save(); g.translate(r() * W, 300 + r() * 1300); g.rotate((r() - 0.5) * 0.6); g.globalAlpha = i === 4 ? 0.35 : 0.55; g.fillStyle = cols[Math.floor(r() * 6)]; g.fill(torn('bg' + i + j, 1500, 90 + r() * 80, 10, 22)); g.restore() }
  g.globalAlpha = 1
}
function chapter(i, title, k) { const s = `${String(i + 1).padStart(2, '0')} / ${title}`; g.font = `30px ${F.type}`; label('ch' + i, s, 70 + (g.measureText(s).width + 44) / 2, 190, { k, size: 30, font: F.type, paper: '#ecdca8', rot: -2, mode: 'slide', from: [-1, 0] }) }

// ---------- captions (typed strip, sound-off friendly) ----------
function caption(text, t0, t1, t) {
  if (t < t0 - 0.05 || t > t1 + 0.25) return
  const n = Math.ceil(text.length * clamp((t - t0) / Math.max(0.4, (t1 - t0) * 0.85)))
  g.font = `46px ${F.type}`; const words = text.split(' '), lines = []; let cur = ''
  for (const w of words) { const nx = cur ? cur + ' ' + w : w; if (g.measureText(nx).width > 900 && cur) { lines.push(cur); cur = w } else cur = nx } lines.push(cur)
  let shown = n; const lh = 60, h = lines.length * lh + 40, y = 1500 - h / 2
  card('cap' + text.length + lines.length, W / 2, y + h / 2, 980, h, { k: 1, border: 0, paper: P.white, amp: 4, boil: 0.4, rot: -0.6 }, () => {
    lines.forEach((L, i) => { const s = L.slice(0, Math.max(0, shown)); shown -= L.length + 1; txt(s, 490, 64 + i * lh, { font: F.type, size: 46, align: 'center' }) })
  })
}

// ---------- the scenes ----------
// each: (t local seconds, T = [[start, end, sentence], ...] local, D = scene duration)
const NAMES = ['THE HOOK', 'THE BACKGROUND', 'THE RECORDING BEGINS', 'THE MANSION', 'THE EXPERIMENTS', 'THE ALBUM', 'THE IMPACT', 'THE LEGACY']
const SCENES = [
  // 1. the hook: 1997, Oxford, five musicians, the album name
  (t, T) => {
    stamp('1997', 300, 390, -8, P01(t, 0.25, 0.4), { size: 120 })
    card('map', 760, 520, 420, 420, { k: P01(t, 1.0), rot: 5, tape: 'corners' }, (w, h) => mapOxford(w, h, t, P01(t, 1.3, 0.5)))
    for (let i = 0; i < 5; i++) card('fig' + i, 170 + i * 185, 980 + (i % 2) * 26, 160, 230, { k: P01(t, 2.0 + i * 0.12), rot: (i - 2) * 3, paper: [P.mustard, P.pink, P.white, P.teal, P.blue][i] }, (w, h) => silhouette(w, h))
    label('five', 'FIVE MUSICIANS', 540, 1180, { k: P01(t, 2.6), size: 40, font: F.block, paper: P.ink, color: P.white, rot: -2 })
    if (t > T[1][0] - 0.2) { g.fillStyle = 'rgba(20,18,16,0.55)'; g.fillRect(0, 0, W, H * clamp((t - T[1][0] + 0.2) * 4)) }
    card('crt1', 540, 700, 560, 480, { k: P01(t, T[1][0]), rot: -3, mode: 'drop', paper: '#f3eee0' }, (w, h) => crt(w, h, t, t > T[2][0] ? 'OK' : '?'))
    ransom('okc', 'OK COMPUTER', 540, 1110, 120, T[2][0], t, { stagger: 0.04 })
    ring(540, 1110, 470, 110, P01(t, T[2][0] + 0.7, 0.6))
  },
  // 2. the background: after The Bends, escape the formula
  (t, T, D) => {
    const s2 = T[1][0]
    card('bends', 330, 600, 470, 470, { k: P01(t, 0.15), rot: -6, paper: P.white, tape: 'top' }, (w, h) => { disc(w / 2, h / 2 - 10, 190, t, null); txt('THE BENDS', w / 2, h - 30, { font: F.block, size: 40, align: 'center' }) })
    label('y95', '1995', 640, 400, { k: P01(t, 0.6), size: 54, font: F.head, paper: P.mustard, rot: 8 })
    stamp('A HIT', 700, 820, 10, P01(t, 1.6), { size: 80 })
    arrow(560, 930, 760, 1080, P01(t, T[0][1] - 1.4, 0.6))
    label('diff', 'SOMEWHERE COMPLETELY DIFFERENT', 540, 1150, { k: P01(t, T[0][1] - 0.9), size: 40, font: F.block, paper: P.ink, color: P.white, rot: -3 })
    // the rock rulebook, torn and crossed out
    if (t > s2 - 0.2) {
      g.fillStyle = 'rgba(199,167,122,0.92)'; g.fillRect(0, 0, W, H * clamp((t - s2 + 0.2) * 5))
      const tear = P01(t, s2 + 2.6, 0.5)
      for (const side of [-1, 1]) card('rule' + side, 540 + side * (130 + tear * 120), 700 + tear * 40, 260, 520, { k: P01(t, s2), rot: side * (2 + tear * 10), paper: '#f7f2e2', mode: 'drop' }, (w, h) => {
        g.save(); g.translate(side < 0 ? 0 : -w, 0); txt('ROCK', w, 120, { font: F.head, size: 110, align: 'center' }); txt('FORMULA', w, 220, { font: F.head, size: 92, align: 'center', color: P.red })
        ;['1. VERSE', '2. CHORUS', '3. VERSE', '4. CHORUS', '5. GUITAR SOLO', '6. REPEAT'].forEach((l, i) => txt(l, w * 0.55, 300 + i * 38, { font: F.type, size: 30 })); g.restore()
      })
      if (tear > 0.5) { stamp('NO THANKS', 540, 1060, -6, P01(t, s2 + 3.1), { size: 70 }) }
      ransom('new', 'SOMETHING NEW', 540, 1180, 90, s2 + 3.4, t, { stagger: 0.04 })
      for (let i = 0; i < 5; i++) star(180 + i * 180, 1300 + (i % 2) * 30, 30, P.mustard, P01(t, s2 + 4.0 + i * 0.1))
    }
  },
  // 3. the apple shed and the producer
  (t, T) => {
    const s2 = T[1][0]
    stamp('1996', 820, 330, 9, P01(t, 0.2), { size: 90 })
    card('shed', 540, 700, 820, 620, { k: P01(t, 0.6), rot: -2, tape: 'corners' }, (w, h) => shed(w, h, t))
    label('ca', 'CANNED APPLAUSE', 420, 1080, { k: P01(t, 2.2), size: 52, font: F.block, paper: P.white, rot: -3 })
    label('ox', 'REHEARSAL SPACE · OXFORDSHIRE', 560, 1170, { k: P01(t, 2.7), size: 32, font: F.type, paper: P.mustard, rot: 2 })
    label('apple', 'a converted APPLE SHED!', 640, 1260, { k: P01(t, T[0][1] - 2.0), size: 44, font: F.mark, paper: P.pink, rot: -4 })
    ring(640, 1262, 300, 56, P01(t, T[0][1] - 1.5, 0.6))
    if (t > s2 - 0.2) {
      g.fillStyle = 'rgba(207,220,207,0.94)'; g.fillRect(0, H * (1 - clamp((t - s2 + 0.2) * 5)), W, H)
      card('mix', 540, 640, 860, 420, { k: P01(t, s2), rot: 3, mode: 'drop' }, (w, h) => mixer(w, h, t))
      card('tag', 540, 1040, 640, 250, { k: P01(t, s2 + 0.8), rot: -4, paper: P.white, tape: 'top' }, (w, h) => { g.fillStyle = P.red; g.fillRect(0, 0, w, 76); txt('HELLO, MY NAME IS', w / 2, 54, { font: F.block, size: 34, color: P.white, align: 'center' }); txt('Nigel Godrich', w / 2, 170, { font: F.mark, size: 66, align: 'center' }) })
      label('prod', 'PRODUCER', 300, 1230, { k: P01(t, s2 + 1.4), size: 44, font: F.head, paper: P.ink, color: P.white, rot: -6 })
      label('collab', 'key creative collaborator', 650, 1300, { k: P01(t, s2 + 2.6), size: 36, font: F.mark, paper: P.mustard, rot: 3 })
    }
  },
  // 4. St Catherine's Court and its rooms
  (t, T) => {
    const s2 = T[1][0]
    if (t < s2 + 0.3) {
    card('truck', 260, 380, 360, 170, { k: P01(t, 0.2), mode: 'slide', from: [-1, 0], rot: -3 }, (w, h) => { g.fillStyle = P.white; g.fillRect(0, 0, w, h); reels(w * 0.45, h * 0.9, t); g.translate(w * 0.5, 0); synth(w * 0.48, h * 0.7); g.translate(-w * 0.5, 0) })
    arrow(450, 440, 640, 560, P01(t, 0.8, 0.5))
    card('mansion', 540, 820, 900, 560, { k: P01(t, 1.0), rot: 2, tape: 'corners' }, (w, h) => mansion(w, h))
    label('stc', "ST CATHERINE'S COURT", 540, 1160, { k: P01(t, 2.0), size: 56, font: F.head, paper: P.white, rot: -2 })
    label('bath', 'historic mansion · near BATH, England', 560, 1250, { k: P01(t, 2.8), size: 32, font: F.type, paper: P.mustard, rot: 2 })
    }
    if (t > s2 - 0.2) {
      card('plan', 540, 780, 900, 720, { k: P01(t, s2 - 0.1), rot: -2, mode: 'drop', paper: '#e4ecf2' }, (w, h) => floorplan(w, h, t, s2 + 0.4))
      stamp('NOT A STUDIO', 760, 1210, -8, P01(t, s2 + 0.5), { size: 64 })
      label('rooms', 'every room = a new sound', 400, 1290, { k: P01(t, s2 + 2.5), size: 40, font: F.mark, paper: P.white, rot: -3 })
    }
  },
  // 5. staircase, ballroom at 3am, experiments
  (t, T) => {
    const s2 = T[1][0], s3 = T[2][0]
    if (t < s2 + 0.1) {
      card('stairs', 540, 700, 820, 760, { k: P01(t, 0.15), rot: -3, tape: 'corners' }, (w, h) => stairs(w, h, t))
      label('exit', 'EXIT MUSIC', 340, 1150, { k: P01(t, 1.2), size: 64, font: F.head, paper: P.ink, color: P.white, rot: -4 })
      label('vox', 'vocals on a stone staircase', 620, 1240, { k: P01(t, 1.8), size: 38, font: F.mark, paper: P.white, rot: 3 })
      label('echo', 'NATURAL ECHO', 760, 380, { k: P01(t, T[0][1] - 1.2), size: 40, font: F.block, paper: P.red, color: P.white, rot: 6 })
    } else if (t < s3 + 0.1) {
      card('ball', 540, 680, 860, 680, { k: P01(t, s2), rot: 2, mode: 'drop' }, (w, h) => ballroom(w, h, t))
      card('clock', 820, 1050, 260, 260, { k: P01(t, s2 + 1.4), rot: -6, border: 8 }, (w, h) => clock(w / 2, h / 2, 110, t))
      label('letdown', 'LET DOWN', 330, 1120, { k: P01(t, s2 + 0.6), size: 70, font: F.head, paper: P.white, rot: -3 })
      label('3am', 'in the ballroom · ~3 A.M.', 420, 1220, { k: P01(t, s2 + 1.8), size: 36, font: F.type, paper: P.mustard, rot: 2 })
    } else {
      const it = [['syn', 300, 560, 440, 220, -6, (w, h) => synth(w, h)], ['ped1', 780, 520, 200, 280, 8, (w, h) => pedal(w, h, P.blue)], ['ped2', 790, 880, 200, 280, -5, (w, h) => pedal(w, h, P.mustard)], ['reel', 330, 920, 420, 300, 4, (w, h) => reels(w, h, t)]]
      it.forEach(([id, x, y, w, h, r, f], i) => card(id, x, y, w, h, { k: P01(t, s3 + i * 0.35), rot: r }, f))
      card('wavecard', 540, 1180, 900, 150, { k: P01(t, s3 + 1.5), rot: -1, paper: P.ink, border: 6 }, (w, h) => wave(20, h / 2, w - 40, 50, t, '#9fe3ff'))
      ;['ELECTRONIC SOUNDS', 'ODD GUITAR EFFECTS', 'NEW TECHNIQUES'].forEach((s, i) => label('exp' + i, s, [300, 720, 520][i], [380, 330, 1310][i], { k: P01(t, s3 + 0.5 + i * 0.9), size: 34, font: F.block, paper: [P.red, P.teal, P.white][i], color: i < 2 ? P.white : P.ink, rot: [-5, 4, -2][i] }))
    }
  },
  // 6. the album: songs, then themes
  (t, T) => {
    const s2 = T[1][0]
    card('crt2', 540, 520, 480, 400, { k: P01(t, 0.1), rot: 3, mode: 'drop' }, (w, h) => crt(w, h, t, 'OK'))
    card('list', 540, 1020, 760, 470, { k: P01(t, 0.7), rot: -2, paper: '#f8f4e8', tape: 'top' }, (w, h) => {
      txt('FEATURING', 40, 70, { font: F.block, size: 40, color: P.red })
      ;['Paranoid Android', 'Karma Police', 'No Surprises'].forEach((s, i) => { const k = P01(t, T[0][0] + 1.6 + i * 0.7, 0.3); if (k <= 0) return; g.globalAlpha = k; txt(`${i + 1}.  ${s}`, 50, 170 + i * 100, { font: F.type, size: 56 }); g.globalAlpha = 1 })
    })
    for (let i = 0; i < 3; i++) underline(330, 360 + [430, 330, 350][i], 1050 - 225 + 170 + i * 100 + 14, P01(t, T[0][0] + 2.0 + i * 0.7, 0.4), { color: P.red, width: 6 })
    if (t > s2 - 0.2) {
      g.fillStyle = '#1e1c20'; g.fillRect(0, 0, W * clamp((t - s2 + 0.2) * 4), H)
      const th = [['TECHNOLOGY', (w, h) => chip(w, h), '#d9e8e0'], ['ISOLATION', (w, h) => lonely(w, h), '#1e2230'], ['CONSUMERISM', (w, h) => cart(w, h), P.white], ['ANXIETY', (w, h) => anxiety(w, h, t), '#f2e0dc']]
      th.forEach(([name, f, pap], i) => { const x = 290 + (i % 2) * 500, y = 560 + Math.floor(i / 2) * 520, k = P01(t, s2 + 0.9 + i * 0.75); card('th' + i, x, y, 400, 380, { k, rot: [-4, 3, 2, -3][i], paper: pap }, f); label('thl' + i, name, x, y + 230, { k: P01(t, s2 + 1.1 + i * 0.75), size: 44, font: F.head, paper: [P.teal, P.white, P.mustard, P.red][i], color: i === 1 || i === 2 ? P.ink : P.white, rot: [3, -3, -2, 4][i] }) })
      label('life', 'of modern life', 540, 1500 - 120, { k: P01(t, s2 + 4.2), size: 42, font: F.mark, paper: P.white, rot: -2 })
    }
  },
  // 7. the impact
  (t, T) => {
    const s2 = T[1][0]
    card('cal', 300, 560, 380, 460, { k: P01(t, 0.15), rot: -5, tape: 'top', paper: P.white }, (w, h) => calendar(w, h, 'JUNE', '16', '1997'))
    label('rel', 'RELEASED', 760, 420, { k: P01(t, 0.6), size: 60, font: F.head, paper: P.ink, color: P.white, rot: 5 })
    card('book', 760, 800, 380, 440, { k: P01(t, 1.6), rot: 4 }, (w, h) => { g.fillStyle = '#2f3f6a'; g.fillRect(0, 0, w, h); txt('WHAT', w / 2, 110, { font: F.head, size: 70, color: P.white, align: 'center' }); txt('ALT-ROCK', w / 2, 200, { font: F.head, size: 70, color: P.mustard, align: 'center' }); txt('SOUNDS', w / 2, 290, { font: F.head, size: 70, color: P.white, align: 'center' }); txt('LIKE', w / 2, 380, { font: F.head, size: 70, color: P.white, align: 'center' }) })
    scribble([[600, 620], [920, 990]], P01(t, T[0][1] - 1.6, 0.35), { width: 14 }); scribble([[920, 620], [600, 990]], P01(t, T[0][1] - 1.25, 0.35), { width: 14 })
    stamp('CHALLENGED', 520, 1150, -7, P01(t, T[0][1] - 0.9), { size: 80 })
    if (t > s2 - 0.2) {
      g.fillStyle = 'rgba(227,211,192,0.96)'; g.fillRect(W * (1 - clamp((t - s2 + 0.2) * 5)), 0, W, H)
      card('guit', 540, 520, 500, 420, { k: P01(t, s2), rot: -3, mode: 'drop' }, (w, h) => { g.fillStyle = '#f6efdf'; g.fillRect(0, 0, w, h); guitarIcon(w / 2, h * 0.62, 2.1, P.red) })
      label('gb', 'A GUITAR BAND COULD BE...', 540, 790, { k: P01(t, s2 + 0.4), size: 40, font: F.block, paper: P.ink, color: P.white, rot: -2 })
      ;['EXPERIMENTAL', 'ATMOSPHERIC', 'AMBITIOUS'].forEach((s, i) => ransom('adj' + i, s, 540, 920 + i * 125, 92, s2 + 1.1 + i * 0.6, t, { stagger: 0.025 }))
      card('chart', 540, 1310, 700, 250, { k: P01(t, s2 + 3.2), rot: 2, paper: P.white }, (w, h) => { chartUp(w, h, P01(t, s2 + 3.4, 0.9)); txt('...AND A HIT', 40, 60, { font: F.mark, size: 40, color: P.teal }) })
    }
  },
  // 8. legacy, and the last line
  (t, T) => {
    const s2 = T[1][0]
    if (t < s2 + 0.05) {
      card('rec', 540, 700, 560, 560, { k: P01(t, 0.15), rot: 0, paper: '#1a1a1e', border: 8 }, (w, h) => disc(w / 2, h / 2, 240, t * 0.6, 'OK COMPUTER'))
      for (let i = 0; i < 5; i++) star(250 + i * 145, 360, 46, P.mustard, P01(t, 0.6 + i * 0.12))
      label('celeb', 'ONE OF THE MOST CELEBRATED ALBUMS', 540, 1040, { k: P01(t, 1.3), size: 36, font: F.block, paper: P.white, rot: -2 })
      // influence: lines out to many small guitars
      const r = rng(77)
      for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 360 + r() * 140, x = 540 + Math.cos(a) * d, y = 700 + Math.sin(a) * d * 1.05, k = P01(t, 3.0 + i * 0.12, 0.4); if (y > 1000 || k <= 0) continue; g.strokeStyle = 'rgba(216,55,31,.7)'; g.lineWidth = 3; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(540, 700); g.lineTo(lerp(540, x, k), lerp(700, y, k)); g.stroke(); g.setLineDash([]); if (k > 0.9) guitarIcon(x, y + 30, 0.6, [P.blue, P.teal, P.mustard, P.pink][i % 4]) }
      for (let i = 0; i < 6; i++) { const x = 140 + i * 160, k = P01(t, 3.6 + i * 0.15); card('inf' + i, x, 1220, 130, 190, { k, rot: (i - 2.5) * 3, paper: [P.mustard, P.pink, P.white, P.teal, P.blue, P.white][i] }, (w, h) => silhouette(w, h)) }
      label('count', 'countless musicians followed', 540, 1340 - 30, { k: P01(t, 4.2), size: 36, font: F.mark, paper: P.white, rot: 2 })
    } else {
      g.fillStyle = '#151312'; g.fillRect(0, 0, W, H)
      ransom('rh', 'AND RADIOHEAD?', 540, 640, 110, s2 + 0.05, t, { stagger: 0.035, dark: true })
      const s3 = T[2][0]
      ransom('ogs1', 'THEY WERE ONLY', 540, 900, 96, s3, t, { stagger: 0.03, dark: true })
      ransom('ogs2', 'GETTING STARTED', 540, 1040, 110, s3 + 0.45, t, { stagger: 0.03, dark: true })
      arrow(380, 1200, 760, 1180, P01(t, s3 + 1.2, 0.5), { color: P.mustard, width: 12 })
    }
  },
]

// ---------- timeline ----------
let TIM, STARTS = [], DUR = 0
function tear(x0, t) { // paper tear wipe between scenes
  g.save(); g.translate(x0, 0); g.fillStyle = P.white; g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 24; g.fill(torn('wipe', 1300, 2400, 40, 50)); g.restore()
}
function frame(T) {
  NOW = T
  let i = STARTS.findIndex((s, j) => T < (STARTS[j + 1] ?? Infinity)); if (i < 0) i = 0
  const s = STARTS[i], t = T - s, sc = TIM[i], D = (STARTS[i + 1] ?? DUR) - s
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1
  background(i)
  chapter(i, NAMES[i], P01(t, 0.05, 0.3))
  SCENES[i](t, sc.sentences, D)
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1
  for (const [a, b, text] of sc.sentences) caption(text.replace('Tom Yorke', 'Thom Yorke').replace('Saint Catherine', 'St Catherine').replace('nineteen ninety-seven', '1997').replace('nineteen ninety-six', '1996').replace('June sixteenth, ', 'June 16, '), a, b, t)
  // tear wipe across each cut: the next scene is revealed behind the passing sheet
  const prevGap = t, nextGap = D - t
  if (i > 0 && prevGap < 0.28) tear(lerp(-120, 1500, prevGap / 0.28), t)
  if (i < STARTS.length - 1 && nextGap < 0.22) tear(lerp(-1400, -120, 1 - nextGap / 0.22), t)
  // film grain + soft vignette, a little flicker
  const f = Math.floor(T * FPS_BOIL)
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.12; g.translate((f * 37) % 256, (f * 91) % 256); g.fillStyle = GRAIN; g.fillRect(-256, -256, W + 512, H + 512); g.restore()
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,15,0,0.35)'); g.fillStyle = vg; g.fillRect(0, 0, W, H)
  if (T < 0.4) { g.fillStyle = `rgba(0,0,0,${1 - T / 0.4})`; g.fillRect(0, 0, W, H) }
  if (T > DUR - 0.8) { g.fillStyle = `rgba(0,0,0,${clamp((T - DUR + 0.8) / 0.8)})`; g.fillRect(0, 0, W, H) }
}

;(async () => {
  try { await Promise.all([`120px Anton`, `40px "Archivo Black"`, `40px "Special Elite"`, `40px "Permanent Marker"`, `900 40px "Playfair Display"`].map((f) => document.fonts.load(f))) } catch {}
  buildTextures()
  TIM = await (await fetch('voice/timing.json')).json()
  let s = LEAD; for (const sc of TIM) { STARTS.push(s); s += sc.dur } DUR = s + TAIL
  STARTS[0] = 0; TIM[0].sentences.forEach((m) => { m[0] += LEAD; m[1] += LEAD })
  window.DUR = DUR
  window.STARTS = STARTS.map((x, i) => (i ? x : LEAD))
  window.render = (t) => frame(Math.max(0, Math.min(DUR - 1e-3, t)))
  const q = new URLSearchParams(location.search); window.render(q.has('t') ? +q.get('t') : 0)
  window.READY = true
})()
