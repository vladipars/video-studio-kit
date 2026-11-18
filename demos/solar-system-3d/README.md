# Our Solar System, explained in 3D

A 38 s, 1920x1080 three.js explainer built on the `sci-molecular` engine (copied into `engine/`).
The camera flies outward from the Sun, past the inner planets, through the asteroid belt and on to the gas and ice
giants. It ends on a wide shot showing each planet's year length.

- `scene.js`: the whole film. Beats and timings are listed at the top. Planet textures are procedural, so there are no image files.
- `our-solar-system-3d.mp4`: the render, with a soft synthesized ambient pad.

Render (after `node setup.mjs`):

```sh
node video-studio/tools/page-render.mjs demos/solar-system-3d --stills 6.5,13,25.5 --outdir demos/solar-system-3d/stills
node video-studio/tools/page-render.mjs demos/solar-system-3d --out solar.mp4 --size 1920x1080 --fps 30
```

Sizes and distances are compressed. Orbital speeds keep the real order (inner planets move faster), and the year lengths shown are the real ones.
