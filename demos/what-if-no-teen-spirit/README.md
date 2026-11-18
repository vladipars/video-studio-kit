# What if grunge never took over? (PS2 style, 9:16, 48 s)

A what-if short in the PS2 look from `claude-animation-styles`. The premise: one Seattle band shelves its loud song in 1991.
Ten scenes take the alternate timeline to 2001: hair metal keeps the radio, flannel stays on clearance, the hairspray meter climbs and then runs dry, and a kid finds the tape.
It has word-by-word captions, a month/year counter (top right), a HAIRSPRAY meter and a GRUNGE readout.
All the characters are generic. The soundtrack is synthesized in `make_audio.py` and uses no real recordings.

```sh
npm i                      # three (+ puppeteer if Playwright isn't installed globally)
node render.cjs stills 2,11,46
node render.cjs video      # out/video.mp4
python3 make_audio.py      # out/audio.wav
ffmpeg -i out/audio.wav -af loudnorm=I=-14:TP=-1.5 out/audio_norm.wav
ffmpeg -i out/video.mp4 -i out/audio_norm.wav -map 0:v -map 1:a -c:v copy -c:a aac -shortest what-if-no-teen-spirit.mp4
```

The scenes are in `styles/ps2what.js` (`SCENES[index]`). The lines, dates and meter values are in `story.json`.
