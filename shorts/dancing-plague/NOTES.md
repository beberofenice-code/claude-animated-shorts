# The Dancing Plague: production notes

**Final:** `the-dancing-plague-2k.mp4` (not in git, 200 MB). 1440x2560, 30 fps, 2075 frames, 69.17 s, H.264 CRF 16, AAC 320k.
Mix: -16.0 LUFS integrated, true peak -1.1 dBTP. Music: own jig, 10 LU under the voice ("+3 dB" standard). SFX: -6 dB rule. Voice: gain only.

**Voice:** ElevenLabs, "Clark - The Trusted Narrator" (eleven_multilingual_v2), one take. Pauses longer than 0.4 s were tightened (`voice/tighten.py`) from 72.3 s to 69.1 s.
Word timings come from ElevenLabs Scribe (`voice/words.json`).

**Code:** `src/` is a copy of the bridge template, adapted:
- `story.ts`: 29 shots.
- `build.ts`: `buildCity` builds Strasbourg (square, lane, cathedral, guildhall, stage, fields, shrine).
- `cast.ts`: 1518 cast, 380-dancer crowd.
- `toon.ts`: dance pose, yawn face with hand, beret/doctor/coif hats, pipe/drum/flask/shoes props, horse, ban sign.
- `Dancing.tsx`: 2K composition `DancingShort2K`.

**Verifier (Opus max) round 1:** day 6, golden 4, lighting 6, ink 7, textures 6, characters 7, depth 7, composition 5, readability 6.
Fixed after it:
- golden grade warmer and less saturated;
- day saturation up, fog pushed back;
- flask raised to eye level (it read as a phone);
- hand over the yawn;
- shoes held low;
- foreground bush blob removed;
- framing of the band, strong men and horse.

**QA:** no black, white or frozen frames, no silences. The flagged "pops" are dance motion in close-ups, checked visually.

## Gotchas found here (CPU-only cloud container)
- There is no GPU, so rendering uses SwiftShader (`--gl swangle`). 2K costs about 60 s per frame per process. Chrome shares one GPU process across tabs, so `--concurrency` does not scale.
  Run separate `remotion render` processes on frame ranges instead (`render_parts.sh` / `render_lane.sh`), one per core.
- Long-lived pages crash ("Page crashed!") after about 200 frames at 2K. Keep each part at 130 frames or fewer.
- `--scale 1.3333` gives an odd width (1439.96): use a native 1440x2560 composition.
- `fx.ink.dispose` is not a function with this postprocessing version, and it crashes on crossfade unmount. It is guarded now.
- Lens blur taps were cut from 16+64+32 to 12+26+10 with no visible change.
- Concatenating the parts with `-c copy` dropped 37 frames at the joins. Re-encode through the concat filter instead (see finish).
