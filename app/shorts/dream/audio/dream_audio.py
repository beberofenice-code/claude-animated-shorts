# Sound of "Ang Batang Nanaginip ng Tulay": synthesized SFX cues + an original score, both timed to the picture
# (app/src/videos/dream/story.ts + cast.ts, mirrored below), mixed with the Tagalog voice.
# Standard mix: voice unchanged, music bed ~-10 LU under the voice (+3 dB house standard), ducked 3 dB under speech,
# SFX stem -6 dB. Master -15 LUFS integrated, own true-peak limiter <= -1.2 dBTP, 48 kHz stereo 24-bit, exact length.
# Writes mix.wav, stem_voice/music/sfx.wav and cues.md.  Run: python3 dream_audio.py
import os
import sys
import json
import numpy as np
from scipy import ndimage, signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from dsp import (SR, ns, tt, rng, pan, place, st, fades, dbg, lp, hp, bp, make_ir, convolve_st, integrated, momentary_max,
                 true_peak, read_wav, write_wav, modal, peq)
import instruments as I
import sfx_gen as G

FPS = 30
TOTAL = 2199
DUR = TOTAL / FPS
N = ns(DUR)
fr = lambda f: f / FPS
WORDS = json.load(open(os.path.join(HERE, "..", "voice", "words.json"), encoding="utf-8"))

# ---------------- picture mirror (story.ts) ----------------
SNAP, DROP0, DROP1 = 34.62, 36.35, 36.95
SHOTS = {1: (0, 80), 2: (80, 160), 3: (160, 415), 4: (415, 608), 5: (608, 760), 6: (760, 889), 7: (889, 1007),
         8: (1007, 1109), 9: (1109, 1274), 10: (1274, 1412), 11: (1412, 1513), 12: (1513, 1733), 13: (1733, 1910), 14: (1910, TOTAL)}
FLASHES = [fr(160), fr(606)]
WAKE = 4.083
HOOK_DROP0, HOOK_DROP1 = 1.05 / 0.85, (DROP1 - DROP0 + 1.05) / 0.85
D_SNAP = 19.067
D_DROP0, D_DROP1 = D_SNAP + (DROP0 - SNAP) / 3, D_SNAP + (DROP1 - SNAP) / 3
SHOUT, GRAB, BANG, LAUGH, DANCE, SLOPPY, LOSE, CALM, QUIET = 29.617, 33.783, 35.15, 36.983, 38.483, 40.517, 43.117, 44.383, 45.583
PAN_HITS = [35.15, 35.62, 35.98, 36.46, 36.71]
HITS = [61.35, 62.117, 62.983]
SWING_T, PUSH0 = 1.55, 52.3
PUSHES = [52.3, 53.85, 55.17]
real_tau = lambda t: t - 7.85


def _lin(pts, x):
    return float(np.interp(x, [p[0] for p in pts], [p[1] for p in pts]))


AMP = [(14.85, 0), (17.8, 0.07), (21.4, 0.13), (27.4, 0.26), (33.0, 0.46), (SNAP, 0.55), (SNAP + 0.35, 0.0)]
amp = lambda tau: _lin(AMP, tau) if tau >= AMP[0][0] else 0.0
stomp = lambda tau: _lin([(21.4, 1.0), (27.4, 1.35), (33, 1.5)], tau)
sm = lambda x: (lambda u: u * u * (3 - 2 * u))(min(1.0, max(0.0, x)))
amp_real = lambda t: min(0.3, amp(real_tau(t))) * (1 - 0.95 * sm((t - LOSE + 0.3) / (QUIET - LOSE + 0.6)))


def hh(i, s=0):
    v = np.sin(i * 127.1 + s * 311.7) * 43758.5453
    return v - np.floor(v)


def desync(t, i):
    h = np.sin(i * 91.7 + 3.1) * 43758.5453
    r = h - np.floor(h)
    return sm((t - (SLOPPY - 0.5 + 3.2 * r)) / 1.6)


def swing_amp(t):
    return 8 + 12 * sm((t - PUSHES[0]) / 0.3) + 12 * sm((t - PUSHES[1]) / 0.3) - 15 * sm((t - PUSHES[2]) / 0.35) - 7 * sm((t - 55.6) / 1.6)


# camera -> column distance (m) per camera key (frame from, frame to, metres)
COL_DIST = [(160, 242, 70), (242, 349, 3.6), (349, 415, 45), (415, 488, 11), (488, 530, 3.5), (530, 566, 9.5), (566, 608, 20),
            (608, 730, 200), (730, 760, 40), (760, 833, 11), (833, 889, 3.5), (889, 925, 28), (925, 974, 4.7), (974, 1007, 18),
            (1007, 1109, 22), (1109, 1147, 3.5), (1147, 1195, 14), (1195, 1274, 13), (1274, 1367, 9.5), (1367, 1412, 6)]


def col_dist(t):
    f = t * FPS
    for a, b, d in COL_DIST:
        if a <= f < b:
            return d
    return None


