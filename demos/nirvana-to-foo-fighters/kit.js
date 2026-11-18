// kit.js: a cardboard miniature kit for three.js. Everything is cut from card: flat extruded cutouts with
// corrugated edges and a painted face, folded-card boxes, paper drums, cotton clouds, googly-eyed puppets.
// All textures are procedural canvases; all randomness is seeded.
import * as THREE from 'three'

export const KRAFT = '#b98b5c', INK = '#2e1d10'
export const FONT = { mark: '"Permanent Marker", "Comic Sans MS", cursive', hand: '"Patrick Hand", "Comic Sans MS", cursive', block: '"Archivo Black", "Arial Black", sans-serif' }
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const lerp = (a, b, k) => a + (b - a) * k
export const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k) }
export const D = (d) => (d * Math.PI) / 180
export const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(4, Math.round(w)); c.height = Math.max(4, Math.round(h)); return [c, c.getContext('2d')] }
const texOf = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t }
let uid = 1

// ---------- shared textures ----------
let KR = null, CORR = null
export function kraftCanvas() {
  if (KR) return KR
  const [c, x] = mk(512, 512), r = rng(11)
  x.fillStyle = KRAFT; x.fillRect(0, 0, 512, 512)
  const d = x.getImageData(0, 0, 512, 512)
  for (let i = 0; i < d.data.length; i += 4) { const v = (r() - 0.5) * 16; d.data[i] += v; d.data[i + 1] += v * 0.9; d.data[i + 2] += v * 0.7 }
  x.putImageData(d, 0, 0)
  for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(${r() < 0.5 ? '70,45,20' : '230,200,160'},${0.05 + r() * 0.1})`; x.lineWidth = 0.6 + r(); x.beginPath(); const a = r() * 512, b = r() * 512, an = r() * 6.3, l = 4 + r() * 18; x.moveTo(a, b); x.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); x.stroke() }
  for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(r() * 512, r() * 512, 0, r() * 512, r() * 512, 40 + r() * 90); g.addColorStop(0, `rgba(90,60,30,${0.04 + r() * 0.05})`); g.addColorStop(1, 'rgba(90,60,30,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512) }
  return (KR = c)
}
// edge of corrugated board: two liners and the wavy flute between them
const corrCache = new Map()
function corrMat(depth) {
  const key = depth.toFixed(3); if (corrCache.has(key)) return corrCache.get(key)
  if (!CORR) {
    const [c, x] = mk(64, 64)
    x.fillStyle = '#c9a072'; x.fillRect(0, 0, 64, 64)
    x.fillStyle = '#8a5f36'; x.fillRect(0, 0, 64, 7); x.fillRect(0, 57, 64, 7)
    x.fillStyle = '#5a3a1c'; for (let i = 0; i < 64; i++) { const y = 32 + Math.sin((i / 64) * Math.PI * 2) * 22; x.fillRect(i, y - 2.5, 1, 5) }
    x.fillStyle = 'rgba(60,35,15,0.35)'; for (let i = 0; i < 64; i += 2) { const y = 32 + Math.sin((i / 64) * Math.PI * 2) * 22; x.fillRect(i, y < 32 ? y : 7, 1, y < 32 ? 57 - y : y - 7) }
    CORR = c
  }
  const t = texOf(CORR); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.42, 1 / depth); t.offset.set(0, -(1 - depth) / depth)
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); corrCache.set(key, m); return m
}

// ---------- point helpers (2D outlines) ----------
export const rectPts = (w, h, cx = 0, cy = 0) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]
export function roundPts(w, h, r, cx = 0, cy = 0, n = 5) {
  const out = [], c = [[cx + w / 2 - r, cy - h / 2 + r, -90], [cx + w / 2 - r, cy + h / 2 - r, 0], [cx - w / 2 + r, cy + h / 2 - r, 90], [cx - w / 2 + r, cy - h / 2 + r, 180]]
  for (const [x, y, a0] of c) for (let i = 0; i <= n; i++) { const a = D(a0 + (i / n) * 90); out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]) }
  return out
}
export const ellPts = (rx, ry, cx = 0, cy = 0, n = 28) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry])
// hand-cut wobble: subdivide edges and nudge points
function handCut(pts, amt, seed) {
  if (!amt) return pts
  const r = rng(seed), out = []
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 0.9))
    for (let k = 0; k < n; k++) { const u = k / n; out.push([lerp(x0, x1, u) + (r() - 0.5) * amt, lerp(y0, y1, u) + (r() - 0.5) * amt]) }
  }
  return out
}

// ---------- the cutout ----------
// pts: outline (x right, y up). paint(x, P): draw on the face; P.X(x), P.Y(y) map world -> px; P.s = px per unit.
export function cutout(pts, { depth = 0.28, paint, res = 300, seed, jitter = 0.05, outline = INK, outlineW = 0.07, cast = true, recv = true, base = true } = {}) {
  seed = seed ?? uid++
  const P2 = handCut(pts, jitter, seed)
  const shape = new THREE.Shape(P2.map(([x, y]) => new THREE.Vector2(x, y)))
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 })
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of P2) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  const bw = x1 - x0, bh = y1 - y0, pos = geo.attributes.position, uv = geo.attributes.uv, g0 = geo.groups[0]
  for (let i = g0.start; i < g0.start + g0.count; i++) uv.setXY(i, (pos.getX(i) - x0) / bw, (pos.getY(i) - y0) / bh)
  geo.translate(0, 0, -depth)
  const sc = res / Math.max(bw, bh), [c, x] = mk(bw * sc, bh * sc)
  const P = { X: (v) => (v - x0) * sc, Y: (v) => (y1 - v) * sc, s: sc, w: c.width, h: c.height, x0, y0, x1, y1 }
  if (base) { x.fillStyle = x.createPattern(kraftCanvas(), 'repeat'); x.fillRect(0, 0, c.width, c.height) }
  const path = () => { x.beginPath(); P2.forEach(([a, b], i) => (i ? x.lineTo(P.X(a), P.Y(b)) : x.moveTo(P.X(a), P.Y(b)))); x.closePath() }
  x.save(); path(); x.clip(); paint && paint(x, P)
  // darker cut edge + marker outline
  if (outline) { x.strokeStyle = outline; x.lineWidth = outlineW * sc * 2; x.lineJoin = 'round'; path(); x.stroke() }
  x.restore()
  const face = new THREE.MeshStandardMaterial({ map: texOf(c), roughness: 0.92 })
  const m = new THREE.Mesh(geo, [face, corrMat(depth)]); m.castShadow = cast; m.receiveShadow = recv
  m.userData.canvas = c; m.userData.P = P; m.userData.redraw = (fn) => { x.save(); path(); x.clip(); fn(x, P); x.restore(); face.map.needsUpdate = true }
  return m
}
// painting helpers for faces
export const fillAll = (x, P, col) => { x.fillStyle = col; x.fillRect(0, 0, P.w, P.h) }
export function paperGrain(x, P, alpha = 0.18) { x.globalAlpha = alpha; x.fillStyle = x.createPattern(kraftCanvas(), 'repeat'); x.globalCompositeOperation = 'multiply'; x.fillRect(0, 0, P.w, P.h); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1 }
export function paint(col, extra, alpha = 0.84) { return (x, P) => { x.globalAlpha = alpha; fillAll(x, P, col); x.globalAlpha = 1; paperGrain(x, P, 0.3); extra && extra(x, P) } }
export function marker(x, P, pts, w = 0.09, col = INK) { x.strokeStyle = col; x.lineWidth = w * P.s; x.lineCap = x.lineJoin = 'round'; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(P.X(a), P.Y(b)) : x.moveTo(P.X(a), P.Y(b)))); x.stroke() }
export function words(x, P, s, cx, cy, size, { font = FONT.mark, col = INK, align = 'center', rot = 0 } = {}) { x.save(); x.translate(P.X(cx), P.Y(cy)); x.rotate(rot); x.font = `${size * P.s}px ${font}`; x.textAlign = align; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(s, 0, 0); x.restore() }

// a text card on cardboard
export function card(w, h, text, { size, font = FONT.mark, col = INK, bg = '#f3ead6', depth = 0.18, seed, lines } = {}) {
  return cutout(rectPts(w, h), { depth, seed, paint: (x, P) => {
    fillAll(x, P, bg); paperGrain(x, P, 0.3)
    const L = lines || [text], sz = size || h * 0.5 / L.length
    L.forEach((s, i) => words(x, P, s, 0, h / 2 - (h / (L.length + 1)) * (i + 1), sz, { font, col }))
  } })
}
// folded-card box: per-face paint functions (front, back, top, bottom, left, right)
export function box(w, h, d, { color = KRAFT, front, top, side, rough = 0.9 } = {}) {
  const face = (fw, fh, fn) => { const sc = 300 / Math.max(fw, fh), [c, x] = mk(fw * sc, fh * sc), P = { X: (v) => (v + fw / 2) * sc, Y: (v) => (fh / 2 - v) * sc, s: sc, w: c.width, h: c.height }; x.fillStyle = x.createPattern(kraftCanvas(), 'repeat'); x.fillRect(0, 0, c.width, c.height); if (color !== KRAFT) { x.fillStyle = color; x.globalAlpha = 0.88; x.fillRect(0, 0, c.width, c.height); x.globalAlpha = 1; paperGrain(x, P, 0.3) } fn && fn(x, P); x.strokeStyle = 'rgba(46,29,16,.8)'; x.lineWidth = 0.08 * sc * 2; x.strokeRect(0, 0, c.width, c.height); return new THREE.MeshStandardMaterial({ map: texOf(c), roughness: rough }) }
  const mats = [face(d, h, side), face(d, h, side), face(w, d, top), face(w, d), face(w, h, front), face(w, h)]
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); m.castShadow = m.receiveShadow = true; return m
}
export function cyl(r, h, { color = KRAFT, cap = '#efe8da', seg = 24, open = false } = {}) {
  const [c, x] = mk(512, 128); x.fillStyle = x.createPattern(kraftCanvas(), 'repeat'); x.fillRect(0, 0, 512, 128); x.fillStyle = color; x.globalAlpha = 0.9; x.fillRect(0, 0, 512, 128); x.globalAlpha = 1
  const mats = [new THREE.MeshStandardMaterial({ map: texOf(c), roughness: 0.85 }), new THREE.MeshStandardMaterial({ color: cap, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: cap, roughness: 0.9 })]
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg, 1, open), mats); m.castShadow = m.receiveShadow = true; return m
}
export function cotton(r = 3, seed = 1, n = 9) { // cotton-ball cloud
  const g = new THREE.Group(), rr = rng(seed), m = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 1 })
  for (let i = 0; i < n; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.45 + rr() * 0.4), 2), m); s.position.set((rr() - 0.5) * r * 2.4, (rr() - 0.3) * r * 0.7, (rr() - 0.5) * r * 0.6); s.castShadow = true; g.add(s) }
  return g
}
// --------- googly eye ---------
const EYE_W = new THREE.MeshStandardMaterial({ color: '#fbfbf7', roughness: 0.35 })
const EYE_B = new THREE.MeshStandardMaterial({ color: '#0c0c0e', roughness: 0.3 })
const EYE_DOME = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.04, clearcoat: 1, depthWrite: false })
export function googly(r = 0.7) {
  const g = new THREE.Group()
  const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 28), EYE_W); w.rotation.x = Math.PI / 2; w.castShadow = true; g.add(w)
  const p = new THREE.Mesh(new THREE.CircleGeometry(r * 0.5, 24), EYE_B); p.position.z = 0.1; g.add(p)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), EYE_DOME); dome.rotation.x = Math.PI / 2; dome.scale.set(1, 0.42, 1); dome.position.z = 0.06; g.add(dome)
  g.userData.look = (dx, dy) => { const L = Math.hypot(dx, dy) || 1, k = Math.min(1, L); p.position.x = (dx / L) * k * r * 0.42; p.position.y = (dy / L) * k * r * 0.42 }
  return g
}

// --------- expression decals ---------
function decalTex(draw) { const [c, x] = mk(256, 128); x.strokeStyle = INK; x.fillStyle = INK; x.lineCap = x.lineJoin = 'round'; draw(x); return texOf(c) }
const MOUTHS = {}, BROWS = {}
function mouths() {
  if (MOUTHS.neutral) return
  MOUTHS.neutral = decalTex((x) => { x.lineWidth = 10; x.beginPath(); x.moveTo(90, 66); x.quadraticCurveTo(128, 72, 166, 64); x.stroke() })
  MOUTHS.sad = decalTex((x) => { x.lineWidth = 10; x.beginPath(); x.moveTo(92, 78); x.quadraticCurveTo(128, 50, 164, 78); x.stroke() })
  MOUTHS.smile = decalTex((x) => { x.lineWidth = 10; x.beginPath(); x.moveTo(84, 54); x.quadraticCurveTo(128, 96, 172, 54); x.stroke() })
  MOUTHS.oh = decalTex((x) => { x.beginPath(); x.ellipse(128, 64, 16, 20, 0, 0, 7); x.fill() })
  MOUTHS.sing = decalTex((x) => { x.beginPath(); x.ellipse(128, 62, 34, 30, 0, 0, 7); x.fill(); x.fillStyle = '#c24a3a'; x.beginPath(); x.ellipse(128, 78, 20, 10, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(104, 36, 48, 9) })
  MOUTHS.grin = decalTex((x) => { x.beginPath(); x.moveTo(80, 50); x.quadraticCurveTo(128, 112, 176, 50); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.fillRect(96, 52, 64, 10) })
  BROWS.neutral = decalTex((x) => { x.lineWidth = 11; x.beginPath(); x.moveTo(40, 70); x.lineTo(100, 64); x.moveTo(156, 64); x.lineTo(216, 70); x.stroke() })
  BROWS.sad = decalTex((x) => { x.lineWidth = 11; x.beginPath(); x.moveTo(40, 80); x.lineTo(102, 52); x.moveTo(154, 52); x.lineTo(216, 80); x.stroke() })
  BROWS.focus = decalTex((x) => { x.lineWidth = 12; x.beginPath(); x.moveTo(42, 54); x.lineTo(104, 76); x.moveTo(152, 76); x.lineTo(214, 54); x.stroke() })
  BROWS.up = decalTex((x) => { x.lineWidth = 11; x.beginPath(); x.moveTo(40, 64); x.quadraticCurveTo(70, 40, 102, 56); x.moveTo(154, 56); x.quadraticCurveTo(186, 40, 216, 64); x.stroke() })
}
function decal(w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.3, roughness: 0.8 })); return m }

// --------- the puppet ---------
// spec: { skin, hair, hairStyle: long|short|slick|curly|spiky, shirt, shirtArt(x,P), pants, shoes, stubble, goatee, glasses, seed }
export function puppet(spec = {}) {
  mouths()
  const sd = hash(spec.name || 'p'), r = rng(sd)
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body)
  const skin = spec.skin || '#e8b98f', hairC = spec.hair || '#3b2414'
  const part = (pts, col, extra, o = {}) => cutout(pts, { depth: 0.26, seed: hash(spec.name + col + pts.length + (o.k || '')), paint: paint(col, extra), ...o })
  const jnt = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g }
  // legs with knees: hip pivot -> thigh -> knee pivot -> shin + shoe
  const legs = [-1, 1].map((sx) => {
    const hip = jnt(sx * 0.95, 5.0, -0.05, body)
    const thigh = part(roundPts(1.45, 2.8, 0.35, 0, -1.3), spec.pants || '#3a4f74', (x, P) => marker(x, P, [[sx * 0.35, 0], [sx * 0.3, -2.4]], 0.05, 'rgba(20,20,40,.5)'), { k: 'th' + sx }); hip.add(thigh)
    const knee = jnt(0, -2.55, 0, hip)
    const shin = part(roundPts(1.35, 2.7, 0.35, 0, -1.25), spec.pants || '#3a4f74', null, { k: 'sh' + sx }); knee.add(shin)
    const shoe = part(roundPts(2.0, 0.95, 0.42, sx * 0.25, -2.65), spec.shoes || '#26221f', (x, P) => { x.fillStyle = '#f2efe6'; x.fillRect(0, P.h * 0.72, P.w, P.h * 0.28) }, { k: 'so' + sx }); shoe.position.z = 0.12; knee.add(shoe)
    return { hip, knee }
  })
  const torsoJ = jnt(0, 5.0, 0, body)
  const torso = part([[-2.0, 0], [2.0, 0], [2.35, 4.6], [1.9, 5.45], [-1.9, 5.45], [-2.35, 4.6]], spec.shirt || '#2b2b30', spec.shirtArt, { k: 'to' }); torso.position.z = 0.0; torsoJ.add(torso)
  const arms = [-1, 1].map((sx) => {
    const sh = jnt(sx * 2.05, 4.85, sx > 0 ? 0.32 : 0.3, torsoJ)
    const up = part(roundPts(1.15, 2.7, 0.5, 0, -1.15), spec.sleeve || spec.shirt || '#2b2b30', null, { k: 'ua' + sx }); sh.add(up)
    const el = jnt(0, -2.35, 0.05, sh)
    const fo = part(roundPts(1.0, 2.5, 0.45, 0, -1.1), spec.forearm || skin, null, { k: 'fa' + sx }); el.add(fo)
    const hand = part(ellPts(0.62, 0.7, 0, -2.45, 14), skin, null, { k: 'ha' + sx }); hand.position.z = 0.04; el.add(hand)
    const grip = jnt(0, -2.5, 0.35, el)
    return { sh, el, grip }
  })
  // head
  const neck = jnt(0, 5.35, 0.02, torsoJ)
  neck.add(part(rectPts(1.1, 0.9, 0, 0.2), skin, null, { k: 'nk' }))
  const head = jnt(0, 0.35, 0.08, neck)
  const style = spec.hairStyle || 'short'
  // back hair
  const backHair = {
    long: [[-2.55, 3.3], [-2.7, 1.2], [-2.6, -0.9], [-1.4, -1.25], [1.4, -1.25], [2.6, -0.9], [2.7, 1.2], [2.55, 3.3], [1.9, 4.9], [0, 5.55], [-1.9, 4.9]],
    short: ellPts(2.35, 2.6, 0, 2.95),
    slick: ellPts(2.3, 2.65, 0, 3.0),
    curly: Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * Math.PI * 2, rr = 2.85 + (i % 2) * 0.42; return [Math.cos(a) * rr * 1.02, 2.95 + Math.sin(a) * rr * 0.98] }),
    spiky: Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * Math.PI * 2, rr = Math.sin(a) > -0.2 ? (i % 2 ? 2.4 : 3.35) : 2.3; return [Math.cos(a) * rr, 3.0 + Math.sin(a) * rr] }),
  }[style]
  const hb = part(backHair, hairC, (x, P) => { for (let i = 0; i < 14; i++) marker(x, P, [[-2.2 + i * 0.32, 4.6], [-2.4 + i * 0.36, -0.6]], 0.035, 'rgba(0,0,0,.28)') }, { k: 'hb' }); hb.position.z = -0.32; head.add(hb)
  if (spec.ears !== false) for (const sx of [-1, 1]) { const e = part(ellPts(0.45, 0.62, sx * 2.05, 2.5, 12), skin, null, { k: 'ear' + sx }); e.position.z = -0.18; head.add(e) }
  const face = part(ellPts(2.08, 2.5, 0, 2.55, 30), skin, (x, P) => {
    // nose, cheeks, stubble
    marker(x, P, [[0.05, 2.5], [-0.25, 1.85], [0.2, 1.75]], 0.07, 'rgba(60,30,15,.8)')
    x.fillStyle = 'rgba(214,110,90,0.25)'; for (const sx of [-1, 1]) { x.beginPath(); x.ellipse(P.X(sx * 1.25), P.Y(1.9), 0.42 * P.s, 0.28 * P.s, 0, 0, 7); x.fill() }
    if (spec.stubble) { const rr = rng(sd + 5); x.fillStyle = 'rgba(40,24,12,0.42)'; for (let i = 0; i < 260; i++) { const a = rr() * Math.PI, d = 1.3 + rr() * 0.95; const px = Math.cos(a) * d * 1.05, py = 2.35 - Math.sin(a) * d; if (py > 1.85 && Math.abs(px) < 1.5) continue; x.fillRect(P.X(px), P.Y(py), 0.05 * P.s, 0.05 * P.s) } }
  }, { k: 'fc' }); head.add(face)
  // front hair pieces
  const front = []
  if (style === 'long') {
    front.push([[-2.3, 3.0], [-2.1, 4.5], [-0.9, 5.3], [0, 5.0], [0.9, 5.3], [2.1, 4.5], [2.3, 3.0], [1.55, 4.15], [0.35, 4.6], [0.05, 4.3], [-0.35, 4.6], [-1.55, 4.15]])
    front.push([[-2.55, 3.4], [-1.65, 3.7], [-1.75, 1.0], [-1.95, -0.95], [-2.75, -0.7], [-2.75, 1.4]])
    front.push([[2.55, 3.4], [1.65, 3.7], [1.75, 1.0], [1.95, -0.95], [2.75, -0.7], [2.75, 1.4]])
  } else if (style === 'short') front.push([[-2.25, 3.3], [-2.05, 4.6], [0, 5.55], [2.05, 4.6], [2.25, 3.3], [1.4, 4.35], [-0.6, 4.5], [-1.5, 4.1]])
  else if (style === 'slick') front.push([[-2.2, 3.5], [-1.9, 4.8], [0, 5.65], [2.0, 4.9], [2.25, 3.6], [1.5, 4.55], [0, 4.7], [-1.4, 4.45]])
  else if (style === 'curly') front.push(Array.from({ length: 14 }, (_, i) => { const u = i / 13, a = Math.PI * (1 - u); return [Math.cos(a) * 2.35, 3.95 + Math.sin(a) * 1.45 + (i % 2) * 0.28] }).concat([[2.0, 3.6], [0, 4.25], [-2.0, 3.6]]))
  else if (style === 'spiky') front.push([[-2.2, 3.6], [-2.6, 5.2], [-1.4, 4.6], [-1.0, 5.9], [-0.2, 4.8], [0.4, 6.0], [0.9, 4.8], [1.7, 5.6], [1.7, 4.4], [2.6, 4.9], [2.2, 3.6], [0, 4.3]])
  front.forEach((pts, i) => { const m = part(pts, hairC, (x, P) => { for (let j = 0; j < 10; j++) marker(x, P, [[-2.3 + j * 0.5, 5.4], [-2.5 + j * 0.52, -1.0]], 0.035, 'rgba(0,0,0,.25)') }, { k: 'hf' + i }); m.position.z = 0.34; head.add(m) })
  if (spec.goatee) { const gt = part([[-0.75, 1.25], [0.75, 1.25], [0.55, 0.35], [0, 0.05], [-0.55, 0.35]], hairC, null, { k: 'gt' }); gt.position.z = 0.3; head.add(gt) }
  // eyes, brows, mouth
  const eyes = [-1, 1].map((sx) => { const e = googly(spec.eye || 0.72); e.position.set(sx * 0.82, 2.95, 0.42); head.add(e); return e })
  if (spec.glasses) { const gl = cutout([...ellPts(0.95, 0.85, -0.82, 2.95, 18)], { depth: 0.08, paint: paint('#18181b'), outline: null }); const gr = cutout([...ellPts(0.95, 0.85, 0.82, 2.95, 18)], { depth: 0.08, paint: paint('#18181b'), outline: null }); for (const m of [gl, gr]) { m.position.z = 0.62; m.material[0].transparent = true; m.material[0].opacity = 0.0; } const rimC = new THREE.MeshStandardMaterial({ color: '#1a1a1c' }); for (const sx of [-1, 1]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 6, 22), rimC); rim.position.set(sx * 0.82, 2.95, 0.7); head.add(rim) } const br = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.1), rimC); br.position.set(0, 3.05, 0.7); head.add(br) }
  const brow = decal(2.9, 1.45); brow.position.set(0, 3.95, 0.4); head.add(brow)
  const mouth = decal(2.0, 1.0); mouth.position.set(0, 1.45, 0.3); head.add(mouth)
  let face_ = ''
  const api = {
    root, body, head, torsoJ, neck, arms, legs, eyes,
    expr(m = 'neutral', b = 'neutral') { const k = m + b; if (k === face_) return; face_ = k; mouth.material.map = MOUTHS[m]; mouth.material.needsUpdate = true; brow.material.map = BROWS[b]; brow.material.needsUpdate = true },
    // angles in degrees: s = shoulder, e = elbow (z rotation); h = hip forward (x), k = knee (x); head tilt/turn
    pose({ sl = 8, el = 6, sr = -8, er = -6, hl = 0, hr = 0, kl = 0, kr = 0, tilt = 0, turn = 0, nod = 0, lean = 0, bob = 0, slx = 0, srx = 0, elx = 0, erx = 0 } = {}) {
      arms[0].sh.rotation.set(D(slx), 0, D(-sl)); arms[0].el.rotation.set(D(elx), 0, D(-el))
      arms[1].sh.rotation.set(D(srx), 0, D(-sr)); arms[1].el.rotation.set(D(erx), 0, D(-er))
      legs[0].hip.rotation.x = D(-hl); legs[1].hip.rotation.x = D(-hr); legs[0].knee.rotation.x = D(kl); legs[1].knee.rotation.x = D(kr)
      neck.rotation.set(D(nod), D(turn), D(tilt)); torsoJ.rotation.z = D(lean); body.position.y = bob
    },
    look(dx, dy) { eyes.forEach((e) => e.userData.look(dx, dy)) },
    sit(seatH = 4.4) { api.pose({ ...api._last, hl: 90, hr: 90, kl: 90, kr: 90 }); body.position.y = seatH - 5.0 },
  }
  api.expr('neutral', 'neutral'); api.pose(); api.look(0, -0.6)
  return api
}

// --------- props ---------
export function guitar({ body = '#c0392b', acoustic = false, bass = false, scale = 1 } = {}) {
  const g = new THREE.Group()
  const L = bass ? 1.25 : 1
  const shape = acoustic ? [...ellPts(1.5, 1.6, 0, 0, 20).filter(([, y]) => y <= 0.4), ...ellPts(1.15, 1.2, 0, 1.7, 18).filter(([, y]) => y > 1.1)] : [[-1.3, -1.2], [0, -1.6], [1.4, -1.1], [1.1, 0.3], [1.6, 1.6], [0.6, 1.2], [0.3, 1.7], [-0.6, 1.5], [-1.5, 0.6]]
  const b = cutout(acoustic ? ellPts(1.45, 1.75, 0, 0.3, 24) : shape, { depth: 0.3, paint: paint(acoustic ? '#d9a05b' : body, (x, P) => {
    if (acoustic) { x.fillStyle = '#2b1a0e'; x.beginPath(); x.arc(P.X(0), P.Y(0.7), 0.45 * P.s, 0, 7); x.fill() } else { x.fillStyle = '#f3efe6'; x.beginPath(); x.ellipse(P.X(0.1), P.Y(-0.2), 0.8 * P.s, 0.55 * P.s, 0.4, 0, 7); x.fill() }
    x.fillStyle = '#1e1a16'; x.fillRect(P.X(-0.5), P.Y(-0.7), 1.0 * P.s, 0.22 * P.s)
  }) })
  g.add(b)
  const neck = cutout(rectPts(0.42, 4.0 * L, 0, 3.2 * L), { depth: 0.2, paint: paint('#5a3a20', (x, P) => { x.strokeStyle = '#d8d0c0'; x.lineWidth = 0.03 * P.s; for (let i = 0; i < 14; i++) { const y = P.Y(1.4 + i * 0.28 * L); x.beginPath(); x.moveTo(0, y); x.lineTo(P.w, y); x.stroke() } }) }); neck.position.z = 0.12; g.add(neck)
  const headst = cutout(roundPts(0.8, 1.0, 0.2, 0, 5.6 * L), { depth: 0.2, paint: paint('#2a1c10') }); headst.position.z = 0.12; g.add(headst)
  const strings = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.2 * L, 0.02), new THREE.MeshStandardMaterial({ color: '#e8e2d0', metalness: 0.6, roughness: 0.3 })); strings.position.set(0, 2.6 * L - 0.4, 0.24); g.add(strings)
  g.scale.setScalar(scale); return g
}
export function cassette(label = 'FOO FIGHTERS', sub = 'ROUGH MIXES') {
  return box(3.0, 1.9, 0.35, { color: '#1c1c20', front: (x, P) => { x.fillStyle = '#f4ecd8'; x.fillRect(P.X(-1.35), P.Y(0.8), 2.7 * P.s, 0.9 * P.s); x.fillStyle = INK; x.font = `${0.3 * P.s}px ${FONT.mark}`; x.textAlign = 'center'; x.fillText(label, P.X(0), P.Y(0.42)); x.fillStyle = '#333'; for (const sx of [-0.7, 0.7]) { x.beginPath(); x.arc(P.X(sx), P.Y(-0.35), 0.3 * P.s, 0, 7); x.fill() } } })
}
export function mic(h = 6) {
  const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: '#2a2a2e', metalness: 0.6, roughness: 0.4 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.25, 18), metal); base.position.y = 0.12; g.add(base)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h, 8), metal); pole.position.y = h / 2; g.add(pole)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), new THREE.MeshStandardMaterial({ color: '#8a8a90', metalness: 0.7, roughness: 0.35 })); head.position.y = h + 0.3; head.scale.y = 1.3; g.add(head)
  g.traverse((o) => o.isMesh && (o.castShadow = true)); g.userData.head = head; return g
}
export function drumKit() {
  const g = new THREE.Group(), shell = '#a8282e'
  const kick = cyl(2.2, 1.9, { color: shell }); kick.rotation.x = Math.PI / 2; kick.position.set(0, 2.2, 0); g.add(kick)
  const logo = cutout(ellPts(1.3, 1.3, 0, 0, 24), { depth: 0.05, paint: paint('#f3ead6', (x, P) => { x.fillStyle = INK; x.font = `${0.42 * P.s}px ${FONT.mark}`; x.textAlign = 'center'; x.fillText('ROCK', P.X(0), P.Y(-0.1)) }) }); logo.position.set(0, 2.2, 1.0); g.add(logo)
  for (const [x, y, z, r, h] of [[-2.0, 3.6, 0.6, 0.95, 0.75], [1.7, 4.3, -0.2, 0.85, 0.9], [-1.0, 4.6, -0.4, 0.8, 0.75], [2.9, 2.6, 0.2, 1.2, 1.7]]) { const d = cyl(r, h, { color: shell }); d.position.set(x, y, z); d.rotation.x = 0.25; g.add(d); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, y, 6), new THREE.MeshStandardMaterial({ color: '#888' })); st.position.set(x, y / 2, z); g.add(st) }
  const cymM = new THREE.MeshStandardMaterial({ color: '#c9a640', metalness: 0.7, roughness: 0.35 })
  for (const [x, y, z] of [[-3.2, 6.4, -0.6], [3.4, 6.8, -0.9], [-3.1, 4.5, 0.6]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.05, 20), cymM); c.position.set(x, y, z); c.rotation.z = 0.15; c.castShadow = true; g.add(c); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, y, 6), new THREE.MeshStandardMaterial({ color: '#888' })); st.position.set(x, y / 2, z); g.add(st); g.userData.cymbals = (g.userData.cymbals || []).concat(c) }
  return g
}
export function amp(w = 3.2, h = 3.0, d = 1.6, label = 'AMP') {
  return box(w, h, d, { color: '#1e1c1c', front: (x, P) => { x.fillStyle = '#5a4a3a'; x.fillRect(P.X(-w / 2 + 0.25), P.Y(h / 2 - 0.9), (w - 0.5) * P.s, (h - 1.15) * P.s); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; for (let i = 0; i < 30; i++) { x.beginPath(); x.moveTo(P.X(-w / 2 + 0.25), P.Y(h / 2 - 0.9 - i * 0.07)); x.lineTo(P.X(w / 2 - 0.25), P.Y(h / 2 - 0.9 - i * 0.07)); x.stroke() } x.fillStyle = '#d8c8a0'; x.fillRect(P.X(-w / 2 + 0.2), P.Y(h / 2 - 0.15), (w - 0.4) * P.s, 0.55 * P.s); x.fillStyle = INK; x.font = `${0.38 * P.s}px ${FONT.mark}`; x.fillText(label, P.X(-w / 2 + 0.35), P.Y(h / 2 - 0.55)) } })
}
export function stand(w, h) { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#3a3a3e', metalness: 0.4, roughness: 0.5 }); for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 6), m); l.position.set(sx * w / 2, h / 2, 0); l.rotation.z = sx * 0.12; g.add(l) } return g }
