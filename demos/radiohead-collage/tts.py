"""Narration with the local Kokoro voice. Writes voice/sNN.wav per scene and voice/timing.json.
Run with studio/tts/.venv/bin/python. Spellings are tuned so names are said right (Tom Yorke, Saint Catherine's)."""
import os, json, sys, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'studio', 'tts'))
import espeakng_loader
DATA, LIB = espeakng_loader.get_data_path(), espeakng_loader.get_library_path()
os.environ["ESPEAK_DATA_PATH"] = DATA; os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = LIB
import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.config import EspeakConfig
TTS = os.path.join(os.path.dirname(__file__), '..', '..', 'studio', 'tts')
k = Kokoro(os.path.join(TTS, 'kokoro-v1.0.onnx'), os.path.join(TTS, 'voices-v1.0.bin'), espeak_config=EspeakConfig(lib_path=LIB, data_path=DATA))
VOICE = os.environ.get('VOICE', 'bf_emma'); SPEED = float(os.environ.get('SPEED', '1.24'))
S = [
 ["In nineteen ninety-seven, five musicians from Oxford, England, released an album that would change the direction of alternative rock forever.", "Its name?", "OK Computer."],
 ["After the success of their previous album, The Bends, Radiohead wanted to take their music somewhere completely different.", "They wanted to escape traditional rock formulas, and experiment with something new."],
 ["In nineteen ninety-six, the band began working on the album at Canned Applause, their rehearsal space in Oxfordshire, which was actually a converted apple shed!", "They worked alongside producer Nigel Godrich, who would become one of their most important creative collaborators."],
 ["Eventually, they moved their recording equipment to Saint Catherine's Court, a historic mansion near Bath, England.", "Instead of recording everything in a traditional studio, they used different rooms throughout the mansion to create unique sounds."],
 ["Tom Yorke recorded vocals for Exit Music on a stone staircase, to capture its natural echo.", "Meanwhile, Let Down was recorded in the mansion's ballroom, at around three in the morning.", "The band also experimented with electronic sounds, unusual guitar effects, and unconventional recording techniques."],
 ["The result was OK Computer, featuring songs like Paranoid Android, Karma Police, and No Surprises.", "Its lyrics explored technology, isolation, consumerism, and the growing anxiety of modern life."],
 ["Released on June sixteenth, nineteen ninety-seven, the album challenged what alternative rock could sound like.", "It showed that a guitar-based band could be experimental, atmospheric, ambitious, and commercially successful."],
 ["OK Computer became one of the most celebrated albums in alternative rock history, influencing countless musicians who followed.", "And Radiohead?", "They were only getting started."],
]
GAP = {'?': 0.38, '.': 0.22, '!': 0.3}
timing = []
for i, sents in enumerate(S):
    parts, marks, t = [], [], 0.0
    for s in sents:
        a, sr = k.create(s, voice=VOICE, speed=SPEED, lang='en-gb')
        marks.append([round(t, 3), round(t + len(a) / sr, 3), s]); parts.append(a); t += len(a) / sr
        g = np.zeros(int(sr * GAP.get(s.strip()[-1], 0.3))); parts.append(g); t += len(g) / sr
    sf.write(f'voice/s{i:02d}.wav', np.concatenate(parts), sr)
    timing.append({'scene': i, 'dur': round(t, 3), 'sentences': marks})
    print(i, round(t, 2))
json.dump(timing, open('voice/timing.json', 'w'), indent=1)
print('total', round(sum(x['dur'] for x in timing), 2))