def dist_fx(d):
    d = max(d, 3.5)
    return -14.0 * np.log10(d / 3.5), float(np.clip(17000 * (3.5 / d) ** 0.55, 1500, 17000))


# ================================================================ SFX
class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))
        self.log = []

    def add(self, t, y, db=0.0, p=0.0, lpf=None, name=None):
        y = np.asarray(y, float)
        if lpf and lpf < 16000:
            y = lp(y, lpf, 2)
        if y.ndim == 1:
            y = pan(y, p)
        place(self.x, y, t, dbg(db))
        if name:
            self.log.append((t, name, db))


def clang(r, big=1.0):
    """iron frying pan struck by a wooden spoon: bright inharmonic ring + knock"""
    d = 1.4
    t = tt(d)
    ring = modal(d, [(r.uniform(395, 425), 1.0, 0.42), (r.uniform(990, 1040), 0.75, 0.3), (1720, 0.55, 0.2), (2640, 0.4, 0.13),
                     (3870, 0.25, 0.08), (5300, 0.12, 0.05)], r, glide=0.01)
    knock = bp(r.standard_normal(len(t)), 600, 4500, 1) * np.exp(-t / 0.006) * 1.4
    return fades((ring + knock) * big, 0.0, 0.15)


def laugh(r, base, dur, rate=None):
    """one man's 'ha-ha-ha': vowel 'a' pulses on a falling pitch"""
    rate = rate or r.uniform(4.3, 5.8)
    n = ns(dur)
    t = np.arange(n) / SR
    f0 = base * (1.25 - 0.3 * t / dur) * (1 + 0.06 * np.sin(2 * np.pi * rate * t))
    forms = G.vowel_track(n, [(0, "a"), (dur, "A")])
    puls = np.clip(np.sin(np.pi * ((t * rate) % 1)) * 1.6, 0, 1) ** 1.5
    env = np.clip(t / 0.04, 0, 1) * np.clip((dur - t) / 0.25, 0, 1) * (1 - 0.4 * t / dur)
    return G.vox(f0, forms, puls * env, r, r.uniform(0.95, 1.08), tilt=1.05, breath=0.4)


def gasp(r, base=330, scale=1.35):
    d = 0.42
    n = ns(d)
    t = np.arange(n) / SR
    air = bp(r.standard_normal(n), 900, 5200, 1) * np.clip(t / 0.03, 0, 1) * np.exp(-t / 0.18) * 0.8
    v = G.vox(base * (1.2 - 0.25 * t / d), G.vowel_track(n, [(0, "a"), (d, "o")]), np.clip(t / 0.02, 0, 1) * np.exp(-t / 0.12) * 0.5,
              r, scale, tilt=1.0, breath=0.7)
    return fades(air + v, 0.002, 0.05)


def kid_step(r):
    return hp(G.stroll_step(r, 0.25), 220) * 0.55


