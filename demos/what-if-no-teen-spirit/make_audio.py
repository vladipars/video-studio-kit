"""Synthesized soundtrack for the what-if short (48 s). Everything is generated here: no samples, no real songs.
python3 make_audio.py  ->  out/audio.wav
Beat starts (s): 0, 4.6, 8.8, 13.4, 17.8, 22.4, 26.8, 31.4, 35.8, 40.6; PLAY at 44.75.
"""
import wave, numpy as np, os
SR = 44100; DUR = 48.0; N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
T = np.arange(N) / SR
BPM = 132; B = 60 / BPM

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); n = min(len(sig), N - i)
    if n <= 0: return
    L[i:i + n] += sig[:n] * gain * (1 - max(0, pan)); R[i:i + n] += sig[:n] * gain * (1 + min(0, pan))

def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)

def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR; f = 50 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.16)

def snare(big=True):
    n = int(0.5 * SR); t = np.arange(n) / SR
    s = rng.standard_normal(n) * env(n, 0.001, 0.12 if big else 0.06) + 0.4 * np.sin(2 * np.pi * 190 * t) * env(n, 0.001, 0.05)
    if big:  # 80s gated reverb: a burst of noise chopped off hard
        tail = rng.standard_normal(n) * 0.35 * (t < 0.24); s = s + np.convolve(tail, np.ones(40) / 40, 'same')
    return s

def hat():
    n = int(0.06 * SR); x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x])); return x * env(n, 0.0005, 0.015)

def saw(f, n, detune=0.004):
    t = np.arange(n) / SR; out = 0
    for d in (-detune, 0, detune): ph = (t * f * (1 + d)) % 1; out = out + (2 * ph - 1)
    return out / 3

def power(root, n, dist=4.0, decay=0.5):  # power chord: root, fifth, octave through soft clipping
    f = 440 * 2 ** ((root - 69) / 12)
    x = saw(f, n) + 0.8 * saw(f * 1.4983, n) + 0.5 * saw(f * 2, n)
    x = np.tanh(x * dist) * env(n, 0.003, decay)
    k = np.ones(6) / 6; return np.convolve(x, k, 'same')

def synth_pad(notes, n):
    t = np.arange(n) / SR; out = 0
    for m in notes: f = 440 * 2 ** ((m - 69) / 12); out = out + saw(f, n, 0.006)
    a = np.minimum(1, t / 0.08) * np.minimum(1, (n / SR - t) / 0.1)
    return np.convolve(out * a / len(notes), np.ones(14) / 14, 'same')

def noise_bed(n, smooth=8):
    x = rng.standard_normal(n); return np.convolve(x, np.ones(smooth) / smooth, 'same')

