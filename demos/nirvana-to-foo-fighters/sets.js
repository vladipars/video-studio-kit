// sets.js: the eight miniature scenes. Each builder returns { shots: [{ until, set, update(t), cam(t) }], cues }.
// t is seconds into the scene. T = sentence marks [[start, end, text], ...] in scene time. Puppets move on twos
// (12 poses a second: q(t)); cameras glide (motion-control style).
import * as THREE from 'three'
import { puppet, cutout, card, box, cyl, cotton, guitar, cassette, mic, drumKit, amp, stand, rectPts, roundPts, ellPts, paint, fillAll, paperGrain, marker, words, KRAFT, INK, FONT, clamp, lerp, ss, D, rng, hash } from './kit.js'

export const q = (t) => Math.floor(t * 12) / 12
const V = (x, y, z) => new THREE.Vector3(x, y, z)
const ease = (a, b, t) => ss(a, b, t)
// word time inside a sentence, by character position (good enough for cutting on a word)
export const wordAt = (T, j, w) => { const [a, b, s] = T[j], i = s.toLowerCase().indexOf(w.toLowerCase()); return a + (b - a) * (i < 0 ? 0 : i / s.length) }

// ---------- characters (same spec everywhere, so every set's copy looks identical) ----------
const DAVE = { name: 'dave', hair: '#3a2416', hairStyle: 'long', shirt: '#24242a', pants: '#3d5277', stubble: true, skin: '#e4b48a',
  shirtArt: (x, P) => { x.strokeStyle = 'rgba(200,195,185,.55)'; x.lineWidth = 0.07 * P.s; x.strokeRect(P.X(-1.5), P.Y(3.9), 1.1 * P.s, 1.1 * P.s) } }
const BARRETT = { name: 'barrett', hair: '#6a4a2a', hairStyle: 'short', glasses: true, shirt: '#a33a2c', sleeve: '#a33a2c', pants: '#46505e', skin: '#eac2a0',
  shirtArt: (x, P) => { x.strokeStyle = 'rgba(30,20,20,.55)'; x.lineWidth = 0.14 * P.s; for (let i = -3; i < 4; i++) { x.beginPath(); x.moveTo(P.X(i * 0.7), 0); x.lineTo(P.X(i * 0.7), P.h); x.stroke(); x.beginPath(); x.moveTo(0, P.Y(i * 0.7 + 2.6)); x.lineTo(P.w, P.Y(i * 0.7 + 2.6)); x.stroke() } } }
const GREG = { name: 'greg', hair: '#1b1411', hairStyle: 'slick', goatee: true, shirt: '#17171a', sleeve: '#2a2a2e', pants: '#1f1f24', skin: '#e2b08a',
  shirtArt: (x, P) => { x.fillStyle = '#2e2e33'; x.beginPath(); x.moveTo(P.X(-2.4), P.Y(4.6)); x.lineTo(P.X(-0.5), P.Y(5.4)); x.lineTo(P.X(-0.3), P.Y(0)); x.lineTo(P.X(-2.0), P.Y(0)); x.fill(); x.beginPath(); x.moveTo(P.X(2.4), P.Y(4.6)); x.lineTo(P.X(0.5), P.Y(5.4)); x.lineTo(P.X(0.3), P.Y(0)); x.lineTo(P.X(2.0), P.Y(0)); x.fill() } }
const BASSIST = { name: 'bassist', hair: '#2a1d14', hairStyle: 'short', shirt: '#4b6a48', pants: '#2b2b33', skin: '#e6b994' }
const DRUMMER = { name: 'drummer', hair: '#3a2618', hairStyle: 'curly', shirt: '#7a2f2f', pants: '#2f3a52', skin: '#e9be98' }
const GUITARIST = { name: 'guitarist', hair: '#e9d27a', hairStyle: 'spiky', shirt: '#c8579a', pants: '#1d1d22', skin: '#efc6a4',
  shirtArt: (x, P) => { x.fillStyle = '#f3d23c'; for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(P.X(-1.8 + (i % 4) * 1.2), P.Y(0.8 + Math.floor(i / 4) * 1.6), 0.28 * P.s, 0, 7); x.fill() } } }

// ---------- set helper ----------
function makeSet({ bg = '#2a1e14', sky = '#e8d8c0', ground = '#3a2818', hemi = 0.8, key = {}, fog } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg)
  if (fog) scene.fog = new THREE.Fog(fog[0], fog[1], fog[2])
  scene.add(new THREE.HemisphereLight(sky, ground, hemi))
  const k = new THREE.SpotLight(key.color || '#ffd9a8', key.int ?? 1100, 0, key.angle ?? 0.6, key.pen ?? 0.7, 1.5)
  k.position.set(...(key.pos || [-16, 30, 22])); k.target.position.set(...(key.target || [0, 4, 0])); k.castShadow = true; k.shadow.mapSize.set(2048, 2048); k.shadow.bias = -0.0005; k.shadow.normalBias = 0.02
  scene.add(k, k.target)
  const add = (o, x = 0, y = 0, z = 0, ry = 0) => { o.position.set(x, y, z); if (ry) o.rotation.y = ry; scene.add(o); return o }
  return { scene, key: k, add }
}
const floorCard = (w, d, col, extra) => { const f = cutout(rectPts(w, d), { depth: 0.4, res: 700, jitter: 0.12, paint: paint(col, extra) }); f.rotation.x = -Math.PI / 2; return f }
const wallCard = (w, h, col, extra) => cutout(rectPts(w, h, 0, h / 2), { depth: 0.4, res: 700, jitter: 0.12, paint: paint(col, extra) })
const planks = (x, P) => { x.strokeStyle = 'rgba(50,28,12,.45)'; x.lineWidth = 0.08 * P.s; for (let i = -60; i < 60; i += 2.4) { x.beginPath(); x.moveTo(P.X(i), 0); x.lineTo(P.X(i), P.h); x.stroke() } }
const stripes = (c) => (x, P) => { x.fillStyle = c; for (let i = -80; i < 80; i += 3) x.fillRect(P.X(i), 0, 0.9 * P.s, P.h) }
function windowCut(w, h, skyCol, extra) { const g = new THREE.Group(); const pane = cutout(rectPts(w, h), { depth: 0.1, paint: paint(skyCol, extra, 1), outline: null }); g.add(pane); const fr = '#efe6d2'; for (const [fw, fh, x, y] of [[w + 0.8, 0.5, 0, h / 2], [w + 0.8, 0.5, 0, -h / 2], [0.5, h, -w / 2, 0], [0.5, h, w / 2, 0], [w, 0.35, 0, 0], [0.35, h, 0, 0]]) { const f = cutout(rectPts(fw, fh, x, y), { depth: 0.3, paint: paint(fr) }); f.position.z = 0.2; g.add(f) } return g }
function pine(h = 9, seed = 1) { const g = new THREE.Group(); const t = cutout(rectPts(0.7, h * 0.35, 0, h * 0.17), { depth: 0.3, paint: paint('#5a3a20') }); g.add(t); for (let i = 0; i < 3; i++) { const w = h * (0.55 - i * 0.12), y = h * (0.25 + i * 0.22); const c = cutout([[-w / 2, y], [w / 2, y], [0, y + h * 0.4]], { depth: 0.3, seed: seed * 10 + i, paint: paint(['#2f5a3a', '#376a42', '#2b4f34'][i], (x, P) => { for (let j = 0; j < 8; j++) marker(x, P, [[-w / 2 + j * w / 8, y + 0.3], [0, y + h * 0.35]], 0.05, 'rgba(10,30,15,.35)') }) }); c.position.z = 0.05 * i; g.add(c) } return g }
function house(w, h, col, roofCol, seed, { glow } = {}) {
  const g = new THREE.Group()
  const body = cutout([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + w * 0.42], [-w / 2, h]], { depth: 0.35, seed, paint: paint(col, (x, P) => {
    x.strokeStyle = 'rgba(40,30,20,.35)'; x.lineWidth = 0.05 * P.s; for (let y = 0.6; y < h; y += 0.6) { x.beginPath(); x.moveTo(0, P.Y(y)); x.lineTo(P.w, P.Y(y)); x.stroke() }
    for (const [wx, wy] of [[-w * 0.25, h * 0.62], [w * 0.25, h * 0.62], [w * 0.25, h * 0.2]]) { x.fillStyle = '#f1dfa0'; x.globalAlpha = 0.9; x.fillRect(P.X(wx - 0.9), P.Y(wy + 0.8), 1.8 * P.s, 1.6 * P.s); x.globalAlpha = 1; marker(x, P, [[wx - 0.9, wy + 0.8], [wx + 0.9, wy + 0.8], [wx + 0.9, wy - 0.8], [wx - 0.9, wy - 0.8], [wx - 0.9, wy + 0.8]], 0.08); marker(x, P, [[wx, wy + 0.8], [wx, wy - 0.8]], 0.06) }
    x.fillStyle = '#5a3a26'; x.fillRect(P.X(-w * 0.32), P.Y(h * 0.42), 1.6 * P.s, h * 0.42 * P.s)
  }) })
  g.add(body)
  const roof = cutout([[-w / 2 - 0.7, h - 0.2], [0, h + w * 0.42 + 0.4], [w / 2 + 0.7, h - 0.2], [w / 2 + 0.3, h - 0.7], [0, h + w * 0.42 - 0.3], [-w / 2 - 0.3, h - 0.7]], { depth: 0.4, seed: seed + 1, paint: paint(roofCol) }); roof.position.z = 0.3; g.add(roof)
  if (glow) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.6), new THREE.MeshBasicMaterial({ color: '#7fb0ff', transparent: true, opacity: 0.0 })); gl.position.set(-w * 0.25, h * 0.62, 0.05); g.add(gl); g.userData.glow = gl }
  return g
}
function table(w, h, d, col = '#8a5a34') { const g = new THREE.Group(); const top = box(w, 0.4, d, { color: col }); top.position.y = h; g.add(top); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = box(0.45, h, 0.45, { color: col }); l.position.set(x * (w / 2 - 0.4), h / 2, z * (d / 2 - 0.4)); g.add(l) } return g }
function chair(col = '#6a4a30') { const g = new THREE.Group(); const seat = box(4.2, 0.4, 3.6, { color: col }); seat.position.y = 3.0; g.add(seat); const back = box(4.2, 4.6, 0.4, { color: col }); back.position.set(0, 5.1, -1.7); g.add(back); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = box(0.4, 3.0, 0.4, { color: col }); l.position.set(x * 1.8, 1.5, z * 1.5); g.add(l) } return g }
function lamp(col = '#e8d6a8') { const g = new THREE.Group(); const b = cyl(0.9, 0.4, { color: '#5a4630' }); b.position.y = 0.2; g.add(b); const p = cyl(0.15, 4.5, { color: '#5a4630' }); p.position.y = 2.6; g.add(p); const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.7, 1.9, 18, 1, true), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, emissive: '#ffcf80', emissiveIntensity: 0.35, roughness: 1 })); sh.position.y = 5.2; g.add(sh); const l = new THREE.PointLight('#ffc880', 60, 30, 1.6); l.position.y = 4.8; l.castShadow = false; g.add(l); g.userData.light = l; return g }
function cone(col, r, h, op = 0.12) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.geometry.translate(0, -h / 2, 0); return m }
function tag(text, w = 6, h = 1.8, bg = '#f3ead6') { return card(w, h, text, { bg, size: h * 0.42 }) }
function cam(pos, look, focus, ap = 0.003, fov = 30) { return { pos, look, focus: focus ?? look, ap, fov } }