def build_sfx():
    S, D = Bus(), Bus()    # S = normal, D = dream (gets a muffled hall later)
    r = rng(7)
    # ---- ambience beds ----
    def bed(a, b, birds=0.5, river=0.0, breeze=1.0, bus=None, db=-30.0, seed=1):
        rr = rng(seed)
        dur = b - a
        x = G.breeze(dur, rr, breeze) * 0.6
        if birds:
            x = x + pan(G.bird_chirps(dur, rr, birds), rr.uniform(-0.5, 0.5)) * 0.5
        if river:
            x = x + G.water_bed(dur, rr, 0.4) * river
        x = fades(x, 0.4, 0.4)
        (bus or S).add(a, x, db)
    bed(fr(0), fr(80), 0.0, 0.7, 0.8, D, -28, 1)
    bed(fr(80), fr(160), 0.25, 0.0, 0.3, S, -40, 2)          # bedroom: morning birds outside
    bed(fr(160), fr(415), 0.6, 0.3, 1.0, S, -30, 3)
    bed(fr(415), fr(608), 0.0, 0.6, 1.0, D, -29, 4)
    bed(fr(608), fr(760), 0.5, 0.0, 1.0, S, -30, 5)
    bed(fr(760), fr(1412), 0.3, 0.5, 1.0, S, -31, 6)
    bed(fr(1412), fr(1733), 0.8, 0.2, 0.7, S, -32, 7)
    bed(fr(1733), DUR, 0.6, 0.4, 1.0, S, -30, 8)

    # ---- marching column: one stomp per footfall (real clock: t = 0.35 + 0.5 k), distance-filtered ----
    for k in range(0, int(DUR * 2) + 2):
        t = 0.35 + 0.5 * k
        d = col_dist(t)
        if d is None or t < fr(160) or t > fr(1412) or fr(415) <= t < fr(608):
            continue
        loose = np.mean([desync(t, i) for i in range(0, 74, 3)])
        if loose > 0.9:
            continue
        g, l = dist_fx(d)
        tau = real_tau(t)
        x, pre = G.column_stomp(r, stomp(tau) * (1 - 0.5 * loose), k % 2, boots=24)
        S.add(t - pre, x, -8 + g + 20 * np.log10(max(0.05, 1 - loose)), lpf=l, name="column footfall" if k % 8 == 0 else None)
        a = amp_real(t)
        if a > 0.08:
            S.add(t, G.deck_flex(r, a * 2), -16 + g, lpf=l)
    # dream column (shot 4): footfalls on its own clock
    for k in range(0, 200):
        t = 0.5 * k - 15.553
        if t < fr(415) or t > D_SNAP + 0.25:
            continue
        d = col_dist(t) or 12
        g, l = dist_fx(d)
        tau = t + 15.553
        x, pre = G.column_stomp(r, stomp(tau), k % 2, boots=24)
        D.add(t - pre, x, -12 + g, lpf=l)
        if amp(tau) > 0.15:
            D.add(t, G.deck_flex(r, amp(tau) * 1.6), -14 + g, lpf=l)
    # out of step: individual boots (shots 9-10), each man on his own cadence
    for i in range(30):
        cad, ph = 1.5 + 0.6 * hh(i, 1), hh(i, 2)
        t = SLOPPY - 0.5 + ph / cad
        while t < fr(1412):
            if desync(t, i * 2) > 0.3:
                d = col_dist(t) or 10
                g, l = dist_fx(d)
                S.add(t, G.stroll_step(r, 0.6), -13 + g - 3 * hh(i, 3), p=(hh(i, 4) - 0.5) * 1.2, lpf=l)
            t += 1 / cad
    # chains groaning while the real bridge bounces, silent after "tumahimik"
    for a, b, i0, i1, db in [(31.0, 35.1, 0.25, 0.7, -21), (35.1, 43.4, 0.7, 0.8, -21), (43.4, QUIET + 0.1, 0.6, 0.0, -22)]:
        S.add(a, fades(G.chain_groan(b - a, r, i0, i1), 0.3, 0.4), db, p=-0.4)
    # ---- hook (dream): the drop ----
    D.add(0.0, fades(G.chain_groan(1.3, r, 0.6, 1.0), 0.05, 0.2), -16, p=-0.3)
    for k in range(5):
        D.add(HOOK_DROP0 + 0.05 + 0.09 * k, G.whoa(r), -19, p=r.uniform(-0.7, 0.7))
    D.add(HOOK_DROP0, G.timber_tear(r), -9, name="timber tear (dream drop)")
    D.add(HOOK_DROP1, G.splash_big(r), -6, name="splash (dream)")
    D.add(fr(52) - 0.25, G.whoosh(0.5, r), -18)
    # ---- bedroom ----
    for k in range(6):
        S.add(fr(80) + 0.15 + 0.5 * k, G.clink(r, 2400, 0.05, 0.5), -36, p=0.6)  # the clock on the stool
    S.add(WAKE - 0.03, gasp(r), -12, name="Nell gasps awake")
    S.add(WAKE - 0.05, G.whoosh(0.5, r, 0.25, 600, 3000), -20)
    for tf in FLASHES:
        S.add(tf - 0.45, G.whoosh(0.7, r, 0.6, 500, 4000, 1.0, 0.2, 0.4), -14, name="flash whoosh")
    # ---- town: cheers on "Taong 1831" ----
    for k in range(9):
        kid = k % 3 == 0
        S.add(5.35 + 0.25 * k + r.uniform(0, 0.2), G.hurrah(r, r.uniform(260, 320) if kid else r.uniform(110, 160), 1.3 if kid else 1.0, kid), -24, p=r.uniform(-0.8, 0.8))
    S.add(5.3, fades(G.applause(2.8, r, 30), 0.1, 0.8), -23, name="town cheer")
    # ---- dream: strain, snap, whip, drop ----
    D.add(17.6, fades(G.chain_groan(D_SNAP - 17.6, r, 0.3, 1.0), 0.2, 0.05), -15, p=-0.4)
    for k in range(3):
        D.add(18.2 + 0.28 * k, G.bolt_strain(r, 0.6 + 0.2 * k), -14)
    D.add(D_SNAP, G.bolt_snap(r), -5, name="bolt snap (dream)")
    D.add(D_SNAP + 0.04, G.chain_whip(r), -9)
    D.add(D_DROP0, G.timber_tear(r), -8)
    D.add(D_DROP1, G.splash_big(r), -5, name="splash (dream)")
    S.add(fr(606) + 0.02, gasp(r, 350), -13, name="Nell gasps awake (2)")
    # ---- the run ----
    t = fr(608) + 0.05
    while t < 25.0:
        f = t * FPS
        d = 3.0 if f < 664 else 2.0 if f < 700 else 25.0 if f < 730 else 5.0
        g, l = dist_fx(d)
        S.add(t, kid_step(r), -10 + g, p=0.1, lpf=l)
        t += 1 / 5.4 if t < 24.4 else 1 / 3.5
    for k, (a, base) in enumerate([(22.15, 150), (22.3, 210), (22.5, 130), (22.6, 240)]):
        S.add(a, fades(G.babble(1.1, r, base, 1.0 if base < 200 else 1.3), 0.1, 0.3), -27, p=-0.6 + 0.4 * k)
    S.add(22.75, G.whoa(r, 230), -22, p=-0.5)
    S.add(23.05, G.whoa(r, 140), -22, p=0.4)
    # ---- shout ----
    S.add(SHOUT + 0.05, G.hurrah(r, 300, 1.4, True), -20, p=0.2, name="Nell shouts (under the voice)")
    S.add(31.2, G.hurrah(r, 310, 1.4, True), -23, p=0.2)
    # ---- the pan ----
    S.add(GRAB + 0.1, G.clink(r, 1400, 0.1, 0.8), -20)
    for k, th in enumerate(PAN_HITS):
        S.add(th, clang(r), 1 if k == 0 else -3, p=-0.15, name="PAN CLANG" if k == 0 else "pan clang (off beat)")
    t = DANCE + 0.2
    while t < fr(1274):
        S.add(t, clang(r, 0.8), -10 if t < fr(1195) else -16, p=-0.2)
        t += 0.698 * (1 + 0.18 * np.sin(t * 3.1))
    # ---- laughter ----
    for k in range(14):
        a = LAUGH - 0.05 + 0.12 * k + r.uniform(0, 0.25)
        d = r.uniform(1.4, 2.6)
        S.add(a, laugh(r, r.uniform(105, 165), d), -15 - 0.5 * k, p=r.uniform(-0.8, 0.8), name="soldiers laugh" if k == 0 else None)
    for k in range(10):
        a = 39.4 + 0.33 * k + r.uniform(0, 0.3)
        S.add(a, laugh(r, r.uniform(100, 150), r.uniform(1.2, 2.0)), -22, p=r.uniform(-0.8, 0.8))
    # ---- golden sway + swing ----
    S.add(fr(1412) + 0.2, fades(G.creak(2.6, r, 70, 95, G.TIMBER, rough=0.05), 0.4, 0.6), -28)
    for k in range(-4, 6):
        tb = PUSH0 + SWING_T * (0.25 + 0.5 * k)
        if fr(1513) < tb < fr(1733):
            a = swing_amp(tb) / 32
            S.add(tb - 0.1, G.swing_squeak(r, a, k % 2 == 0), -19 + 6 * a, p=0.15)
    for k, tp in enumerate(PUSHES):
        S.add(tp - 0.03, G.push_thump(r), -13 if k < 2 else -9, name="push" if k < 2 else "mistimed push")
    S.add(PUSHES[2] + 0.05, G.whoa(r, 290, 0.5), -18, p=0.2, name="kid 'whoa'")
    # ---- rule ----
    for k, th in enumerate(HITS):
        S.add(th - 0.005, G.hammer_hit(r, 1.0 if k < 2 else 1.25), -8, p=0.3, name="hammer")
    # ---- tourists + Tom and Nell ----
    for i in range(24):
        sp, ph0 = 0.55 + hh(i) * 0.5, hh(i, 5)
        k = 0
        while True:
            t = 63.6 + (k * 0.5 - ph0) * 1.4 / sp
            k += 1
            if t < fr(1906):
                continue
            if t > DUR - 0.3:
                break
            S.add(t, G.stroll_step(r, 0.5), -15 - 4 * hh(i, 3), p=(hh(i, 3) - 0.5) * 1.4, lpf=6000)
    t = fr(2065)
    while t < fr(2125):
        S.add(t, G.stroll_step(r, 0.4), -14, p=0.15)
        S.add(t + 0.33, kid_step(r), -15, p=-0.15)
        t += 0.8
    for k in range(10):
        kid = k % 3 == 0
        S.add(68.15 + 0.22 * k + r.uniform(0, 0.2), G.hurrah(r, r.uniform(260, 320) if kid else r.uniform(110, 160), 1.3 if kid else 1.0, kid), -26, p=r.uniform(-0.8, 0.8))
    S.add(68.1, fades(G.applause(2.6, r, 30), 0.1, 0.9), -25)
    S.add(fr(2125) - 0.3, G.whoosh(1.0, r, 0.45, 300, 1800, 1.2, 0.3, 0.2), -20, name="crane whoosh")
    # dream bus: muffled + big hall
    Dx = lp(D.x, 2600, 2)
    ir = make_ir(2.6, 11, hf=1.6)
    wet = convolve_st(Dx, ir)[:, :N]
    S.x += Dx * 0.75 + wet * 0.45
    return S.x, S.log + D.log


