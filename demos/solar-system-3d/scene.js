// Our Solar System, explained in 3D: 38 s, 1920x1080. One continuous world, the camera flies outward from the Sun.
//   0.0-4.5   establishing wide shot, orbits draw on            "Our Solar System"
//   4.5-8.5   the Sun: 99.86 % of the mass, 5,500 C surface
//   8.5-11.5  the inner system: Mercury, Venus (Earth, Mars tagged)
//  11.5-14.5  Earth + Moon close-up
//  14.5-17.0  Mars close-up
//  17.0-20.0  low pass through the asteroid belt
//  20.0-23.5  Jupiter + Great Red Spot
//  23.5-27.0  Saturn and its rings
//  27.0-29.5  Uranus, tipped on its side
//  29.5-32.0  Neptune
//  32.0-38.0  pull back to the whole system, year lengths, "not to scale", fade out
// Sizes and distances are compressed so everything fits; orbital speeds keep the real order (inner = faster).
import * as THREE from '/_vendor/three.module.js';
import { boot, createStage, overlay, backgroundTex, softDotTex, seeded, seg, env, lerp, clamp, ease, deg, PAL, TYPE } from './engine/index.js';

const W = 1920, H = 1080, DUR = 38;
let S, O, sun, sunGlow, planets = {}, moon, belt, orbitLines = [], stars, dotTex;

// ---------- the system (world units are arbitrary, compressed) ----------
// R: orbit radius, r: body radius, P: real period in years, goal: where (deg) the planet sits mid-close-up.
const P = {
  mercury: { R: 6.0, r: 0.26, P: 0.241, tilt: 0.0, spin: 0.10, goal: 40, at: 10.0, year: '88 days' },
  venus:   { R: 8.2, r: 0.55, P: 0.615, tilt: 3.0, spin: -0.05, goal: 300, at: 10.0, year: '225 days' },
  earth:   { R: 10.6, r: 0.60, P: 1.0, tilt: 23.4, spin: 0.45, goal: 30, at: 13.0, year: '1 year' },
  mars:    { R: 13.2, r: 0.40, P: 1.88, tilt: 25.2, spin: 0.40, goal: 80, at: 15.75, year: '1.9 years' },
  jupiter: { R: 22.0, r: 1.75, P: 11.86, tilt: 3.1, spin: 0.30, goal: 140, at: 21.75, year: '12 years' },
  saturn:  { R: 28.5, r: 1.45, P: 29.46, tilt: 26.7, spin: 0.28, goal: 195, at: 25.25, year: '29 years' },
  uranus:  { R: 34.0, r: 0.92, P: 84.0, tilt: 97.8, spin: 0.25, goal: 250, at: 28.25, year: '84 years' },
  neptune: { R: 38.5, r: 0.90, P: 164.8, tilt: 28.3, spin: 0.25, goal: 305, at: 30.75, year: '165 years' },
};
const ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const SUN_R = 3.0, BELT = { r0: 15.3, r1: 17.8, w: 0.12 }, BELT_GOAL = 110, BELT_AT = 18.5;
for (const k of ORDER) { const p = P[k]; p.w = 0.30 / Math.sqrt(p.P); p.phase = deg(p.goal) - p.w * p.at; }
const theta = (k, t) => P[k].phase + P[k].w * t;
const posOf = (k, t) => { const a = theta(k, t), R = P[k].R; return new THREE.Vector3(R * Math.sin(a), 0, R * Math.cos(a)); };
const thetaDeg = (k, t) => (theta(k, t) * 180) / Math.PI;

