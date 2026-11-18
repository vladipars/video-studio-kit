// WHAT IF the song was never released? PS2-style cutscenes, one scene per beat (story.json, by index).
// Every scene is drawn at 302x536 with few polygons, tiny noisy nearest-neighbour textures and fog, then stretched
// to the frame with scanlines. HUD on top: chapter line, a month/year counter, word-by-word captions and two meters.
import * as THREE from 'three'
import { makeFlame } from '../lib/three-claude.js'
import { canvas, clamp, ss, rng, easeOut, lerp } from '../lib/common.js'

const RH = 536
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const D = (d) => (d * Math.PI) / 180

// ---------- low-fi materials ----------
const tex = (w, h, draw, rep) => {
  const c = canvas(w, h); draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...(Array.isArray(rep) ? rep : [rep, rep])) }
  return t
}
const noisy = (base, spread, seed) => (x, w, h) => { const r = rng(seed); const [a, b, c] = base; for (let i = 0; i < w; i++) for (let k = 0; k < h; k++) { const v = (r() - 0.5) * spread; x.fillStyle = `rgb(${a + v},${b + v},${c + v * 0.7})`; x.fillRect(i, k, 1, 1) } }
const lam = (c, map) => new THREE.MeshLambertMaterial({ color: map ? 0xffffff : c, map })
const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o })
const glowMat = (c, op = 0.3) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
const at = (o, x, y, z, parent) => { o.position.set(x, y, z); parent && parent.add(o); return o }
const noiseTex = (base, spread, seed, rep, size = 16) => tex(size, size, noisy(base, spread, seed), rep)
const plaid = (a, b, seed) => tex(16, 16, (x, w, h) => { noisy(a, 20, seed)(x, w, h); x.fillStyle = b; x.globalAlpha = 0.75; x.fillRect(0, 5, w, 4); x.fillRect(5, 0, 4, h); x.globalAlpha = 0.35; x.fillStyle = '#ffffff'; x.fillRect(0, 12, w, 1); x.fillRect(12, 0, 1, h) })
// pixel-text sign: drawn small, so it stays chunky
function label(text, { w = 96, h = 24, bg = '#1a1420', fg = '#ffd23f', font = 'bold 15px Arial', border } = {}) {
  return tex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h)
    if (border) { x.strokeStyle = border; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2) }
    x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 1)
  })
}
function sky(s, stops) {
  const t = tex(8, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([k, c]) => g.addColorStop(k, c)); x.fillStyle = g; x.fillRect(0, 0, w, h) })
  t.magFilter = THREE.LinearFilter
  s.add(new THREE.Mesh(new THREE.SphereGeometry(95, 12, 8), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false })))
}
const blob = (s, x, z, r = 0.6) => { const b = new THREE.Mesh(new THREE.CircleGeometry(r, 10), basic(0x000000, { transparent: true, opacity: 0.4 })); b.rotation.x = -Math.PI / 2; return at(b, x, 0.03, z, s) }

// ---------- a low-poly person (generic, not anyone real) ----------
function person(o = {}) {
  const M = (c) => lam(c)
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body)
  const skin = M(o.skin ?? 0xe2b48c), shirt = o.shirtMat ?? M(o.shirt ?? 0x333333), pants = o.pantsMat ?? M(o.pants ?? 0x2f4258), shoe = M(o.shoe ?? 0x1c1c1c)
  const limb = (w, h, m, x, y) => { const j = new THREE.Group(); j.position.set(x, y, 0); const b = box(w, h, w, m); b.position.y = -h / 2; j.add(b); body.add(j); return j }
  const legL = limb(0.24, 0.95, pants, -0.15, 1.0), legR = limb(0.24, 0.95, pants, 0.15, 1.0)
  for (const l of [legL, legR]) at(box(0.27, 0.14, 0.42, shoe), 0, -0.98, 0.07, l)
  at(box(0.66, 0.86, 0.36, shirt), 0, 1.43, 0, body)
  const armL = limb(0.18, 0.78, shirt, -0.43, 1.82), armR = limb(0.18, 0.78, shirt, 0.43, 1.82)
  for (const a of [armL, armR]) at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), skin), 0, -0.86, 0, a)
  const head = at(new THREE.Group(), 0, 2.12, 0, body)
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.27, 6, 5), skin); hm.scale.set(0.95, 1.1, 1); head.add(hm)
  const eye = M(0x141014); at(box(0.06, 0.08, 0.03, eye), -0.09, 0.03, 0.25, head); at(box(0.06, 0.08, 0.03, eye), 0.09, 0.03, 0.25, head)
  const hairM = M(o.hair ?? 0x3a2618), hair = at(new THREE.Group(), 0, 0.12, -0.02, head)
  const style = o.style ?? 'short'
  if (style === 'big') { // teased, sprayed, enormous
    const r = rng(o.seed ?? 7)
    const lumps = [[0, 0.22, 0, 0.36], [-0.24, 0.1, -0.05, 0.3], [0.24, 0.1, -0.05, 0.3], [0, 0.12, -0.24, 0.34], [-0.3, -0.18, -0.12, 0.26], [0.3, -0.18, -0.12, 0.26], [-0.26, -0.45, -0.14, 0.22], [0.26, -0.45, -0.14, 0.22], [0, -0.3, -0.3, 0.3], [-0.14, 0.38, 0.06, 0.24], [0.14, 0.38, 0.06, 0.24]]
    for (const [x, y, z, rr] of lumps) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rr * (0.9 + r() * 0.2), 0), hairM); m.position.set(x, y, z); m.rotation.set(r() * 3, r() * 3, 0); hair.add(m) }
  } else {
    const capM = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), hairM); capM.position.y = -0.08; hair.add(capM)
    if (style === 'cap') { const c = M(o.capColor ?? 0xc0392b); at(box(0.62, 0.05, 0.3, c), 0, -0.02, -0.28, hair); const cy = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.31, 0.16, 7), c); at(cy, 0, 0.0, 0, hair) }
    if (style === 'paper') at(box(0.5, 0.18, 0.34, M(0xf4f1ea)), 0, 0.08, 0, hair)
  }
  g.userData = { body, head, hair, armL, armR, legL, legR }
  g.userData.pose = ({ al = 0, ar = 0, afl = 0, afr = 0, ll = 0, lr = 0, tilt = 0, lean = 0, nod = 0 } = {}) => {
    armL.rotation.set(D(-afl), 0, D(-al)); armR.rotation.set(D(-afr), 0, D(ar)); legL.rotation.x = D(-ll); legR.rotation.x = D(-lr)
    head.rotation.set(D(nod), 0, D(tilt)); body.rotation.x = D(lean)
  }
  g.userData.walk = (t, speed = 9, amt = 28) => { const s = Math.sin(t * speed) * amt; g.userData.pose({ afl: s, afr: -s, ll: -s, lr: s }); body.position.y = Math.abs(Math.cos(t * speed)) * 0.05 }
  if (o.guitar) {
    const gt = guitar(o.guitar); gt.position.set(0.05, 1.3, 0.28); gt.rotation.z = D(28); body.add(gt); g.userData.guitar = gt
  }
  return g
}
function guitar(color = 0xd8432f) {
  const g = new THREE.Group(), m = lam(color), dark = lam(0x1a1410)
  at(box(0.56, 0.42, 0.1, m), 0, 0, 0, g); at(box(0.4, 0.3, 0.1, m), 0.08, 0.3, 0, g)
  at(box(0.08, 0.95, 0.06, dark), -0.02, 0.85, 0.01, g).rotation.z = D(-6); at(box(0.14, 0.2, 0.06, dark), -0.07, 1.36, 0.01, g)
  at(box(0.3, 0.06, 0.02, basic(0xdddddd)), 0, -0.05, 0.06, g)
  return g
}
function cassette(text = 'DEMO 91') {
  const g = new THREE.Group(), sh = lam(0x1d1d22)
  at(box(0.6, 0.38, 0.09, sh), 0, 0, 0, g)
  const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshLambertMaterial({ map: label(text, { w: 64, h: 28, bg: '#f2ead2', fg: '#b3261e', font: 'bold 12px Arial' }) }))
  at(lb, 0, 0.04, 0.047, g)
  return g
}
function boombox() {
  const g = new THREE.Group(), body = lam(0x3c3c44), grill = lam(0x16161a), chrome = lam(0xb8bcc4)
  at(box(1.6, 0.8, 0.45, body), 0, 0.4, 0, g); at(box(1.2, 0.08, 0.08, chrome), 0, 0.92, 0, g)
  g.userData.cones = []
  for (const x of [-0.5, 0.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 8), grill); c.rotation.x = Math.PI / 2; at(c, x, 0.4, 0.23, g); g.userData.cones.push(c) }
  at(box(0.42, 0.26, 0.04, lam(0x111114)), 0, 0.45, 0.23, g)
  g.userData.btn = at(box(0.12, 0.06, 0.08, lam(0xd8432f)), 0.12, 0.83, 0.12, g)
  return g
}

