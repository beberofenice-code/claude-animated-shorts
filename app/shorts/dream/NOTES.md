# Dream short: production notes (2026-11-26)
- Final: shorts/dream/Ang_Batang_Nanaginip_ng_Tulay_2K.mp4 (gitignored, 232 MB): 1440x2560, 30 fps, 2199 frames,
  73.3 s, -15.3 LUFS, -1.0 dBFS peak. Rebuild: scripts/render_chunks.sh -> concat parts -> mux shorts/dream/audio/mix.wav.
- QA (scripts/short_qa.py, shots in out/dream/shots.json): no black/white/frozen frames; all pops are planned camera
  cuts (CAMS cut keys) or impact shakes (pan hits ~1055, hammer ~1891).
- Render lessons (headless container, software GL):
  - --concurrency=4 with --gl=swangle CORRUPTED many frames (tiled blank frames, white character cards). Render with
    --concurrency=1: clean, and faster per frame (~5 s/frame at 2K, ~2.3 h total in 250-frame chunks).
  - Crossfade canvases unmount mid-render: the ink pass dispose is guarded (Dream.tsx).
  - Frame 982 rendered the cobble quay as grass for exactly one frame (camera at z -36.6, near the quay quad seam at
    z -36.5; reproducible, not a depth-precision issue: polygonOffset did not help). Patched in the final by
    ffmpeg freezeframes (982 <- 981). Never splice through PNG: it changes the colour range.
- Final Opus audit: f982 fixed. "Tourists" look like soldiers by design (line 12: the soldiers cross "parang mga
  turista"). Left as is (low): the sign is cut by the right edge in the bank shot, the pier wall fills the right edge
  at f349-414, there's empty deck below the low-angle march, Nell is small at f748-759, and the market wide shot
  has a bare field.