// shared painted things
function calendarCard(month, day, year, w = 4.4, h = 5.4) {
  return cutout(rectPts(w, h), { depth: 0.12, paint: (x, P) => {
    fillAll(x, P, '#f6f0e2'); paperGrain(x, P, 0.25); x.fillStyle = '#b3342a'; x.fillRect(0, 0, P.w, P.h * 0.24)
    words(x, P, month, 0, h / 2 - h * 0.12, h * 0.13, { font: FONT.block, col: '#fff' })
    if (day) { words(x, P, day, 0, -0.05, h * 0.36, { font: FONT.block }); words(x, P, year, 0, -h * 0.37, h * 0.1, { font: FONT.hand }) }
    else { words(x, P, year, 0, h * 0.18, h * 0.1, { font: FONT.hand }); x.strokeStyle = 'rgba(40,30,20,.5)'; x.lineWidth = 0.04 * P.s; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(P.X(-w / 2 + 0.3 + i * (w - 0.6) / 7), P.Y(h * 0.05)); x.lineTo(P.X(-w / 2 + 0.3 + i * (w - 0.6) / 7), P.Y(-h / 2 + 0.3)); x.stroke() } for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(P.X(-w / 2 + 0.3), P.Y(h * 0.05 - i * (h * 0.55 - 0.3) / 4)); x.lineTo(P.X(w / 2 - 0.3), P.Y(h * 0.05 - i * (h * 0.55 - 0.3) / 4)); x.stroke() } }
  } })
}
function studioSet() {
  // the live room at Robert Lang: wood floor, foam panels, gear; a control-room window at the back with the desk
  const S = makeSet({ bg: '#20160f', sky: '#f0dcc0', ground: '#3a2616', hemi: 0.75, key: { pos: [-18, 34, 26], target: [0, 4, -2], int: 1200, angle: 0.75 } })
  S.add(floorCard(90, 60, '#9a6a40', planks), 0, 0, 0)
  // control room window (dark glass with the desk visible behind), the desk lives behind it
  const winFrame = cutout([[-9, 7], [9, 7], [9, 16], [-9, 16]], { depth: 0.6, paint: paint('#3a2a1c') }); S.add(winFrame, 4, 0, -15.6)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(16.6, 8.2), new THREE.MeshPhysicalMaterial({ color: '#a8c8d8', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false })); S.add(glass, 4, 11.5, -15.0)
  S.scene.remove(winFrame)
  const ctrl = new THREE.Group(); S.add(ctrl, 4, 0, -24)
  const back = wallCard(26, 26, '#4a3c30'); ctrl.add(back); back.position.z = -4
  const desk = box(16, 3.2, 4, { color: '#3a3a40', top: (x, P) => { const r = rng(3); for (let i = 0; i < 44; i++) for (let j = 0; j < 6; j++) { x.fillStyle = r() < 0.3 ? '#e04a3a' : r() < 0.5 ? '#f2c94c' : '#d8d8d8'; x.beginPath(); x.arc(P.X(-7.5 + i * 0.34), P.Y(-1.6 + j * 0.6), 0.09 * P.s, 0, 7); x.fill() } } }); desk.position.set(0, 7.2, 0); desk.rotation.x = 0.35; ctrl.add(desk)
  const deskLeds = []; for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: i % 3 ? '#7cff6a' : '#ff5a3a' })); l.position.set(-6.5 + i, 8.9, 1.3); ctrl.add(l); deskLeds.push(l) }
  const cl = new THREE.PointLight('#ffd8a0', 120, 26, 1.5); cl.position.set(0, 12, 2); ctrl.add(cl)
  // a wall with the window cut out: build as four strips in front of the control room
  for (const [w, h, x, y] of [[50, 7, -6, 3.5], [50, 18, -6, 25], [27, 9, -27.5, 11.5], [27, 9, 21.5, 11.5]]) { const s = cutout(rectPts(w, h, x, y), { depth: 0.5, paint: paint('#6b5a48', (xx, P) => { xx.fillStyle = 'rgba(30,24,20,.5)'; for (let i = -30; i < 30; i += 4.2) for (let j = -10; j < 10; j += 4.2) xx.fillRect(P.X(x + i), P.Y(y + j), 3.6 * P.s, 3.6 * P.s) }) }); S.add(s, 0, 0, -15.5) }
  const wf = []; for (const [w, h, x, y] of [[17.6, 0.7, 4, 7.2], [17.6, 0.7, 4, 15.8], [0.7, 9, -4.6, 11.5], [0.7, 9, 12.6, 11.5]]) { const f = cutout(rectPts(w, h, x, y), { depth: 0.6, paint: paint('#4a3220') }); S.add(f, 0, 0, -15.2); wf.push(f) }
  // gear
  const kit = drumKit(); S.add(kit, -7, 0, -9)
  const a1 = amp(4, 3.6, 2, 'TUBE'); S.add(a1, 6.5, 1.8, -10)
  const a2 = amp(3.4, 4.6, 2, 'BASS'); S.add(a2, 11.5, 2.3, -10)
  const g1 = guitar({ body: '#c0392b' }); g1.scale.setScalar(1.1); S.add(g1, 2.6, 2.2, -11); g1.rotation.z = 0.12
  const st1 = stand(1.4, 2.4); S.add(st1, 2.6, 0, -11)
  const g2 = guitar({ body: '#2c5aa0', bass: true }); g2.scale.setScalar(1.1); S.add(g2, 15, 2.2, -11); g2.rotation.z = -0.1
  const m1 = mic(6.2); S.add(m1, 1, 0, -4)
  const rug = cutout(ellPts(9, 6), { depth: 0.12, paint: paint('#7a3a3a', (x, P) => { x.strokeStyle = '#d8b46a'; x.lineWidth = 0.25 * P.s; for (let i = 1; i < 4; i++) { x.beginPath(); x.ellipse(P.X(0), P.Y(0), i * 2.1 * P.s, i * 1.4 * P.s, 0, 0, 7); x.stroke() } }) }); rug.rotation.x = -Math.PI / 2; S.add(rug, -2, 0.42, -5)
  const cal = calendarCard('OCTOBER', '17', '1994', 4.4, 5.4); S.add(cal, -15.5, 14, -15.2)
  const tapeM = box(5, 6, 3.4, { color: '#bdb6a8', front: (x, P) => { x.fillStyle = '#222'; x.fillRect(P.X(-2), P.Y(-0.8), 4 * P.s, 1.4 * P.s); for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#e04a3a' : '#333'; x.fillRect(P.X(-1.9 + i * 0.66), P.Y(-1.8), 0.4 * P.s, 0.35 * P.s) } } }); S.add(tapeM, -16, 3, -10)
  const reels = [-1, 1].map((sx) => { const r = cyl(1.2, 0.2, { color: '#5a4a3a', cap: '#3a2a20' }); r.rotation.x = Math.PI / 2; r.position.set(-16 + sx * 1.3, 4.6, -8.2); S.scene.add(r); return r })
  const door = new THREE.Group(); const dp = cutout(rectPts(5, 10, 2.5, 5), { depth: 0.4, paint: paint('#7a5232', (x, P) => { x.fillStyle = '#d8c070'; x.beginPath(); x.arc(P.X(4.3), P.Y(5), 0.3 * P.s, 0, 7); x.fill() }) }); door.add(dp); S.add(door, 17.5, 0, -15.4)
  S.parts = { kit, mic: m1, reels, deskLeds, door, g1, g2, ctrl, cal }
  return S
}

// ===================== the scenes =====================
export function buildScenes(TIM, PADB) {
  const sc = (i) => TIM[i].sentences.map(([a, b, s]) => [a + PADB[i], b + PADB[i], s])
  const out = []

  // ---------- 1. THE END OF AN ERA ----------
  {
    const T = sc(0), cues = []
    // A: Seattle street, cloudy
    const A = makeSet({ bg: '#8d98a4', sky: '#c8d4e0', ground: '#4a4a40', hemi: 1.25, key: { pos: [-10, 40, 30], int: 600, color: '#e8eef8', angle: 0.8, pen: 1 } })
    A.add(floorCard(140, 80, '#6f7f5a'), 0, 0, 0)
    const road = floorCard(140, 9, '#6c6a66', (x, P) => { x.fillStyle = '#e8e0c8'; for (let i = -70; i < 70; i += 5) x.fillRect(P.X(i), P.Y(0.2), 2.4 * P.s, 0.35 * P.s) }); A.add(road, 0, 0.25, 9)
    const sky = wallCard(160, 70, '#9aa6b2', (x, P) => { const gr = x.createLinearGradient(0, 0, 0, P.h); gr.addColorStop(0, 'rgba(110,122,138,.9)'); gr.addColorStop(1, 'rgba(190,198,204,.9)'); x.fillStyle = gr; x.fillRect(0, 0, P.w, P.h); x.fillStyle = 'rgba(235,238,242,.85)'; x.beginPath(); x.moveTo(P.X(-30), P.Y(8)); x.lineTo(P.X(-12), P.Y(26)); x.lineTo(P.X(4), P.Y(8)); x.fill(); x.fillStyle = 'rgba(90,100,110,.6)'; x.beginPath(); x.moveTo(P.X(-40), P.Y(8)); x.lineTo(P.X(-12), P.Y(19)); x.lineTo(P.X(16), P.Y(8)); x.fill() }); A.add(sky, 0, 0, -40)
    const houses = [['#9cb2c6', '#4a4a52'], ['#b8c4a0', '#5a3a30'], ['#e2d6b4', '#3a4a5a'], ['#b8574a', '#3a3a3a'], ['#c6b0d0', '#4a3a3a']].map(([c, r], i) => { const h = house(9, 7 + (i % 2) * 2, c, r, 40 + i * 3, { glow: i === 2 }); A.add(h, -26 + i * 13, 0, -6 - (i % 2) * 3); return h })
    for (let i = 0; i < 9; i++) A.add(pine(9 + (i % 3) * 3, i), -34 + i * 8.5, 0, -14 - (i % 2) * 4)
    const clouds = [[-14, 26, -20], [10, 30, -24], [26, 24, -18], [-30, 30, -26]].map(([x, y, z], i) => { const c = cotton(3 + i % 2, i + 7); A.add(c, x, y, z); const th = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 30, 4), new THREE.MeshBasicMaterial({ color: '#ddd' })); th.position.set(x, y + 16, z); A.scene.add(th); return c })
    const sign = new THREE.Group(); const sp = cutout(rectPts(0.4, 4, 0, 2), { depth: 0.3, paint: paint('#7a5232') }); sign.add(sp); const sc1 = card(7.4, 2.8, '', { lines: ['SEATTLE', 'APRIL 1994'], size: 0.9 }); sc1.position.set(0, 4.6, 0.2); sign.add(sc1); sign.rotation.z = 0.04; A.add(sign, 4.2, 0, 3)
    // B: living room with the TV
    const B = makeSet({ bg: '#2a2018', sky: '#d8c8b0', ground: '#3a2a1a', hemi: 0.55, key: { pos: [-20, 30, 20], int: 650, angle: 0.7 } })
    B.add(floorCard(70, 50, '#8a6440', planks), 0, 0, 0)
    B.add(wallCard(70, 30, '#9fae94', stripes('rgba(255,255,255,.12)')), 0, 0, -12)
    const win = windowCut(9, 7, '#9aa8b6'); B.add(win, -12, 13, -11.6)
    const couch = new THREE.Group(); const cb = box(14, 3.6, 5, { color: '#7a4a3a' }); cb.position.y = 1.8; couch.add(cb); const cbk = box(14, 4.4, 1.4, { color: '#6a3e30' }); cbk.position.set(0, 4.6, -2.2); couch.add(cbk); for (const sx of [-1, 1]) { const arm = box(1.4, 4.6, 5, { color: '#6a3e30' }); arm.position.set(sx * 7.4, 2.3, 0); couch.add(arm) } B.add(couch, -9, 0, -6)
    const stand1 = box(9, 3.4, 5, { color: '#5a3e28' }); B.add(stand1, 8, 1.7, -7)
    const tv = box(8, 6.4, 6, { color: '#d2c6a8', front: (x, P) => { x.fillStyle = '#2a2a2a'; x.beginPath(); x.roundRect(P.X(-3.5), P.Y(2.8), 5.6 * P.s, 4.6 * P.s, 0.6 * P.s); x.fill(); for (let i = 0; i < 2; i++) { x.fillStyle = '#5a5248'; x.beginPath(); x.arc(P.X(3.0), P.Y(1.8 - i * 1.1), 0.38 * P.s, 0, 7); x.fill() } } }); B.add(tv, 8, 6.6, -7)
    const [scrC, scrX] = (() => { const c = document.createElement('canvas'); c.width = 320; c.height = 260; return [c, c.getContext('2d')] })(), scrT = new THREE.CanvasTexture(scrC); scrT.colorSpace = THREE.SRGBColorSpace
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 4.3), new THREE.MeshBasicMaterial({ map: scrT, toneMapped: false })); B.add(screen, 7.15, 6.85, -3.95)
    for (const sx of [-1, 1]) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 5), new THREE.MeshStandardMaterial({ color: '#999', metalness: 0.7 })); ant.position.set(8 + sx * 1.2, 11.6, -8); ant.rotation.z = -sx * 0.45; B.scene.add(ant) }
    const tvLight = new THREE.PointLight('#8fb8ff', 0, 30, 1.4); tvLight.position.set(7, 7, -1); B.scene.add(tvLight)
    const lp = lamp(); B.add(lp, -18, 0, -8)
    const drawScreen = (t, on) => {
      const x = scrX, w = 320, h = 260
      if (t < on) { x.fillStyle = '#1e2224'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(30, 20, 120, 60) }
      else if (t < on + 0.7) { const r = rng(Math.floor(t * 30)); const img = x.createImageData(w, h); for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255 } x.putImageData(img, 0, 0) }
      else {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a4a7a'); gr.addColorStop(1, '#16284a'); x.fillStyle = gr; x.fillRect(0, 0, w, h)
        x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(200, 30, 100, 70); x.fillStyle = '#e8eef8'; x.font = `22px ${FONT.block}`; x.fillText('SEATTLE', 206, 62); x.fillText('NEWS', 206, 88)
        // the reporter: cardboard-style figure with a microphone
        x.fillStyle = '#3a4a6a'; x.beginPath(); x.moveTo(60, 230); x.lineTo(80, 150); x.lineTo(160, 150); x.lineTo(180, 230); x.fill()
        x.fillStyle = '#e9bf9a'; x.beginPath(); x.ellipse(120, 112, 30, 36, 0, 0, 7); x.fill(); x.fillStyle = '#4a2e1a'; x.beginPath(); x.ellipse(120, 88, 32, 18, 0, Math.PI, 0); x.fill()
        x.fillStyle = '#fff'; for (const ex of [108, 132]) { x.beginPath(); x.arc(ex, 108, 7, 0, 7); x.fill() } x.fillStyle = '#111'; for (const ex of [108, 132]) { x.beginPath(); x.arc(ex, 111, 3.5, 0, 7); x.fill() }
        x.fillStyle = '#5a2a2a'; const mo = Math.floor(t * 8) % 2; x.beginPath(); x.ellipse(120, 130, 9, mo ? 6 : 2, 0, 0, 7); x.fill()
        x.fillStyle = '#222'; x.fillRect(150, 140, 8, 40); x.beginPath(); x.arc(154, 138, 9, 0, 7); x.fill()
        x.fillStyle = '#b3241e'; x.fillRect(0, 196, w, 26); x.fillStyle = '#fff'; x.font = `17px ${FONT.block}`; x.fillText('BREAKING NEWS', 10, 216)
        x.fillStyle = '#f3efe6'; x.fillRect(0, 222, w, 30); x.fillStyle = '#111'; x.font = `12.5px ${FONT.block}`; x.fillText("NIRVANA'S KURT COBAIN DIES AT 27", 8, 242)
      }
      x.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1)
      scrT.needsUpdate = true
    }
    // C: bedroom wall with a band poster
    const C = makeSet({ bg: '#1c1a20', sky: '#9aa8c8', ground: '#2a2420', hemi: 0.45, key: { pos: [24, 26, 26], target: [0, 10, -10], int: 700, color: '#d8e0ff', angle: 0.5, pen: 0.8 } })
    C.add(floorCard(60, 40, '#6a5440'), 0, 0, 0)
    C.add(wallCard(60, 34, '#7d8798', stripes('rgba(255,255,255,.06)')), 0, 0, -10)
    const poster = cutout(rectPts(9, 12.5), { depth: 0.06, jitter: 0.02, paint: (x, P) => {
      fillAll(x, P, '#1b1d24'); const gr = x.createRadialGradient(P.X(0), P.Y(1.5), 0, P.X(0), P.Y(1.5), 6 * P.s); gr.addColorStop(0, '#5a6a8a'); gr.addColorStop(1, '#1b1d24'); x.fillStyle = gr; x.fillRect(0, 0, P.w, P.h)
      // a stylised singer: shaggy blond hair, striped sweater, guitar neck (an illustration, not a photo)
      x.fillStyle = '#7a6a8a'; x.beginPath(); x.moveTo(P.X(-3.4), P.Y(-6.2)); x.lineTo(P.X(-2.6), P.Y(-1.4)); x.lineTo(P.X(2.6), P.Y(-1.4)); x.lineTo(P.X(3.4), P.Y(-6.2)); x.fill()
      x.fillStyle = 'rgba(30,30,40,.55)'; for (let i = 0; i < 5; i++) x.fillRect(P.X(-3.3), P.Y(-2.0 - i * 0.9), 6.6 * P.s, 0.38 * P.s)
      x.fillStyle = '#e4b896'; x.beginPath(); x.ellipse(P.X(0), P.Y(1.0), 1.7 * P.s, 2.1 * P.s, 0, 0, 7); x.fill()
      x.fillStyle = '#e8c86a'; x.beginPath(); x.moveTo(P.X(-2.3), P.Y(-0.6)); x.quadraticCurveTo(P.X(-2.6), P.Y(3.6), P.X(0), P.Y(3.6)); x.quadraticCurveTo(P.X(2.6), P.Y(3.6), P.X(2.3), P.Y(-0.6)); x.lineTo(P.X(1.3), P.Y(1.5)); x.lineTo(P.X(0.4), P.Y(2.3)); x.lineTo(P.X(-0.8), P.Y(1.7)); x.lineTo(P.X(-1.4), P.Y(0.2)); x.closePath(); x.fill()
      x.strokeStyle = 'rgba(150,110,40,.6)'; x.lineWidth = 0.06 * P.s; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(P.X(-2.0 + i * 0.5), P.Y(3.2)); x.lineTo(P.X(-2.2 + i * 0.52), P.Y(-0.4)); x.stroke() }
      x.fillStyle = '#fff'; for (const ex of [-0.6, 0.6]) { x.beginPath(); x.arc(P.X(ex), P.Y(1.1), 0.32 * P.s, 0, 7); x.fill() } x.fillStyle = '#20304a'; for (const ex of [-0.6, 0.6]) { x.beginPath(); x.arc(P.X(ex), P.Y(1.05), 0.15 * P.s, 0, 7); x.fill() }
      words(x, P, 'NIRVANA', 0, 5.0, 1.9, { font: FONT.mark, col: '#f1ede2' })
      x.fillStyle = 'rgba(240,235,225,.75)'; x.font = `${0.5 * P.s}px ${FONT.hand}`; x.textAlign = 'center'; x.fillText('LIVE · SEATTLE', P.X(0), P.Y(-5.6))
    } })
    poster.rotation.z = 0.03; C.add(poster, 0, 15, -9.7)
    for (const [x, y] of [[-4.2, 21], [4.2, 21], [-4.2, 9], [4.2, 9]]) C.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshStandardMaterial({ color: '#c8382a' })), x, y, -9.55)
    C.add(cutout(rectPts(5, 4), { depth: 0.04, paint: paint('#f2ecd8', (x, P) => { marker(x, P, [[-1.8, 0.8], [0, 1.4], [1.6, 0.2]], 0.1, '#3a5aa0'); marker(x, P, [[-1.6, -0.8], [1.6, -1]], 0.08, '#b3342a') }) }), -11, 13, -9.7)
    C.add(cutout(rectPts(4, 5), { depth: 0.04, paint: paint('#e8d8a8', (x, P) => { words(x, P, '♪', 0, 0, 3, { col: '#3a2a1a' }) }) }), 10, 17, -9.7).rotation.z = -0.08
    // window blinds: slats between the moonlight and the wall throw stripes
    for (let i = 0; i < 9; i++) { const s = cutout(rectPts(10, 0.5), { depth: 0.1, paint: paint('#e8e0c8') }); s.position.set(27, 18 + i * 1.1, 10); s.rotation.y = -0.7; s.rotation.x = 0.3; C.scene.add(s) }

    const sA = 3.0, on = 3.35
    cues.push([0.0, 'room_tone', { dur: 3.0 }], [on, 'tv_click'], [on, 'static', { dur: 0.7 }], [on + 0.7, 'news_tone'], [on + 0.8, 'tv_voice', { dur: T[1][0] - on - 0.6 }])
    out.push({ cues, T, shots: [
      { until: sA, set: A, update: (t) => { houses[2].userData.glow.material.opacity = 0.3 + 0.25 * Math.sin(q(t) * 9); clouds.forEach((c, i) => (c.position.x += 0)) }, cam: (t) => { const k = ease(0, sA, t); return cam(V(lerp(-2, -6, k), lerp(9, 7, k), lerp(64, 30, k)), V(-0.5, 6, -6), V(-0.5, 7, -6), 0.002) } },
      { until: T[1][0] - 0.15, set: B, update: (t) => { drawScreen(t, on); tvLight.intensity = t > on ? 90 + 40 * Math.sin(q(t) * 13) : 0 }, cam: (t) => { const k = ease(sA, T[1][0], t); return cam(V(lerp(-10, 3, k), lerp(9, 7.4, k), lerp(32, 15, k)), V(lerp(2, 7.2, k), 6.6, -5), V(7.2, 6.8, -4), lerp(0.003, 0.005, k)) } },
      { until: 1e9, set: C, update: () => {}, cam: (t) => { const k = ease(T[1][0], T[2][1] + 0.4, t); return cam(V(lerp(3, 0.4, k), lerp(13, 15, k), lerp(34, 16, k)), V(0, 15, -9.7), V(0, 15, -9.7), 0.003) } },
    ] })
  }

  // ---------- 2. THE PHONE CALL ----------
  {
    const T = sc(1), cues = []
    const S = makeSet({ bg: '#141620', sky: '#7f8eb8', ground: '#1e1a18', hemi: 0.35, key: { pos: [-14, 28, 26], target: [-1, 9, -1], int: 700, color: '#aebce6', angle: 0.6 } })
    S.add(floorCard(60, 40, '#5a4634', planks), 0, 0, 0)
    S.add(wallCard(60, 30, '#4a5266', stripes('rgba(255,255,255,.05)')), 0, 0, -10)
    S.add(windowCut(8, 9, '#1e2a48', (x, P) => { x.fillStyle = '#e8ecf4'; x.beginPath(); x.arc(P.X(2), P.Y(2.4), 0.9 * P.s, 0, 7); x.fill() }), -13, 14, -9.6)
    const ch = chair(); S.add(ch, -2, 0, -2)
    const tb = table(6, 5.6, 5); S.add(tb, 5.5, 0, -1.5)
    const lp = lamp('#d8c090'); lp.scale.setScalar(0.7); S.add(lp, 7.5, 5.8, -3); lp.userData.light.intensity = 45
    // beige 90s phone
    const phone = new THREE.Group(); const base = box(2.6, 0.9, 2.2, { color: '#d9ceb0', top: (x, P) => { x.fillStyle = '#b9ae90'; for (let i = 0; i < 12; i++) x.fillRect(P.X(-0.9 + (i % 3) * 0.6), P.Y(0.7 - Math.floor(i / 3) * 0.4), 0.4 * P.s, 0.28 * P.s) } }); base.position.y = 0.45; phone.add(base); S.add(phone, 4.6, 5.8, -0.5)
    const handset = box(3.0, 0.6, 0.8, { color: '#d9ceb0' }); S.scene.add(handset)
    const dave = puppet(DAVE); S.add(dave.root, -2, 0, -1.3); dave.root.rotation.y = 0.25
    const pts = []; for (let i = 0; i <= 40; i++) pts.push(V(0, 0, 0))
    const cordM = new THREE.MeshStandardMaterial({ color: '#c8bc9c' }); let cord = null
    const ring0 = PADB[1] - 0.9, pick = ring0 + 3.2
    cues.push([ring0, 'phone_ring'], [ring0 + 2.0, 'phone_ring'], [pick, 'pickup'], [0, 'room_tone', { dur: T[2][1] + 1 }])
    out.push({ cues, T, shots: [{ until: 1e9, set: S, update: (t) => {
      const u = q(t), ringing = (u > ring0 && u < ring0 + 1.2) || (u > ring0 + 2.0 && u < Math.min(pick, ring0 + 3.2))
      const look = ss(ring0 + 0.3, ring0 + 0.8, u), reach = ss(pick - 0.9, pick, u), lift = ss(pick, pick + 0.7, u)
      dave.pose({ sl: 6, el: 10, sr: lerp(10, -128 , lift) + reach * -30, er: lerp(8, -120, lift) + reach * -10, srx: -reach * 50 * (1 - lift), hl: 90, hr: 90, kl: 90, kr: 90, tilt: lerp(-8, 4, look) + lift * 10, turn: look * 22 * (1 - lift), nod: lerp(8, 2, look) + lift * 4, lean: -2 })
      dave.body.position.y = -1.9; dave.root.position.z = -1.3
      dave.expr(lift > 0.5 ? 'sad' : look > 0.5 ? 'oh' : 'sad', look > 0.5 && lift < 0.5 ? 'up' : 'sad'); dave.look(lerp(-0.2, 0.9, look) * (1 - lift), lerp(-0.8, -0.2, look))
      // handset: on the cradle (jumping while it rings), then at his ear
      const cradle = V(4.6, 7.0, -0.5), ear = new THREE.Vector3(); dave.head.localToWorld(ear.set(2.0, 2.6, 0.6))
      const hp = cradle.clone().lerp(ear, lift); if (ringing) hp.y += (Math.floor(t * 24) % 2) * 0.12
      handset.position.copy(hp); handset.rotation.set(0, lerp(0, -0.4, lift), lerp(0, 1.25, lift))
      if (cord) { S.scene.remove(cord); cord.geometry.dispose() }
      const a = V(4.6, 6.4, 0.6), b = hp.clone(); const path = new THREE.CatmullRomCurve3(Array.from({ length: 30 }, (_, i) => { const k = i / 29, p = a.clone().lerp(b, k); p.y -= Math.sin(k * Math.PI) * (2.4 - lift); p.x += Math.sin(k * 60) * 0.18; p.z += Math.cos(k * 60) * 0.18; return p }))
      cord = new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.07, 5), cordM); S.scene.add(cord)
    }, cam: (t) => { const k = ease(0.6, T[2][1] + 0.6, t); return cam(V(lerp(1, 6, k), lerp(11, 12, k), lerp(30, 54, k)), V(lerp(-1.2, 1.5, k), lerp(10, 8.5, k), -1), V(-2, 10.5, -1), lerp(0.005, 0.003, k)) } }] })
  }

  // ---------- 3. FINDING HIS WAY BACK ----------
  {
    const T = sc(2), cues = []
    const S = makeSet({ bg: '#2a2016', sky: '#ffe8c8', ground: '#4a3220', hemi: 0.8, key: { pos: [-22, 30, 18], int: 1100, color: '#ffd4a0', angle: 0.6 } })
    S.add(floorCard(60, 40, '#8a6a48', planks), 0, 0, 0)
    S.add(wallCard(60, 30, '#d4bf96', stripes('rgba(140,100,60,.12)')), 0, 0, -10)
    S.add(windowCut(8, 8, '#b8d8e8', (x, P) => { x.fillStyle = '#f8f4e4'; x.beginPath(); x.arc(P.X(-1.5), P.Y(1.5), 1.6 * P.s, 0, 7); x.fill() }), -14, 15, -9.6)
    const bed = new THREE.Group(); const fr = box(16, 2.4, 9, { color: '#6a4a30' }); fr.position.y = 1.2; bed.add(fr); const mat = box(15.4, 1.4, 8.6, { color: '#e8e0d0' }); mat.position.y = 3.0; bed.add(mat); const blanket = box(10, 0.5, 8.8, { color: '#3a6a8a', top: (x, P) => { x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 0.15 * P.s; for (let i = -5; i < 5; i += 1.2) { x.beginPath(); x.moveTo(P.X(i), 0); x.lineTo(P.X(i), P.h); x.stroke() } } }); blanket.position.set(3, 3.9, 0); bed.add(blanket); const hb = box(1, 7, 9, { color: '#6a4a30' }); hb.position.set(8, 3.5, 0); bed.add(hb); S.add(bed, 1, 0, -4.5)
    // calendar: April page, May page, June underneath; pages flip up
    const calJ = calendarCard('JUNE', null, '1994'); S.add(calJ, -4, 16.5, -9.6)
    const pages = ['MAY', 'APRIL'].map((m, i) => { const piv = new THREE.Group(); piv.position.set(-4, 16.5 + 2.7, -9.5 + i * 0.06); const c = calendarCard(m, null, '1994'); c.position.y = -2.7; piv.add(c); S.scene.add(piv); return piv })
    S.add(card(4.6, 1.3, 'SONG IDEAS', { size: 0.6, bg: '#f4d860' }), 9, 15, -9.6).rotation.z = -0.06
    // notebook on the bed, pages fill with handwriting
    const nb = cutout(rectPts(5.4, 3.8), { depth: 0.12, paint: paint('#f6f2e6', (x, P) => { x.strokeStyle = 'rgba(90,120,180,.45)'; x.lineWidth = 0.03 * P.s; for (let y = -1.6; y < 1.7; y += 0.42) { x.beginPath(); x.moveTo(0, P.Y(y)); x.lineTo(P.w, P.Y(y)); x.stroke() } marker(x, P, [[0, 1.9], [0, -1.9]], 0.05, 'rgba(60,40,20,.5)') }) })
    nb.rotation.x = -Math.PI / 2 + 0.25; S.add(nb, 2.2, 4.3, -1.8)
    let written = -1
    const writeNb = (n) => { if (n === written) return; written = n; nb.userData.redraw((x, P) => { const lines = ['new song?', 'this is a call...', 'chords: D  A  G', 'big chorus!', 'drums first']; for (let i = 0; i < Math.min(n, 12); i++) { const L = Math.floor(i / 2.4), part = lines[Math.min(4, L)]; if (i % 3 === 2) continue; x.fillStyle = '#2a3a6a'; x.font = `${0.36 * P.s}px ${FONT.hand}`; x.fillText(part.slice(0, 18), P.X(i % 2 ? 0.3 : -2.5), P.Y(1.45 - L * 0.62)) } }) }
    const pencil = cyl(0.12, 2.4, { color: '#f2c230', cap: '#e08a8a' }); S.scene.add(pencil)
    const ag = guitar({ acoustic: true }); ag.scale.setScalar(1.25); S.scene.add(ag)
    const dave = puppet(DAVE); S.add(dave.root, -4.5, 0, -1.2); dave.root.rotation.y = 0.2
    const pickAt = T[0][1] - 0.2, flip1 = T[1][0] + 0.1, flip2 = T[1][0] + 0.75
    // B: Barrett Jones's Laundry Room studio
    const L = makeSet({ bg: '#1e2024', sky: '#e8f0f0', ground: '#3a3a3a', hemi: 0.75, key: { pos: [18, 30, 22], int: 950, color: '#fff0d8', angle: 0.65 } })
    L.add(floorCard(60, 40, '#a8a49a', (x, P) => { x.strokeStyle = 'rgba(60,60,60,.25)'; x.lineWidth = 0.06 * P.s; for (let i = -30; i < 30; i += 3) { x.beginPath(); x.moveTo(P.X(i), 0); x.lineTo(P.X(i), P.h); x.stroke(); x.beginPath(); x.moveTo(0, P.Y(i)); x.lineTo(P.w, P.Y(i)); x.stroke() } }), 0, 0, 0)
    L.add(wallCard(60, 30, '#b8c8c8'), 0, 0, -10)
    for (const [x0, lbl] of [[-14, 'WASH'], [-7.6, 'DRY']]) { const wsh = box(6, 8, 6, { color: '#f0eee6', front: (x, P) => { x.fillStyle = '#c8ccd0'; x.beginPath(); x.arc(P.X(0), P.Y(-0.6), 2.2 * P.s, 0, 7); x.fill(); x.fillStyle = '#3a4a5a'; x.beginPath(); x.arc(P.X(0), P.Y(-0.6), 1.6 * P.s, 0, 7); x.fill(); x.fillStyle = INK; x.font = `${0.6 * P.s}px ${FONT.mark}`; x.fillText(lbl, P.X(-2.4), P.Y(3.0)) } }); L.add(wsh, x0, 4, -6.5) }
    L.add(card(9, 2.2, 'LAUNDRY ROOM', { size: 1.1, bg: '#f6e6a8' }), -2, 18, -9.6).rotation.z = 0.03
    const desk2 = table(9, 6, 5, '#7a5a3a'); L.add(desk2, 7, 0, -5)
    const fourTrack = box(5, 1.2, 3.4, { color: '#2a2a30', top: (x, P) => { x.fillStyle = '#d8d0c0'; x.fillRect(P.X(-2), P.Y(0.9), 1.8 * P.s, 1.2 * P.s); for (let i = 0; i < 4; i++) { x.fillStyle = '#ddd'; x.fillRect(P.X(0.3 + i * 0.45), P.Y(1.2), 0.18 * P.s, 2.4 * P.s); x.fillStyle = '#e04a3a'; x.fillRect(P.X(0.25 + i * 0.45), P.Y(0.2 + (i % 2) * 0.6), 0.28 * P.s, 0.3 * P.s) } } }); L.add(fourTrack, 6.5, 6.8, -5)
    const lm = mic(5.6); L.add(lm, -1.8, 0, 1.5)
    const barrett = puppet(BARRETT); L.add(barrett.root, 7.2, 0, -1.6); barrett.root.rotation.y = -0.45
    const dave2 = puppet(DAVE); L.add(dave2.root, 0.8, 0, 0); dave2.root.rotation.y = 0.35
    const eg = guitar({ body: '#c0392b' }); L.scene.add(eg)
    const lStart = T[1][0] + 2.3
    cues.push([0.5, 'pencil', { dur: pickAt - 0.7 }], [pickAt + 0.4, 'strum'], [pickAt + 1.0, 'strum'], [pickAt + 1.6, 'strum'], [flip1, 'page'], [flip2, 'page'], [lStart + 0.5, 'tape_click'], [lStart + 1.0, 'strum_e'], [lStart + 2.0, 'strum_e'], [lStart + 3.0, 'strum_e'])
    out.push({ cues, T, shots: [
      { until: lStart, set: S, update: (t) => {
        const u = q(t), pick = ss(pickAt, pickAt + 0.6, u), playing = u > pickAt + 0.6
        writeNb(Math.floor(clamp((u - 0.4) / (pickAt - 0.6)) * 12))
        const strum = playing ? Math.sin(u * 9) * 18 : 0
        dave.pose({ sl: lerp(-28, 14, pick), el: lerp(-50, 70, pick) + (playing ? 20 : 0), slx: lerp(-60, -30, pick), elx: lerp(-30, 0, pick), sr: lerp(4, -22, pick) - strum * 0.3, er: lerp(-30, 70, pick) + strum, srx: lerp(-30, -40, pick), hl: 90, hr: 90, kl: 90, kr: 90, nod: lerp(12, 6, pick) + (playing ? Math.sin(u * 4.5) * 3 : Math.sin(u * 3) * 2), tilt: playing ? Math.sin(u * 2.2) * 5 : 4 })
        dave.body.position.y = -0.95
        dave.expr(playing ? 'neutral' : 'neutral', playing ? 'neutral' : 'focus'); dave.look(playing ? 0.1 : 0.4, -0.9)
        const hand = new THREE.Vector3(); dave.arms[0].grip.getWorldPosition(hand); pencil.position.copy(hand); pencil.rotation.set(0.9, 0, 0.5); pencil.visible = pick < 0.5
        const rest = V(-12.5, 3.4, -8.2), held = new THREE.Vector3(); dave.torsoJ.localToWorld(held.set(0.2, 1.4, 1.6))
        ag.position.copy(rest.clone().lerp(held, pick)); ag.rotation.set(0, 0, lerp(0.12, 1.15, pick))
        pages[1].rotation.x = -Math.PI * 0.96 * ss(flip1, flip1 + 0.35, u); pages[0].rotation.x = -Math.PI * 0.96 * ss(flip2, flip2 + 0.35, u)
      }, cam: (t) => { const k = ease(0, T[1][0] + 1.2, t), j = ease(T[1][0] - 0.4, T[1][0] + 0.2, t) * (1 - ease(lStart - 1.2, lStart - 0.2, t)); return cam(V(lerp(4, 5, k) - j * 7, lerp(12, 13, k) + j * 3, lerp(42, 46, k) - j * 12), V(lerp(-2, -1.5, k) - j * 1.8, lerp(9, 9.5, k) + j * 6.5, lerp(-3, -3.5, k) - j * 5), null, 0.003) } },
      { until: 1e9, set: L, update: (t) => {
        const u = q(t) - lStart, s = Math.sin(u * 10) * 14
        dave2.pose({ sl: -20, el: 60, slx: -30, sr: -12 - s * 0.3, er: 72 + s, srx: -40, nod: 10 + Math.sin(u * 5) * 4, tilt: Math.sin(u * 2) * 5 }); dave2.expr(u > 2.4 ? 'smile' : 'neutral', 'neutral'); dave2.look(0.2, -0.6)
        const held = new THREE.Vector3(); dave2.torsoJ.localToWorld(held.set(0.2, 1.4, 1.6)); eg.position.copy(held); eg.rotation.set(0, 0.35, 1.15)
        barrett.pose({ sl: 10, el: 40, slx: -40, sr: -10, er: -50, srx: -50, nod: 18 }); barrett.expr('smile', 'neutral'); barrett.look(-0.8, -0.5)
      }, cam: (t) => { const k = ease(lStart, lStart + 5, t); return cam(V(lerp(8, 1, k), 12, lerp(46, 42, k)), V(lerp(4.5, 3, k), 9.5, -2), null, 0.003) } },
    ] })
  }

  // ---------- 4. ROBERT LANG STUDIOS ----------
  const STUDIO = studioSet()
  const sDave = puppet(DAVE), sBarrett = puppet(BARRETT), sGreg = puppet(GREG)
  STUDIO.scene.add(sDave.root, sBarrett.root, sGreg.root)
  const sGuitar = guitar({ body: '#c0392b' }), sBass = guitar({ body: '#2c5aa0', bass: true }); sGuitar.scale.setScalar(1.1); sBass.scale.setScalar(1.1); STUDIO.scene.add(sGuitar, sBass)
  const sticks = [0, 1].map(() => cyl(0.1, 3.2, { color: '#e8d8b0' })); sticks.forEach((s) => STUDIO.scene.add(s))
  const reset = () => { sGreg.root.visible = false; sGuitar.visible = sBass.visible = false; sticks.forEach((s) => (s.visible = false)); STUDIO.parts.g1.visible = true; STUDIO.parts.g2.visible = true }
  const spinGear = (t) => { STUDIO.parts.reels.forEach((r, i) => (r.rotation.y = t * (i ? 3.4 : 2.8))); STUDIO.parts.deskLeds.forEach((l, i) => (l.visible = Math.sin(t * 6 + i * 1.7) > -0.3)) }
  const holdGuitar = (p, g, rz = 1.15) => { const held = new THREE.Vector3(); p.torsoJ.localToWorld(held.set(0.2, 1.4, 1.6)); g.position.copy(held); g.rotation.set(0, p.root.rotation.y, rz); g.visible = true }
  {
    const T = sc(3), cues = []
    const E = makeSet({ bg: '#a8b4be', sky: '#d8e4ec', ground: '#3a4030', hemi: 1.1, key: { pos: [-20, 40, 26], int: 800, color: '#fff2dc', angle: 0.75, pen: 0.9 } })
    E.add(floorCard(140, 80, '#6a7a50'), 0, 0, 0)
    E.add(wallCard(160, 70, '#a6b2bc', (x, P) => { x.fillStyle = 'rgba(70,90,70,.5)'; for (let i = -80; i < 80; i += 6) { x.beginPath(); x.moveTo(P.X(i), P.Y(0)); x.lineTo(P.X(i + 3), P.Y(14 + (i * 7) % 6)); x.lineTo(P.X(i + 6), P.Y(0)); x.fill() } }), 0, 0, -40)
    const bld = cutout([[-15, 0], [15, 0], [15, 11], [7, 11], [7, 15], [0, 19.5], [-7, 15], [-7, 11], [-15, 11]], { depth: 0.5, paint: paint('#7f8f7a', (x, P) => { x.strokeStyle = 'rgba(30,40,30,.35)'; x.lineWidth = 0.06 * P.s; for (let y = 0.7; y < 19; y += 0.7) { x.beginPath(); x.moveTo(0, P.Y(y)); x.lineTo(P.w, P.Y(y)); x.stroke() } for (const [wx, wy] of [[-11, 6], [-6, 6], [6, 6], [11, 6], [0, 13]]) { x.fillStyle = '#f2dc9a'; x.fillRect(P.X(wx - 1.3), P.Y(wy + 1.3), 2.6 * P.s, 2.6 * P.s); marker(x, P, [[wx - 1.3, wy + 1.3], [wx + 1.3, wy + 1.3], [wx + 1.3, wy - 1.3], [wx - 1.3, wy - 1.3], [wx - 1.3, wy + 1.3]], 0.1); marker(x, P, [[wx, wy + 1.3], [wx, wy - 1.3]], 0.08) } x.fillStyle = '#2a1e14'; x.fillRect(P.X(-2.4), P.Y(8), 4.8 * P.s, 8 * P.s) }) })
    E.add(bld, 0, 0, -10)
    const edoor = new THREE.Group(); const ed = cutout(rectPts(4.6, 7.8, 2.3, 3.9), { depth: 0.35, paint: paint('#8a3a2a', (x, P) => { x.fillStyle = '#e0c060'; x.beginPath(); x.arc(P.X(3.9), P.Y(3.9), 0.3 * P.s, 0, 7); x.fill() }) }); edoor.add(ed); E.add(edoor, -2.3, 0.1, -9.4)
    const sign = card(16, 3.6, '', { lines: ['ROBERT LANG STUDIOS', 'SHORELINE, WA'], size: 1.15, bg: '#f2e6c4' }); E.add(sign, 0, 23, -9.2).rotation.z = -0.02
    for (let i = 0; i < 10; i++) E.add(pine(10 + (i % 3) * 4, i + 20), -40 + i * 9 + (i > 4 ? 6 : -6), 0, -18 - (i % 2) * 6)
    for (let i = 0; i < 6; i++) { const st = cutout(ellPts(1.5, 1.0), { depth: 0.15, paint: paint('#9a9488') }); st.rotation.x = -Math.PI / 2; E.add(st, -12 + i * 2.2, 0.45, 1 - i * 1.6) }
    E.add(cotton(4, 31), 14, 30, -26); E.add(cotton(3, 32), -18, 33, -30)
    const eDave = puppet(DAVE); E.scene.add(eDave.root); const gcase = box(1.6, 5.4, 0.9, { color: '#1c1c1e' }); E.scene.add(gcase)
    const inT = T[0][0] + 3.6, doorAt = inT - 0.9
    for (let i = 0; i < 7; i++) cues.push([0.3 + i * 0.42, 'step'])
    cues.push([doorAt, 'door'], [inT + 0.9, 'step'], [inT + 1.3, 'step'], [inT + 1.7, 'step'], [T[1][0] - 0.6, 'amp_on'], [T[1][0] + 1.6, 'mic_stand'])
    out.push({ cues, T, shots: [
      { until: inT, set: E, update: (t) => {
        const u = q(t), k = clamp(u / (doorAt - 0.1)), x = lerp(-15, -1.0, k), z = lerp(5, -7.6, k)
        eDave.root.position.set(x, 0, z); eDave.root.rotation.y = lerp(0.9, Math.PI * 0.85, ss(doorAt - 0.6, doorAt + 0.3, u))
        const s = k < 1 ? Math.sin(u * 9) * 22 : 0; eDave.pose({ hl: s, hr: -s, sl: 8 + s * 0.3, sr: -6, er: -4, bob: Math.abs(Math.sin(u * 9)) * 0.25, nod: 4 }); eDave.expr('neutral', 'neutral'); eDave.look(0.6, -0.3)
        const hand = new THREE.Vector3(); eDave.arms[1].grip.getWorldPosition(hand); gcase.position.copy(hand).add(V(0, -2.2, 0)); gcase.rotation.y = eDave.root.rotation.y
        edoor.rotation.y = -1.5 * ss(doorAt, doorAt + 0.5, u)
      }, cam: (t) => { const k = ease(0, inT, t); return cam(V(lerp(-10, 4, k), lerp(6, 9, k), lerp(38, 46, k)), V(lerp(-8, 0, k), lerp(5, 9, k), -6), V(lerp(-9, -1, k), 6, lerp(2, -7, k)), 0.0025) } },
      { until: 1e9, set: STUDIO, update: (t) => {
        reset(); const u = q(t) - inT
        sDave.root.position.set(lerp(16, 5, clamp(u / 1.8)), 0, lerp(-12, -3, clamp(u / 1.8))); sDave.root.rotation.y = -0.6 + clamp(u / 1.8) * 0.5
        const s = u < 1.8 ? Math.sin(u * 9) * 20 : 0; sDave.pose({ hl: s, hr: -s, sl: 8, sr: -8, bob: u < 1.8 ? Math.abs(Math.sin(u * 9)) * 0.2 : 0, turn: u > 2 ? -20 : 0 }); sDave.expr(u > 2.5 ? 'smile' : 'neutral', 'neutral'); sDave.look(-0.5, -0.2)
        sBarrett.root.position.set(4, 0, -24.5); sBarrett.root.rotation.y = 0.1; sBarrett.pose({ sl: 30, el: 60, slx: -40, sr: -30, er: -60, srx: -40, nod: 10 }); sBarrett.expr('smile', 'neutral'); sBarrett.look(0.4, -0.3)
        STUDIO.parts.mic.userData.head.position.y = 6.5 + Math.min(0, Math.sin(u * 3)) * 0 + (u > T[1][0] - inT + 1.6 ? 0.4 : 0)
        spinGear(t)
      }, cam: (t) => { const k = ease(inT, T[1][1] + 0.5, t); return cam(V(lerp(-12, 5, k), 12, lerp(40, 44, k)), V(lerp(-10, 4.5, k), lerp(9, 10.5, k), lerp(-8, -12, k)), V(lerp(-10, 5, k), 9, lerp(-6, -4, k)), 0.0026) } },
    ] })
  }

  // ---------- 5. ONE MAN, AN ENTIRE BAND ----------
  {
    const T = sc(4), cues = []
    const tD = wordAt(T, 2, 'drums'), tG = wordAt(T, 2, 'guitars'), tB = wordAt(T, 2, 'bass'), tV = wordAt(T, 2, 'vocals'), tE = T[3][0]
    const labels = [['TRACK 1 · DRUMS', '#f3d860'], ['TRACKS 2-3 · GUITARS', '#f2a0a0'], ['TRACK 4 · BASS', '#a8c8f0'], ['TRACK 5 · VOCALS', '#b8e0a8']].map(([s, c]) => { const m = card(8.6, 1.9, s, { size: 0.8, bg: c }); STUDIO.scene.add(m); m.visible = false; return m })
    const tally = cutout(rectPts(10, 7), { depth: 0.12, paint: paint('#2f3a34') }); STUDIO.scene.add(tally); tally.visible = false
    let tallyN = -1
    const drawTally = (n) => { if (n === tallyN) return; tallyN = n; tally.userData.redraw((x, P) => { x.globalAlpha = 0.9; fillAll(x, P, '#2f3a34'); x.globalAlpha = 1; words(x, P, 'SONGS', -2.6, 2.5, 1.0, { col: '#f2efe6' }); words(x, P, '~1 WEEK', 2.4, 2.5, 0.85, { col: '#f4d860' }); for (let i = 0; i < n; i++) { const g = Math.floor(i / 5), j = i % 5, gx = -3.8 + g * 2.6; x.strokeStyle = '#f2efe6'; x.lineWidth = 0.14 * P.s; x.lineCap = 'round'; x.beginPath(); if (j < 4) { x.moveTo(P.X(gx + j * 0.42), P.Y(0.9)); x.lineTo(P.X(gx + j * 0.42 + 0.08), P.Y(-1.4)) } else { x.moveTo(P.X(gx - 0.3), P.Y(-1.0)); x.lineTo(P.X(gx + 1.6), P.Y(0.6)) } x.stroke() } if (n >= 15) words(x, P, '15!', 3.4, -2.4, 1.2, { col: '#f4d860' }); words(x, P, 'mostly TAKE 1', -1.6, -2.6, 0.7, { font: FONT.hand, col: '#f2efe6' }) }) }
    for (let i = 0; i < 9; i++) cues.push([tD + 0.1 + i * 0.16, i % 3 === 2 ? 'snare' : i % 4 === 0 ? 'cymbal' : 'tom'])
    for (let i = 0; i < 5; i++) cues.push([tG + 0.1 + i * 0.3, 'strum_e'])
    for (let i = 0; i < 4; i++) cues.push([tB + 0.1 + i * 0.28, 'bass'])
    cues.push([tV + 0.05, 'mic_tap'], [tE + 0.1, 'button'], [tE + 0.35, 'reels', { dur: T[3][1] - tE }], [T[1][0], 'button'])
    const show = (i) => labels.forEach((l, j) => (l.visible = j === i))
    out.push({ cues, T, shots: [
      { until: tD, set: STUDIO, update: (t) => { reset(); show(-1); tally.visible = false; const u = q(t); sDave.root.position.set(0, 0, -2); sDave.root.rotation.y = 0; sDave.pose({ sl: u > T[1][0] ? 60 : 10, el: u > T[1][0] ? 80 : 10, sr: u > T[1][0] ? -60 : -10, er: u > T[1][0] ? -80 : -10, tilt: Math.sin(u * 3) * 6 }); sDave.expr(u > T[1][0] ? 'grin' : 'smile', 'up'); sDave.look(Math.sin(u * 2) * 0.8, -0.2); sBarrett.root.position.set(4, 0, -24.5); spinGear(t) }, cam: (t) => { const k = ease(0, tD, t); return cam(V(lerp(-6, 6, k), 12, lerp(44, 40, k)), V(0, 9.5, -5), V(0, 9, -2), 0.0032) } },
      { until: tG, set: STUDIO, update: (t) => { reset(); show(0); const u = q(t); sDave.root.position.set(-7, 0, -12.2); sDave.root.rotation.y = 0; const a = Math.sin(u * 18) * 30; sDave.pose({ sl: 50 + a, el: 70 - a, sr: -50 + a, er: -70 - a, slx: -40, srx: -40, hl: 90, hr: 90, kl: 90, kr: 90, nod: Math.sin(u * 18) * 8, tilt: Math.sin(u * 9) * 6 }); sDave.body.position.y = -1.6; sDave.expr('grin', 'focus'); sDave.look(0, -0.7); sticks.forEach((s, i) => { const h = new THREE.Vector3(); sDave.arms[i].grip.getWorldPosition(h); s.position.copy(h); s.rotation.set(-1.0, 0, i ? 0.7 : -0.7); s.visible = true }); (STUDIO.parts.kit.userData.cymbals || []).forEach((c, i) => (c.rotation.x = Math.sin(t * 20 + i) * 0.12)); labels[0].position.set(-7, 19, -8); sBarrett.root.position.set(4, 0, -24.5); spinGear(t) }, cam: (t) => { const k = ease(tD, tG, t); return cam(V(lerp(-10, -5, k), 13, 34), V(-7, 9, -10), V(-7, 9, -12), 0.0036) } },
      { until: tB, set: STUDIO, update: (t) => { reset(); show(1); const u = q(t); STUDIO.parts.g1.visible = false; sDave.root.position.set(4.5, 0, -6.5); sDave.root.rotation.y = -0.2; const s = Math.sin(u * 12) * 16; sDave.pose({ sl: -20, el: 60, slx: -30, sr: -12 - s * 0.3, er: 72 + s, srx: -40, hl: 8, hr: -8, nod: 10 + Math.sin(u * 6) * 6, tilt: Math.sin(u * 3) * 7 }); sDave.expr('grin', 'focus'); sDave.look(0, -0.8); holdGuitar(sDave, sGuitar); labels[1].position.set(4.5, 18.8, -8); sBarrett.root.position.set(4, 0, -24.5); spinGear(t) }, cam: (t) => { const k = ease(tG, tB, t); return cam(V(lerp(9, 5, k), 12, 32), V(4.5, 10, -7), null, 0.0036) } },
      { until: tV, set: STUDIO, update: (t) => { reset(); show(2); const u = q(t); STUDIO.parts.g2.visible = false; sDave.root.position.set(10.5, 0, -6); sDave.root.rotation.y = -0.3; const s = Math.sin(u * 8) * 10; sDave.pose({ sl: -22, el: 62, slx: -30, sr: -10 - s * 0.3, er: 70 + s, srx: -40, nod: 14, tilt: -6 }); sDave.expr('neutral', 'focus'); sDave.look(0.2, -0.8); holdGuitar(sDave, sBass); labels[2].position.set(10.5, 18.8, -8); sBarrett.root.position.set(4, 0, -24.5); spinGear(t) }, cam: (t) => { const k = ease(tB, tV, t); return cam(V(lerp(15, 11, k), 12, 32), V(10.5, 10, -7), null, 0.0036) } },
      { until: tE, set: STUDIO, update: (t) => { reset(); show(3); const u = q(t); sDave.root.position.set(1, 0, -1.6); sDave.root.rotation.y = 0; sDave.pose({ sl: 30, el: 40, slx: -30, sr: -70, er: -60, srx: -50, nod: -6 + Math.sin(u * 7) * 5, tilt: Math.sin(u * 3.5) * 6 }); sDave.expr(Math.floor(u * 6) % 3 ? 'sing' : 'oh', 'up'); sDave.look(0, 0.2); labels[3].position.set(1, 18.6, -5); sBarrett.root.position.set(4, 0, -24.5); spinGear(t) }, cam: (t) => { const k = ease(tV, tE, t); return cam(V(lerp(3, 1.5, k), 13, lerp(28, 24, k)), V(1, 11.5, -2), null, 0.0042) } },
      { until: 1e9, set: STUDIO, update: (t) => { reset(); show(-1); const u = q(t); tally.visible = true; tally.position.set(-12, 10, -6); tally.rotation.y = 0.35; drawTally(Math.floor(clamp((u - tE - 0.3) / (T[3][1] - tE - 1.2)) * 15)); sDave.root.position.set(-6.5, 0, -4); sDave.root.rotation.y = 0.5; sDave.pose({ sl: 20, sr: -120, er: -40, tilt: 8 }); sDave.expr('grin', 'up'); sDave.look(-0.7, 0); sBarrett.root.position.set(4, 0, -24.5); spinGear(t) }, cam: (t) => { const k = ease(tE, T[3][1] + 0.5, t); return cam(V(lerp(-4, -8, k), 12, lerp(32, 30, k)), V(lerp(-11, -9.5, k), 9.5, -6), V(-12, 10, -6), 0.0036) } },
    ] })
  }

  // ---------- 6. A SURPRISE VISITOR ----------
  {
    const T = sc(5), cues = []
    const music = card(5.6, 3.4, '', { lines: ['X-STATIC', 'guitar: G. Dulli'], size: 0.9, bg: '#f6efdd' }); STUDIO.scene.add(music); music.visible = false
    const mstand = stand(1.6, 5.2); STUDIO.scene.add(mstand); mstand.visible = false
    const stool = new THREE.Group(); const top = cyl(1.6, 0.5, { color: '#7a5232' }); top.position.y = 3.2; stool.add(top); for (let i = 0; i < 3; i++) { const l = cyl(0.15, 3.2, { color: '#5a3a22' }); const a = (i / 3) * Math.PI * 2; l.position.set(Math.cos(a) * 1, 1.6, Math.sin(a) * 1); stool.add(l) } STUDIO.scene.add(stool); stool.visible = false
    const hand = T[1][0] + 0.2, sitAt = T[2][0]
    cues.push([0.35, 'door'], [0.9, 'step'], [1.3, 'step'], [1.7, 'step'], [2.1, 'step'], [hand + 0.4, 'amp_buzz', { dur: 1.2 }], [sitAt + 0.3, 'notes'], [sitAt + 1.4, 'notes'], [sitAt + 2.2, 'button'])
    out.push({ cues, T, shots: [
      { until: sitAt, set: STUDIO, update: (t) => {
        reset(); music.visible = mstand.visible = stool.visible = false; const u = q(t)
        STUDIO.parts.door.rotation.y = -1.4 * ss(0.3, 0.8, u) * (1 - ss(2.6, 3.2, u))
        const k = clamp((u - 0.6) / 2.2); sGreg.root.visible = true; sGreg.root.position.set(lerp(19, 7.5, k), 0, lerp(-13, -4, k)); sGreg.root.rotation.y = lerp(-0.9, -0.35, k)
        const s = k < 1 ? Math.sin(u * 9) * 20 : 0; const hk = ss(hand, hand + 0.8, u)
        sGreg.pose({ hl: s, hr: -s, sl: lerp(6, 60, hk), el: lerp(6, 40, hk), slx: -hk * 40, sr: -6, bob: k < 1 ? Math.abs(Math.sin(u * 9)) * 0.2 : 0, nod: 4 }); sGreg.expr(u > 2.4 ? 'smile' : 'neutral', 'neutral'); sGreg.look(-0.8, -0.2)
        sDave.root.position.set(0.5, 0, -3.5); sDave.root.rotation.y = 0.35; sDave.pose({ sl: 8, sr: lerp(-10, -70, hk) + (u < hand ? -40 : 0), er: lerp(-10, -20, hk), srx: -hk * 30, tilt: 4 }); sDave.expr(u > 1.2 ? 'grin' : 'oh', 'up'); sDave.look(0.8, -0.1)
        // the guitar passes from Dave to Greg
        const gD = new THREE.Vector3(), gG = new THREE.Vector3(); sDave.arms[1].grip.getWorldPosition(gD); sGreg.arms[0].grip.getWorldPosition(gG)
        STUDIO.parts.g1.visible = false; sGuitar.visible = true; sGuitar.position.copy(gD.lerp(gG, ss(hand + 0.5, hand + 1.3, u))).add(V(0, -1.4, 0.6)); sGuitar.rotation.set(0, 0, 0.2)
        sBarrett.root.position.set(4, 0, -24.5); spinGear(t)
      }, cam: (t) => { const k = ease(0, sitAt, t); return cam(V(lerp(11, 5, k), 12, lerp(44, 38, k)), V(lerp(11, 4.5, k), 9.5, -6), null, 0.003) } },
      { until: 1e9, set: STUDIO, update: (t) => {
        reset(); const u = q(t); STUDIO.parts.g1.visible = false
        stool.visible = true; stool.position.set(1.5, 0, -2); music.visible = mstand.visible = true; mstand.position.set(6.4, 0, 0.6); music.position.set(6.4, 5.6, 0.7); music.rotation.set(-0.35, -0.5, 0)
        sGreg.root.visible = true; sGreg.root.position.set(1.5, 0, -1.8); sGreg.root.rotation.y = 0.15; const s = Math.sin(u * 9) * 14
        sGreg.pose({ sl: -20, el: 60, slx: -30, sr: -12 - s * 0.3, er: 72 + s, srx: -40, hl: 90, hr: 90, kl: 90, kr: 90, nod: 16, tilt: Math.sin(u * 2.6) * 5 }); sGreg.body.position.y = -1.5; sGreg.expr('neutral', 'focus'); sGreg.look(0.2, -0.8)
        holdGuitar(sGreg, sGuitar)
        // Dave watches through the control-room glass, next to Barrett
        sDave.root.position.set(8.5, 0.6, -24); sDave.root.rotation.y = -0.15; sDave.pose({ sl: 30, el: 60, slx: -30, sr: -30, er: -60, srx: -30, nod: 6 }); sDave.expr('smile', 'up'); sDave.look(-0.4, -0.4)
        sBarrett.root.position.set(1.5, 0, -24.5); sBarrett.root.rotation.y = 0.1; sBarrett.pose({ sl: 30, el: 60, slx: -40, sr: -30, er: -60, srx: -40, nod: 14 }); sBarrett.expr('smile', 'neutral'); sBarrett.look(0.2, -0.6)
        spinGear(t)
      }, cam: (t) => { const k = ease(sitAt, T[2][1] + 0.5, t); return cam(V(lerp(-7, -3, k), 12, lerp(32, 40, k)), V(lerp(2, 4.5, k), lerp(8.5, 10, k), lerp(-3, -10, k)), V(lerp(1.5, 6, k), 9, lerp(-2, -20, k)), 0.0024) } },
    ] })
  }

  // ---------- 7. THE BIRTH OF FOO FIGHTERS ----------
  {
    const T = sc(6), cues = []
    const A = makeSet({ bg: '#2a1e14', sky: '#ffe4c0', ground: '#3a2616', hemi: 0.7, key: { pos: [-10, 30, 14], target: [0, 0, 0], int: 900, angle: 0.5 } })
    A.add(floorCard(50, 40, '#8a5a34', planks), 0, 0, 0)
    const caseB = box(6.4, 0.4, 4.2, { color: '#c8ccd0' }); A.add(caseB, -2, 0.6, 1)
    const insert = cutout(rectPts(6.0, 3.9), { depth: 0.05, paint: paint('#f2ead2', (x, P) => { words(x, P, 'FOO FIGHTERS', 0, 0.7, 0.85, { font: FONT.mark }); words(x, P, 'ROUGH MIXES', 0, -0.6, 0.62, { font: FONT.hand, col: '#b3342a' }); marker(x, P, [[-2.4, -1.2], [2.4, -1.3]], 0.06, '#3a5aa0') }) }); insert.rotation.x = -Math.PI / 2; A.add(insert, -2, 0.85, 1)
    const lidP = new THREE.Group(); const lid = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.25, 4.2), new THREE.MeshPhysicalMaterial({ color: '#e8eef4', transparent: true, opacity: 0.35, roughness: 0.1 })); lid.position.z = 2.1; lidP.add(lid); A.add(lidP, -2, 0.9, -1.1)
    const tape = cassette('FOO FIGHTERS'); tape.scale.setScalar(1.3); A.scene.add(tape)
    const deck = box(12, 3.4, 6, { color: '#2a2a30', front: (x, P) => { for (const sx of [-3, 3]) { x.fillStyle = '#111'; x.fillRect(P.X(sx - 2.4), P.Y(1.2), 4.8 * P.s, 2.0 * P.s); x.fillStyle = '#666'; for (const r of [-1, 1]) { x.beginPath(); x.arc(P.X(sx + r * 1.1), P.Y(0.2), 0.45 * P.s, 0, 7); x.fill() } } x.fillStyle = '#e04a3a'; x.fillRect(P.X(-0.4), P.Y(-0.8), 0.8 * P.s, 0.4 * P.s); x.fillStyle = '#ddd'; x.font = `${0.45 * P.s}px ${FONT.block}`; x.fillText('DUB', P.X(-0.55), P.Y(-1.2)) } }); A.add(deck, 2, 1.9, -8)
    const stack = Array.from({ length: 9 }, (_, i) => { const c = cassette('FOO FIGHTERS'); c.rotation.x = -Math.PI / 2; c.rotation.z = (i % 3 - 1) * 0.08; A.add(c, 7.5, 0.6 + i * 0.36, 1.5); c.visible = false; return c })
    const arm = new THREE.Group(); const sleeve = cutout(roundPts(3, 14, 1.2, 0, 7), { depth: 0.3, paint: paint('#24242a') }); arm.add(sleeve); const handM = cutout(ellPts(1.8, 1.6, 0, -0.6, 16), { depth: 0.3, paint: paint('#e4b48a') }); handM.position.z = 0.1; arm.add(handM); A.scene.add(arm)
    // B: a little stage, Dave alone, then silhouettes join
    const B = makeSet({ bg: '#0e0c12', sky: '#6a5a8a', ground: '#140e10', hemi: 0.25, key: { pos: [0, 34, 18], target: [0, 5, -2], int: 1300, color: '#ffe8c8', angle: 0.28, pen: 0.5 } })
    B.add(floorCard(60, 40, '#2a2024'), 0, 0, 0)
    const stage = box(30, 2.2, 14, { color: '#3a2a22', front: (x, P) => { x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.1 * P.s; for (let i = -14; i < 15; i += 2) { x.beginPath(); x.moveTo(P.X(i), 0); x.lineTo(P.X(i), P.h); x.stroke() } } }); B.add(stage, 0, 1.1, -3)
    B.add(wallCard(60, 30, '#5a1e22', (x, P) => { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.4 * P.s; for (let i = -30; i < 30; i += 1.6) { x.beginPath(); x.moveTo(P.X(i), 0); x.quadraticCurveTo(P.X(i + 0.8), P.h / 2, P.X(i), P.h); x.stroke() } }), 0, 0, -10)
    const bDave = puppet(DAVE); B.add(bDave.root, 0, 2.2, -1); const bG = guitar({ body: '#c0392b' }); bG.scale.setScalar(1.1); B.scene.add(bG); const bMic = mic(6.4); B.add(bMic, 0.2, 2.2, 1.4)
    const beam = cone('#fff1d0', 7, 30, 0.1); B.add(beam, 0, 31, -1); const rimL = new THREE.PointLight('#a080ff', 260, 40, 1.4); B.add(rimL, 0, 14, -9)
    const sil = [[-9, 'bass'], [9, 'gtr'], [0, 'drums']].map(([x, k], i) => { const p = puppet({ name: 'sil' + i, hair: '#0a0a0c', hairStyle: ['short', 'spiky', 'curly'][i], shirt: '#1c1a22', pants: '#1c1a22', skin: '#1c1a22', shoes: '#1c1a22', hair: '#15131a', ears: false }); p.eyes.forEach((e) => (e.visible = false)); p.root.position.set(x, 2.2, i === 2 ? -7 : -4); p.root.scale.setScalar(i === 2 ? 0.9 : 1); B.scene.add(p.root); return p })
    const tapeIn = 0.7, closeAt = 2.0, dubAt = 2.8, stageAt = T[1][0] - 0.1, joinAt = T[2][0]
    cues.push([tapeIn + 0.6, 'cassette'], [closeAt + 0.4, 'case_close'], [dubAt, 'button'], [dubAt + 0.2, 'tape_run', { dur: stageAt - dubAt }], [joinAt + 0.4, 'flash'], [joinAt + 1.2, 'flash'], [joinAt + 0.2, 'crowd', { dur: T[2][1] - joinAt + 1.5, rise: 1 }])
    out.push({ cues, T, shots: [
      { until: stageAt, set: A, update: (t) => {
        const u = q(t), k = ss(tapeIn, tapeIn + 0.7, u), out_ = ss(closeAt - 0.2, closeAt + 0.4, u)
        tape.position.set(lerp(-6, -2, k), lerp(5, 1.05, k), lerp(6, 1, k)); tape.rotation.set(lerp(-0.6, -Math.PI / 2, k), 0, lerp(0.4, 0, k))
        arm.position.set(lerp(-6, -2, k) - out_ * 6, lerp(5, 1.6, k) + out_ * 6, lerp(6.6, 1.6, k) + out_ * 4); arm.rotation.set(-1.1, 0, lerp(0.6, 0.2, k))
        lidP.rotation.x = -1.9 * (1 - ss(closeAt, closeAt + 0.4, u))
        const n = Math.floor(clamp((u - dubAt - 0.2) / (stageAt - dubAt - 0.6)) * stack.length); stack.forEach((c, i) => (c.visible = i < n))
      }, cam: (t) => { const k = ease(0, stageAt, t), p = ease(dubAt - 0.6, dubAt + 0.6, t); return cam(V(lerp(-1, 3, p), lerp(15, 13, k), lerp(16, 26, p)), V(lerp(-1.5, 3, p), lerp(0.8, 2.2, p), lerp(1, -3, p)), null, 0.005) } },
      { until: 1e9, set: B, update: (t) => {
        const u = q(t), s = Math.sin(u * 8) * 10
        bDave.pose({ sl: -20, el: 60, slx: -30, sr: -12 - s * 0.3, er: 72 + s, srx: -40, nod: 6, tilt: Math.sin(u * 2.4) * 4 }); bDave.expr(u > joinAt + 0.5 ? 'smile' : 'neutral', u > joinAt ? 'up' : 'neutral'); bDave.look(u > joinAt ? Math.sin(u * 1.5) : 0, -0.2)
        holdGuitar(bDave, bG); bDave.root.position.y = 2.2
        sil.forEach((p, i) => { const k = ss(joinAt + i * 0.45, joinAt + i * 0.45 + 0.3, u); p.root.visible = k > 0; p.root.scale.setScalar((i === 2 ? 0.9 : 1) * Math.max(0.01, k)); p.pose({ sl: 10 + Math.sin(u * 6 + i) * 10, sr: -10, nod: Math.sin(u * 8 + i) * 6 }) })
        B.key.intensity = 1300 + (u > joinAt ? 400 : 0)
      }, cam: (t) => { const k = ease(stageAt, T[2][1] + 0.6, t); return cam(V(0, lerp(12, 13, k), lerp(36, 54, k)), V(0, lerp(10.5, 10, k), -2), V(0, 10, -1), 0.0028) } },
    ] })
  }

  // ---------- 8. A NEW CHAPTER ----------
  {
    const T = sc(7), cues = []
    const S = makeSet({ bg: '#1a120c', sky: '#c8a0ff', ground: '#1a1014', hemi: 0.45, key: { pos: [-30, 60, 40], target: [0, 4, -3], int: 2600, color: '#ffe2b8', angle: 0.5, pen: 0.7 } })
    // the workbench the whole miniature sits on
    S.add(floorCard(240, 160, '#7a5434', planks), 0, -0.4, 0)
    const mat_ = floorCard(70, 46, '#2f6a4a', (x, P) => { x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 0.06 * P.s; for (let i = -35; i < 35; i += 2) { x.beginPath(); x.moveTo(P.X(i), 0); x.lineTo(P.X(i), P.h); x.stroke(); x.beginPath(); x.moveTo(0, P.Y(i)); x.lineTo(P.w, P.Y(i)); x.stroke() } }); S.add(mat_, 0, 0, 0)
    const stage = box(34, 2.6, 15, { color: '#3a2a22', front: (x, P) => { words(x, P, '1995', 0, 0, 1.6, { col: '#f4d860' }) } }); S.add(stage, 0, 1.3, -4)
    const backdrop = wallCard(38, 24, '#232036', (x, P) => { x.fillStyle = 'rgba(244,216,96,.85)'; for (let i = 0; i < 40; i++) { const r = rng(i * 7); x.beginPath(); x.arc(P.X(-18 + r() * 36), P.Y(2 + r() * 21), (0.08 + r() * 0.15) * P.s, 0, 7); x.fill() } }); S.add(backdrop, 0, 0, -11.5)
    const truss = box(36, 0.8, 0.8, { color: '#555' }); S.add(truss, 0, 22, -5)
    const beams = [['#ff7a5a', -10], ['#7ac8ff', 0], ['#ffd25a', 10]].map(([c, x]) => { const b = cone(c, 5, 22, 0.1); S.add(b, x, 22, -5); return b })
    const band = { dave: puppet(DAVE), bass: puppet(BASSIST), gtr: puppet(GUITARIST), drums: puppet(DRUMMER) }
    S.add(band.dave.root, 0, 2.6, -2); S.add(band.bass.root, -10, 2.6, -4); S.add(band.gtr.root, 10, 2.6, -4)
    const riser = box(10, 2, 5, { color: '#2a2a2e' }); S.add(riser, 0, 3.6, -9); const kit = drumKit(); kit.scale.setScalar(0.85); S.add(kit, 0, 4.6, -8.6); S.add(band.drums.root, 0, 4.6, -10.4)
    const gD = guitar({ body: '#c0392b' }), gB = guitar({ body: '#2c5aa0', bass: true }), gG = guitar({ body: '#f2f0e6' }); for (const g of [gD, gB, gG]) { g.scale.setScalar(1.1); S.scene.add(g) }
    const m = mic(6.4); S.add(m, 0.2, 2.6, 0.6)
    for (const x of [-15, 15]) S.add(amp(4.4, 4.4, 2.4, 'LOUD'), x, 4.8, -8)
    // crowd: cardboard heads with arms up, in front of the stage
    const crowd = Array.from({ length: 22 }, (_, i) => { const r = rng(i + 99), g = new THREE.Group(), col = ['#c8574a', '#4a6a9a', '#e8c060', '#6a9a5a', '#9a5a9a', '#e8e0d0'][i % 6]; const b = cutout(roundPts(3.4, 4, 1.2, 0, 2), { depth: 0.25, paint: paint(col), seed: 300 + i }); g.add(b); const h = cutout(ellPts(1.4, 1.6, 0, 5.2, 16), { depth: 0.25, paint: paint(['#e4b48a', '#c89068', '#f0c8a8', '#8a5a3a'][i % 4]), seed: 400 + i }); g.add(h); const hr = cutout(ellPts(1.5, 1.0, 0, 6.2, 14), { depth: 0.25, paint: paint(['#2a1a10', '#e8d070', '#6a3a1a', '#1a1a1a'][i % 4]), seed: 500 + i }); hr.position.z = -0.1; g.add(hr); const arm_ = cutout(roundPts(0.8, 4, 0.4, 0, 2), { depth: 0.2, paint: paint(col), seed: 600 + i }); arm_.position.set(1.4, 3.4, 0.1); g.add(arm_); g.userData = { arm: arm_, ph: r() * 6 }; g.position.set(-15 + (i % 11) * 3 + (r() - 0.5), 0, 9 + Math.floor(i / 11) * 3.4); g.rotation.y = Math.PI; S.scene.add(g); g.rotation.y = 0; return g })
    // craft clutter around the miniature (the reveal)
    const scis = cutout([[-1, 0], [1, 0], [0.6, 10], [-0.6, 10]], { depth: 0.2, paint: paint('#b8bcc4') }); scis.rotation.set(-Math.PI / 2, 0, 0.5); S.add(scis, 21, 0.2, 22)
    for (const sx of [-1, 1]) { const ring_ = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.45, 8, 20), new THREE.MeshStandardMaterial({ color: '#d8432f' })); ring_.rotation.x = -Math.PI / 2; S.add(ring_, 19 + sx * 1.8, 0.4, 28) }
    const glue = cyl(1.8, 7, { color: '#f2f0ea', cap: '#f08a24' }); S.add(glue, -22, 3.5, 20); const gcap = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.2, 12), new THREE.MeshStandardMaterial({ color: '#f08a24' })); S.add(gcap, -22, 8.1, 20)
    for (let i = 0; i < 3; i++) { const p = cyl(0.45, 16, { color: ['#f2c230', '#3a8a5a', '#d8432f'][i] }); p.rotation.set(Math.PI / 2, 0, 0.3 + i * 0.2); S.add(p, -18 + i * 2.2, 0.5, 30) }
    for (let i = 0; i < 5; i++) { const sc_ = cutout([[0, 0], [5 + i, 0.6], [4, 3 + i % 2], [0.6, 2.6]], { depth: 0.3, seed: 700 + i }); sc_.rotation.set(-Math.PI / 2, 0, i); S.add(sc_, 24 - i * 11, 0.1, 34 + (i % 2) * 4) }
    // the cardboard logo tiles on skewers above the stage
    const letters = 'FOO FIGHTERS'.split(''), tiles = []
    letters.forEach((ch, i) => { if (ch === ' ') return; const g = new THREE.Group(); const tl = cutout(roundPts(2.6, 3.2, 0.4), { depth: 0.35, seed: 800 + i, paint: paint(i < 3 ? '#e2b33c' : '#f2efe6', (x, P) => words(x, P, ch, 0, -0.05, 2.5, { font: FONT.block, col: '#1c1a18' })) }); g.add(tl); const stick = cyl(0.08, 6, { color: '#d8c8a0' }); stick.position.y = -4.4; g.add(stick); g.position.set(-14.2 + i * 2.6, 27.5 + Math.sin(i * 0.9) * 0.5, -3); g.rotation.z = (rng(i + 3)() - 0.5) * 0.25; S.scene.add(g); tiles.push(g) })
    const logoAt = T[3][0] - 0.3
    cues.push([0, 'crowd', { dur: T[3][1] + 4, rise: 0 }], [0.4, 'band', { dur: T[3][1] + 2.6 }], [1.5, 'flash'], [T[1][0] + 1.0, 'flash'], [T[2][0] + 0.5, 'flash'], [logoAt, 'pop_logo', { n: tiles.length }], [T[3][1] + 1.0, 'final_chord'])
    out.push({ cues, T, final: T[3][1] + 0.4, shots: [{ until: 1e9, set: S, update: (t) => {
      const u = q(t), b = Math.sin(u * 9.5)
      const strum = (p, g, ph) => { const s = Math.sin(u * 10 + ph) * 14; p.pose({ sl: -20, el: 60, slx: -30, sr: -12 - s * 0.3, er: 72 + s, srx: -40, nod: 8 + b * 6, tilt: Math.sin(u * 3 + ph) * 6, bob: Math.max(0, b) * 0.2 }); holdGuitar(p, g) }
      strum(band.dave, gD, 0); band.dave.expr(Math.floor(u * 6) % 3 ? 'sing' : 'oh', 'up'); band.dave.look(0, 0.1)
      strum(band.bass, gB, 1.4); band.bass.expr('neutral', 'focus'); band.bass.look(0.4, -0.6)
      strum(band.gtr, gG, 2.6); band.gtr.expr('grin', 'up'); band.gtr.look(-0.5, 0)
      const a = Math.sin(u * 18) * 30; band.drums.pose({ sl: 50 + a, el: 70 - a, sr: -50 + a, er: -70 - a, slx: -40, srx: -40, hl: 90, hr: 90, kl: 90, kr: 90, nod: a * 0.25 }); band.drums.body.position.y = -1.6; band.drums.expr('grin', 'focus')
      crowd.forEach((c) => { const h = Math.max(0, Math.sin(u * 9 + c.userData.ph)); c.position.y = h * 0.5; c.userData.arm.rotation.z = -0.3 + Math.sin(u * 6 + c.userData.ph) * 0.4 })
      beams.forEach((bm, i) => (bm.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.35))
      tiles.forEach((g, i) => { const k = ss(logoAt + i * 0.07, logoAt + i * 0.07 + 0.25, u); g.visible = k > 0; g.scale.setScalar(Math.max(0.01, k)) })
    }, cam: (t) => { const k = ease(0.2, T[3][1] + 2.5, t); return cam(V(lerp(2, 6, k), lerp(12, 40, k), lerp(28, 120, k)), V(0, lerp(11, 12, k), lerp(-1, -4, k)), V(0, 11, -1), lerp(0.0045, 0.0016, k)) } }] })
  }
  return out
}
