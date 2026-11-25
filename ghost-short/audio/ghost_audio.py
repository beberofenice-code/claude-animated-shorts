# Sound for "The Ghost Ship Mary Celeste": an original score (sea-shanty 6/8 in D minor -> mystery -> comic -> sunset ->
# a light D-major waltz for the doctor), synthesized SFX timed to the picture (studio/src/videos/ghost/story.ts + cast.ts)
# and the mix: voice unchanged, music ducked under the words, standard levels (music +3 dB, SFX -6 dB relative to the
# bridge baseline: music bed ~ -10 LU and SFX ~ -15 LU under the voice), master -15 LUFS, true peak <= -1.2 dBTP.
# Writes ../mix.wav (exactly TOTAL frames long, 48 kHz stereo 24-bit), stems and cues.md.
import os
import json
import numpy as np
from scipy import signal
from dsp import SR, ns, tt, dbg, rng, lp, hp, bp, colored, smooth_noise, fades, pan, st, place, widen, read_wav, write_wav, integrated, true_peak
import sfx_gen as G
import instruments as I

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FPS, TOTAL = 30, 2064
DUR = TOTAL / FPS
N = ns(DUR)
fr = lambda f: f / FPS

# ---------------- picture timeline (mirrors story.ts) ----------------
SHOTS = [(1, 0, 180, "sea"), (2, 180, 228, "sea"), (3, 228, 290, "hold"), (4, 290, 388, "sea"), (5, 388, 450, "sea"), (6, 450, 505, "sea"),
         (7, 505, 537, "sea"), (8, 537, 581, "sea"), (9, 581, 605, "sea"), (10, 605, 649, "hold"), (11, 649, 681, "hold"), (12, 681, 771, "sea"),
         (13, 771, 963, "sea"), (14, 963, 1107, "hold"), (15, 1107, 1160, "hold"), (16, 1160, 1272, "sea"), (17, 1272, 1407, "sea"),
         (18, 1407, 1530, "house"), (19, 1530, 1597, "sea"), (20, 1597, 1640, "sea"), (21, 1640, 1668, "sea"), (22, 1668, 1710, "sea"),
         (23, 1710, 1745, "sea"), (24, 1745, 1830, "study"), (25, 1830, 1889, "study"), (26, 1889, 1962, "study"), (27, 1962, TOTAL, "study")]
CUTS = [104, 145, 180, 228, 290, 362, 388, 450, 505, 537, 581, 605, 649, 681, 739, 771, 830, 893, 963, 996, 1080, 1107, 1160, 1198,
        1272, 1325, 1369, 1407, 1484, 1530, 1597, 1640, 1668, 1710, 1745, 1830, 1889, 1904, 1962]
FLASH = fr(180)
SPARK, SLAM, SNAP, MODEL_BOAT = 41.72, 49.94, 54.8, 61.62
WORDS = json.load(open(os.path.join(ROOT, "voice", "words.json")))

def place_at(buf, x, t, db=0.0, p=0.0):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = pan(x, p)
    place(buf, x, t, dbg(db))