// ---------- procedural textures ----------
// Periodic (in x) value noise + fbm, so equirect maps have no seam.
function makeNoise(seed) {
  const r = seeded(seed), N = 256, tab = new Float32Array(N * N);
  for (let i = 0; i < tab.length; i++) tab[i] = r() * 2 - 1;
  const at = (x, y, px) => tab[(((y % N) + N) % N) * N + ((((x % px) + px) % px) % N)];
  const n = (x, y, px) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(at(xi, yi, px), at(xi + 1, yi, px), u), lerp(at(xi, yi + 1, px), at(xi + 1, yi + 1, px), u), v);
  };
  return (u, v, f = 4, oct = 5) => { let s = 0, a = 0.5, fr = f; for (let o = 0; o < oct; o++) { s += a * n(u * fr, v * fr, fr); a *= 0.5; fr *= 2; } return s; };
}
const hex = (h) => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
function paint(w, h, fn, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [R, G, B, A = 255] = fn(x / w, y / h), i = (y * w + x) * 4;
    d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = A;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// banded gas-giant map: stops = [[v, color]...] sampled along latitude, turbulence bends the bands
function bands(seed, stops, turb = 0.035, fine = 0.12) {
  const n = makeNoise(seed), cs = stops.map(([v, c]) => [v, hex(c)]);
  return (u, v) => {
    const vv = clamp(v + turb * n(u, v, 6, 4) + 0.01 * Math.sin(u * 40 + v * 30));
    let i = 0; while (i < cs.length - 2 && vv > cs[i + 1][0]) i++;
    const k = clamp((vv - cs[i][0]) / (cs[i + 1][0] - cs[i][0]));
    const c = mix3(cs[i][1], cs[i + 1][1], ease.inOutSine(k)), f = 1 + fine * n(u * 3, v * 20, 8, 3);
    return [c[0] * f, c[1] * f, c[2] * f];
  };
}
const TEX = {
  sun: () => { const n = makeNoise(1), a = hex('#FFB347'), b = hex('#FF7A1C'), c = hex('#FFE6A8');
    return paint(512, 256, (u, v) => { const g = n(u, v, 10, 5), cc = g > 0.12 ? mix3(a, c, (g - 0.12) * 3) : mix3(a, b, clamp(-g * 2.5)); return cc; }); },
  mercury: () => { const n = makeNoise(2), r = seeded(21), cr = Array.from({ length: 60 }, () => [r(), 0.1 + r() * 0.8, 0.005 + r() * r() * 0.04]);
    return paint(512, 256, (u, v) => { let s = 138 + 40 * n(u, v, 6, 5); for (const [x, y, rr] of cr) { const dx = Math.min(Math.abs(u - x), 1 - Math.abs(u - x)) * 2, d = Math.hypot(dx, v - y) / rr; if (d < 1) s += d > 0.75 ? 30 : -22; } return [s, s * 0.96, s * 0.92]; }); },
  venus: () => paint(512, 256, bands(3, [[0, '#E9D9B0'], [0.3, '#D9B676'], [0.5, '#F0DFB6'], [0.7, '#D4AE6E'], [1, '#E9D9B0']], 0.09, 0.08)),
  earth: () => { const n = makeNoise(4), ocean = hex('#1B4F9C'), deep = hex('#0E2F6B'), land = hex('#4E7A3A'), dry = hex('#A58C5A'), ice = hex('#F2F5F8');
    return paint(1024, 512, (u, v) => { const lat = Math.abs(v - 0.5) * 2, h = n(u, v, 4, 6) + 0.06;
      if (lat > 0.86 + 0.05 * n(u, v, 8, 3)) return ice;
      if (h > 0.05) return mix3(land, dry, clamp((h - 0.05) * 4 + (0.45 - Math.abs(lat - 0.3)) * 0.6 - 0.3));
      return mix3(ocean, deep, clamp(-h * 3)); }); },
  clouds: () => { const n = makeNoise(5);
    return paint(1024, 512, (u, v) => { const c = n(u, v, 5, 6) + 0.05 * Math.sin(v * 25); return [255, 255, 255, clamp((c - 0.14) * 3.0) * 210]; }); },
  mars: () => { const n = makeNoise(6), a = hex('#C4592E'), b = hex('#7E3A22'), c = hex('#E0956A'), ice = hex('#F4EEE8');
    return paint(512, 256, (u, v) => { const lat = Math.abs(v - 0.5) * 2, h = n(u, v, 5, 6); if (lat > 0.9) return ice; return h < -0.08 ? mix3(a, b, clamp(-h * 3)) : mix3(a, c, clamp(h * 2)); }); },
  moon: () => { const n = makeNoise(7); return paint(256, 128, (u, v) => { const s = 150 + 55 * n(u, v, 6, 5) - (n(u, v, 2, 2) < -0.15 ? 45 : 0); return [s, s, s * 0.98]; }); },
  jupiter: () => { const f = bands(8, [[0, '#B7A58A'], [0.18, '#D8C7A6'], [0.3, '#A9774F'], [0.38, '#EFE6D2'], [0.45, '#B57D52'], [0.52, '#F2EBDD'], [0.58, '#C08A5C'], [0.66, '#EADFC8'], [0.74, '#9C6B48'], [0.85, '#D3C2A2'], [1, '#A8977E']], 0.03, 0.14);
    return paint(1024, 512, (u, v) => { const d = Math.hypot((u - 0.3) / 0.055, (v - 0.64) / 0.028); if (d < 1) return mix3(hex('#C2543A'), hex('#E0A27C'), d * d); if (d < 1.25) return hex('#EFE3CC'); return f(u, v); }); },
  saturn: () => { const f = bands(9, [[0, '#C8B48A'], [0.25, '#E3CF9E'], [0.42, '#D2B67E'], [0.5, '#F1E3BE'], [0.6, '#D9BF88'], [0.78, '#E8D6A8'], [1, '#BFA97E']], 0.02, 0.08); return paint(512, 256, f); },
  uranus: () => { const f = bands(10, [[0, '#B4E6EA'], [0.5, '#9AD5DF'], [1, '#B8E8EC']], 0.02, 0.04); return paint(512, 256, f); },
  neptune: () => { const f = bands(11, [[0, '#3A5FC4'], [0.3, '#5A86E8'], [0.45, '#4570D6'], [0.55, '#7099F2'], [0.7, '#4E78DC'], [1, '#3858B8']], 0.04, 0.1);
    return paint(512, 256, (u, v) => { const d = Math.hypot((u - 0.6) / 0.05, (v - 0.62) / 0.03); return d < 1 ? hex('#1D2C78') : f(u, v); }); },
  rings: () => { const n = makeNoise(12), r = seeded(13); // radial strip: x = 0 inner .. 1 outer
    return paint(1024, 4, (x) => { let a = 0.25 + 0.55 * clamp(n(x, 0.5, 40, 4) + 0.6); if (x < 0.08) a *= x / 0.08 * 0.4; if (x > 0.6 && x < 0.66) a *= 0.08; if (x > 0.9 && x < 0.915) a *= 0.2; if (x > 0.985) a *= (1 - x) / 0.015;
      const c = mix3(hex('#C9B48E'), hex('#EFE2C4'), clamp(n(x, 0.2, 30, 3) + 0.5)); return [c[0], c[1], c[2], clamp(a) * 255]; }); },
};

// ---------- builders ----------
function glow(color, size, opacity, parent) {
  const m = new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.layers.set(S.GLOW); (parent || S.scene).add(s); return s;
}
function planet(key) {
  const p = P[key], orbitG = new THREE.Group(), tiltG = new THREE.Group();
  tiltG.rotation.z = deg(p.tilt);
  const mat = new THREE.MeshStandardMaterial({ map: TEX[key](), roughness: 0.92, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.r, 96, 64), mat);
  tiltG.add(mesh); orbitG.add(tiltG); S.scene.add(orbitG);
  return { key, p, group: orbitG, tilt: tiltG, mesh };
}
function ringMesh(ri, ro, tex, opacity = 1) {
  const g = new THREE.RingGeometry(ri, ro, 256, 1), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - ri) / (ro - ri), 0.5);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.32, transparent: true, opacity, side: THREE.DoubleSide, roughness: 1, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}