// ---------- shared pieces ----------
function rain(s, { n = 500, cx = 0, cz = 0, wx = 24, wz = 24, top = 14, speed = 22, col = 0xa8b8d0 } = {}) {
  const pos = new Float32Array(n * 6), r = rng(77), base = []
  for (let i = 0; i < n; i++) base.push([cx + (r() - 0.5) * wx, r() * top, cz + (r() - 0.5) * wz])
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const ln = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55 })); s.add(ln)
  return (t) => { for (let i = 0; i < n; i++) { const [x, y0, z] = base[i], y = (((y0 - t * speed) % top) + top) % top; pos.set([x, y, z, x + 0.08, y + 0.7, z], i * 6) } g.attributes.position.needsUpdate = true }
}
function spot(s, x, y, z, col, h = 12, r = 2.4) {
  const piv = at(new THREE.Group(), x, y, z, s)
  const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8, 1, true), glowMat(col, 0.16)); c.position.y = -h / 2; piv.add(c)
  at(new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), basic(col)), 0, 0, 0, piv)
  return piv
}
function crowd(s, { n = 140, x0 = -9, x1 = 9, z0 = 4, z1 = 11, keep = 1, seed = 5 } = {}) {
  const r = rng(seed), people = []
  for (let i = 0; i < n; i++) { const p = [lerp(x0, x1, r()), lerp(z0, z1, r()), r() * 6, r()]; if (r() < keep) people.push(p) }
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 1.1, 0.4), lam(0x2a2434), people.length)
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 5, 4), lam(0x5a4048), people.length)
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 4, 3), basic(0xffd060), people.length)
  s.add(bodies, heads, lights)
  const m = new THREE.Matrix4(), hide = new THREE.Matrix4().makeScale(0, 0, 0)
  return (t, energy = 1) => {
    people.forEach(([x, z, ph, k], i) => {
      const b = Math.max(0, Math.sin(t * 9 + ph)) * 0.25 * energy
      m.makeTranslation(x, 0.55 + b, z); bodies.setMatrixAt(i, m)
      m.makeTranslation(x, 1.35 + b, z); heads.setMatrixAt(i, m)
      if (k < 0.35) { m.makeTranslation(x + 0.3, 1.9 + b + Math.sin(t * 3 + ph) * 0.1, z); lights.setMatrixAt(i, m) } else lights.setMatrixAt(i, hide)
    })
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true
  }
}
function garage(s, { dusty = false } = {}) {
  s.fog = new THREE.Fog(dusty ? 0x6a6258 : 0x2a2230, 8, 30)
  s.add(new THREE.HemisphereLight(dusty ? 0xd8d0c0 : 0x9a88b8, 0x3a3028, dusty ? 1.5 : 1.1))
  const bulb = new THREE.PointLight(0xffc27a, dusty ? 14 : 22, 16, 1.4); bulb.position.set(0, 4.2, 0.5); s.add(bulb)
  at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), basic(0xfff0c0)), 0, 4.3, 0.5, s)
  at(box(0.02, 1.2, 0.02, basic(0x222222)), 0, 5.0, 0.5, s)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), lam(0, noiseTex(dusty ? [128, 122, 112] : [108, 104, 100], 30, 3, 8))); floor.rotation.x = -Math.PI / 2; s.add(floor)
  const planks = tex(32, 32, (x, w, h) => { noisy(dusty ? [150, 120, 88] : [128, 96, 68], 26, 4)(x, w, h); x.fillStyle = 'rgba(40,24,12,.6)'; for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 1, h) }, [4, 2])
  at(box(14, 7, 0.3, lam(0, planks)), 0, 3.5, -3.2, s); at(box(0.3, 7, 10, lam(0, planks)), -5.2, 3.5, 1, s); at(box(0.3, 7, 10, lam(0, planks)), 5.2, 3.5, 1, s)
  // workbench + shelf
  const wood = lam(0, noiseTex([110, 80, 54], 30, 6))
  at(box(4.2, 0.18, 1.4, wood), 1.6, 1.5, -2.2, s); for (const x of [-0.4, 3.6]) at(box(0.16, 1.5, 1.3, wood), x, 0.75, -2.2, s)
  at(box(4, 0.12, 0.8, wood), 1.6, 3.2, -2.7, s)
  // a little band corner: amp, drum, guitar on a stand, cables
  at(box(1.3, 1.4, 0.8, lam(0x26222a)), -3.3, 0.7, -2.3, s)
  at(box(1.05, 0.9, 0.05, lam(0, tex(8, 8, noisy([40, 36, 44], 22, 9)))), -3.3, 0.8, -1.88, s)
  const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.6, 8), lam(0xa8282e)); kick.rotation.x = Math.PI / 2; at(kick, -1.6, 0.7, -2.1, s)
  const cym = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 8), lam(0xc9a740)); at(cym, -0.9, 2.1, -2.4, s); at(box(0.04, 2.1, 0.04, lam(0x777777)), -0.9, 1.05, -2.4, s)
  const gt = guitar(0x3d5aa8); gt.position.set(-4.4, 0.85, -1.4); gt.rotation.set(-0.15, 0.5, 0.05); s.add(gt)
  if (dusty) { at(box(2, 0.02, 1.2, basic(0xd8d0c0, { transparent: true, opacity: 0.25 })), 1.6, 1.6, -2.2, s) }
  // the shoebox on the bench
  const sb = lam(0xc8b48a), lid = new THREE.Group()
  at(box(1.0, 0.45, 0.7, sb), 2.4, 1.82, -2.1, s)
  at(box(1.05, 0.1, 0.75, lam(0xd2bf94)), 0, 0, 0.375, lid); lid.position.set(2.4, 2.07, -2.475); s.add(lid)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.22), new THREE.MeshLambertMaterial({ map: label('DO NOT PLAY', { w: 64, h: 18, bg: '#c8b48a', fg: '#2a1a10', font: 'bold 10px Arial' }) }))
  at(sign, 2.4, 1.82, -1.74, s)
  return { lid, bulb }
}