# ================================================================ MUSIC
F = I.m2f
BEAT = 0.5
# our own theme (Bb major): (bar, beat, length in beats, midi)
THEME = [(1, 0, 1, 74), (1, 1, .5, 70), (1, 1.5, .5, 72), (1, 2, 1, 74), (1, 3, 1, 77),
         (2, 0, 1, 75), (2, 1, .5, 74), (2, 1.5, .5, 72), (2, 2, 2, 70),
         (3, 0, 1, 72), (3, 1, .5, 69), (3, 1.5, .5, 70), (3, 2, 1, 72), (3, 3, 1, 75),
         (4, 0, 1.5, 74), (4, 1.5, .5, 72), (4, 2, 2, 70),
         (5, 0, 1, 77), (5, 1, .5, 74), (5, 1.5, .5, 75), (5, 2, 1, 77), (5, 3, 1, 79),
         (6, 0, .5, 77), (6, .5, .5, 75), (6, 1, .5, 74), (6, 1.5, .5, 72), (6, 2, 1, 70), (6, 3, 1, 74),
         (7, 0, 1, 72), (7, 1, 1, 75), (7, 2, .5, 74), (7, 2.5, .5, 72), (7, 3, 1, 69),
         (8, 0, 2, 70)]
CHORDS = {1: ["Bb"] * 4, 2: ["Eb", "Eb", "Bb", "Bb"], 3: ["F"] * 4, 4: ["Bb", "Bb", "F7", "F7"], 5: ["Bb", "Bb", "Eb", "Eb"],
          6: ["Eb", "Eb", "Bb", "Bb"], 7: ["Cm", "Cm", "F7", "F7"], 8: ["Bb"] * 4}