async function setup() {
  S = createStage({ width: W, height: H, dof: false, bloom: 0.75, bloomThreshold: 0.78, exposure: 1.05 });
  const { scene, camera } = S;
  camera.far = 2000; camera.near = 0.05; camera.updateProjectionMatrix();
  scene.fog = null; scene.environment = null;
  scene.background = backgroundTex({ top: '#070A14', bottom: '#020308', center: '#0C1222', cy: 0.45 });
  S.key.intensity = 0; S.fill.intensity = 0; S.rim.intensity = 0; S.amb.intensity = 0.10;
  scene.add(new THREE.PointLight('#FFF1DE', 3.2, 0, 0));
  dotTex = softDotTex(256, 2.0);
  O = overlay(S);

  // stars: a seeded shell far away, a few brighter ones, a faint Milky Way band
  const r = seeded(31), N = 5200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const band = new THREE.Vector3(0.3, 0.9, 0.3).normalize();
  for (let i = 0; i < N; i++) {
    let v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (i < N * 0.45) v.sub(band.clone().multiplyScalar(v.dot(band) * (0.85 + 0.1 * r()))); // flatten into a band
    v.normalize().multiplyScalar(900);
    pos.set([v.x, v.y, v.z], i * 3);
    const b = Math.pow(r(), 3.2) * 1.1 + 0.12, warm = r();
    col.set([b * (warm > 0.8 ? 1 : 0.85), b * 0.9, b * (warm < 0.3 ? 1.1 : 0.9)], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(stars);

  // the Sun: emissive granulated sphere + two additive halos
  const sm = new THREE.MeshBasicMaterial({ map: TEX.sun() }); sm.color.setRGB(1.7, 1.45, 1.15);
  sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 128, 64), sm); scene.add(sun);
  sunGlow = [glow('#FF8A2A', SUN_R * 5.2, 0.55), glow('#FFD58A', SUN_R * 2.9, 0.65), glow('#FF6A1A', SUN_R * 12, 0.18)];

  for (const k of ORDER) planets[k] = planet(k);
  // Earth: clouds + thin blue atmosphere glow
  const E = planets.earth;
  E.clouds = new THREE.Mesh(new THREE.SphereGeometry(P.earth.r * 1.015, 96, 64), new THREE.MeshStandardMaterial({ map: TEX.clouds(), transparent: true, depthWrite: false, roughness: 1 }));
  E.tilt.add(E.clouds); E.atmo = glow('#5FA8FF', P.earth.r * 2.5, 0.35, E.group);
  moon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 48, 32), new THREE.MeshStandardMaterial({ map: TEX.moon(), roughness: 1 }));
  E.group.add(moon);
  // Venus haze, Uranus/Neptune soft glows
  glow('#FFE7B0', P.venus.r * 2.5, 0.18, planets.venus.group);
  glow('#9EE6F0', P.uranus.r * 2.6, 0.22, planets.uranus.group);
  glow('#5A86FF', P.neptune.r * 2.6, 0.25, planets.neptune.group);
  // Saturn's rings (in its tilted equator), Uranus's faint rings
  const rt = TEX.rings();
  planets.saturn.tilt.add(ringMesh(P.saturn.r * 1.24, P.saturn.r * 2.3, rt));
  planets.uranus.tilt.add(ringMesh(P.uranus.r * 1.6, P.uranus.r * 2.0, rt, 0.25));

  // orbit lines (draw on in the intro)
  for (const k of ORDER) {
    const pts = []; for (let i = 0; i <= 360; i++) { const a = deg(i); pts.push(new THREE.Vector3(P[k].R * Math.sin(a), 0, P[k].R * Math.cos(a))); }
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0.22, depthWrite: false }));
    ln.userData.k = k; orbitLines.push(ln); scene.add(ln);
  }

  // asteroid belt: instanced rocks + a few big hero rocks near where the camera passes
  const rr = seeded(41), NB = 3200;
  const rockG = new THREE.IcosahedronGeometry(1, 1), rp = rockG.attributes.position;
  for (let i = 0; i < rp.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(rp, i), s = 0.75 + 0.5 * seeded(i * 7 + 3)(); rp.setXYZ(i, v.x * s, v.y * s * 0.8, v.z * s); }
  rockG.computeVertexNormals();
  const rockM = new THREE.MeshStandardMaterial({ color: '#6F665D', roughness: 1, flatShading: true });
  belt = new THREE.Group(); scene.add(belt);
  const inst = new THREE.InstancedMesh(rockG, rockM, NB), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < NB; i++) {
    const R = lerp(BELT.r0, BELT.r1, (rr() + rr() + rr()) / 3), a = rr() * Math.PI * 2, y = (rr() - 0.5) * 0.7 * (rr() + 0.3);
    const s = 0.02 + Math.pow(rr(), 3) * 0.13;
    e.set(rr() * 6, rr() * 6, rr() * 6); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(R * Math.sin(a), y, R * Math.cos(a)), q, new THREE.Vector3(s, s * (0.6 + rr() * 0.4), s));
    inst.setMatrixAt(i, m4);
  }
  belt.add(inst);
  belt.hero = [];
  const base = deg(BELT_GOAL) - BELT.w * BELT_AT;
  for (let i = 0; i < 14; i++) {
    const a = base + (rr() - 0.5) * 0.22, R = 16.5 + (rr() - 0.5) * 1.6, s = 0.07 + rr() * 0.22;
    const m = new THREE.Mesh(rockG, rockM); m.position.set(R * Math.sin(a), (rr() - 0.5) * 0.8, R * Math.cos(a));
    m.scale.set(s, s * (0.6 + rr() * 0.3), s * (0.8 + rr() * 0.4)); m.userData.spin = [rr() - 0.5, rr() - 0.5, (rr() - 0.5) * 0.5];
    belt.add(m); belt.hero.push(m);
  }
}