// ---------- the ten scenes. Each returns update(t, dur) and sets this.cam ----------
const SCENES = [
  // 0. 1991: the song goes into a shoebox
  function (S) {
    const s = S.scene, { lid, bulb } = garage(s)
    const tape = cassette(); s.add(tape); S.tape = tape
    S.cam.fov = 46
    return (t, dur) => {
      const u = ss(dur * 0.35, dur * 0.62, t), v = ss(dur * 0.66, dur * 0.85, t)
      tape.position.set(lerp(0.9, 2.4, u), 1.78 + Math.sin(u * Math.PI) * 0.9 + (1.95 - 1.78) * u, lerp(-1.75, -2.1, u))
      tape.rotation.set(-Math.PI / 2 * (u > 0.6 ? 1 : u / 0.6) * 0.95, u * 0.6, 0)
      if (u <= 0) { tape.rotation.set(-1.45, 0.2, 0); tape.position.y = 1.64 }
      lid.rotation.x = -D(105) * (1 - v)
      bulb.intensity = 22 * (t > dur * 0.9 ? 0.35 + 0.65 * (Math.floor(t * 20) % 3 ? 1 : 0) : 1)
      const k = ss(0, dur, t), ang = lerp(-0.5, 0.1, k)
      S.cam.position.set(1.4 + Math.sin(ang) * lerp(7.5, 3.6, k), lerp(4.2, 2.9, k), -2 + Math.cos(ang) * lerp(7.5, 3.6, k))
      S.cam.lookAt(lerp(1.2, 2.2, k), 1.8, -2.1)
    }
  },
  // 1. the garage door rolls shut in the rain
  function (S) {
    const s = S.scene
    sky(s, [[0, '#0c1020'], [0.55, '#1c2238'], [0.7, '#2c2a40'], [1, '#2c2a40']])
    s.fog = new THREE.Fog(0x1c1e30, 14, 46)
    s.add(new THREE.HemisphereLight(0x6a78a8, 0x1a1a22, 0.9))
    const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), lam(0, noiseTex([46, 48, 56], 18, 11, 30))); road.rotation.x = -Math.PI / 2; s.add(road)
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(5, 9), lam(0, noiseTex([70, 70, 76], 20, 12, 3))); drive.rotation.x = -Math.PI / 2; at(drive, 0, 0.02, 2.5, s)
    const siding = tex(32, 32, (x, w, h) => { noisy([150, 168, 170], 18, 13)(x, w, h); x.fillStyle = 'rgba(30,40,40,.5)'; for (let i = 0; i < h; i += 4) x.fillRect(0, i, w, 1) }, 2)
    at(box(14, 4.6, 8, lam(0, siding)), 3, 2.3, -4, s)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(10.2, 3, 4), lam(0, noiseTex([60, 52, 58], 26, 14))); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.6; at(roof, 3, 6.1, -4, s)
    // glowing inside + the roll-up door
    at(new THREE.Mesh(new THREE.PlaneGeometry(4, 3.2), basic(0xffb866)), 0, 1.6, 0.02, s)
    const doorTex = tex(16, 32, (x, w, h) => { noisy([196, 196, 188], 14, 15)(x, w, h); x.fillStyle = 'rgba(60,60,60,.6)'; for (let i = 0; i < h; i += 4) x.fillRect(0, i, w, 1) })
    const door = new THREE.Mesh(new THREE.BoxGeometry(4.1, 3.3, 0.12), lam(0, doorTex)); door.geometry.translate(0, -1.65, 0); at(door, 0, 3.3, 0.1, s)
    for (const [x, y] of [[6, 2.4], [9, 2.4]]) at(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), basic(0x2a3350)), x, y, 0.02, s)
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), glowMat(0xffa850, 0.35)); spill.rotation.x = -Math.PI / 2; at(spill, 0, 0.04, 2.6, s)
    // streetlight
    at(box(0.18, 6, 0.18, lam(0x555a60)), -5, 3, 5, s); at(box(1.4, 0.16, 0.16, lam(0x555a60)), -4.4, 6, 5, s)
    spot(s, -3.8, 5.9, 5, 0xffd9a0, 6, 2.2)
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 10), glowMat(0xffd9a0, 0.2)); pool.rotation.x = -Math.PI / 2; at(pool, -3.8, 0.05, 5, s)
    const wet = rain(s, { cx: 0, cz: 4, wx: 20, wz: 16, top: 12 })
    return (t, dur) => {
      const d = ss(dur * 0.12, dur * 0.7, t); door.scale.y = Math.max(0.02, d); spill.material.opacity = 0.35 * (1 - d)
      wet(t)
      const k = ss(0, dur, t)
      S.cam.position.set(lerp(-1.5, -3.2, k), lerp(1.7, 2.6, k), lerp(9, 13.5, k)); S.cam.lookAt(0.6, 1.9, 0)
    }
  },
  // 2. the arena: hair metal forever
  function (S) { return arena(S, { full: true }) },
  // 3. the store aisle: flannel on clearance
  function (S) {
    const s = S.scene
    s.fog = new THREE.Fog(0xc8ccc0, 10, 38); s.background = new THREE.Color(0xc8ccc0)
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a8a80, 2.2))
    const tiles = tex(16, 16, (x, w, h) => { noisy([206, 204, 196], 16, 21)(x, w, h); x.fillStyle = 'rgba(90,90,90,.35)'; x.fillRect(0, 0, w, 1); x.fillRect(0, 0, 1, h) }, 24)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 60), lam(0, tiles)); floor.rotation.x = -Math.PI / 2; s.add(floor)
    const metal = lam(0, noiseTex([150, 154, 160], 20, 22))
    const pl = [plaid([168, 38, 40], '#141014', 23), plaid([48, 96, 60], '#141014', 24), plaid([46, 64, 120], '#141014', 25), plaid([180, 140, 60], '#3a1a10', 26)].map((t) => lam(0, t))
    for (const side of [-1, 1]) for (let z = -24; z < 6; z += 3.2) {
      const x = side * 2.4
      at(box(1.2, 3.4, 3, metal), x + side * 0.6, 1.7, z, s)
      for (let lv = 0; lv < 4; lv++) for (let j = 0; j < 3; j++) { const st = box(0.8, 0.5, 0.82, pl[(lv + j + (z | 0)) & 3]); at(st, x, 0.55 + lv * 0.8, z - 1 + j * 1, s) }
    }
    const signs = [['FLANNEL', '#ffd23f', '#a8282e'], ['75% OFF', '#ffffff', '#c02020'], ['LUMBER', '#1a1a1a', '#e8c23a']]
    signs.forEach(([txt, fg, bg], i) => { const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), basic(0xffffff, { map: label(txt, { w: 80, h: 22, bg, fg, font: 'bold 15px Arial' }) })); at(sg, 0, 4.4, -2 - i * 9, s); at(box(0.03, 1.4, 0.03, metal), -1, 5.1, -2 - i * 9, s); at(box(0.03, 1.4, 0.03, metal), 1, 5.1, -2 - i * 9, s) })
    for (let z = -30; z < 8; z += 5) at(box(0.5, 0.06, 3, basic(0xfafaf0)), 0, 6, z, s)
    const shopper = person({ style: 'big', hair: 0xd8b860, shirt: 0xe048a0, pants: 0x1c1c2a, seed: 3 }); s.add(shopper)
    const cart = new THREE.Group(); at(box(0.9, 0.6, 1.2, lam(0x9aa0a8)), 0, 0.85, 0, cart); for (const [x, z] of [[-0.4, -0.5], [0.4, -0.5], [-0.4, 0.5], [0.4, 0.5]]) at(box(0.06, 0.55, 0.06, lam(0x666666)), x, 0.3, z, cart); s.add(cart)
    const sh = blob(s, 0, 0)
    return (t, dur) => {
      const z = lerp(-8, 2.5, t / dur); shopper.position.set(0.5, 0, z); shopper.rotation.y = 0; shopper.userData.walk(t, 8)
      shopper.userData.armL.rotation.x = D(-50); shopper.userData.armR.rotation.x = D(-50)
      cart.position.set(0.5, 0, z + 1.3); sh.position.set(0.5, 0.03, z)
      // she glances at the flannel and keeps walking
      shopper.userData.head.rotation.y = D(-55) * Math.sin(Math.PI * ss(dur * 0.3, dur * 0.75, t))
      const k = ss(0, dur, t)
      S.cam.position.set(lerp(-1.2, 0.9, k), lerp(2.2, 1.8, k), lerp(6.5, 7.6, k)); S.cam.lookAt(lerp(-0.6, 0.4, k), 1.7, z - 2)
    }
  },
  // 4. the bathroom mirror: hair goes up, and up
  function (S) {
    const s = S.scene
    s.fog = new THREE.Fog(0xe8c8d8, 10, 30); s.background = new THREE.Color(0xe8c8d8)
    s.add(new THREE.HemisphereLight(0xfff0f8, 0x806878, 1.8))
    const sun = new THREE.DirectionalLight(0xffe0c8, 1.6); sun.position.set(3, 6, 6); s.add(sun)
    const tiles = tex(16, 16, (x, w, h) => { noisy([226, 168, 200], 14, 31)(x, w, h); x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(0, 0, w, 1); x.fillRect(0, 0, 1, h) }, [8, 5])
    at(box(14, 9, 0.3, lam(0, tiles)), 0, 4.5, -2.5, s)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), lam(0, noiseTex([200, 196, 210], 16, 32, 10))); floor.rotation.x = -Math.PI / 2; s.add(floor)
    at(box(3.6, 3.6, 0.1, lam(0xf0e4a0)), 0, 3.2, -2.3, s)
    at(box(3.2, 3.2, 0.06, lam(0x9fc8d8)), 0, 3.2, -2.24, s)
    at(box(4.6, 1.2, 1.4, lam(0xf4f0f0)), 0, 0.6, -1.6, s)
    const bulbs = []; for (let i = 0; i < 5; i++) bulbs.push(at(new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), basic(0xfff4c0)), -1.6 + i * 0.8, 5.1, -2.15, s))
    const teen = person({ style: 'big', hair: 0x6a3a22, shirt: 0x38c8c0, pants: 0x7a4ab8, seed: 11 }); teen.position.set(0, 0, 0.6); teen.rotation.y = Math.PI; s.add(teen)
    const can = new THREE.Group(); at(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 6), lam(0xe04040)), 0, 0, 0, can); at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 5), lam(0xffffff)), 0, 0.25, 0, can)
    can.position.set(0, -0.86, 0.1); teen.userData.armR.add(can)
    const puffs = []; for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })); s.add(p); puffs.push(p) }
    S.cam.fov = 52
    return (t, dur) => {
      const n = 5, step = Math.min(n, Math.floor((t / dur) * n * 1.15)), frac = ((t / dur) * n * 1.15) % 1
      const grow = 1 + (step + easeOut(Math.min(1, frac * 3))) * 0.42
      teen.userData.hair.scale.set(1 + (grow - 1) * 0.35, grow, 1 + (grow - 1) * 0.3); teen.userData.hair.position.y = 0.12 + (grow - 1) * 0.28
      const spray = frac < 0.35
      teen.userData.pose({ ar: 150, afr: 10, al: 10, tilt: Math.sin(t * 4) * 4 })
      can.rotation.z = spray ? D(-20) : 0
      const hp = new THREE.Vector3(); teen.userData.head.getWorldPosition(hp)
      puffs.forEach((p, i) => { const u = (frac * 3 + i / puffs.length) % 1; p.visible = spray; p.position.set(hp.x + 0.7 - u * 0.8 + Math.sin(i) * 0.2, hp.y + 0.6 + u * (grow - 1) * 0.8 + Math.cos(i * 2) * 0.2, hp.z + 0.2 - u * 0.3); p.scale.setScalar(0.6 + u * 2); p.material.opacity = 0.55 * (1 - u) })
      bulbs.forEach((b, i) => b.visible = !(grow > 2.6 && i === 2 && Math.floor(t * 12) % 2))
      const k = ss(0, dur, t)
      S.cam.position.set(lerp(1.4, 2.4, k), lerp(2.6, 3.4 + 0.3 * k, k), lerp(5.6, 6.6, k)); S.cam.lookAt(0, lerp(2.3, 3.0, k), 0.2)
    }
  },
  // 5. a neon music-TV studio that never switches off
  function (S) {
    const s = S.scene
    s.fog = new THREE.Fog(0x220a30, 12, 40); s.background = new THREE.Color(0x150720)
    s.add(new THREE.HemisphereLight(0xff80e0, 0x201030, 1.3))
    const grid = tex(16, 16, (x, w, h) => { x.fillStyle = '#140818'; x.fillRect(0, 0, w, h); x.fillStyle = '#ff2ea0'; x.fillRect(0, 0, w, 1); x.fillRect(0, 0, 1, h) }, 20)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), basic(0xffffff, { map: grid })); floor.rotation.x = -Math.PI / 2; s.add(floor)
    const neon = [0x00e5ff, 0xff2ea0, 0xffe600, 0x7cff4a]
    for (let i = 0; i < 7; i++) { const tri = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.07, 3, 3), basic(neon[i % 4])); tri.rotation.z = D(90 + i * 13); at(tri, -7 + i * 2.3, 4 + (i % 2) * 1.6, -6, s) }
    // a stack of CRT TVs with animated screens
    const scrC = canvas(24, 18), scrX = scrC.getContext('2d'), scr = new THREE.CanvasTexture(scrC); scr.magFilter = scr.minFilter = THREE.NearestFilter; scr.colorSpace = THREE.SRGBColorSpace
    const tvM = lam(0x2a2a30)
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r === 2 ? 1 : 0); c++) {
      const x = -3.3 + c * 2.2 + (r === 2 ? 1.1 : 0), y = 0.9 + r * 1.75
      at(box(2, 1.6, 1.4, tvM), x, y, -4, s); at(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), basic(0xffffff, { map: scr })), x, y, -3.29, s)
    }
    const host = person({ style: 'big', hair: 0x101010, shirt: 0xffe600, pants: 0x00b8d8, shoe: 0xffffff, seed: 21 }); host.position.set(-1.2, 0, 0.5); s.add(host)
    const dj = person({ style: 'big', hair: 0xf0d070, shirt: 0xff2ea0, pants: 0x222222, seed: 22 }); dj.position.set(1.4, 0, 0.2); s.add(dj)
    blob(s, -1.2, 0.5); blob(s, 1.4, 0.2)
    const lasers = []; for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 30, 4), glowMat(neon[i], 0.7)); const p = at(new THREE.Group(), -6 + i * 4, 7.5, -5, s); l.position.y = -15; p.add(l); lasers.push(p) }
    return (t, dur) => {
      scrX.fillStyle = '#000'; scrX.fillRect(0, 0, 24, 18)
      const cols = ['#ff2ea0', '#00e5ff', '#ffe600', '#7cff4a', '#ffffff', '#9a3cff']
      for (let i = 0; i < 6; i++) { scrX.fillStyle = cols[(i + Math.floor(t * 6)) % 6]; scrX.fillRect(i * 4, 0, 4, 18) }
      scrX.fillStyle = '#000'; scrX.fillRect(0, 12, 24, 6); scrX.fillStyle = '#fff'; scrX.fillRect(((t * 30) % 30) - 6, 14, 6, 2); scr.needsUpdate = true
      const b = Math.sin(t * 9.4)
      host.userData.pose({ al: 140 + b * 25, ar: 140 - b * 25, ll: b * 15, lr: -b * 15, tilt: b * 8 }); host.userData.body.position.y = Math.abs(b) * 0.25; host.rotation.y = Math.sin(t * 2) * 0.5
      dj.userData.pose({ al: 60 + b * 40, ar: 30, afr: 60, ll: -b * 10, lr: b * 10, nod: b * 12 }); dj.userData.body.position.y = Math.abs(Math.cos(t * 9.4)) * 0.15; dj.rotation.y = -0.4
      lasers.forEach((l, i) => { l.rotation.z = Math.sin(t * 1.7 + i) * 0.6; l.rotation.x = Math.cos(t * 1.3 + i * 2) * 0.4 })
      const k = ss(0, dur, t), ang = lerp(0.6, -0.5, k)
      S.cam.position.set(Math.sin(ang) * 8.4, lerp(1.4, 2.6, k), Math.cos(ang) * 8.4 + 1); S.cam.lookAt(0, 2.1, -1)
    }
  },
  // 6. Seattle: rain, a tower, coffee
  function (S) {
    const s = S.scene
    sky(s, [[0, '#7a8494'], [0.6, '#a8b0b8'], [1, '#a8b0b8']])
    s.fog = new THREE.Fog(0x9aa2ac, 18, 70)
    s.add(new THREE.HemisphereLight(0xd0d8e0, 0x404850, 1.9))
    const water = new THREE.Mesh(new THREE.PlaneGeometry(200, 120), lam(0, noiseTex([70, 90, 104], 24, 41, 40))); water.rotation.x = -Math.PI / 2; at(water, 0, -0.4, -40, s)
    const pier = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), lam(0, noiseTex([96, 92, 88], 20, 42, 12))); pier.rotation.x = -Math.PI / 2; at(pier, 0, 0, 6, s)
    const win = (seed, a) => tex(16, 32, (x, w, h) => { noisy(a, 16, seed)(x, w, h); const r = rng(seed); for (let i = 1; i < w; i += 3) for (let k = 1; k < h; k += 3) { x.fillStyle = r() < 0.25 ? '#f2d890' : '#40505c'; x.fillRect(i, k, 2, 2) } })
    const r = rng(43)
    for (let i = 0; i < 16; i++) { const h = 6 + r() * 16, w = 2.5 + r() * 3; at(box(w, h, 3, lam(0, win(44 + i, [120 + r() * 30, 124, 130]))), -26 + i * 3.6 + r(), h / 2, -38 - r() * 10, s) }
    // the needle tower (a generic low-poly landmark)
    const tw = at(new THREE.Group(), 14, 0, -26, s), steel = lam(0xe8e4dc)
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.3, 15, 6), steel), 0, 7.5, 0, tw)
    at(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 1.6, 1.4, 10), lam(0xc8a870)), 0, 15.6, 0, tw)
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.4, 5, 5), steel), 0, 19, 0, tw)
    // the coffee shop
    const brick = tex(16, 16, (x, w, h) => { noisy([150, 70, 52], 26, 45)(x, w, h); x.fillStyle = 'rgba(220,210,200,.55)'; for (let k = 0; k < h; k += 4) { x.fillRect(0, k, w, 1); for (let i = (k / 4) % 2 ? 0 : 4; i < w; i += 8) x.fillRect(i, k, 1, 4) } }, 3)
    at(box(6, 4.4, 4, lam(0, brick)), -3, 2.2, -1, s)
    at(new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2), basic(0xffc070)), -3, 1.5, 1.02, s)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8), basic(0xffffff, { map: label('COFFEE', { w: 72, h: 18, bg: '#1e3a28', fg: '#f4e8c8', font: 'bold 14px Arial' }) })); at(sign, -3, 3.3, 1.03, s)
    const awn = box(4.8, 0.12, 1.4, lam(0x2c6a44)); awn.rotation.x = 0.35; at(awn, -3, 2.75, 1.6, s)
    const peep = [], cols = [[0x4a5868, 0x2a2a30], [0x8a3a3a, 0x30303a], [0x3a6a5a, 0x2a2a2a]]
    cols.forEach(([shirt, pants], i) => { const p = person({ shirt, pants, hair: 0x2a1c14, seed: 50 + i }); const u = new THREE.Group(); at(new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.45, 7, 1, true), lam([0x222a3a, 0x6a2a2a, 0x1e1e22][i])), 0, 0, 0, u).material.side = THREE.DoubleSide; at(box(0.04, 1.0, 0.04, lam(0x222222)), 0, -0.5, 0, u); u.position.set(0.25, 2.85, 0); p.add(u); s.add(p); peep.push(p) })
    const wet = rain(s, { cx: 1, cz: 3, wx: 24, wz: 18, top: 14, speed: 18, col: 0xd0d8e0 })
    return (t, dur) => {
      wet(t)
      peep.forEach((p, i) => { const dir = i % 2 ? -1 : 1, x = dir * (6 - ((t * 1.1 + i * 3.3) % 12)); p.position.set(x + 0.5, 0, 2.6 + i * 1.3); p.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; p.userData.walk(t + i, 7, 22); p.userData.armR.rotation.set(D(-80), 0, 0) })
      const k = ss(0, dur, t)
      S.cam.position.set(lerp(3, 6, k), lerp(1.8, 3.0, k), lerp(11.5, 13, k)); S.cam.lookAt(lerp(-1.5, 10, k), lerp(3, 9, k), lerp(-2, -20, k))
    }
  },
  // 7. day job: flipping burgers, guitar case by the fryer
  function (S) {
    const s = S.scene
    s.fog = new THREE.Fog(0xd8c890, 9, 30); s.background = new THREE.Color(0xd8c890)
    s.add(new THREE.HemisphereLight(0xfff4d8, 0x7a6a48, 2.0))
    const checker = tex(16, 16, (x, w, h) => { for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { x.fillStyle = (i + k) % 2 ? '#e8e2d4' : '#2a2a2a'; x.fillRect(i * 4, k * 4, 4, 4) } }, 10)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), lam(0, checker)); floor.rotation.x = -Math.PI / 2; s.add(floor)
    at(box(14, 7, 0.3, lam(0, noiseTex([236, 214, 150], 14, 61, 1))), 0, 3.5, -3, s)
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.5), basic(0xffffff, { map: tex(64, 22, (x, w, h) => { x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; x.font = 'bold 9px Arial'; x.fillText('BURGER  .99', 4, 9); x.fillText('FRIES   .79', 4, 19); x.fillStyle = '#e04030'; x.fillRect(46, 4, 14, 14) }) })); at(menu, 0, 4.6, -2.83, s)
    const steel = lam(0, noiseTex([176, 178, 184], 20, 62))
    at(box(5, 1.1, 1.6, steel), 0, 0.55, -1.6, s); const grill = box(2.6, 0.1, 1.2, lam(0x26262a)); at(grill, -0.9, 1.15, -1.6, s)
    const cook = person({ style: 'paper', shirt: 0xc0392b, pants: 0x2a2a2a, hair: 0x2a1a10, seed: 70 }); cook.position.set(-0.9, 0, -0.2); cook.rotation.y = Math.PI; s.add(cook)
    const spat = box(0.32, 0.03, 0.3, lam(0xc0c0c0)); spat.position.set(0, -0.92, 0.18); cook.userData.armR.add(spat)
    const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 7), lam(0x5a3018)); s.add(patty)
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 7), lam(0x6a3a1c)); at(p2, -1.7, 1.25, -1.5, s)
    // the guitar case leaning on the wall, with a sticker
    const cs = at(new THREE.Group(), 2.6, 0, -2.4, s); const cm = lam(0x1a1a1c)
    at(box(0.8, 1.4, 0.32, cm), 0, 0.7, 0, cs); at(box(0.5, 1.4, 0.26, cm), 0, 2.0, 0, cs); cs.rotation.z = D(8)
    at(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), basic(0xffffff, { map: label('ROCK', { w: 32, h: 16, bg: '#ffd23f', fg: '#1a1a1a', font: 'bold 10px Arial' }) })), 0, 0.8, 0.17, cs)
    const steam = []; for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })); s.add(p); steam.push(p) }
    S.cam.fov = 50
    return (t, dur) => {
      const per = dur / 2.5, ph = (t % per) / per, flip = ss(0.2, 0.75, ph)
      patty.position.set(-0.9, 1.26 + Math.sin(flip * Math.PI) * 1.1, -1.55); patty.rotation.x = flip * Math.PI
      cook.userData.pose({ afr: 40 + 50 * Math.sin(Math.PI * ss(0.1, 0.4, ph)), al: 12, afl: 20, nod: 14 + Math.sin(t * 2) * 4 })
      steam.forEach((p, i) => { const u = (t * 0.6 + i / 6) % 1; p.position.set(-1.4 + i * 0.25, 1.3 + u * 2.2, -1.6); p.scale.setScalar(0.5 + u * 1.6); p.material.opacity = 0.4 * (1 - u) })
      // the cook sneaks a look at the guitar case at the end
      cook.userData.head.rotation.y = D(70) * ss(dur * 0.7, dur * 0.85, t)
      const k = ss(0, dur, t)
      S.cam.position.set(lerp(1.2, 2.2, k), lerp(2.4, 2.8, k), lerp(4.6, 5.4, k)); S.cam.lookAt(lerp(-0.6, 0.6, k), 1.7, -1.5)
    }
  },
  // 8. 2000: the same arena, mostly empty, the hairspray runs dry
  function (S) { return arena(S, { full: false }) },
  // 9. 2001: a kid opens the shoebox and presses play
  function (S) {
    const s = S.scene, { lid, bulb } = garage(s, { dusty: true })
    const kid = person({ style: 'cap', shirt: 0x5a6e3a, pants: 0x2f4258, hair: 0x3a2618, capColor: 0x2a4a8a, seed: 90 }); kid.scale.setScalar(0.82); kid.position.set(2.4, 0, -0.9); kid.rotation.y = Math.PI; s.add(kid); blob(s, 2.4, -0.9)
    const tape = cassette(); s.add(tape)
    const bb = boombox(); bb.position.set(0.2, 1.6, -2.1); s.add(bb)
    const dust = []; for (let i = 0; i < 30; i++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), basic(0xfff4d0)); s.add(p); dust.push(p) }
    const flash = new THREE.PointLight(0xfff0d0, 0, 18, 1.2); flash.position.set(0.2, 2.6, -1); s.add(flash)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 12), glowMat(0xfff0c0, 0)); s.add(ring)
    S.cam.fov = 48
    return (t, dur) => {
      const open = ss(0.3, 1.3, t), grab = ss(1.6, 2.6, t), insert = ss(2.6, 3.4, t), press = ss(3.9, 4.15, t), PLAY = 4.15
      lid.rotation.x = -D(110) * open
      const inBox = [2.4, 1.85, -2.1], hand = [2.0, 2.3, -1.5], slot = [0.2, 2.05, -1.86]
      const p = insert > 0 ? hand.map((v, i) => lerp(v, slot[i], insert)) : inBox.map((v, i) => lerp(v, hand[i], grab))
      tape.position.set(...p); tape.rotation.set(insert > 0 ? 0 : -1.45 * (1 - grab), 0, 0); tape.visible = insert < 0.98
      kid.position.x = lerp(2.4, 1.2, ss(2.4, 3.4, t))
      kid.userData.pose({ afl: 70 * Math.max(open * (1 - grab), grab) + 20 * insert, afr: 80 * Math.max(open, press) , ar: 10, al: 10, nod: 20 })
      bb.userData.btn.position.y = 0.83 - 0.04 * press
      const live = t > PLAY, beat = live ? Math.pow(Math.max(0, Math.sin((t - PLAY) * Math.PI * 2.1)), 4) : 0
      bb.userData.cones.forEach((c) => c.scale.set(1 + beat * 0.25, 1, 1 + beat * 0.25))
      flash.intensity = live ? 30 * Math.exp(-(t - PLAY) * 3) + beat * 8 : 0
      bulb.intensity = 14 + beat * 10
      ring.position.set(0.2, 2.0, -1.7); const ru = ((t - PLAY) * 1.6) % 1; ring.scale.setScalar(live ? 1 + ru * 6 : 0.01); ring.material.opacity = live ? 0.5 * (1 - ru) : 0
      dust.forEach((d, i) => { const r = Math.sin(i * 12.9898) * 43758.5; const fx = r - Math.floor(r); d.position.set(-2 + fx * 6, 1 + ((i * 0.37 + t * 0.15) % 3), -1.5 + Math.sin(i) * 1.2); d.position.x += live ? beat * Math.sin(i * 3) * 0.2 : 0 })
      const k = ss(0, PLAY, t), shake = live ? beat * 0.06 : 0
      const ang = lerp(-0.55, -0.35, k) + (live ? ss(PLAY, dur, t) * 0.3 : 0), R = lerp(6.2, 4.6, k) + (live ? ss(PLAY, dur, t) * 1.8 : 0)
      S.cam.position.set(1.2 + Math.sin(ang) * R + shake, 3.4 + shake, -1.8 + Math.cos(ang) * R); S.cam.lookAt(lerp(1.8, 0.6, k), lerp(1.7, 2.0, k), -2)
      S.live = live; S.liveT = t - PLAY
    }
  },
]

