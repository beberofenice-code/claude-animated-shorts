# The Ghost Ship Mary Celeste — production notes

- **Script + facts:** `SCRIPT.md` (sources at the top). Approved v1, ~241 words.
- **Voice:** ElevenLabs `eleven_v4`, library voice "Clark – The Trusted Narrator", take A. Raw read was 89 s; pauses
  capped at 0.26 s and tempo x1.22 (ffmpeg atempo) -> `voice/voice.wav` 67.97 s. Word timings from ElevenLabs Scribe ->
  `voice/words.json` (243 words). Every shot/reaction in `story.ts`/`cast.ts` is keyed to these times.
- **Picture:** `studio/src/videos/ghost/` (copied from `templates/bridge/`, composition `GhostShort`, 2064 f @ 30 fps).
  - `story.ts`: 27 shots, crossfades on place/time changes, white flash at f180, flip kicks on the spark (41.72 s),
    the door slam (49.94 s), the rope snap (54.8 s); ship poses, towline/boat physics, DOF table.
  - `world.ts`: sea shader, lofted brigantine hull (Mary Celeste + Dei Gratia), billowing sails, rigging, self-steering
    wheel, the yawl + towline (snaps into two frayed ends), cargo hold (9 red-oak leakers), smoke-alarm house
    (door slams), the doctor's study (ship model, the lifeboat pops back, spinning globe).
  - `cast.ts` / `toon.ts`: new outfits (sailors, captain with beard, wife, 2-year-old, Dei Gratia crew, the doctor,
    pyjama man) and props (spyglass, sniff, quill, toy boat); fumes, smoke, alarm rings, drips, frayed rope, snap burst.
- **Sound:** `audio/ghost_audio.py` -> `mix.wav` (-15 LUFS, TP -1.2 dBTP, 68.8 s), stems, `audio/cues.md`.
  Original 6/8 shanty in D minor -> mystery vibes -> comic alarm -> sunset pad -> D-major waltz for the doctor.
  Voice gain only; music ducked -3 dB under each word, bed ~10 LU under the voice; SFX ~15 LU under.
- **Render:** `npx remotion render src/index.ts GhostShort out/ghost/video.mp4 --codec h264 --crf 16 --scale 1.3333333333333333 --gl angle --browser-executable /opt/pw-browsers/chromium --concurrency 3`
  (`--scale 1.3333` gives a non-integer height 2559.936 and Remotion refuses it). Software GL here: ~2 h for 2064 frames.
- **Mux:** `ffmpeg -i video.mp4 -i ../../ghost-short/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k final.mp4`

## Render glitch (2K, --concurrency 4, --gl angle)
The full `remotion render` at concurrency 4 produced ~20-45 % scrambled frames (the image tiled 2x8 —
a broken SwiftShader readback; all tabs share one GPU process). Single-frame stills of the same frames are clean.
Fix: `scripts/patch_frames.mjs` renders every frame as PNG with 4 separate browser processes (~10.5 s/frame/worker,
~90 min total, also faster than the concurrent render), then encode:
`ffmpeg -framerate 30 -i out/ghost/frames/f%04d.png -i ../ghost-short/mix.wav -map 0:v -map 1:a -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k out/ghost/final.mp4`
Always run short_qa.py and look at POPS: paired ~57-diff spikes = glitch frames.
