"""Soundtrack for the cardboard short, all synthesized here (no samples, no real recordings).
Reads cues.json (dumped from the page: sound cues + where each narration file starts) and voice/sNN.wav.
Writes out/voice.wav, out/music.wav, out/sfx.wav; README.md has the ffmpeg mix (duck + -14 LUFS).
Score: original, generic alt-rock: somber pad + clean guitar (1994) -> silence -> acoustic picking (finding his
way back) -> mid-tempo band groove in the studio -> full, uplifting band for 1995, ending on one big chord.
"""
import json, os, wave
import numpy as np
import soundfile as sf

SR = 44100
E = json.load(open('cues.json'))
DUR = E['dur']; N = int(DUR * SR); ST = E['starts']
rng = np.random.default_rng(12)
os.makedirs('out', exist_ok=True)

def buf(): return np.zeros((N, 2))
def put(dst, sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); sig = np.asarray(sig)
    if sig.ndim == 1: sig = np.stack([sig * (1 - max(0, pan)), sig * (1 + min(0, pan))], 1)
    n = min(len(sig), N - i)
    if n > 0 and i >= 0: dst[i:i + n] += sig[:n] * gain
def env(n, a=0.005, d=0.3):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
def lp(x, k=8): return np.convolve(x, np.ones(k) / k, 'same')
def hp(x, k=8): return x - lp(x, k)
def noise(n): return rng.standard_normal(n)
def tone(f, n, ph=0): return np.sin(2 * np.pi * f * np.arange(n) / SR + ph)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

# Karplus-Strong plucked string, vectorized per period
def ks(freq, dur, decay=0.996, bright=0.6, seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    P = max(2, int(SR / freq)); n = int(dur * SR); y = np.zeros(n + P + 2)
    exc = r.uniform(-1, 1, P); exc = bright * exc + (1 - bright) * lp(exc, 3); y[1:P + 1] = exc
    s = P + 1
    while s < n + 1:
        L = min(P, n + 1 - s); y[s:s + L] = decay * 0.5 * (y[s - P:s - P + L] + y[s - P - 1:s - P - 1 + L]); s += L
    return y[1:n + 1]
def strum(notes, dur=1.8, spread=0.018, gain=0.22, bright=0.6, decay=0.996, drive=0.0, down=True):
    n = int(dur * SR); out = np.zeros(n + int(spread * SR * 8))
    for j, m in enumerate(notes if down else notes[::-1]):
        s = ks(mtof(m), dur, decay, bright); i = int(j * spread * SR); out[i:i + len(s)] += s
    out = out[:n] * gain * np.minimum(1, np.arange(n) / 30)
    if drive: out = np.tanh(out * drive) / np.tanh(drive * 0.6)
    return out
CH = {'Am': [45, 52, 57, 60, 64], 'F': [41, 48, 53, 57, 60], 'C': [48, 52, 55, 60, 64], 'G': [43, 47, 50, 55, 59, 67],
      'D': [50, 57, 62, 66], 'A': [45, 52, 57, 61, 64], 'Bm': [47, 54, 59, 62, 66], 'Em': [40, 47, 52, 55, 59, 64]}
POWER = {'D': [38, 45, 50], 'A': [33, 40, 45], 'Bm': [35, 42, 47], 'G': [31, 38, 43], 'E': [28, 35, 40]}

# ---------- drums ----------
def kick(): n = int(0.4 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(45 + 90 * np.exp(-t * 28)) / SR) * env(n, 0.001, 0.18)
def snare(): n = int(0.35 * SR); t = np.arange(n) / SR; return hp(noise(n), 3) * env(n, 0.001, 0.09) * 0.8 + 0.5 * np.sin(2 * np.pi * 185 * t) * env(n, 0.001, 0.05)
def tom(f=110): n = int(0.5 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.5 * np.exp(-t * 20))) / SR) * env(n, 0.001, 0.22)
def hat(open_=False): n = int((0.25 if open_ else 0.06) * SR); return hp(noise(n), 2) * env(n, 0.0005, 0.08 if open_ else 0.015) * 0.5
def crash(d=1.6): n = int(d * SR); x = hp(noise(n), 2) + 0.3 * hp(noise(n), 4); return x * env(n, 0.001, d * 0.4) * 0.5