// the arena, used twice: packed in 1992, nearly empty in 2000
function arena(S, { full }) {
  const s = S.scene
  s.fog = new THREE.Fog(full ? 0x2a1238 : 0x1a1822, 12, 50); s.background = new THREE.Color(full ? 0x12081c : 0x0e0e14)
  s.add(new THREE.HemisphereLight(full ? 0xb078e0 : 0x707888, 0x140a18, full ? 1.0 : 0.7))
  const key = new THREE.DirectionalLight(0xffd0e0, full ? 2.2 : 1.0); key.position.set(2, 10, 8); s.add(key)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), lam(0, noiseTex([40, 36, 46], 16, 81, 20))); floor.rotation.x = -Math.PI / 2; s.add(floor)
  const stage = box(16, 1.4, 7, lam(0, noiseTex([30, 28, 34], 14, 82, 4))); at(stage, 0, 0.7, -2, s)
  const truss = lam(0x6a6a74); at(box(17, 0.4, 0.4, truss), 0, 9, -3, s); for (const x of [-8.3, 8.3]) at(box(0.4, 9, 0.4, truss), x, 4.5, -3, s)
  const spk = lam(0, tex(8, 8, noisy([34, 32, 38], 26, 83)))
  for (const x of [-6.5, -5, 5, 6.5]) for (let y = 0; y < (full ? 3 : 2); y++) at(box(1.4, 1.3, 1.1, spk), x, 2.05 + y * 1.3, -3.6, s)
  // the banner: tattered in 2000
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.3), basic(0xffffff, { map: label(full ? 'LOUD TOUR 92' : 'FAREWELL TOUR', { w: 128, h: 28, bg: full ? '#d8204a' : '#4a3a40', fg: full ? '#ffe600' : '#b8a8a0', font: 'bold 15px Arial', border: full ? '#ffe600' : null }) }))
  at(ban, 0, 7.4, -3.4, s); if (!full) ban.rotation.z = D(-6)
  const star = person({ style: 'big', hair: full ? 0xf2d070 : 0xb8b4ac, shirt: full ? 0x161616 : 0x3a3438, pants: full ? 0xe030a0 : 0x5a4a58, shoe: 0xf0f0f0, guitar: full ? 0xd8202a : 0x8a7a70, seed: full ? 5 : 6 })
  star.position.set(0, 1.4, -1.2); s.add(star); blob(s, 0, -1.2).position.y = 1.43
  if (!full) { star.userData.hair.scale.set(1.05, 0.62, 1.05); star.userData.hair.position.y = -0.04 }
  const spots = [[-5, 0xff3ea0], [0, 0x50d8ff], [5, 0xffe050]].map(([x, c]) => spot(s, x, 8.8, -2.8, full ? c : 0x8a8a90, 9.5, 1.8))
  const flames = [-7.2, 7.2].map((x) => { const f = makeFlame({ seg: 6 }); f.rotation.x = Math.PI; f.position.set(x, 1.4, -1.2); s.add(f); return f })
  const crowdUp = crowd(s, { n: 160, keep: full ? 1 : 0.07, seed: full ? 5 : 9 })
  // one lonely fan near the front in 2000
  let fan = null
  if (!full) { fan = person({ style: 'big', hair: 0x9a8a70, shirt: 0x5a2a4a, pants: 0x222222, seed: 13 }); fan.position.set(1.6, 0, 4.4); fan.rotation.y = Math.PI; s.add(fan) }
  return (t, dur) => {
    const b = Math.sin(t * 9.4), hit = Math.pow(Math.max(0, Math.sin(t * Math.PI * 1.55)), 8)
    if (full) {
      const wind = t * 11
      star.userData.pose({ ar: 90 + Math.sin(wind) * 80, afr: 30 + Math.cos(wind) * 60, al: 30, afl: 60, ll: -18, lr: 22, tilt: b * 10, lean: -8 })
      star.userData.body.position.y = Math.abs(b) * 0.08
      flames.forEach((f) => f.scale.set(1.3, 2.2 + hit * 4, 1.3))
    } else {
      star.userData.pose({ ar: 20 + Math.sin(t * 3) * 10, afr: 50, al: 18, afl: 55, tilt: -6, lean: 12, nod: 14 })
      const sputter = t > dur * 0.5 ? (Math.floor(t * 14) % 4 === 0 ? 0.4 : 0.05) : 0.6 + hit
      flames.forEach((f, i) => f.scale.set(1, (i ? 0.05 : sputter) * 2, 1))
      // the hair deflates as the can runs dry
      const sag = ss(dur * 0.3, dur * 0.9, t); star.userData.hair.scale.set(1.05 + sag * 0.15, 0.62 - sag * 0.25, 1.05 + sag * 0.1)
      fan.userData.pose({ ar: 150 + Math.sin(t * 2.2) * 15, al: 5 })
    }
    spots.forEach((p, i) => { p.rotation.z = Math.sin(t * (full ? 1.6 : 0.4) + i * 2) * (full ? 0.5 : 0.15); p.rotation.x = Math.cos(t * 1.2 + i) * (full ? 0.3 : 0.05) })
    crowdUp(t, full ? 1 : 0.15)
    const k = ss(0, dur, t)
    if (full) { const ang = lerp(-0.4, 0.3, k), R = lerp(12, 9.5, k); S.cam.position.set(Math.sin(ang) * R, lerp(4.2, 3.6, k), -1.2 + Math.cos(ang) * R); S.cam.lookAt(0, lerp(4.4, 3.8, k), -1.5) }
    else { S.cam.position.set(lerp(-3, -1.2, k), lerp(3.4, 3.0, k), lerp(15, 6.5, k)); S.cam.lookAt(0, lerp(3.6, 3.3, k), -1.2) }
  }
}

