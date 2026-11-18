// main.js: timeline, rendering (shadows + depth of field), subtitles, flashes, the final cardboard title.
// Frame page contract: window.DUR, window.render(t), window.READY. window.EXPORT holds the sound cues + voice
// placement for make_audio.py (dump it with tools/dump.mjs).
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { buildScenes } from './sets.js'
import { kraftCanvas, clamp, rng } from './kit.js'

const W = 1080, H = 1920
const PADB = [0.8, 1.7, 0.3, 0.3, 0.25, 0.3, 0.25, 0.25]  // silence before each scene's narration
const PADA = [0.2, 0.4, 0.2, 0.2, 0.15, 0.2, 0.2, 4.4]    // after it (the last one holds the final title)

const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
R.setPixelRatio(1); R.setSize(W, H); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap
R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05
document.body.appendChild(R.domElement)
const OV = document.createElement('canvas'); OV.width = W; OV.height = H; document.body.appendChild(OV); const g = OV.getContext('2d')
const camera = new THREE.PerspectiveCamera(30, W / H, 0.5, 600)
const composer = new EffectComposer(R); composer.setSize(W, H)
const rp = new RenderPass(new THREE.Scene(), camera); composer.addPass(rp)
const bokeh = new BokehPass(new THREE.Scene(), camera, { focus: 30, aperture: 0.003, maxblur: 0.012 }); composer.addPass(bokeh)
composer.addPass(new OutputPass())

let SCENES, STARTS = [], DURS = [], DUR = 0, SUBS = [], FLASH = []
function chunk(text, a, b) { // split a sentence into subtitle chunks of <= 34 characters, timed by length
  const words = text.split(' '), out = []; let cur = ''
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (n.length > 34 && cur) { out.push(cur); cur = w } else cur = n }
  out.push(cur); const total = out.reduce((s, c) => s + c.length, 0); let t = a
  return out.map((c) => { const d = ((b - a) * c.length) / total, r = [t, t + d, c]; t += d; return r })
}
const SPELL = (s) => s.replace(/Grole/g, 'Grohl').replace(/Dully/g, 'Dulli').replace('the song, Ecstatic', 'the song "X-Static"').replace(/nineteen ninety-four/g, '1994').replace(/nineteen ninety-five/g, '1995')

