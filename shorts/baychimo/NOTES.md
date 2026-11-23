# The Ship That Refused to Sink: production notes

**Output:** 1440x2560, 30 fps, 1982 frames (66.07 s), h264 CRF 16. Mix: −15 LUFS integrated, −1.2 dBTP.

## Where things are
- **Script and sources:** `SCRIPT.md` (this folder).
- **Voice:**
  - `remotion/voice/raw.mp3` is the ElevenLabs take: "Marcus K – Calm Documentary Narrator", `eleven_multilingual_v2`, 85.6 s.
  - `voice.wav` is that take with long pauses capped at 0.28 s (`trim_map.py`), 66.0 s.
  - `words.json` holds the word timings: ElevenLabs Scribe, mapped through the trim. The "In" onset was fixed by hand.
- **Picture:** `remotion/src/videos/baychimo/`, composition `BaychimoShort`, started from the bridge template.
  - `story.ts`: 19 shots, cameras, kicks, lens blur, the pack-ice gyre, the suitcase path.
  - `ship.ts`: the steamer, built procedurally (lofted hull, deckhouse, funnel, masts, rigging, ladder, glowing portholes, snow skirt).
  - `world.ts`:
    - sky, sea and pack ice (shader freeze edge, leads, floes, heave slabs)
    - shore, hut and mountains
    - ski plane, dog sled
    - airport carousel hall
    - blizzard and smoke
  - `cast.ts`: who stands where in each shot.
  - `toon.ts`: added knit caps, a captain's cap, fur-ruff parka hoods, a harpoon, fur bales, a suitcase, sled dogs and a seal.
- **Sound:** `remotion/audio/baychimo_audio.py`.
  - Original score: pizzicato, glockenspiel, music box, pad, timpani.
  - SFX: wind, snow steps, ice cracks, engine, plane, hammer, seal, dogs, airport.
  - Mix: music −10 LU under the voice and ducked 3 dB while words are spoken; SFX −6 dB; voice unchanged.
  - Outputs go to `remotion/out/baychimo/audio/` (mix, stems, `cues.md`).

## How to re-render
- **Stills:** `node scripts/stills.mjs out/x/a_ 100,400 0.5` (swangle GL, no GPU needed).
- **Debug camera:** `node scripts/dbgcam.mjs out.jpg <frame> '[{"pos":[..],"look":[..]}]'`.
- **Final picture:** `remotion/scripts/render_chunks.sh` renders 250-frame chunks and can resume. Delete a chunk in `out/baychimo/chunks/` to re-render only that range. The single-pass equivalent is `npx remotion render src/index.ts BaychimoShort out/baychimo/video.mp4 --codec h264 --crf 16 --scale 1.3333333333333333 --gl swangle --concurrency 3`. Use the full-precision scale: 1.3333 gives a non-integer height. About 2 s per frame on 4 CPUs.
- **Mux:** `ffmpeg -i video.mp4 -i audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k final.mp4`

## Verifier
- **Round 1 (Opus max):** colour day 5, golden 7, lighting 6, ink 7, textures 4, characters 6, depth 7, composition 5, story 6.
- **Fixed after round 1:**
  - warm cream snow with periwinkle shade
  - framing of edge-cut characters
  - plane bottoms
  - hunter on the ladder rungs
  - a slower, readable throw
  - sun disc in the golden shots
  - focus on the hook crew
  - airport wall dressing
  - the suitcase kept visible

- **Final audit (Opus max, on the 2K render):** colour day 7, golden 8, lighting 7, ink 7, textures 5, characters 7, depth 7, composition 6, story 7.
- **Fixed after the final audit:**
  - **Blockers:**
    - In the blizzard, the world ink and the clouds now fade with the snow. Before, the ship stayed a crisp line drawing and a black line crossed the ice.
    - The waiting hunters now walk to the ladder instead of teleporting onto it.
  - **Frame 1461:** the ice and sea planes are subdivided. Software GL had dropped the whole two-triangle ice plane for one frame.
- **Final QA:** 1440x2560, 30 fps, 1982 frames (66.07 s), −15.2 LUFS, −1.2 dBTP. No black, frozen or unplanned white frames. Every remaining frame-diff spike is a planned cut or kick.

## Known gaps (nice-to-have, from the final audit)
- Some characters are partly cut by the frame edge:
  - 490-544: the left edge in the hut build.
  - 620-642 and 880-904: the right edge.
  - 1764-1795 and 1826-1838.
- Narration and picture don't always match:
  - "Freezes solid" plays over open sea until about 376.
  - "Sled out" has no sled.
  - "Storm" has a calm sky.
  - "Round and round the same coast" shows no coast.
- The plane is on screen for only about 9 frames (425-434).
- The bow has a red smear, and the forestay ends in mid-air (880-904).
- The seal hunter's shadow is detached from his feet (700-783).
- The ice-plate texture reads a little hexagonal, and the floes are faceted.