// ---------- HUD ----------
const ym = (s) => { const [y, m] = s.split('-').map(Number); return y * 12 + (m - 1) }
export default {
  name: 'ps2 what-if',
  create({ W, H, renderer, index, beat, line }) {
    this.W = W; this.H = H; this.r = renderer; this.index = index; this.beat = beat; this.line = line
    const RW = (this.RW = Math.round((W / H) * RH))
    this.scene = new THREE.Scene()
    this.cam = new THREE.PerspectiveCamera(50, RW / RH, 0.1, 200)
    this.update = SCENES[index](this)
    this.cam.updateProjectionMatrix()
    this.low = canvas(RW, RH)
    this.lines = canvas(4, 4); const lx = this.lines.getContext('2d'); lx.fillStyle = 'rgba(0,0,0,.12)'; lx.fillRect(0, 0, 4, 2)
    this.m0 = ym(beat.from); this.m1 = ym(beat.to)
    this.words = line.split(' ')
  },
  render(t, ctx, dur) {
    this.update(t, dur); this.cam.updateProjectionMatrix()
    const RW = this.RW, rr = this.r; rr.shadowMap.enabled = false
    rr.setSize(RW, RH, false); rr.setClearColor(0x000000); rr.render(this.scene, this.cam)
    this.low.getContext('2d').drawImage(rr.domElement, 0, 0)
    const { W, H } = this
    ctx.imageSmoothingEnabled = true; ctx.drawImage(this.low, 0, 0, W, H)
    ctx.fillStyle = ctx.createPattern(this.lines, 'repeat'); ctx.fillRect(0, 0, W, H)
    // letterbox bars, like an in-engine cutscene
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 34, W, 34)
    ctx.lineJoin = 'round'
    const hud = (s, x, y, size, col, stroke = 9, align = 'left') => { ctx.textAlign = align; ctx.font = `italic 800 ${size}px "Inter Tight",Arial,sans-serif`; ctx.strokeStyle = '#141018'; ctx.lineWidth = stroke; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y) }
    const last = this.index === 9

    // top left: what-if tag + chapter
    hud('WHAT IF...', 44, 190, 34, '#ffffff', 8)
    hud(`CH.${this.index + 1}  ${this.beat.hud}`, 44, 244, 44, '#ffd23f', 10)

    // top right: the month / year counter
    const u = clamp(t / (dur * 0.92)), mf = lerp(this.m0, this.m1, u), mi = Math.floor(mf + 1e-6), frac = mf - mi
    const pop = this.m1 > this.m0 ? 1 + 0.18 * (1 - ss(0, 0.35, frac)) : 1 + (last ? 0.25 * (1 - ss(0, 0.5, t)) : 0)
    const bx = W - 44 - 236, by = 140
    ctx.fillStyle = 'rgba(16,12,24,.82)'; ctx.fillRect(bx, by, 236, 156); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.strokeRect(bx, by, 236, 156)
    hud('DATE', bx + 18, by + 36, 24, '#bfb6d8', 6)
    ctx.save(); ctx.translate(bx + 118, by + 98); ctx.scale(pop, pop)
    hud(MONTHS[mi % 12], 0, -6, 40, '#ffffff', 8, 'center')
    ctx.restore()
    ctx.save(); ctx.translate(bx + 118, by + 146); ctx.scale(pop, pop); hud(String(Math.floor(mi / 12)), 0, 0, 52, '#ffd23f', 10, 'center'); ctx.restore()

    // captions: word by word, the current word in yellow
    const n = this.words.length, w0 = 0.12, w1 = last ? 4.6 / dur : 0.62
    const shown = Math.floor(((t / dur - w0) / (w1 - w0)) * n) + 1
    ctx.font = 'italic 800 58px "Inter Tight",Arial,sans-serif'
    const rows = [[]]; let rw = 0
    for (const [i, w] of this.words.entries()) { const ww = ctx.measureText(w + ' ').width; if (rw + ww > W - 120 && rows.at(-1).length) { rows.push([]); rw = 0 } rows.at(-1).push([w, i, ww]); rw += ww }
    const cy = H * 0.70 - (rows.length - 1) * 36
    rows.forEach((row, ri) => {
      const total = row.reduce((a, [, , ww]) => a + ww, 0); let x = (W - total) / 2
      for (const [w, i, ww] of row) {
        if (i < shown) { const cur = i === shown - 1 && shown <= n; const age = clamp((t / dur - w0 - (i / n) * (w1 - w0)) * dur / 0.12)
          ctx.save(); ctx.translate(x, cy + ri * 72); ctx.scale(0.8 + 0.2 * age, 0.8 + 0.2 * age); hud(w, 0, 0, 58, cur ? '#ffd23f' : '#ffffff', 11); ctx.restore() }
        x += ww
      }
    })

    // bottom: hairspray meter + a grunge readout that stays at zero... until the end
    const spray = lerp(this.beat.spray[0], this.beat.spray[1], ss(0, dur, t))
    const my = H - 250
    hud('HAIRSPRAY', 44, my - 14, 30, '#ffffff', 7)
    ctx.fillStyle = '#141018'; ctx.fillRect(44, my, 372, 40); ctx.fillStyle = '#343044'; ctx.fillRect(50, my + 6, 360, 28)
    ctx.fillStyle = spray < 0.15 ? (Math.floor(t * 6) % 2 ? '#e0403a' : '#7a2020') : '#ff5ac8'; ctx.fillRect(50, my + 6, 360 * spray, 28)
    const grunge = last && this.live ? Math.min(100, Math.floor(ss(0, 1.4, this.liveT) * 100)) : 0
    if (grunge > 0 || Math.floor(t * 2.5) % 2 === 0) hud(`GRUNGE ${grunge}%`, W - 44, my + 34, 40, grunge > 0 ? '#7cff4a' : '#ff5a4a', 9, 'right')

    // the twist ending: PRESS PLAY, then a big WHAT IF?
    if (last) {
      if (!this.live && t > 2.8 && Math.floor(t * 5) % 2 === 0) hud('PRESS ▶ TO PLAY', W / 2, H * 0.58, 46, '#ffffff', 10, 'center')
      if (this.live) {
        const lt = this.liveT, fl = Math.exp(-lt * 6)
        if (fl > 0.02) { ctx.globalAlpha = fl * 0.85; ctx.fillStyle = '#fff6dc'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
        const k = easeOut(clamp((lt - 1.2) / 0.5))
        if (k > 0) { ctx.save(); ctx.translate(W / 2, H * 0.47); ctx.rotate(-0.06); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); ctx.globalAlpha = k; hud('WHAT IF?', 0, 0, 150, '#ffd23f', 18, 'center'); ctx.restore(); ctx.globalAlpha = 1 }
      }
      const out = ss(dur - 0.5, dur, t); if (out > 0) { ctx.globalAlpha = out; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1 }
    }
    ctx.textAlign = 'left'
  },
}