// ---------- camera: a list of shots, cross-blended over 1.3 s at each cut ----------
const aroundPlanet = (k, dist, az0, az1, el0, el1, a, b) => (t) => {
  const p = posOf(k, t), u = seg(t, a, b, 'inOutSine');
  return [p.x, p.y, p.z, dist, thetaDeg(k, t) + lerp(az0, az1, u), lerp(el0, el1, u)];
};
const fixed = (tgt, d0, d1, az0, az1, el0, el1, a, b, e = 'inOutSine') => (t) => { const u = seg(t, a, b, e); return [...tgt, lerp(d0, d1, u), lerp(az0, az1, u), lerp(el0, el1, u)]; };
const beltPt = (t) => { const a = deg(BELT_GOAL) + BELT.w * (t - BELT_AT); return [16.5 * Math.sin(a), 0, 16.5 * Math.cos(a)]; };
const SHOTS = [
  [0, fixed([0, 0, 0], 118, 82, 18, 36, 30, 24, 0, 5.2, 'outCubic')],
  [4.5, fixed([0, 0, 0], 23, 20, 36, 52, 7, 10, 3.8, 9)],
  [8.5, fixed([0, 0, 0], 44, 38, 26, 44, 42, 35, 7.8, 12)],
  [11.5, aroundPlanet('earth', 5.2, 128, 146, 9, 11, 10.8, 15)],
  [14.5, aroundPlanet('mars', 3.6, 125, 142, 7, 9, 13.8, 17.7)],
  [17.0, (t) => { const u = seg(t, 16.3, 20.7, 'inOutSine'); return [...beltPt(t), lerp(7.5, 5.6, u), BELT_GOAL + BELT.w * (t - BELT_AT) * 57.3 + lerp(95, 125, u), lerp(14, 6, u)]; }],
  [20.0, aroundPlanet('jupiter', 11.5, 122, 142, 6, 9, 19.3, 24.2)],
  [23.5, aroundPlanet('saturn', 11.5, 118, 140, 20, 16, 22.8, 27.7)],
  [27.0, aroundPlanet('uranus', 9.0, 118, 136, 10, 12, 26.3, 30.2)],
  [29.5, aroundPlanet('neptune', 6.8, 135, 152, 8, 10, 28.8, 32.7)],
  [32.0, fixed([0, 0, 0], 80, 168, 70, 100, 24, 60, 31.3, 38, 'inOutCubic')],
];
const XF = 1.6;
function camAt(t) {
  let i = 0; while (i < SHOTS.length - 1 && t >= SHOTS[i + 1][0] - XF / 2) i++;
  const cur = SHOTS[i][1](t);
  if (i > 0) {
    const k = seg(t, SHOTS[i][0] - XF / 2, SHOTS[i][0] + XF / 2, 'inOutCubic');
    if (k < 1) { const prev = SHOTS[i - 1][1](t); return prev.map((x, j) => lerp(x, cur[j], k)); }
  }
  return cur;
}

