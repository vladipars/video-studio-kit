# How Radiohead Changed Alternative Rock Forever (collage, 9:16, 92 s)

A paper-collage explainer for a YouTube Short. Everything on screen is drawn in Canvas 2D: torn paper, halftone photocopies, tape, rubber stamps, marker scribbles and ransom-note headlines. Cutouts boil at 12 poses a second.
There are no photos, no album art and no band likenesses.
The narration is the local Kokoro voice `bf_emma`, run through a vintage radio filter. The music is a synthesized lo-fi bed with vinyl crackle that ducks under the voice.

- `tts.py`: the script, the voice and the scene timing (`voice/timing.json`). Names are spelled for the voice ("Tom Yorke", "Saint Catherine's"), and the captions show the real spelling.
- `scene.js`: the frame page, with one function per scene. Pictures are timed to the sentences.
- `make_audio.py`: joins the narration and builds the music bed.

```sh
studio/tts/.venv/bin/python demos/radiohead-collage/tts.py          # run from inside the folder; SPEED=1.24
node video-studio/tools/page-render.mjs demos/radiohead-collage --out out/video.mp4 --size 1080x1920 --fps 30
python3 make_audio.py
ffmpeg -i out/voice_raw.wav -af "aresample=44100,highpass=f=170,lowpass=f=5200,equalizer=f=1800:t=q:w=1.2:g=4,equalizer=f=300:t=q:w=1:g=2,vibrato=f=0.5:d=0.02,asoftclip=type=tanh:threshold=0.8,aecho=0.8:0.6:28|52:0.18|0.1,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-2" -ac 2 out/voice_retro.wav
ffmpeg -i out/music.wav -i out/voice_retro.wav -filter_complex "[0]volume=0.5[m];[m][1]sidechaincompress=threshold=0.04:ratio=6:attack=30:release=400[d];[d][1]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5" out/mix.wav
ffmpeg -i out/video.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v libx264 -crf 27 -c:a aac -shortest radiohead-ok-computer-collage.mp4
```