# the same tune in G minor (relative minor) for the tense march
MINOR = {74: 74, 70: 70, 72: 72, 77: 77, 75: 75, 69: 69, 79: 79}
CHORDS_MIN = {1: ["Gm"] * 4, 2: ["Cm", "Cm", "Gm", "Gm"], 3: ["D7"] * 4, 4: ["Gm", "Gm", "D7", "D7"], 5: ["Gm", "Gm", "Cm", "Cm"],
              6: ["Eb", "Eb", "Gm", "Gm"], 7: ["Cm", "Cm", "D7", "D7"], 8: ["Gm"] * 4}
CH = {"Bb": (34, [58, 62, 65]), "Eb": (39, [58, 63, 67]), "F": (41, [57, 60, 65]), "F7": (41, [57, 60, 63]), "Cm": (36, [60, 63, 67]),
      "Gm": (43, [58, 62, 67]), "D7": (38, [57, 60, 66]), "D": (38, [57, 62, 66])}


def TREM(rate, depth=0.3):
    return lambda t: 1 - depth * (0.5 + 0.5 * np.sin(2 * np.pi * rate * t))


class Score:
    def __init__(self):
        self.x = np.zeros((2, N))
        self.wet = np.zeros((2, N))

    def add(self, t, y, g=1.0, p=0.0, send=0.15):
        y = np.asarray(y, float)
        if y.ndim == 1:
            y = pan(y, p)
        place(self.x, y, t, g)
        place(self.wet, y, t, g * send)


def march(S, t0, bars, chords=CHORDS, melody="glock", vel=0.6, snare=True, swing=False, wobble=0.0, r=None, minor=False, mel_oct=0):
    """bars of the theme from t0 (bar 1 beat 0) at 120 bpm: oom-pah tuba, horn chords, melody, snare"""
    r = r or rng(int(t0 * 100))
    for bi, bar in enumerate(bars):
        tb = t0 + 4 * BEAT * bi
        drift = lambda beat: wobble * (np.sin(beat * 1.7 + bi) * 0.06 + r.normal(0, 0.025)) * max(0, bi - 0.5)
        for beat in range(4):
            c = chords[bar][beat]
            root, triad = CH[c]
            t = tb + beat * BEAT + drift(beat)
            if beat % 2 == 0:
                S.add(t, I.brass(F(root if beat == 0 else root + 7), 0.4, vel, r, "tuba"), 0.9, -0.1, 0.1)
            else:
                for m in triad:
                    S.add(t + drift(beat + 0.5), I.brass(F(m), 0.22, vel * 0.55, r, "horn"), 0.32, 0.25, 0.15)
            if snare:
                S.add(t, I.snare(0.35 * vel + 0.1 * (beat % 2), r), 0.5, 0.15, 0.12)
        for (b, beat, d, m) in THEME:
            if b != bar:
                continue
            bt = beat
            if swing:
                fl = np.floor(bt); fr_ = bt - fl
                bt = fl + (2 / 3 if fr_ == 0.5 else fr_)
            t = tb + bt * BEAT + drift(bt) * 1.5
            mm = m + 12 * mel_oct + (wobble * r.normal(0, 0.25) if wobble else 0)
            if melody == "glock":
                S.add(t, I.glock(F(mm), vel * 0.8, r), 0.55, 0.2, 0.25)
                S.add(t, I.fife(F(mm), d * BEAT * 0.9, vel * 0.55, r), 0.3, -0.2, 0.3)
            elif melody == "musicbox":
                S.add(t, I.musicbox(F(mm), vel * 0.8, r), 0.6, 0.0, 0.5)
            elif melody == "whistle":
                st_, w = I.whistle([(0.0, d * BEAT * 0.95, mm, vel)], r, detune=r.normal(0, 8))
                S.add(t + st_, w, 0.5, r.uniform(-0.4, 0.4), 0.4)