function subtitle(text, k) {
  if (k <= 0) return
  g.save(); g.globalAlpha = k; g.font = `800 62px Inter, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
  const words = text.split(' '), lines = []; let cur = ''
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (g.measureText(n).width > 900 && cur) { lines.push(cur); cur = w } else cur = n } lines.push(cur)
  lines.forEach((L, i) => { const y = 1330 + (i - (lines.length - 1) / 2) * 76; g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 16; g.strokeStyle = 'rgba(24,14,8,.92)'; g.lineWidth = 11; g.strokeText(L, W / 2, y); g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.fillText(L, W / 2, y) })
  g.restore()
}
let KP = null
function kraftStrip(text, cx, cy, size, rot, k, { font = '"Permanent Marker", cursive', col = '#1c140c', pad = 34, bg } = {}) {
  if (k <= 0) return
  KP = KP || g.createPattern(kraftCanvas(), 'repeat')
  g.save(); g.font = `${size}px ${font}`; const w = g.measureText(text).width + pad * 2, h = size * 1.5, e = 1 + (1 - clamp(k * 1.6)) * -0.3
  g.translate(cx, cy + (1 - clamp(k * 1.4)) * 60); g.rotate(rot); g.scale(e, e); g.globalAlpha = clamp(k * 3)
  const r = rng(text.length * 13), pts = []; for (let i = 0; i <= 20; i++) pts.push([-w / 2 + (w * i) / 20, -h / 2 + (r() - 0.5) * 5]); for (let i = 20; i >= 0; i--) pts.push([-w / 2 + (w * i) / 20, h / 2 + (r() - 0.5) * 5])
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath()
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 22; g.shadowOffsetY = 10; g.fillStyle = KP; g.fill(); g.shadowColor = 'transparent'
  if (bg) { g.globalAlpha *= 0.85; g.fillStyle = bg; g.fill(); g.globalAlpha = clamp(k * 3) }
  g.strokeStyle = '#6a4a28'; g.lineWidth = 3; g.stroke()
  g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 4)
  g.restore()
}

function frame(T) {
  let i = STARTS.findIndex((s, j) => T < s + DURS[j]); if (i < 0) i = STARTS.length - 1
  const t = T - STARTS[i], S = SCENES[i], shot = S.shots.find((s) => t < s.until)
  shot.update(t)
  const c = shot.cam(t)
  camera.fov = c.fov; camera.updateProjectionMatrix(); camera.position.copy(c.pos); camera.lookAt(c.look); camera.updateMatrixWorld()
  rp.scene = shot.set.scene; bokeh.scene = shot.set.scene
  bokeh.uniforms.focus.value = camera.position.distanceTo(c.focus); bokeh.uniforms.aperture.value = c.ap
  composer.render()

  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H)
  // stop-motion exposure flicker + warm vignette
  const f = Math.floor(T * 12), fl = (rng(f * 31)() - 0.5) * 0.05
  g.fillStyle = fl > 0 ? `rgba(255,240,220,${fl})` : `rgba(0,0,0,${-fl})`; g.fillRect(0, 0, W, H)
  const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.28, W / 2, H * 0.5, H * 0.78); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H)
  for (const ft of FLASH) { const d = T - ft; if (d >= 0 && d < 0.25) { g.fillStyle = `rgba(255,252,240,${0.75 * (1 - d / 0.25)})`; g.fillRect(0, 0, W, H) } }
  const sub = SUBS.find(([a, b]) => T >= a - 0.05 && T < b + 0.05); if (sub && !(S.final && t > S.final)) subtitle(sub[2], clamp((T - sub[0] + 0.05) * 8) * clamp((sub[1] + 0.05 - T) * 8))
  if (S.final) { const k = (d) => clamp((t - S.final - d) / 0.45); g.fillStyle = `rgba(14,8,4,${0.45 * k(0)})`; g.fillRect(0, 0, W, H)
    kraftStrip('FROM NIRVANA', W / 2, 760, 96, -0.03, k(0.1)); kraftStrip('TO FOO FIGHTERS', W / 2, 920, 96, 0.025, k(0.45), { bg: '#e2b33c' }); kraftStrip('A NEW CHAPTER IN ROCK HISTORY.', W / 2, 1110, 50, -0.015, k(1.0), { font: '"Patrick Hand", cursive', pad: 30 }) }
  if (T < 0.5) { g.fillStyle = `rgba(0,0,0,${1 - T / 0.5})`; g.fillRect(0, 0, W, H) }
  if (T > DUR - 0.7) { g.fillStyle = `rgba(0,0,0,${clamp((T - DUR + 0.7) / 0.7)})`; g.fillRect(0, 0, W, H) }
}

;(async () => {
  try { await Promise.all(['40px "Permanent Marker"', '40px "Patrick Hand"', '40px "Archivo Black"', '800 40px Inter'].map((f) => document.fonts.load(f))) } catch {}
  const TIM = await (await fetch('voice/timing.json')).json()
  SCENES = buildScenes(TIM, PADB)
  let s = 0; TIM.forEach((sc, i) => { STARTS.push(s); DURS.push(PADB[i] + sc.dur + PADA[i]); s += DURS[i] }); DUR = s
  const cues = [], voice = []
  SCENES.forEach((S, i) => {
    for (const [t, name, o] of S.cues) cues.push([+(STARTS[i] + t).toFixed(3), name, o || {}])
    voice.push(+(STARTS[i] + PADB[i]).toFixed(3))
    for (const [a, b, txt] of S.T) SUBS.push(...chunk(SPELL(txt), STARTS[i] + a, STARTS[i] + b))
  })
  FLASH = cues.filter((c) => c[1] === 'flash').map((c) => c[0])
  window.EXPORT = { dur: DUR, voice, cues, starts: STARTS }
  window.DUR = DUR
  window.render = (t) => frame(Math.max(0, Math.min(DUR - 1e-3, t)))
  const q = new URLSearchParams(location.search); window.render(q.has('t') ? +q.get('t') : 0)
  window.READY = true
})().catch((e) => { console.error(e); window.FAILED = String(e.stack || e) })