music, sfx = buf(), buf()

# ---------- score ----------
s0, s1, s2, s3, s4, s5, s6, s7 = ST
end_somber = s2 - 0.6
# 1994: a soft pad + clean arpeggios, 66 bpm, fading to silence by the end of the phone call
B = 60 / 66; t = 0.6; prog = ['Am', 'F', 'C', 'G']; k = 0
while t < end_somber:
    ch = CH[prog[k % 4]]; bar = 4 * B
    pad = sum(tone(mtof(m + 12), int(bar * SR + SR)) * 0.5 + tone(mtof(m + 12) * 1.003, int(bar * SR + SR)) * 0.5 for m in ch[1:4]) / 3
    pad *= np.minimum(1, np.arange(len(pad)) / (0.8 * SR)) * np.minimum(1, (len(pad) - np.arange(len(pad))) / (0.8 * SR))
    put(music, lp(pad, 6), t, 0.05)
    for j in range(8):
        m = ch[[0, 2, 3, 4, 3, 2, 1, 2][j] % len(ch)] + 12
        put(music, ks(mtof(m), 2.0, 0.997, 0.35) * 0.16, t + j * B / 2, 1.0, 0.3 if j % 2 else -0.3)
    t += bar; k += 1
fade = np.ones(N); a, b = int((s1 + 3.0) * SR), int(end_somber * SR); fade[a:b] = np.linspace(1, 0, b - a) ** 2; fade[b:] = 0
music *= fade[:, None]
# finding his way back: gentle acoustic picking returns
t = s2 + 2.3; prog = ['C', 'G', 'Am', 'F']; k = 0; B2 = 60 / 84
while t < s3 + 0.6:
    ch = CH[prog[k % 4]]
    for j in range(8): put(music, ks(mtof(ch[[0, 3, 2, 3, 1, 3, 2, 3][j] % len(ch)] + 12), 1.6, 0.996, 0.45) * 0.14, t + j * B2 / 2, 1.0, 0.25 if j % 2 else -0.25)
    t += 4 * B2; k += 1
# the studio: a mid-tempo band groove (D A Bm G), 104 bpm, building through the sessions to 1995
BPM = 104; Bb = 60 / BPM; bar = 4 * Bb
def groove(t0, t1, level, dist=0.0, full=False):
    t = t0; k = 0; prog = ['D', 'A', 'Bm', 'G']
    while t < t1 - 0.05:
        c = prog[k % 4]
        for q in range(4):
            tq = t + q * Bb
            if tq >= t1: break
            if q in (0, 2) or (full and q == 3 and k % 2): put(music, kick(), tq, 0.5 * level)
            if q in (1, 3): put(music, snare(), tq, 0.32 * level)
            for h in (0, 0.5): put(music, hat(), tq + h * Bb, 0.12 * level, 0.3)
            # bass on 8ths
            for h in (0, 0.5): put(music, ks(mtof(POWER[c][0]), Bb * 0.55, 0.99, 0.3) * 0.5, tq + h * Bb, level)
        put(music, strum(CH[c], bar, 0.012, 0.16, 0.55), t, level, -0.25)
        if dist:
            for e8 in range(8): put(music, strum(POWER[c], Bb * 0.5, 0.004, 0.25, 0.7, 0.99, drive=dist), t + e8 * Bb / 2, level * 0.8, 0.3)
        if full and k % 4 == 0: put(music, crash(), t, 0.25 * level)
        t += bar; k += 1
    return t
groove(s3 + 0.6, s5, 0.55)
groove(s5, s6, 0.65, dist=3.0)
groove(s6, s7, 0.75, dist=4.0)
final = [c for c in E['cues'] if c[1] == 'final_chord'][0][0]
end_t = groove(s7, final - 0.02, 1.0, dist=5.0, full=True)
put(music, strum(POWER['D'] + [57, 62], 4.5, 0.01, 0.4, 0.7, 0.9995, drive=5.0), final, 0.9); put(music, crash(3.5), final, 0.5); put(music, kick(), final, 0.8)