def build_music():
    S = Score()
    r = rng(3)
    # ---- A: hook + bedroom: Gm dream pad, music-box arpeggios, sting on the wake ----
    S.add(0.0, fades(I.pad([F(43), F(55), F(58), F(62)], 4.0, 0.5, r, att=0.4, rel=1.0, trem=TREM(4.0)), 0.05, 0.6), 0.55, 0, 0.6)
    arps = [[67, 70, 74, 79], [63, 67, 70, 75], [60, 63, 67, 72], [62, 66, 69, 74]]
    t = 0.05
    for i in range(10):
        for j, m in enumerate(arps[i % 4]):
            if t + j * 0.13 < WAKE - 0.1:
                S.add(t + j * 0.13, I.musicbox(F(m + 12), 0.5, r), 0.45, -0.3 + 0.2 * j, 0.7)
        t += 0.55
    S.add(HOOK_DROP1, I.timpani(F(31), 0.9, r), 1.0, 0, 0.5)
    S.add(2.7, fades(I.pad([F(39), F(51), F(55), F(58)], 1.5, 0.35, r, att=0.3, rel=0.8), 0.1, 0.5), 0.4, 0, 0.6)
    S.add(WAKE - 0.02, I.timpani(F(38), 0.85, r), 0.9, 0, 0.4)
    sw = I.cymbal(0.6, r, 1.3)[::-1]
    S.add(FLASHES[0] - len(sw) / SR + 0.02, sw, 0.5, 0, 0.3)
    # ---- B: town + Tom (5.35 .. 13.35): the theme, bars 1-4, then a pickup fill ----
    S.add(FLASHES[0], I.cymbal(0.5, r, 2.0), 0.35, 0.2, 0.3)
    march(S, 5.35, [1, 2, 3, 4], vel=0.62, r=r)
    for k in range(4):
        S.add(13.35 + 0.125 * k, I.snare(0.4 + 0.1 * k, r), 0.5, 0.1, 0.1)
    # ---- C: dream march (13.85 .. snap): whistled theme in a hall, Gm pad, timpani heartbeat; dead stop on the snap ----
    t0 = 13.947   # dream footfall grid: t = 0.5 k - 15.553
    for bi, bar in enumerate([1, 2, 3, 4, 5]):
        tb = t0 + 2.0 * bi
        for beat in range(4):
            tt_ = tb + beat * BEAT
            if tt_ >= D_SNAP - 0.05:
                break
            S.add(tt_, I.timpani(F(CH[CHORDS_MIN[bar][beat]][0] + 12), 0.35 + 0.08 * bi, r), 0.55, 0, 0.5)
        for (b, beat, d, m) in THEME:
            if b == bar and tb + beat * BEAT < D_SNAP - 0.1:
                st_, w = I.whistle([(0.0, min(d * BEAT * 0.95, D_SNAP - 0.05 - tb - beat * BEAT), m, 0.6)], r, detune=r.normal(0, 10))
                S.add(tb + beat * BEAT + st_, w, 0.45, r.uniform(-0.3, 0.3), 0.6)
    S.add(13.85, fades(I.pad([F(43), F(50), F(55), F(58)], D_SNAP - 13.85, 0.45, r, att=1.5, rel=0.05, trem=TREM(6.0)), 0.5, 0.03), 0.5, 0, 0.6)
    S.add(D_DROP1, I.timpani(F(31), 1.0, r), 0.9, 0, 0.6)
    sw = I.cymbal(0.6, r, 0.9)[::-1]
    S.add(FLASHES[1] - len(sw) / SR + 0.02, sw, 0.5, 0, 0.3)
    # ---- D: the run (20.27 .. 25.0): pizzicato Gm ostinato in eighths, timpani on the bar, snare roll building ----
    ost = [55, 58, 62, 58, 55, 58, 63, 58, 54, 57, 62, 57, 55, 58, 62, 67]
    t, k = 20.3, 0
    while t < 24.95:
        S.add(t, I.pluck(F(ost[k % 16]), 0.65, r), 0.55, -0.25, 0.2)
        S.add(t, I.pluck(F(ost[k % 16] - 12), 0.5, r), 0.4, 0.25, 0.2)
        if k % 8 == 0:
            S.add(t, I.timpani(F(43), 0.7, r), 0.7, 0, 0.3)
        t += 0.25
        k += 1
    for j in range(int((24.9 - 23.6) * 16)):
        S.add(23.6 + j / 16, I.snare(0.15 + 0.4 * j / 21, r), 0.45, 0.1, 0.15)
    S.add(25.0, I.brass(F(43), 0.6, 0.8, r, "stab"), 0.8, 0, 0.3)
    S.add(25.0, I.brass(F(55), 0.6, 0.7, r, "stab"), 0.5, 0.2, 0.3)
    # ---- E: the column on the bridge (25.35 .. 33.35) tense minor march, then tension hold to the bang ----
    march(S, 25.35, [1, 2, 3, 4], chords=CHORDS_MIN, melody="glock", vel=0.5, r=r, mel_oct=-1)
    S.add(33.35, fades(I.pad([F(38), F(50), F(54), F(57), F(60)], BANG - 33.35, 0.45, r, att=0.8, rel=0.02, trem=TREM(8.0)), 0.3, 0.02), 0.5, 0, 0.4)
    for j in range(int((BANG - 33.4) * 14)):
        S.add(33.4 + j / 14, I.snare(0.1 + 0.35 * j / 24, r), 0.4, 0.1, 0.15)
    # ---- F: falling-apart march from the laugh (37.35 ..), sloppier every bar, slide down and silence before "tumahimik" ----
    march(S, 37.35, [5, 6, 7, 8], vel=0.55, swing=True, wobble=1.0, r=r)
    S.add(45.2, I.brass(F(46), 0.9, 0.6, r, "horn", fall=-7.0), 0.6, 0, 0.3)
    # ---- G: explanation (47.07 .. 57.77): waltz on the swing period, two pushes in time, the mistimed one stops it ----
    bar_t = SWING_T
    t0 = PUSH0 - 3 * bar_t   # downbeats: ... 47.65, 49.2, 50.75, 52.3, 53.85, (55.4 never comes)
    S.add(47.1, fades(I.pad([F(46), F(58), F(62), F(65)], 8.0, 0.35, r, att=1.0, rel=0.4), 0.6, 0.4), 0.45, 0, 0.6)
    WALTZ = [[70, 74, 77], [75, 74, 72], [74, 77, 82], [81, 79, 77], [79, 75, 72], [70, 74, 77]]
    WCH = ["Bb", "Eb", "Bb", "F", "Eb", "Bb"]
    for k in range(6):
        tb = t0 + k * bar_t
        if tb < 47.1 or tb >= PUSHES[2] - 0.05:
            continue
        root, triad = CH[WCH[k]]
        S.add(tb, I.pluck(F(root + 12), 0.6, r), 0.6, -0.2, 0.3)
        for j in (1, 2):
            for m in triad:
                S.add(tb + j * bar_t / 3, I.pluck(F(m), 0.3, r, dur=0.5), 0.25, 0.2, 0.3)
        for j, m in enumerate(WALTZ[k]):
            if tb + j * bar_t / 3 < PUSHES[2] - 0.05:
                S.add(tb + j * bar_t / 3, I.musicbox(F(m + 12), 0.6 + 0.1 * (k >= 3), r), 0.6, 0.0, 0.5)
                S.add(tb + j * bar_t / 3, I.vibes(F(m), 0.4, r), 0.3, 0.3, 0.5)
    S.add(PUSHES[2], I.brass(F(46), 0.9, 0.7, r, "horn", fall=-12.0), 0.7, 0, 0.3)       # the stumble
    for k, m in enumerate([77, 74, 70, 65]):
        S.add(55.9 + 0.45 * k * (1 + 0.25 * k), I.glock(F(m), 0.45, r), 0.5, 0, 0.6)
    # ---- H: the rule (57.8 ..): soft march, stabs on the hammer blows ----
    march(S, 57.85, [1, 2], vel=0.42, snare=False, r=r)
    for k, th in enumerate(HITS):
        for m in ([46, 58, 62, 65] if k < 2 else [41, 57, 60, 63]):
            S.add(th, I.brass(F(m), 0.35, 0.8, r, "stab"), 0.35, 0, 0.25)
    # ---- I: tourists (63.85 ..): lazy swung theme with brushes, ending on a deliberately late button ----
    march(S, 63.85, [5, 6, 7, 8], melody="glock", vel=0.48, snare=False, swing=True, r=r)
    for k in range(int((71.85 - 63.85) / BEAT)):
        S.add(63.85 + k * BEAT + (0.04 if k % 2 else 0), I.brush(0.35, r, swish=k % 4 == 0), 0.5, 0.2, 0.2)
    end = 72.33   # a beat and a bit after "tiyempo": the band lands out of time on purpose
    for m in [34, 46, 58, 62, 65, 70]:
        S.add(end, I.brass(F(m), 0.7, 0.7, r, "stab" if m > 40 else "tuba"), 0.4, 0, 0.4)
    S.add(end, I.glock(F(82), 0.6, r), 0.5, 0.2, 0.5)
    S.add(end, I.cymbal(0.35, r, 1.2), 0.3, 0.2, 0.3)
    # hall reverb on the send, mild on everything
    ir = make_ir(1.6, 5, hf=1.3)
    out = S.x + convolve_st(S.wet, ir)[:, :N] * 0.7
    return out