// ---------- overlay helpers ----------
const SECTIONS = [
  [0.4, 4.3, 'EXPLAINED IN 3D', 'Our Solar System'],
  [4.7, 8.4, 'THE STAR AT THE CENTRE', 'The Sun'],
  [8.7, 17.0, 'THE INNER PLANETS', 'Four small, rocky worlds'],
  [17.2, 19.9, 'BETWEEN MARS AND JUPITER', 'The asteroid belt'],
  [20.2, 26.9, 'THE GAS GIANTS', 'Mostly hydrogen and helium'],
  [27.2, 31.9, 'THE ICE GIANTS', 'Cold, distant and blue'],
  [32.4, 37.4, 'ONE STAR, EIGHT PLANETS', 'Everything orbits the Sun'],
];
function caption(text, k, y = 975, size = 30, color = PAL.ink) {
  if (k <= 0) return; const g = O.ctx, s = O.scale, e = ease.outCubic(clamp(k));
  g.globalAlpha = e; g.font = `${size >= 30 ? 600 : 400} ${size * s}px ${TYPE.label.family}`; g.letterSpacing = `${0.03 * size * s}px`;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = color; g.fillText(text, (W / 2) * s, (y + (1 - e) * 10) * s);
}
function yearTag(at, name, val, k) { // small two-line tag above a planet (finale)
  if (k <= 0) return; const [x, y, z] = O.project(at); if (z > 1) return;
  const g = O.ctx, s = O.scale, e = ease.outCubic(clamp(k));
  g.globalAlpha = e; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `600 ${22 * s}px ${TYPE.kicker.family}`; g.letterSpacing = `${0.2 * 22 * s}px`; g.fillStyle = PAL.soft; g.fillText(name, x, y - 46 * s + (1 - e) * 8 * s);
  g.font = `600 ${26 * s}px ${TYPE.label.family}`; g.letterSpacing = '0px'; g.fillStyle = PAL.ink; g.fillText(val, x, y - 18 * s + (1 - e) * 8 * s);
}
const above = (k, t, f = 0.75) => posOf(k, t).add(new THREE.Vector3(0, P[k].r * f, 0));
const tmpV = new THREE.Vector3();
// world position of a texture point (u, v) on a planet's surface + whether it faces the camera
function surfacePoint(pl, u, v) {
  const phi = u * Math.PI * 2, th = v * Math.PI, r = pl.p.r * 1.01;
  const local = new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
  pl.mesh.updateWorldMatrix(true, false);
  const w = pl.mesh.localToWorld(local.clone()), nrm = w.clone().sub(pl.group.position).normalize();
  const facing = nrm.dot(tmpV.copy(S.camera.position).sub(w).normalize());
  return { w, facing };
}