# ---- 0 - 8.8: garage hum, a muffled band behind the door, then rain
hum = 0.04 * np.sin(2 * np.pi * 60 * T[:int(8.8 * SR)]) * (1 + 0.3 * np.sin(2 * np.pi * 0.3 * T[:int(8.8 * SR)]))
add(hum, 0, 0.6)
for i in range(int(4.0 / B)):  # muffled practice: kick + dull chords
    t0 = 0.2 + i * B
    if i % 2 == 0: add(kick(), t0, 0.35)
    if i % 4 == 0: add(np.convolve(power([40, 43, 45, 40][(i // 4) % 4], int(B * 4 * SR), 2.0, 0.6), np.ones(60) / 60, 'same'), t0, 0.12)
add(noise_bed(int(0.25 * SR), 3) * env(int(0.25 * SR), 0.001, 0.05), 2.9, 0.25)  # tape into the box
add(noise_bed(int(0.4 * SR), 20) * env(int(0.4 * SR), 0.002, 0.08), 3.6, 0.5)    # lid thud
rain = noise_bed(int(9.6 * SR), 3); rain *= np.minimum(1, np.arange(len(rain)) / SR / 0.6)
add(rain * 0.11, 4.4)
door = saw(55, int(2.6 * SR), 0.02) * env(int(2.6 * SR), 0.05, 1.5) * 0.08 + noise_bed(int(2.6 * SR), 30) * 0.12 * env(int(2.6 * SR), 0.05, 1.2)
add(door, 5.0, 0.8); add(noise_bed(int(0.5 * SR), 40) * env(int(0.5 * SR), 0.001, 0.1), 7.5, 0.9)  # door hits the ground

# ---- 8.8 - 35.8: the hair-metal loop that never ends (original progression, E - G - A - C - D)
prog = [(40, 2), (43, 1), (45, 1), (40, 2), (48, 1), (50, 1)]  # (root midi, bars)
start, end = 8.8, 35.8
def section_gain(t):
    if t < 13.4: return 1.0
    if t < 26.8: return 0.85
    if t < 31.4: return 0.35   # Seattle: muffled, from a passing car
    return 0.5                 # day job: kitchen radio
bar = 4 * B; t = start; pi = 0
while t < end:
    root, bars = prog[pi % len(prog)]; pi += 1
    for b in range(bars):
        tb = t + b * bar
        if tb >= end: break
        g = section_gain(tb)
        for k8 in range(8):  # eighth-note chug
            tt = tb + k8 * B / 2
            if tt >= end: break
            add(power(root, int(B / 2 * SR), 4.0, 0.12 if k8 % 2 else 0.2), tt, 0.16 * g, -0.3)
            add(hat(), tt, 0.10 * g, 0.4)
        for q in range(4):
            tq = tb + q * B
            if q in (0, 2): add(kick(), tq, 0.55 * g)
            if q in (1, 3): add(snare(), tq, 0.30 * g)
        add(synth_pad([root + 24, root + 28, root + 31], int(bar * SR)), tb, 0.05 * g, 0.3)
        if (pi + b) % 4 == 0: add(power(root + 12, int(bar * SR), 6.0, 0.9), tb, 0.08 * g, 0.5)
    t += bars * bar
# arena crowd roar on the first hit + mirror spray hisses + Seattle rain + grill sizzle
add(noise_bed(int(2.0 * SR), 12) * env(int(2.0 * SR), 0.2, 0.9), 8.8, 0.35)
for i in range(6): add(rng.standard_normal(int(0.4 * SR)) * env(int(0.4 * SR), 0.01, 0.15), 17.9 + i * 0.84, 0.10, 0.3)
add(noise_bed(int(4.8 * SR), 3) * 0.13, 26.7)
add(rng.standard_normal(int(4.4 * SR)) * 0.035 * (1 + 0.5 * np.sin(2 * np.pi * 3 * T[:int(4.4 * SR)])), 31.4, 1, -0.2)

# ---- 35.8 - 40.6: the same loop on a tape that slows down and dies
n = int(4.8 * SR); t = np.arange(n) / SR
speed = np.clip(1 - (t / 4.2) ** 1.6, 0, 1); ph = np.cumsum(speed) / SR
mel = 0
for m, w in ((40, 1), (47, 0.7), (52, 0.5)): mel = mel + w * np.tanh(3 * np.sin(2 * np.pi * 440 * 2 ** ((m - 69) / 12) * ph))
beatk = np.sin(2 * np.pi * 55 * ph) * np.exp(-((ph % (B)) / 0.06))
dying = (0.10 * mel + 0.35 * beatk) * speed ** 0.6
add(np.convolve(dying, np.ones(10) / 10, 'same'), 35.8, 0.6)
add(noise_bed(int(1.5 * SR), 50) * env(int(1.5 * SR), 0.05, 0.6), 39.0, 0.08)  # sad wind

# ---- 40.6 - 48: dust, box, cassette clunk, button, then the big hit
add(noise_bed(int(4.2 * SR), 60) * 0.05, 40.6)
add(noise_bed(int(0.5 * SR), 15) * env(int(0.5 * SR), 0.05, 0.25), 41.0, 0.25)       # box lid creaks open
add(noise_bed(int(0.12 * SR), 2) * env(int(0.12 * SR), 0.0005, 0.03), 44.0, 0.7)      # clunk into the deck
add(noise_bed(int(0.06 * SR), 2) * env(int(0.06 * SR), 0.0005, 0.012), 44.7, 0.9)     # click: PLAY
PLAY = 44.75
add(power(41, int(3.2 * SR), 7.0, 1.6), PLAY, 0.42, -0.2); add(power(41, int(3.2 * SR), 7.0, 1.6), PLAY + 0.012, 0.42, 0.2)
add(kick(), PLAY, 0.9); add(snare(), PLAY, 0.6); add(noise_bed(int(2.4 * SR), 2) * env(int(2.4 * SR), 0.002, 0.9), PLAY, 0.18)
for i, (tt, m) in enumerate([(PLAY + 0.9, 44), (PLAY + 1.35, 46), (PLAY + 1.8, 41)]):
    add(power(m, int(1.2 * SR), 7.0, 0.7), tt, 0.32); add(kick(), tt, 0.7); add(snare(), tt + B, 0.4)
fade = np.ones(N); fi = int((DUR - 0.6) * SR); fade[fi:] = np.linspace(1, 0, N - fi)
mix = np.stack([L, R], 1) * fade[:, None]
mix /= np.max(np.abs(mix)) * 1.05
os.makedirs('out', exist_ok=True)
with wave.open('out/audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('out/audio.wav')