# ================================================================ MIX
def speech_spans(merge=0.3):
    sp = []
    for w in WORDS:
        s, e = float(w["s"]), float(w["e"])
        if sp and s - sp[-1][1] < merge:
            sp[-1][1] = max(sp[-1][1], e)
        else:
            sp.append([s, e])
    return sp


def duck_curve(depth=-3.0, pre=0.08, post=0.12, att=0.07, rel=0.45):
    ctrl = 1000
    nc = int(DUR * ctrl) + 2
    va = np.zeros(nc)
    for s, e in speech_spans():
        va[max(0, int((s - pre) * ctrl)): int((e + post) * ctrl)] = 1.0
    ka, kr = 1 - np.exp(-1 / (att * ctrl)), 1 - np.exp(-1 / (rel * ctrl))
    env = np.zeros(nc)
    e = 0.0
    for i in range(nc):
        e += (va[i] - e) * (ka if va[i] > e else kr)
        env[i] = e
    return dbg(np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, depth * env))


def limiter(x, ceil_db=-1.2, look=0.003, rel=0.08):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    g2 = g1.copy()
    kr = 1 - np.exp(-1 / (rel * SR))
    idx = np.flatnonzero(g1 < 1.0)
    if len(idx):
        # forward pass (one-pole release back to unity after each reduction)
        g = 1.0
        for k in range(n):
            if g < 1.0 or g1[k] < 1.0:
                g = min(g1[k], g + (1 - g) * kr)
                g2[k] = g
    g3 = np.minimum(ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest"), 1.0)
    return x * g3[None, :]


def main():
    vx, sr = read_wav(os.path.join(HERE, "..", "voice", "voice.wav"))
    assert sr == SR, sr
    v = vx[0] if vx.shape[0] == 1 else vx.mean(0)
    voice = np.zeros(N)
    voice[: min(N, len(v))] = v[:N]
    voice = st(voice)
    print("sfx ...", flush=True)
    sfx, log = build_sfx()
    print("music ...", flush=True)
    mus = build_music()
    Lv = integrated(voice)
    # music bed ~10 LU under the voice (house standard "+3 dB": bed -10 instead of -13), ducked 3 dB under speech
    mus = mus * dbg(Lv - 8.0 - integrated(mus))
    mus = mus * duck_curve()[None, :]
    # SFX stem: events normalised so the stem sits ~-12 LU under the voice, then the house -6 dB rule is the mix-bus trim
    # anchored on the bridge march (25.3-33.6 s): the column's footfalls sit 11 LU under the voice there; every other
    # event keeps its own offset from that (the house "-6 dB SFX" rule is folded into the anchor)
    br = slice(ns(25.33), ns(33.57))
    sfx = sfx * dbg(integrated(voice[:, br]) - 11.0 - integrated(sfx[:, br]))
    mix = voice + mus + sfx
    g = dbg(-15.0 - integrated(mix))
    mix, voice, mus, sfx = mix * g, voice * g, mus * g, sfx * g
    mix = limiter(mix)
    mix = fades(mix, 0.002, 0.25)
    out = os.path.join(HERE)
    write_wav(os.path.join(out, "mix.wav"), mix)
    write_wav(os.path.join(out, "stem_voice.wav"), voice)
    write_wav(os.path.join(out, "stem_music.wav"), mus)
    write_wav(os.path.join(out, "stem_sfx.wav"), sfx)
    L, tp = integrated(mix), true_peak(mix)
    rows = [f"| {t:6.2f} | {name} | {db:+.0f} |" for t, name, db in sorted(log)]
    md = ["# Dream short: sound cues", "", f"- length {mix.shape[1] / SR:.3f} s, {SR} Hz stereo 24-bit",
          f"- integrated {L:.2f} LUFS, true peak {tp:.2f} dBTP", f"- voice {integrated(voice):.2f} LUFS, music {integrated(mus):.2f}, sfx {integrated(sfx):.2f}", "",
          "## Music map", "- 0-5.3 dream pad + music box (Gm), timpani on the drop and the wake, reverse cymbal into the flash",
          "- 5.35-13.35 theme (Bb, 120 bpm, on the column's step grid t = 0.35 + 0.5k)", "- 13.9-19.07 dream: whistled theme in a hall, Gm pad, dead stop on the snap",
          "- 20.3-25.0 the run: pizzicato Gm ostinato, snare roll, stab when she stops", "- 25.35-35.15 minor march on the bridge, tension hold, cut on the pan",
          "- 37.35-45.6 the march falls apart (swing + drift), horn slide, silence on 'tumahimik'", "- 47.1-55.17 waltz on the swing period, stumbles on the mistimed push",
          "- 57.85 soft march, brass stabs on the hammer", "- 63.85-72.33 lazy swung theme, a deliberately late button chord", "",
          "## SFX events (named)", "| t (s) | event | dB |", "|---|---|---|", *rows]
    open(os.path.join(out, "cues.md"), "w").write("\n".join(md) + "\n")
    print(f"mix.wav {mix.shape[1] / SR:.3f} s, {L:.2f} LUFS, TP {tp:.2f} dBTP")


if __name__ == "__main__":
    main()