def place_span(buf, x, a, b, db=0.0, fin=0.4, fout=0.6):
    x = st(np.asarray(x, float))[:, : ns(b - a)]
    n = x.shape[1]
    e = np.ones(n); fi, fo = min(n // 2, ns(fin)), min(n // 2, ns(fout))
    if fi: e[:fi] = np.linspace(0, 1, fi) ** 2
    if fo: e[-fo:] = np.linspace(1, 0, fo) ** 2
    place(buf, x * e[None, :], a, dbg(db))

def spans(kind):
    out = []
    for _, a, b, k in SHOTS:
        if k != kind: continue
        if out and abs(out[-1][1] - fr(a)) < 1e-6: out[-1] = (out[-1][0], fr(b))
        else: out.append((fr(a), fr(b)))
    return out

# ================================================================ SFX
def sfx():
    r = rng(7)
    S = np.zeros((2, N))
    cues = []
    def cue(t, name, x, db=0.0, p=0.0):
        place_at(S, x, t, db, p); cues.append((t, name, db))
    # ---- ambiences per place ----
    for a, b in spans("sea"):
        golden = a >= 53.2
        bed = G.water_bed(b - a + 0.1, r, close=0.55, slosh_rate=0.6)
        place_span(S, hp(bed, 120), a, b, -10)
        place_span(S, G.breeze(b - a + 0.1, r, 1.0, 0.25, 700 if golden else 1000), a, b, -14 if golden else -16)
        place_span(S, widen(G.flag_flutter(b - a + 0.1, r), r, 9, 0.6), a, b, -24)
        tm = a + r.uniform(0.3, 1.2)
        while tm < b - 0.8: # hull and rigging creaks
            cue(tm, "ship creak", G.creak(r.uniform(0.35, 0.8), r, r.uniform(70, 110), r.uniform(120, 190)), -15 + r.uniform(-3, 2), r.uniform(-0.6, 0.6))
            tm += r.uniform(1.2, 2.6)
    for a, b in spans("hold"):
        place_span(S, lp(G.water_bed(b - a + 0.1, r, 0.4, 0.5), 500), a, b, -9)
        place_span(S, lp(G.breeze(b - a + 0.1, r, 1.0, 0.2, 400), 300), a, b, -18)
        tm = a + 0.4
        while tm < b - 0.8:
            cue(tm, "hold timber groan", lp(G.creak(r.uniform(0.6, 1.1), r, 55, 95), 1800), -12, r.uniform(-0.5, 0.5)); tm += r.uniform(1.5, 2.8)
    for a, b in spans("house"):
        place_span(S, G.bird_chirps(b - a + 0.1, r, 0.6), a, b, -16)
        place_span(S, G.breeze(b - a + 0.1, r, 0.6, 0.2, 800), a, b, -22)
    for a, b in spans("study"):
        place_span(S, lp(G.breeze(b - a + 0.1, r, 0.4, 0.1, 300), 250), a, b, -26)
        k = 0
        while a + k * 1.0 < b - 0.05: # mantel clock
            tick = fades(bp(r.standard_normal(ns(0.03)), 2500, 6000, 2) * np.exp(-tt(0.03) / 0.006), 0.0, 0.01)
            cue(a + k * 1.0 + 0.11, "clock tick" if k % 2 else "clock tock", tick * (1 if k % 2 else 0.7), -20, 0.55); k += 1
    # ---- camera whooshes on the hard cuts (soft, the reference cuts carry a little air) ----
    for f in CUTS:
        t = fr(f)
        cue(t - 0.12, "cut whoosh", G.whoosh(0.35, r, 0.6, 400, 2400, 0.7, 0.15, 0.1), -24, r.uniform(-0.3, 0.3))
    # ---- events ----
    cue(FLASH - 0.35, "flash whoosh", G.whoosh(0.7, r, 0.5, 300, 3000, 0.8, 0.3, 0.2), -10)
    cue(FLASH, "flash shimmer", I.triangle(0.8, r, 1.4, 2637.0), -14)
    cue(4.83, "wheel spins", G.creak(1.1, r, 140, 220), -12, 0.2)
    cue(16.8, "wheel spins", G.creak(1.0, r, 160, 260), -9, 0.1)
    cue(13.0, "spyglass", G.clink(r, 2400, 0.25, 0.8), -12, 0.3)
    cue(14.4, "spyglass squeak", G.creak(0.3, r, 300, 420), -16, 0.3)
    for t in (18.55, 18.9, 19.15, 19.45): cue(t, "boots on deck", G.stroll_step(r, 0.4), -8, 0.4)
    cue(19.35, "sails flap", lp(G.whoosh(0.6, r, 0.3, 150, 900, 0.9, 0.3, 0.1), 1200), -8)
    cue(21.6, "barrel pat", G.hammer_hit(r, 0.25), -14, 0.2)
    cue(24.0, "empty chocks thud", I.timpani(73.4, 0.7, r, 1.2), -10)
    for t in (35.3, 35.43): cue(t, "hollow knock", bp(G.wood_crack(r), 120, 1500), -9, -0.2)
    for i in range(4):
        for k in range(3):
            t = 36.0 + (i * 0.27 + k) / 0.9 - 0.15
            if 35.9 < t < 36.9: cue(t, "drip", G.bubbles(0.12, r, 30, 1800, 3800, (0.004, 0.01), rise=(15, 30)) * 3, -14, -0.3)
    hiss = lambda d: bp(colored(ns(d), r, 0.3), 2000, 9000, 1) * (0.6 + 0.4 * smooth_noise(ns(d), r, 0.8))
    place_span(S, widen(hiss(3.0), r, 9, 0.8), 37.0, 39.6, -20, 1.2, 0.8)
    place_span(S, widen(hiss(2.6), r, 9, 0.8), 38.8, 41.6, -24, 0.8, 0.4)
    spark = bp(r.standard_normal(ns(0.35)), 2500, 9000, 2) * np.exp(-tt(0.35) / 0.05) * (r.random(ns(0.35)) < 0.08)
    cue(SPARK - 0.02, "spark crackle", spark * 6, -6, 0.3)
    cue(SPARK, "spark tink", G.clink(r, 3600, 0.3, 1.0), -10, 0.3)
    for t in (42.9, 43.3, 43.8): cue(t, "climbing into the boat", G.stroll_step(r, 0.2), -10, -0.2)
    cue(43.6, "boat rocks", lp(G.splash_big(r), 1200) * 0.3, -14)
    cue(44.2, "rope creak", G.creak(1.2, r, 90, 140), -12, 0.2)
    for k in range(6): cue(47.28 + k * 0.19, "running slippers", G.stroll_step(r, 0.8), -12 + k, 0.0)
    beep_t = np.arange(ns(0.16)) / SR
    beep = np.sin(2 * np.pi * 3150 * beep_t) * fades(np.ones(len(beep_t)), 0.004, 0.01)
    t = 48.15
    while t < SLAM + 1.2:
        cue(t, "smoke alarm beep", beep * (1 if t < SLAM else 0.45), -21, 0.45); t += 0.3
    cue(SLAM - 0.02, "door slam", G.wood_crack(r), -2, 0.1)
    cue(SLAM, "door slam thump", I.timpani(55, 1.0, r, 1.4), -6)
    cue(51.3, "rope in the water", lp(G.water_bed(1.6, r, 0.9, 1.5), 1500), -10)
    place_span(S, G.breeze(3.0, r, 1.0, 0.6, 1500), 53.2, 56.0, -6, 0.4, 1.2)
    cue(53.4, "sails fill", lp(G.whoosh(1.0, r, 0.3, 100, 700, 1.0, 0.4, 0.1), 900), -2)
    cue(SNAP - 0.25, "rope strains", G.creak(0.3, r, 160, 260), -8, 0.2)
    cue(SNAP - 0.01, "rope snap", hp(G.wood_crack(r), 400), -4, 0.1)
    cue(SNAP, "rope whip", G.whoosh(0.45, r, 0.25, 600, 4000, 0.6, 0.15, 0.3), -8, -0.3)
    cue(55.3, "rope splash", G.splash_big(r) * 0.4, -14, -0.4)
    cue(55.6, "ship sails off", G.whoosh(1.6, r, 0.4, 200, 1200, 1.0, 0.5, 0.2), -12)
    cue(fr(1745) - 0.3, "time shimmer", I.triangle(0.7, r, 1.6, 1975.5), -14)
    pen = bp(colored(ns(2.4), r, 0.2), 1800, 7000, 2) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * tt(2.4)) ** 8) * (0.4 + 0.6 * smooth_noise(ns(2.4), r, 2))
    place_span(S, pen, 58.6, 61.0, -21, 0.1, 0.3)
    cue(MODEL_BOAT - 0.04, "magic pop", I.glock(I.m2f(98), 0.6, r, 1.0) + lp(r.standard_normal(ns(1.0)), 1200) * np.exp(-tt(1.0) / 0.03) * 0.4, -10, 0.25)
    whir = bp(colored(ns(1.9), r, 0.5), 600, 3000, 1) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * tt(1.9)))
    place_span(S, whir, fr(1904), fr(1904) + 1.8, -18, 0.2, 0.6)
    return S, cues

