# Bakit mahilig tayong mga Pilipino sa pelikula? — production notes
- Final: `pelikula_final_2k.mp4` (not in git, 145 MB): 1440x2560, 30 fps, 2100 frames, 70.0 s, H.264 CRF 16 + AAC 256k; -15.0 LUFS, -1.2 dBTP.
- Voice: ElevenLabs eleven_v4, voice "Pocholo Gonzales - TagaKuwento Biography" (jPdyrzVQ46VvhaOBWVjL), take A, atempo 1.06; word times from ElevenLabs Scribe (voice/words.json).
- Picture: remotion/src/videos/pelikula (composition PelikulaShort). Render: remotion/scripts/render_final.sh (10 resumable chunks, ~3.5 h on CPU/SwiftShader).
- Concat gotcha: chunked mp4s concat with timestamp gaps; re-time via raw h264 (`-bsf:v h264_mp4toannexb`, then `-r 30`) before muxing the mix.
- Crossfade gotcha: InkPass has no dispose(); unmount guard in Pelikula.tsx.
- Sound: shorts/pelikula/audio (music.py original score, sfx.py synthesized SFX, mix.py). Re-run `python3 mix.py` after any timing change.
- QA: no black/white/frozen frames; flagged "pops" f553-651 are the film cans landing (planned), f994 the family standing up (planned).
- Verifier fixes applied: barong, poster hole, dark cinemas, ballot box, unlit flags, lechon/queso de bola, warm heat shot, pastel town. Text labels it suggested were skipped (no-text rule).