function frame(t) {
  // world
  sun.rotation.y = t * 0.04;
  sunGlow[0].scale.setScalar(SUN_R * (5.2 + 0.15 * Math.sin(t * 1.3)));
  for (const k of ORDER) {
    const pl = planets[k]; pl.group.position.copy(posOf(k, t)); pl.mesh.rotation.y = P[k].spin * t + 1.0;
  }
  planets.jupiter.mesh.rotation.y = 0.3 * t - 1.92; // Great Red Spot turns into view mid-shot
  planets.earth.clouds.rotation.y = 0.52 * t + 1.0;
  const ma = 0.9 * t + 1.2; moon.position.set(1.35 * Math.sin(ma), 0.12 * Math.sin(ma), 1.35 * Math.cos(ma));
  belt.rotation.y = BELT.w * t;
  for (const h of belt.hero) { h.rotation.set(h.userData.spin[0] * t, h.userData.spin[1] * t, h.userData.spin[2] * t); }
  const draw = seg(t, 0.4, 3.4, 'inOutCubic');
  orbitLines.forEach((ln, i) => {
    const kk = clamp(draw * 1.6 - i * 0.08); ln.geometry.setDrawRange(0, Math.floor(361 * kk));
    const close = t > 10.8 && t < 31.5 ? 0.45 : 1; ln.material.opacity = 0.22 * close + 0.12 * seg(t, 32, 34);
  });

  // camera
  const [tx, ty, tz, dist, az, el] = camAt(t);
  S.orbit({ target: [tx, ty, tz], dist, az, el });
  S.render();

  // overlay
  O.begin(); O.vignette(0.6);
  for (const [a, b, kicker, title] of SECTIONS) { const k = env(t, a, b, 0.45, 0.35); if (k > 0) O.header({ kicker, title, k }); }

  caption('1 star  ·  8 planets  ·  4.6 billion years old', env(t, 1.2, 4.3, 0.5, 0.35));

  // Sun
  O.label({ at: [0.9, SUN_R * 0.82, 0.8], text: 'THE SUN', sub: '99.86 % of all the mass in the solar system', dx: 230, dy: -130, k: env(t, 5.1, 8.3, 0.4, 0.3) });
  O.label({ at: [-0.8, -SUN_R * 0.6, 1.8], text: 'SURFACE ≈ 5,500 °C', sub: '1.3 million Earths would fit inside', dx: -240, dy: 140, k: env(t, 5.9, 8.3, 0.4, 0.3) });

  // inner system
  O.label({ at: above('mercury', t, 1.2), text: 'MERCURY', sub: 'closest to the Sun · 88-day year', dx: -150, dy: -110, k: env(t, 9.0, 11.3, 0.4, 0.3) });
  O.label({ at: above('venus', t, 1.0), text: 'VENUS', sub: 'hottest planet · 465 °C', dx: 150, dy: -120, k: env(t, 9.4, 11.3, 0.4, 0.3) });
  yearTag(above('earth', t, 1.0), 'EARTH', '', env(t, 9.8, 11.3, 0.4, 0.3));
  yearTag(above('mars', t, 1.0), 'MARS', '', env(t, 10.0, 11.3, 0.4, 0.3));

  O.label({ at: above('earth', t, 0.7), text: 'EARTH', sub: 'the only world known to have life', dx: 200, dy: -150, k: env(t, 12.1, 14.3, 0.4, 0.3) });
  O.label({ at: moon.getWorldPosition(new THREE.Vector3()), text: 'THE MOON', sub: 'our only natural satellite', dx: -170, dy: 130, k: env(t, 12.7, 14.3, 0.4, 0.3) });
  O.label({ at: above('mars', t, 0.7), text: 'MARS', sub: 'rusty iron dust turns it red', dx: 210, dy: -140, k: env(t, 15.1, 16.8, 0.4, 0.3) });

  // belt
  const bp = beltPt(t);
  O.label({ at: [bp[0], 0.2, bp[2]], text: 'MILLIONS OF ROCKS', sub: "all together: ~3 % of the Moon's mass", dx: 220, dy: -170, k: env(t, 17.8, 19.8, 0.4, 0.3) });

  // gas giants
  O.label({ at: above('jupiter', t, 0.8), text: 'JUPITER', sub: 'the biggest: 1,300 Earths would fit inside', dx: 260, dy: -150, k: env(t, 20.6, 23.3, 0.4, 0.3) });
  const grs = surfacePoint(planets.jupiter, 0.3, 0.64);
  O.label({ at: grs.w, text: 'GREAT RED SPOT', sub: 'a storm wider than Earth', dx: -250, dy: 150, k: env(t, 21.3, 23.3, 0.4, 0.3) * clamp(grs.facing * 4) });
  O.label({ at: above('saturn', t, 0.8), text: 'SATURN', sub: 'rings of ice, ~270,000 km across', dx: 300, dy: -160, k: env(t, 24.1, 26.8, 0.4, 0.3) });

  // ice giants
  O.label({ at: above('uranus', t, 0.75), text: 'URANUS', sub: 'rolls around the Sun tipped on its side', dx: 220, dy: -150, k: env(t, 27.6, 29.3, 0.4, 0.3) });
  O.label({ at: above('neptune', t, 0.75), text: 'NEPTUNE', sub: 'the windiest: storms up to 2,100 km/h', dx: 220, dy: -150, k: env(t, 30.1, 31.8, 0.4, 0.3) });

  // finale: one year on each planet
  ORDER.forEach((k, i) => yearTag(above(k, t, 1.2), k.toUpperCase(), P[k].year, env(t, 33.2 + i * 0.22, 37.5, 0.4, 0.4)));
  caption('The farther from the Sun, the longer the year', env(t, 33.6, 37.5, 0.5, 0.4));
  caption('Sizes and distances not to scale', env(t, 34.2, 37.5, 0.5, 0.4), 1022, 22, PAL.soft);

  // fade in / out
  const black = Math.max(1 - seg(t, 0, 0.6), seg(t, 37.3, 38));
  if (black > 0) { const g = O.ctx; g.globalAlpha = black; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  O.ctx.globalAlpha = 1;
}

boot({ dur: DUR, fonts: [], setup, frame });