# ================================================================ score
B8 = 1 / 3            # 6/8 at dotted-quarter = 60: an eighth is 1/3 s, a bar 2 s
def chord(root, kind="m"):
    return [root, root + (3 if kind == "m" else 4), root + 7]

def score():
    r = rng(11)
    M = np.zeros((2, N))
    def nt(x, t, db=0.0, p=0.0): place_at(M, x, t, db, p)
    # A hook 0-6: mystery (pad + music box motif), swell into the flash
    nt(I.pad([I.m2f(m) for m in [38, 45, 53]], 5.6, 0.5, r, att=1.4, rel=0.8, warm=700), 0.0, -4)
    for k, (m, d) in enumerate([(74, 0.0), (69, 0.66), (72, 1.33), (70, 2.0), (69, 2.66), (65, 3.33), (67, 4.0), (69, 4.66)]):
        nt(I.musicbox(I.m2f(m), 0.55, r, 1.6), d + 0.1, -6, 0.2)
    nt(I.timpani(I.m2f(38), 0.5, r, 2.0), 4.9, -6); nt(I.timpani(I.m2f(38), 0.7, r, 2.0), 5.45, -4)
    nt(I.cymbal(0.5, r, 2.6), 5.9, -10)
    # B 6-25.7: the shanty (pizzicato bass + glock tune), 6/8
    prog = [(50, "m"), (50, "m"), (45, "M"), (50, "m"), (46, "M"), (43, "m"), (45, "M"), (50, "m")]
    tune = [[74, None, 72, 74, None, 69], [72, 70, 69, 65, None, 67], [69, None, 67, 69, 72, 73], [74, None, None, 69, None, None],
            [70, None, 72, 74, None, 70], [67, None, 69, 70, None, 67], [69, 71, 73, 76, None, 73], [74, None, None, None, None, None]]
    t0 = 6.0
    for bar in range(10):
        tb = t0 + bar * 2
        if tb > 22.6: break
        root, kind = prog[bar % 8]
        ch = chord(root, kind)
        for e8, m, v in [(0, root - 12, 0.9), (3, root - 5, 0.7)]:
            nt(I.pluck(I.m2f(m), v, r, 0.9, 0.4), tb + e8 * B8, -3, -0.2)
        for e8 in (1, 2, 4, 5):
            nt(I.pluck(I.m2f(ch[1] + 12), 0.35, r, 0.5, 0.6) + I.pluck(I.m2f(ch[2] + 12), 0.3, r, 0.5, 0.6), tb + e8 * B8, -9, 0.15)
        if 2 <= bar:
            for e8, m in enumerate(tune[(bar - 2) % 8]):
                if m: nt(I.glock(I.m2f(m), 0.5, r, 1.2), tb + e8 * B8, -9, 0.3)
        if 3 <= bar: nt(I.brush(0.4, r, 0.3), tb + 3 * B8, -16)
    # 22.6-25.7: the only things missing: sparse, tense
    nt(I.pad([I.m2f(m) for m in [38, 44, 53]], 3.2, 0.45, r, att=0.4, rel=0.6, warm=600), 22.6, -6)
    for k in range(9): nt(I.pluck(I.m2f(62 if k % 2 else 63), 0.4, r, 0.4, 0.3), 22.7 + k * 0.33, -10, -0.3)
    # C 25.7-32.1: Luckily (bright staccato) / Unluckily (the same, minor and slower), then a question
    for k, m in enumerate([62, 66, 69, 74, 69, 66]): nt(I.pluck(I.m2f(m), 0.6, r, 0.4, 0.7), 25.85 + k * 0.25, -6, 0.2)
    for k, m in enumerate([62, 65, 68, 71, 68, 65]): nt(I.pluck(I.m2f(m), 0.6, r, 0.5, 0.5), 27.9 + k * 0.3, -6, -0.2)
    nt(I.pad([I.m2f(m) for m in [43, 46, 50, 53]], 2.4, 0.4, r, att=0.5, rel=0.8, warm=700), 29.8, -6)
    nt(I.vibes(I.m2f(76), 0.5, r, 2.0), 31.3, -8)
    # D 32.1-42.4: the theory: vibes arpeggios over Dm - Bb - Gm - A, building to the spark
    arp = [(50, "m"), (46, "M"), (43, "m"), (45, "M"), (50, "m"), (46, "M"), (43, "m"), (45, "M"), (45, "M"), (45, "M")]
    for k, (root, kind) in enumerate(arp):
        tb = 32.2 + k * 0.95
        if tb > SPARK - 0.2: break
        ch = chord(root + 12, kind)
        for j, m in enumerate([ch[0], ch[1], ch[2], ch[1] + 12]):
            nt(I.vibes(I.m2f(m), 0.42 + 0.03 * k, r, 1.2), tb + j * 0.237, -9, 0.25 * (-1) ** j)
        nt(I.pluck(I.m2f(root - 12), 0.7, r, 1.0, 0.3), tb, -6)
    nt(I.pad([I.m2f(m) for m in [45, 49, 52, 57]], 4.2, 0.5, r, att=2.5, rel=0.3, warm=900), 37.5, -8)
    nt(I.timpani(I.m2f(45), 1.0, r, 2.0), SPARK, -2); nt(I.cymbal(0.7, r, 2.0), SPARK, -10)
    # E 42.4-47: into the boat: a gentle rocking waltz (D minor 3/4 at 0.5 s beats)
    for k in range(9):
        tb = 42.5 + k * 0.5
        root = [50, 50, 50, 46, 46, 46, 45, 45, 45][k]
        nt(I.pluck(I.m2f(root - 12 if k % 3 == 0 else root + 3 + (k % 3) * 4), 0.55 if k % 3 == 0 else 0.35, r, 0.7, 0.4), tb, -6 if k % 3 == 0 else -10)
    for k, m in enumerate([69, 70, 69, 67, 65]): nt(I.musicbox(I.m2f(m), 0.45, r, 1.4), 43.0 + k * 0.75, -9, 0.2)
    # F 47-50: the smoke alarm: frantic comic glock, cut dead by the slam
    for k in range(int((SLAM - 47.1) / 0.125)):
        m = [74, 77, 81, 77][k % 4] + (2 if k >= 12 else 0)
        nt(I.glock(I.m2f(m), 0.35, r, 0.3), 47.1 + k * 0.125, -12, 0.3 * (-1) ** k)
    for k in range(int((SLAM - 47.1) / 0.25)): nt(I.pluck(I.m2f([38, 45][k % 2]), 0.6, r, 0.3, 0.3), 47.1 + k * 0.25, -8)
    # G 51-58.1: golden: pad swell, the snap, a falling music-box line
    nt(I.pad([I.m2f(m) for m in [46, 53, 58, 62]], 2.3, 0.45, r, att=1.2, rel=0.6, warm=900), 51.0, -6)
    nt(I.pad([I.m2f(m) for m in [41, 48, 57, 60]], 1.6, 0.5, r, att=0.4, rel=0.5, warm=1100), 53.3, -5)
    nt(I.timpani(I.m2f(45), 0.9, r, 2.2), SNAP, -3); nt(I.cymbal(0.8, r, 3.0), SNAP, -9)
    nt(I.pad([I.m2f(m) for m in [43, 50, 55, 58]], 3.2, 0.5, r, att=0.3, rel=1.0, warm=800), 55.0, -6)
    for k, m in enumerate([74, 72, 70, 69, 67, 65, 64, 62]): nt(I.musicbox(I.m2f(m), 0.5, r, 1.8), 55.2 + k * 0.36, -7, 0.2)
    # H 58.1-68.8: the doctor: a light D-major waltz (3/4, beat 0.46 s), ends on D with a triangle on "Doyle"
    beat = 0.46
    wprog = [(50, "M"), (55, "M"), (57, "M"), (50, "M"), (55, "M"), (50, "M"), (57, "M"), (50, "M")]
    wtune = [[78, 81, 78], [79, 76, 74], [76, 73, 69], [74, None, 78], [79, 83, 81], [78, 74, 76], [73, 76, 73], [74, None, None]]
    t0 = 58.3
    for bar in range(8):
        tb = t0 + bar * 3 * beat
        root, kind = wprog[bar % 8]
        ch = chord(root, kind)
        nt(I.pluck(I.m2f(root - 12), 0.8, r, 0.9, 0.4), tb, -4, -0.2)
        for j in (1, 2): nt(I.pluck(I.m2f(ch[1] + 12), 0.32, r, 0.4, 0.6) + I.pluck(I.m2f(ch[2] + 12), 0.28, r, 0.4, 0.6), tb + j * beat, -10, 0.2)
        for j, m in enumerate(wtune[bar]):
            if m: nt(I.glock(I.m2f(m - 12), 0.45, r, 1.3), tb + j * beat, -8, 0.3)
    tend = t0 + 8 * 3 * beat
    nt(I.pluck(I.m2f(38), 0.9, r, 2.0, 0.4), max(tend, 66.6), -3)
    nt(I.pad([I.m2f(m) for m in [50, 54, 57, 62]], 2.0, 0.45, r, att=0.3, rel=1.2, warm=1000), 66.6, -6)
    nt(I.triangle(0.8, r, 2.0, 2637.0), 67.55, -10)
    return M

