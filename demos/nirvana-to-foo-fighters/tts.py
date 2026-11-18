"""Narration with the local Kokoro voice. Writes voice/sNN.wav per scene and voice/timing.json.
Run with studio/tts/.venv/bin/python. Spellings are tuned so names are said right (Grole, Dully, Ecstatic)."""
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
VOICE = os.environ.get('VOICE', 'am_michael'); SPEED = float(os.environ.get('SPEED', '1.2'))
S = [
 ["In April, nineteen ninety-four, the music world was shaken by the death of Kurt Cobain.", "For Dave Grole, Nirvana's drummer, the loss was deeply personal.", "One of the most important chapters of his life had suddenly come to an end."],
 ["After receiving the news, Dave struggled to process what had happened.", "He later described feeling completely lost.", "Even listening to music became painful."],
 ["But eventually, Dave began writing music again.", "In June, nineteen ninety-four, he started recording new material with his friend Barrett Jones.", "Slowly, music became something he could return to."],
 ["In October, nineteen ninety-four, Dave headed to Robert Lang Studios in Washington, to record what would become the first Foo Fighters album.", "He brought along his friend and producer, Barrett Jones."],
 ["Here's what made the recording so unusual.", "Dave played almost everything himself.", "He started with the drums, then added guitars, bass, and finally, vocals.", "He recorded fifteen songs in roughly a week, using mostly first takes."],
 ["During the sessions, Afghan Whigs frontman Greg Dully visited the studio.", "Dave invited him to contribute a guitar part to the song, Ecstatic.", "It was one of the few performances on the record that wasn't Dave's."],
 ["Dave initially wanted to release the recordings anonymously, under the name Foo Fighters.", "He wasn't even planning to become the frontman of a new band.", "But eventually, the project grew into something much bigger."],
 ["The first Foo Fighters album was released in nineteen ninety-five.", "What began as one musician finding his way back to music, became one of the biggest rock bands in the world.", "Dave Grole hadn't forgotten where he came from.", "He had started a new chapter."],
]
GAP = {'?': 0.34, '.': 0.2, '!': 0.28}
timing = []
for i, sents in enumerate(S):
    parts, marks, t = [], [], 0.0
    for s in sents:
        a, sr = k.create(s, voice=VOICE, speed=SPEED, lang='en-us')
        marks.append([round(t, 3), round(t + len(a) / sr, 3), s]); parts.append(a); t += len(a) / sr
        g = np.zeros(int(sr * GAP.get(s.strip()[-1], 0.3))); parts.append(g); t += len(g) / sr
    sf.write(f'voice/s{i:02d}.wav', np.concatenate(parts), sr)
    timing.append({'scene': i, 'dur': round(t, 3), 'sentences': marks})
    print(i, round(t, 2))
json.dump(timing, open('voice/timing.json', 'w'), indent=1)
print('total', round(sum(x['dur'] for x in timing), 2))