# ---------- sound effects ----------
def tv_voice(d):  # muffled broadcast speech: buzzy source through a moving formant, syllable rhythm
    n = int(d * SR); t = np.arange(n) / SR; src = np.sign(np.sin(2 * np.pi * (135 + 12 * np.sin(2 * np.pi * 0.7 * t)) * t)) * 0.5 + noise(n) * 0.15
    syl = np.clip(np.sin(2 * np.pi * 4.6 * t + 2 * np.sin(2 * np.pi * 0.9 * t)), 0, 1) ** 0.6 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * t))
    return hp(lp(src, 7), 30) * syl * 0.5
def ring(d=1.0): n = int(d * SR); t = np.arange(n) / SR; x = (tone(440, n) + tone(480, n)) * (0.55 + 0.45 * np.sign(np.sin(2 * np.pi * 20 * t))); return np.tanh(x * 1.5) * env(n, 0.005, 9) * np.minimum(1, (n - np.arange(n)) / 400)
def click(d=0.03, k=2): n = int(d * SR); return hp(noise(n), k) * env(n, 0.0002, d / 4)
def thud(f=80, d=0.25): n = int(d * SR); return tone(f, n) * env(n, 0.001, d / 4)
def creak(d=0.9): n = int(d * SR); t = np.arange(n) / SR; f = 220 + 90 * np.sin(2 * np.pi * 0.8 * t) + 30 * np.sin(2 * np.pi * 13 * t); x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.5 + 0.5 * np.sin(2 * np.pi * 31 * t)); return lp(x, 5) * env(n, 0.08, d) * 0.25
def swoosh(d=0.3, k=5): n = int(d * SR); return lp(noise(n), k) * np.sin(np.pi * np.arange(n) / n) ** 2
def hum(d, f=60): n = int(d * SR); return sum(tone(f * h, n) / h for h in (1, 2, 3, 5)) * 0.3
def crowd(d, rise):
    n = int(d * SR); t = np.arange(n) / SR; x = lp(noise(n), 6) * 0.6 + lp(noise(n), 18) * 0.5
    for _ in range(int(d * 18)):  # claps and whoops
        i = rng.integers(0, max(1, n - 4000)); put_arr = hp(noise(1500), 2) * env(1500, 0.0005, 0.01); x[i:i + 1500] += put_arr * rng.uniform(0.3, 1.0)
    for _ in range(int(d * 1.5)):
        i = rng.integers(0, max(1, n - 30000)); L = 26000; tt = np.arange(L) / SR; f = rng.uniform(500, 800) * (1 + 0.4 * tt); x[i:i + L] += lp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)), 6) * np.sin(np.pi * tt / tt[-1]) * 0.15
    shape = np.minimum(1, t / 1.2) * (np.clip(t / (d * 0.7), 0.15, 1) if rise else 1) * np.minimum(1, (d - t) / 1.0)
    return x * shape * 0.5