# ================================================================ mix
def duck_curve(depth=-3.0, pre=0.08, post=0.15):
    g = np.zeros(N)
    for w in WORDS:
        g[ns(max(0, w["s"] - pre)): ns(min(DUR, w["e"] + post))] = depth
    k = ns(0.12)
    return np.convolve(g, np.ones(k) / k, mode="same")

def limiter(x, ceil_db=-1.2):
    c = dbg(ceil_db)
    up = signal.resample_poly(x, 4, 1, axis=1)
    pk = np.abs(up).max(axis=0).reshape(-1, 4).max(axis=1)[: x.shape[1]]
    pk = np.pad(pk, (0, x.shape[1] - len(pk)))
    g = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    g = minimum_filter1d(g, ns(0.003) * 2 + 1)
    rel = np.exp(-1 / (0.08 * SR)); out = g.copy()
    for i in range(1, len(out)):
        if out[i] > out[i - 1]: out[i] = out[i - 1] * rel + out[i] * (1 - rel)
    return x * uniform_filter1d(out, ns(0.002))[None, :]

def lufs(x): return integrated(x)

if __name__ == "__main__":
    v, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav")); assert sr == SR
    v = st(v)[:, :N]; v = np.pad(v, ((0, 0), (0, N - v.shape[1])))
    print("voice", round(lufs(v), 2))
    m = score(); s, cues = sfx()
    m = m * dbg(duck_curve())[None, :]
    Lv = lufs(v)
    m *= dbg(Lv - 10.0 - lufs(m))            # music bed ~10 LU under the voice (the +3 dB standard)
    s *= dbg(Lv - 15.0 - lufs(s))            # SFX ~15 LU under the voice (the -6 dB standard)
    mix0 = v + m + s
    Gm = -15.0 - lufs(mix0)
    for it in range(4):
        y = limiter(mix0 * dbg(Gm)); L = lufs(y)
        if abs(L + 15.0) < 0.05: break
        Gm += -15.0 - L
    y = y[:, :N]
    write_wav(os.path.join(ROOT, "mix.wav"), y)
    for nm, x in (("voice", v), ("music", m), ("sfx", s)): write_wav(os.path.join(ROOT, f"stem_{nm}.wav"), x * dbg(Gm))
    rep = [f"# Ghost Ship sound cues\n", f"- mix: {lufs(y):.2f} LUFS integrated, true peak {true_peak(y):.2f} dBTP, {y.shape[1] / SR:.3f} s\n",
           f"- stems at mix gain: voice {lufs(v * dbg(Gm)):.1f}, music {lufs(m * dbg(Gm)):.1f}, sfx {lufs(s * dbg(Gm)):.1f} LUFS\n",
           "- voice: gain only. music ducked -3 dB under every word (words.json).\n\n| time s | frame | cue | dB |\n|---|---|---|---|\n"]
    rep += [f"| {t:.2f} | {round(t * FPS)} | {n} | {d:+.1f} |\n" for t, n, d in sorted(cues)]
    open(os.path.join(HERE, "cues.md"), "w").write("".join(rep))
    print("".join(rep[:3]))
