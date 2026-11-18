"""Audio for the collage short: narration + a synthesized lo-fi bed (no samples, no real songs).
python3 make_audio.py -> out/voice_raw.wav, out/music.wav. The ffmpeg step in README.md adds the retro filter,
ducks the music under the voice and masters to -14 LUFS.
"""
import json, os, wave, numpy as np
import soundfile as sf

LEAD, TAIL = 0.35, 1.4
T = json.load(open('voice/timing.json'))
parts, sr = [], 24000
for i in range(len(T)):
    a, sr = sf.read(f'voice/s{i:02d}.wav'); parts.append(a)
voice = np.concatenate([np.zeros(int(LEAD * sr))] + parts + [np.zeros(int(TAIL * sr))])
os.makedirs('out', exist_ok=True); sf.write('out/voice_raw.wav', voice, sr)
DUR = len(voice) / sr

SR = 44100; N = int(DUR * SR); t = np.arange(N) / SR; rng = np.random.default_rng(4)
L = np.zeros(N); R = np.zeros(N)
def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); n = min(len(sig), N - i)
    if n > 0: L[i:i + n] += sig[:n] * gain * (1 - max(0, pan)); R[i:i + n] += sig[:n] * gain * (1 + min(0, pan))
def env(n, a, d): x = np.arange(n) / SR; return np.minimum(1, x / a) * np.exp(-x / d)
def ep(m, n, vel=1.0):  # soft electric piano: sine + bell partials, slow decay
    f = 440 * 2 ** ((m - 69) / 12); x = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * x) + 0.25 * np.sin(2 * np.pi * 2 * f * x) * np.exp(-x * 3) + 0.08 * np.sin(2 * np.pi * 7 * f * x) * np.exp(-x * 12)
    return s * env(n, 0.004, 1.4) * vel
BPM = 84; B = 60 / BPM; BAR = 4 * B
CH = [[50, 53, 57, 60, 64], [46, 50, 53, 57, 62], [41, 45, 48, 52, 57], [48, 52, 55, 57, 62]]  # Dm9 Bbmaj9 Fmaj7 C6/9
bar = 0; t0 = 0.0
while t0 < DUR:
    c = CH[bar % 4]
    for j, m in enumerate(c): add(ep(m, int(BAR * SR) + SR), t0 + j * 0.012, 0.05, (j - 2) * 0.15)
    add(ep(c[0] - 12, int(BAR * SR), 1.2), t0, 0.07)
    for k in range(8):  # gentle arpeggio
        if (k + bar) % 3 == 0: continue
        add(ep(c[(k * 2 + bar) % 5] + 12, int(B * SR)), t0 + k * B / 2 + 0.01, 0.025, 0.4 if k % 2 else -0.4)
    for q in range(4):  # brushed kit
        tq = t0 + q * B
        kn = int(0.3 * SR); x = np.arange(kn) / SR
        if q in (0, 2): add(np.sin(2 * np.pi * (48 + 60 * np.exp(-x * 25)) * x) * env(kn, 0.002, 0.12), tq, 0.22)
        if q in (1, 3): sn = rng.standard_normal(int(0.25 * SR)); add(np.convolve(sn, np.ones(6) / 6, 'same') * env(len(sn), 0.004, 0.07), tq, 0.07)
        for h in (0, 0.5): hn = rng.standard_normal(int(0.05 * SR)); add(np.diff(np.concatenate([[0], hn])) * env(len(hn), 0.001, 0.012), tq + h * B, 0.025, 0.3)
    bar += 1; t0 += BAR
# tape wow: a slow wobble in pitch, by resampling against a wobbling clock
wob = t + 0.0018 * np.sin(2 * np.pi * 0.55 * t) + 0.0007 * np.sin(2 * np.pi * 3.1 * t)
L = np.interp(wob, t, L); R = np.interp(wob, t, R)
# vinyl crackle + hiss
cr = np.zeros(N); idx = rng.integers(0, N, int(DUR * 22)); cr[idx] = rng.uniform(-1, 1, len(idx)) * rng.uniform(0.2, 1, len(idx)) ** 2
cr = np.convolve(cr, [1, 0.6, 0.3, 0.1], 'same') * 0.25 + rng.standard_normal(N) * 0.004
L += cr; R += cr
# low-pass the whole bed (warm, old) and fade the ends
k = np.ones(9) / 9; L = np.convolve(L, k, 'same'); R = np.convolve(R, k, 'same')
fade = np.minimum(1, t / 1.0) * np.minimum(1, (DUR - t) / 2.0)
mix = np.stack([L * fade, R * fade], 1); mix /= np.max(np.abs(mix)) * 1.1
with wave.open('out/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('voice', round(DUR, 2), 's')