for t0, name, o in E['cues']:
    d = o.get('dur', 1.0)
    if name == 'room_tone': put(sfx, lp(noise(int(d * SR)), 40) * 0.05, t0)
    elif name == 'tv_click': put(sfx, click(0.04), t0, 0.6); put(sfx, thud(110, 0.15), t0, 0.4)
    elif name == 'static': n = int(d * SR); put(sfx, hp(noise(n), 2) * 0.28 * np.minimum(1, np.arange(n) / 600), t0); put(sfx, np.sin(2 * np.pi * np.cumsum(np.linspace(300, 2200, n)) / SR) * 0.06 * np.sin(np.pi * np.arange(n) / n), t0)
    elif name == 'news_tone':
        for j, f in enumerate([880, 660, 990]): put(sfx, tone(f, int(0.35 * SR)) * env(int(0.35 * SR), 0.005, 0.12) * 0.18, t0 + j * 0.16)
    elif name == 'tv_voice': put(sfx, tv_voice(d), t0, 0.22)
    elif name == 'phone_ring': put(sfx, ring(1.1), t0, 0.32, 0.25)
    elif name == 'pickup': put(sfx, click(0.03), t0, 0.7); put(sfx, thud(140, 0.12), t0 + 0.01, 0.5); put(sfx, click(0.05, 4), t0 + 0.08, 0.3)
    elif name == 'pencil':
        n = int(d * SR); x = hp(noise(n), 2) * (np.clip(np.sin(2 * np.pi * 3.1 * np.arange(n) / SR), 0, 1) ** 2) * 0.12; put(sfx, x, t0)
    elif name == 'strum': put(sfx, strum(CH['G'], 2.2, 0.02, 0.28, 0.5), t0, 0.8, 0.1)
    elif name == 'strum_e': put(sfx, strum(CH['D'], 1.4, 0.012, 0.24, 0.7, drive=1.6), t0, 0.7)
    elif name == 'page': put(sfx, swoosh(0.28, 3), t0, 0.22)
    elif name == 'tape_click': put(sfx, click(0.03), t0, 0.6); put(sfx, click(0.03), t0 + 0.09, 0.5); put(sfx, lp(noise(int(1.6 * SR)), 30) * 0.04, t0 + 0.1)
    elif name == 'step': put(sfx, thud(70, 0.18), t0, 0.5); put(sfx, click(0.02, 6), t0, 0.15)
    elif name == 'door': put(sfx, click(0.04, 3), t0, 0.4); put(sfx, creak(0.9), t0 + 0.05, 0.7)
    elif name == 'amp_on': put(sfx, thud(50, 0.2), t0, 0.6); put(sfx, hum(2.4) * np.linspace(1, 0.2, int(2.4 * SR)), t0, 0.08)
    elif name == 'amp_buzz': put(sfx, hum(d, 120), t0, 0.07)
    elif name == 'mic_stand':
        for j in range(4): put(sfx, click(0.02, 1), t0 + j * 0.07, 0.35)
    elif name in ('snare', 'tom', 'cymbal'): put(sfx, {'snare': snare, 'tom': lambda: tom(rng.uniform(90, 160)), 'cymbal': lambda: crash(0.8)}[name](), t0, 0.5)
    elif name == 'bass': put(sfx, ks(mtof(rng.choice([38, 40, 43])), 0.9, 0.995, 0.35), t0, 0.6)
    elif name == 'mic_tap': put(sfx, thud(90, 0.12), t0, 0.5)
    elif name == 'button': put(sfx, click(0.025, 2), t0, 0.6); put(sfx, thud(300, 0.05), t0, 0.2)
    elif name == 'reels': n = int(d * SR); put(sfx, (tone(110, n) * 0.25 + lp(noise(n), 3) * 0.3) * 0.12 * np.minimum(1, np.arange(n) / 4000), t0)
    elif name == 'notes':
        for j, m in enumerate([62, 66, 69, 67]): put(sfx, ks(mtof(m), 0.8, 0.996, 0.7) * 0.35, t0 + j * 0.22, 0.8)
    elif name == 'cassette': put(sfx, click(0.03, 2), t0, 0.7); put(sfx, thud(400, 0.05), t0 + 0.02, 0.4)
    elif name == 'case_close': put(sfx, click(0.04, 2), t0, 0.8)
    elif name == 'tape_run': n = int(d * SR); put(sfx, (tone(90, n) * 0.3 + lp(noise(n), 4) * 0.2) * 0.12, t0)
    elif name == 'flash': n = int(0.5 * SR); put(sfx, np.sin(2 * np.pi * np.cumsum(np.linspace(2500, 7000, n)) / SR) * env(n, 0.01, 0.2) * 0.04, t0 - 0.35); put(sfx, click(0.03, 1), t0, 0.5)
    elif name == 'crowd': put(sfx, crowd(d, o.get('rise', 0)), t0, 0.45 if o.get('rise') else 0.55)
    elif name == 'pop_logo':
        for j in range(o.get('n', 11)): put(sfx, thud(500 + j * 30, 0.06), t0 + j * 0.07 + 0.1, 0.35)

def write(name, x, peak=0.9):
    m = np.max(np.abs(x)) or 1; x = x / m * peak
    with wave.open(name, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
write('out/music.wav', music); write('out/sfx.wav', sfx)
voice = np.zeros(N)
for i, t0 in enumerate(E['voice']):
    a, sr = sf.read(f'voice/s{i:02d}.wav'); a = np.interp(np.arange(int(len(a) * SR / sr)) * sr / SR, np.arange(len(a)), a)
    i0 = int(t0 * SR); n = min(len(a), N - i0); voice[i0:i0 + n] += a[:n]
write('out/voice.wav', np.stack([voice, voice], 1))
print('ok', round(DUR, 2))
