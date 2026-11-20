# Sound for "The Tower That Was Saved by a War": an original tarantella-flavoured comedy score (D major 6/8,
# mandolin tremolo, tuba oom-pah, glockenspiel; a fife-and-snare war march; golden pads for the century; stern B minor
# for 1934; a tension ostinato for 1990 that resolves when the tower eases back) + synthesized SFX on the picture's
# events (story.ts) + the voice. Mix standard: music +3 dB, SFX -6 dB, voice unchanged; music ducked under speech.
# Writes mix.wav (48 kHz, stereo, 24-bit, exactly TOTAL frames long), stems and cues.md.
import json
import os
import numpy as np
from dsp import (SR, ns, tt, rng, lp, hp, bp, colored, smooth_noise, fades, pan, st, place, dbg, phase, read_wav, write_wav,
                 integrated, true_peak, make_ir, convolve_st)
import instruments as I
import sfx_gen as X

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, TOTAL = 30, 2130
DUR = TOTAL / FPS
N = ns(DUR)
R = rng(1173)

# ---------------- picture events (mirrored from remotion/src/videos/pisa/story.ts) ----------------
POP = [13.92, 15.79, 18.06, 40.36, 40.6, 40.84, 41.08, 41.86]
LEAN0, LEAN1 = 19.62, 20.62
FLASH = 126 / FPS
B = dict(proud=6.72, fanciest=7.8, deep=10.72, soft=12.18, perfect1=14.6, perfect2=16.78, leans=20.18, luckily=21.3,
         dragged=22.46, unluckily=23.8, years=25.86, saved=27.6, water=29.62, sink=32.52, squeeze=33.72, holds=34.78,
         firm=37.1, back=39.4, taller=40.72, banana=45.22, ordered=47.58, pumped=49.24, further=51.52, closed=55.48,
         engineers=56.28, pulling=58.3, sank=60.68, straight=64.34, stopped=65.18, nobody=66.52, photograph=67.6)
LURCH = 51.75
SHOT_T = {1: 0, 2: 126, 3: 288, 4: 405, 5: 462, 6: 525, 7: 639, 8: 714, 9: 852, 10: 906, 11: 1065, 12: 1161, 13: 1284,
          14: 1380, 15: 1584, 16: 1872, 17: 1992}
fr = lambda f: f / FPS

cues = []


def ev(buf, x, t, gain_db, name):
    place(buf, x, t, dbg(gain_db))
    cues.append((t, name, gain_db))


# ================================================================ SFX
def thud(r, low=55.0, dur=0.7):
    t = tt(dur)
    y = np.exp(-t / 0.16) * np.sin(phase(low * (1 + 0.4 * np.exp(-t / 0.03)))) * 1.4
    y += lp(r.standard_normal(len(t)), 900) * np.exp(-t / 0.05) * 0.6
    y += bp(r.standard_normal(len(t)), 1800, 4500) * np.exp(-t / 0.012) * 0.25
    return fades(y, 0.001, 0.08)


def ding(f, vel=0.7):
    a, b = I.glock(f, vel), 0.5 * I.triangle(vel * 0.4, dur=1.2, f=f * 2)
    out = np.zeros(max(len(a), len(b)))
    out[:len(a)] += a; out[:len(b)] += b
    return out


def slide_whistle(f0, f1, dur, r):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    y = np.sin(phase(f)) + 0.15 * np.sin(phase(2 * f))
    y += 0.05 * hp(r.standard_normal(len(t)), 3000)
    return fades(y * np.clip(t / 0.05, 0, 1) * 0.5, 0.01, 0.12)


def boing(r, dur=0.8):
    t = tt(dur)
    f = 110 * (1 + 0.9 * np.exp(-t / 0.25) * np.sin(2 * np.pi * 9 * t))
    y = np.sin(phase(f)) * np.exp(-t / 0.35) + 0.3 * np.sin(phase(2.01 * f)) * np.exp(-t / 0.2)
    return fades(y * 0.8, 0.002, 0.1)


def squelch(r, dur=0.45):
    y = X.bubbles(dur, r, 26, 180, 900, tau=(0.01, 0.04)) * 0.8
    y += lp(r.standard_normal(ns(dur)), 500) * np.exp(-tt(dur) / 0.12) * 0.7
    return fades(y, 0.002, 0.05)


def engine(dur, r, f0=38.0, rough=0.5, bright=600):
    """old motor: low harmonic hum with a lumpy firing rhythm and rattle"""
    t = tt(dur)
    lump = 0.65 + 0.35 * np.sign(np.sin(2 * np.pi * f0 / 2 * t)) * rough
    y = sum(np.sin(phase(f0 * k * (1 + 0.004 * np.sin(2 * np.pi * 0.7 * t)))) / k for k in range(1, 9)) * lump
    y += lp(colored(len(t), r, 0.5), bright) * 0.6 * lump
    return fades(y * 0.35, 0.15, 0.25)


def drill(dur, r, stop_at=None):
    t = tt(dur)
    spd = np.ones_like(t) if stop_at is None else np.clip(1 - (t - stop_at) / 0.9, 0, 1) ** 1.5
    f = 70 * (0.3 + 0.7 * spd)
    y = sum(np.sin(phase(f * k)) / k ** 1.2 for k in range(1, 12)) * (0.3 + 0.7 * spd)
    y += bp(colored(len(t), r, 0.3), 900, 3500) * 0.25 * spd * (0.6 + 0.4 * smooth_noise(len(t), r, 5))
    y += lp(colored(len(t), r, 1.0), 200) * 0.4 * spd
    return fades(y * 0.32, 0.2, 0.1)


def shovel(r):
    d = 0.35
    t = tt(d)
    y = bp(r.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.08) * (t < 0.2)
    y += lp(r.standard_normal(len(t)), 700) * np.exp(-((t - 0.18) / 0.06) ** 2) * 0.8
    return fades(y * 0.5, 0.002, 0.05)


def shutter(r):
    d = 0.12
    t = tt(d)
    y = bp(r.standard_normal(len(t)), 2000, 8000) * (np.exp(-t / 0.004) + 0.7 * np.exp(-np.maximum(0, t - 0.05) / 0.004) * (t > 0.05))
    return y * 0.6


def waves(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for k in range(5):
        per = r.uniform(5.5, 8.5)
        ph = r.uniform(0, per)
        env = np.clip(np.sin(np.pi * ((t + ph) % per) / per), 0, 1) ** 3
        nz = colored(n, r, 0.6)
        out += pan(lp(nz, 1500 + 1500 * r.uniform()) * env, r.uniform(-0.7, 0.7)) * 0.35
    out += st(lp(colored(n, r, 1.0), 300) * 0.25)
    return out


def gull(r):
    d = 0.5
    t = tt(d)
    f = 1300 * (1 + 0.35 * np.sin(np.pi * t / d)) * (1 - 0.15 * t / d)
    y = np.sin(phase(f)) + 0.6 * np.sin(phase(2 * f)) + 0.3 * np.sin(phase(3 * f))
    y *= np.clip(t / 0.03, 0, 1) * np.exp(-t / 0.3) * (0.7 + 0.3 * np.sin(2 * np.pi * 28 * t))
    return fades(y * 0.25, 0.005, 0.06)


def crowd_cheer(t0, dur, r, people=10, gain=0.0):
    out = np.zeros((2, ns(dur + 1.2)))
    for p in range(people):
        x = X.hurrah(r, r.uniform(110, 260), r.uniform(0.9, 1.15))
        place(out, pan(x, r.uniform(-0.8, 0.8)), r.uniform(0, 0.35) + (p % 3) * 0.1, 0.5)
    env = np.clip(np.linspace(0, dur + 1.2, out.shape[1]) / 0.1, 0, 1) * np.clip((dur + 1.2 - np.linspace(0, dur + 1.2, out.shape[1])) / 0.6, 0, 1)
    out += X.applause(dur + 1.2, r, 24, env) * 0.6
    return out


def build_sfx():
    S = np.zeros((2, N))
    r = rng(7)
    # flash after the hook
    ev(S, X.whoosh(0.9, r, peak=0.5, f_lo=500, f_hi=4000, width=0.9), FLASH - 0.5, -4, "flash whoosh")
    # ambience by era: birds + breeze on the piazza, waves on the beach
    for a, b, lvl in [(0, 30.2, -16), (35.5, DUR, -17)]:
        ev(S, X.breeze(b - a, r, 0.7) * 0.6, a, lvl, "breeze bed")
        ev(S, st(X.bird_chirps(b - a, r, 0.35)), a, lvl - 2, "birds")
    ev(S, waves(5.4, r), fr(906) - 0.15, -9, "beach waves")
    for tg in [30.8, 33.1, 34.6]:
        ev(S, pan(gull(r), 0.4), tg, -12, "gull")
    # hook: shutter clicks, chatter
    for tc in [0.9, 2.3, 3.4]:
        ev(S, pan(shutter(r), 0.3), tc, -10, "camera shutter")
    ev(S, crowd_cheer(0.4, 1.5, r, 6) * 0.25, 0.3, -18, "tourist chatter")
    # 1173 crowd cheer on "proud"
    ev(S, crowd_cheer(B["proud"], 1.6, r, 12), B["proud"] - 0.05, -9, "crowd cheer (proud)")
    # digging, the squelch on "soft, wet clay"
    for k in range(9):
        ev(S, pan(shovel(r), r.uniform(-0.6, 0.6)), fr(288) + 0.15 + k * 0.42 + r.uniform(0, 0.1), -12, "shovel")
    ev(S, squelch(r), B["soft"], -5, "mud squelch")
    # floors going up: stone thud + dust, ding on "perfect"
    for k, tp in enumerate(POP):
        ev(S, thud(r, 50 + 4 * k), tp, -5 if k < 3 else -9, f"floor {k + 1} thud")
        ev(S, X.whoosh(0.5, r, peak=0.15, f_lo=300, f_hi=1200, width=0.8, tail=0.2), tp - 0.05, -14, "dust puff")
    # the lean: a long stone groan, then the settle thud
    ev(S, X.creak(1.05, r, 40, 22, X.TIMBER, rough=0.2, noise=0.08) * 0.8, LEAN0, -6, "tower groan")
    ev(S, thud(r, 42, 0.9), LEAN1 - 0.15, -3, "lean settle")
    # war: boots of the column (2 steps/s), the builders' "whoa"
    for k in range(5):
        x, pre = X.column_stomp(r, 0.8, k % 2, boots=12, boom_gain=0.3)
        ev(S, x, 21.3 + 0.12 + k * 0.5 - pre, -9, "column step")
    ev(S, pan(X.whoa(r, 150), -0.2), B["dragged"] + 0.05, -8, "builder whoa")
    ev(S, pan(X.whoa(r, 120), 0.3), B["dragged"] + 0.3, -10, "builder whoa 2")
    # the century: a time-lapse whoosh of wind
    ev(S, X.whoosh(4.0, r, peak=2.0, f_lo=250, f_hi=900, width=1.2, tail=1.2), fr(714), -15, "time-lapse wind")
    # clay sweat: drips
    ev(S, st(X.bubbles(1.8, r, 5, 700, 2200)), fr(852) + 0.1, -10, "clay drips")
    # beach: the sink squelch, the water squeezing out
    ev(S, squelch(r, 0.4), B["sink"], -8, "sand squelch")
    ev(S, st(X.bubbles(1.0, r, 18, 900, 3000)) + st(hp(colored(ns(1.0), r, 0.2), 2500) * np.exp(-tt(1.0) / 0.4) * 0.3), B["squeeze"], -9, "water squeeze")
    ev(S, ding(I.m2f(86), 0.4), B["holds"] + 0.05, -12, "holds ding")
    # return of the old builders: steps
    for k in range(8):
        ev(S, pan(X.stroll_step(r, 0.4), r.uniform(-0.4, 0.4)), fr(1161) + 0.1 + k * 0.33, -14, "stroll step")
    # banana boing
    ev(S, boing(r), B["banana"] + 0.08, -6, "banana boing")
    # 1934: the mixer motor, pump gulps, the lurch
    ev(S, engine(LURCH - fr(1380) + 0.3, r), fr(1380), -13, "concrete mixer motor")
    for k in range(5):
        ev(S, squelch(r, 0.3), B["pumped"] + 0.1 + k * 0.62, -11, "concrete gulp")
    ev(S, X.creak(0.6, r, 30, 18, X.TIMBER, rough=0.25) * 0.9, LURCH - 0.35, -6, "lurch groan")
    ev(S, thud(r, 38, 1.1), LURCH, -2, "lurch thud")
    # 1990: barrier clank, the drill rig, soil pour, the tower easing back
    ev(S, X.hammer_hit(r, 1.2), B["closed"] + 0.05, -6, "barrier clank")
    ev(S, drill(fr(1872) - B["engineers"], r), B["engineers"], -14, "drill rig")
    ev(S, st(lp(colored(ns(3.0), r, 0.8), 800) * np.clip(tt(3.0) / 0.3, 0, 1) * np.clip((3.0 - tt(3.0)) / 0.8, 0, 1) * 0.5), B["pulling"], -12, "soil pour")
    ev(S, X.creak(1.1, r, 28, 40, X.TIMBER, rough=0.15) * 0.7, 60.5, -8, "tower eases back")
    ev(S, ding(I.m2f(81), 0.5), 61.65, -10, "eased ding")
    # 2001: the rig runs, then winds down on "stopped on purpose"
    ev(S, drill(B["stopped"] - fr(1872) + 1.2, r, stop_at=B["stopped"] - fr(1872)), fr(1872), -14, "drill run + stop")
    ev(S, X.whoosh(0.5, r, peak=0.12, f_lo=300, f_hi=900), B["stopped"] + 0.05, -14, "stop puff")
    # today: shutters and a laugh
    for tc in [66.9, 67.75, 68.4, 69.3]:
        ev(S, pan(shutter(r), r.uniform(-0.5, 0.5)), tc, -9, "camera shutter")
    ev(S, crowd_cheer(68.6, 1.5, r, 5) * 0.35, 68.6, -16, "tourist laughter")
    ev(S, X.whoosh(2.4, r, peak=1.2, f_lo=300, f_hi=1500, width=1.0, tail=0.8), fr(2050) - 0.2, -15, "crane whoosh")
    return S


# ================================================================ music
E8 = 0.2  # eighth note (s): 6/8 at a dotted quarter of 0.6 s
THEME = [  # (bar, eighth, length in eighths, midi)
    (1, 0, 3, 74), (1, 3, 1, 76), (1, 4, 1, 78), (1, 5, 1, 79),
    (2, 0, 3, 81), (2, 3, 3, 78),
    (3, 0, 1, 79), (3, 1, 1, 78), (3, 2, 1, 76), (3, 3, 3, 74),
    (4, 0, 2, 76), (4, 2, 1, 78), (4, 3, 3, 69),
    (5, 0, 3, 74), (5, 3, 1, 76), (5, 4, 1, 78), (5, 5, 1, 79),
    (6, 0, 2, 81), (6, 2, 1, 83), (6, 3, 3, 81),
    (7, 0, 1, 79), (7, 1, 1, 78), (7, 2, 1, 76), (7, 3, 3, 73),
    (8, 0, 6, 74),
]
CHORDS = {1: "D", 2: "D", 3: "G", 4: "A", 5: "D", 6: "D", 7: "A7", 8: "D"}
CH = {"D": (38, 45, [62, 66, 69]), "G": (43, 38, [62, 67, 71]), "A": (45, 40, [61, 64, 69]), "A7": (45, 40, [61, 64, 67]),
      "Bm": (47, 42, [62, 66, 71]), "Em": (40, 47, [64, 67, 71]), "F#": (42, 37, [61, 66, 70]), "Dm": (38, 45, [62, 65, 69]),
      "Gm": (43, 38, [62, 67, 70]), "Bb": (46, 41, [62, 65, 70])}
F = I.m2f


class Band:
    def __init__(self):
        self.tr = {k: np.zeros((2, N)) for k in ["mando", "bass", "chords", "glock", "drums", "pad", "fife"]}
        self.r = rng(1272)

    def put(self, k, x, t, g=1.0, p=0.0):
        if t >= DUR or t < -1:
            return
        place(self.tr[k], pan(x, p) if np.ndim(x) == 1 else x, t, g)

    def mando(self, t, dur, m, vel=0.6, cut=None):
        """mandolin: single pluck for short notes, tremolo for long ones"""
        if cut is not None and t >= cut:
            return
        if dur <= 0.25:
            self.put("mando", I.pluck(F(m), vel, self.r, 0.6, bright=0.8, pos=0.12), t, 1, 0.15)
        else:
            k, tt0 = 0, 0.0
            while tt0 < dur - 0.04 and (cut is None or t + tt0 < cut):
                self.put("mando", I.pluck(F(m), vel * (0.85 if k % 2 else 1.0) * (1 - 0.25 * tt0 / dur), self.r, 0.25, bright=0.8, pos=0.12), t + tt0, 1, 0.15)
                tt0 += 0.055
                k += 1

    def theme(self, t0, bars=range(1, 9), vel=0.6, cut=None, transpose=0, oompah=True, glock=False):
        for (b, e, L, m) in THEME:
            if b not in bars:
                continue
            tb = t0 + (b - bars[0]) * 6 * E8 + e * E8
            self.mando(tb, L * E8, m + transpose, vel, cut)
            if glock and L >= 3:
                self.put("glock", I.glock(F(m + 12 + transpose), 0.35, self.r), tb, 1, -0.2)
        if oompah:
            for b in bars:
                tb = t0 + (b - bars[0]) * 6 * E8
                self.oompah(tb, CHORDS[b], transpose, cut=cut, vel=vel)

    def oompah(self, tb, ch, transpose=0, cut=None, vel=0.6, pah=True):
        oom1, oom2, tri = CH[ch]
        for e, m in [(0, oom1), (3, oom2)]:
            t = tb + e * E8
            if cut is None or t < cut:
                self.put("bass", I.brass(F(m + transpose), 0.38, vel * 0.9, self.r, kind="tuba"), t, 1, 0)
        if pah:
            for e in [1, 2, 4, 5]:
                t = tb + e * E8
                if cut is None or t < cut:
                    for m in tri:
                        self.put("chords", I.pluck(F(m + transpose), vel * 0.22, self.r, 0.3, bright=0.4), t, 1, -0.3)

    def pad(self, t, dur, chord, vel=0.4):
        _, _, tri = CH[chord]
        self.put("pad", I.pad([F(m) for m in tri] + [F(tri[0] - 12)], dur, vel, self.r, att=0.6, rel=1.0), t, 1, 0)


def build_music():
    M = Band()
    r = M.r
    # hook (0 - 4.2): theme bars 1-4 at full band, cymbal into the flash
    M.theme(0.15, range(1, 5), 0.62, cut=FLASH - 0.05, glock=True)
    M.put("drums", I.cymbal(0.55, r, 2.0), FLASH - 0.04, 1, 0)
    # 1173 build (4.2 - 19.5): softer theme, dings on every floor
    M.theme(FLASH + 0.1, range(1, 9), 0.45, cut=LEAN0 - 0.1)
    M.theme(FLASH + 0.1 + 8 * 6 * E8, range(5, 9), 0.42, cut=LEAN0 - 0.1)
    for k, m in enumerate([76, 78, 81]):
        M.put("glock", ding(F(m + 12), 0.55), POP[k] + 0.05, 1, 0.2)
    # the lean: a slide whistle falling with the tower
    M.put("fife", slide_whistle(1100, 380, LEAN1 - LEAN0 + 0.1, r), LEAN0, 0.9, 0.1)
    # war (21.3 - 23.8): snare march + fife in B minor
    t0 = 21.3
    for k in range(20):
        acc = 1.0 if k % 4 == 0 else 0.55
        M.put("drums", I.snare(0.5 * acc, r, 0.25), t0 + k * 0.125, 1, -0.1)
    for k in range(5):
        M.put("drums", I.timpani(F(35), 0.55, r, 0.6), t0 + k * 0.5, 1, 0)
    for k, (dt, L, m) in enumerate([(0, 0.25, 71), (0.25, 0.25, 74), (0.5, 0.5, 78), (1.0, 0.25, 76), (1.25, 0.25, 74), (1.5, 0.5, 73), (2.0, 0.45, 71)]):
        M.put("fife", I.fife(F(m + 12), L, 0.45, r), t0 + dt, 1, 0.2)
    # the century (23.8 - 28.4): golden pads, slow vibes arpeggio
    for k, ch in enumerate(["D", "Bm", "G", "A"]):
        M.pad(23.85 + k * 1.15, 1.6, ch, 0.42)
        for j, m in enumerate(CH[ch][2]):
            M.put("glock", I.vibes(F(m + 12), 0.35, r, 1.4), 23.85 + k * 1.15 + j * 0.38, 1, 0.3 - 0.3 * j)
    # explanation + beach (28.4 - 38.7): gentle plucked arpeggios, vibes on the beach
    prog = ["D", "G", "A", "D", "Bm", "G", "A", "D"]
    for k in range(int((38.6 - 28.4) / 1.2)):
        ch = prog[k % len(prog)]
        tb = 28.45 + k * 1.2
        _, _, tri = CH[ch]
        M.put("bass", I.pluck(F(CH[ch][0]), 0.5, r, 1.0, bright=0.3), tb, 1, 0)
        for e, m in enumerate([tri[0], tri[1], tri[2], tri[1], tri[0] + 12, tri[2]]):
            M.put("chords", I.pluck(F(m), 0.28, r, 0.6, bright=0.6), tb + e * E8, 1, -0.2 + 0.08 * e)
    # the return (38.7 - 45.2): theme again, full band, up to the banana
    M.theme(38.75, range(1, 9), 0.58, cut=B["banana"] - 0.02, glock=True)
    M.put("glock", ding(F(93), 0.5), B["banana"] + 0.45, 1, 0)
    M.put("glock", ding(F(98), 0.5), B["banana"] + 0.62, 1, 0)
    # 1934 (46 - 51.7): stern B minor oom-pah, snare roll into the lurch
    t0 = 46.0
    for k in range(5):
        ch = ["Bm", "Em", "F#", "Bm", "F#"][k]
        M.oompah(t0 + k * 1.2, ch, 0, cut=LURCH - 0.05, vel=0.55)
    for k, (bb, e, L, m) in enumerate([(0, 0, 3, 71), (0, 3, 3, 74), (1, 0, 2, 76), (1, 2, 1, 74), (1, 3, 3, 71), (2, 0, 3, 73), (2, 3, 3, 70),
                                       (3, 0, 3, 71), (3, 3, 2, 74), (3, 5, 1, 76), (4, 0, 6, 73)]):
        M.mando(t0 + bb * 1.2 + e * E8, L * E8, m, 0.5, cut=LURCH - 0.05)
    for k in range(int((LURCH - 50.4) / 0.04)):
        M.put("drums", I.snare(0.12 + 0.3 * k * 0.04 / (LURCH - 50.4), r, 0.12), 50.4 + k * 0.04, 1, 0)
    M.put("drums", I.timpani(F(35), 0.9, r, 1.8), LURCH, 1, 0)
    M.put("drums", I.cymbal(0.45, r, 1.8), LURCH, 1, 0)
    # 1990 (52.9 - 60.6): tension ostinato in D minor, resolving to D major when the tower eases back
    for k in range(int((60.6 - 52.9) / 0.2)):
        t = 52.9 + k * 0.2
        m = [62, 65, 69, 65][k % 4] - (2 if (k // 12) % 2 else 0)
        M.put("chords", I.pluck(F(m), 0.3 + 0.1 * (k % 4 == 0), r, 0.35, bright=0.5), t, 1, -0.2)
    for k, ch in enumerate(["Dm", "Bb", "Gm", "A", "Dm", "Bb"]):
        M.pad(52.9 + k * 1.3, 1.6, ch, 0.3)
    M.pad(60.7, 1.9, "D", 0.5)
    M.put("glock", I.vibes(F(78), 0.4, r, 1.8), 60.75, 1, 0)
    # 2001 (62.4 - 65.2): hovering vibes, then silence on "stopped"
    for k, m in enumerate([74, 78, 81, 78, 76, 74]):
        if 62.45 + k * 0.45 < B["stopped"] - 0.1:
            M.put("glock", I.vibes(F(m + 12), 0.3, r, 1.0), 62.45 + k * 0.45, 1, 0.2)
    M.pad(62.45, B["stopped"] - 62.45, "G", 0.25)
    # finale (66.5 - 71): theme bars 5-8, final chord + cymbal
    M.theme(66.5, range(5, 9), 0.62, glock=True)
    M.put("drums", I.cymbal(0.5, r, 2.2), 70.1, 1, 0)
    M.pad(70.1, 0.9, "D", 0.45)
    return M


def render_music(M):
    gains = {"mando": 0.0, "bass": -3.0, "chords": -6.0, "glock": -5.0, "drums": -4.0, "pad": -8.0, "fife": -3.0}
    out = np.zeros((2, N))
    for k, x in M.tr.items():
        out += x * dbg(gains[k])
    ir = make_ir(1.4, 5)
    wet = convolve_st(out, ir)[:, :N]
    return out * 0.85 + wet * 0.28


# ================================================================ mix
def words_env(words, pad0=0.12, pad1=0.25):
    env = np.ones(N)
    on = np.zeros(N, bool)
    for w in words:
        a, b = ns(max(0, w["s"] - pad0)), ns(min(DUR, w["e"] + pad1))
        on[a:b] = True
    k = ns(0.12)
    sm = np.convolve(on.astype(float), np.ones(k) / k, mode="same")
    return sm


def limiter(x, ceil_db=-1.2):
    c = dbg(ceil_db)
    peak = np.max(np.abs(x), axis=0)
    g = np.minimum(1, c / np.maximum(peak, 1e-9))
    k = ns(0.005)
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    g = minimum_filter1d(g, k * 2 + 1)
    g = uniform_filter1d(g, k * 2 + 1)
    return x * g[None, :]


def main():
    voice, sr = read_wav(os.path.join(HERE, "..", "voice", "voice.wav"))
    assert sr == SR
    v = np.zeros((2, N))
    vv = st(voice)
    n = min(N, vv.shape[1])
    v[:, :n] = vv[:, :n]
    words = json.load(open(os.path.join(HERE, "..", "voice", "words.json")))
    print("sfx...")
    S = build_sfx()
    print("music...")
    Mu = render_music(build_music())
    Lv = integrated(v)
    # standard: music sits 13 LU under the voice +3 dB, SFX events land ~ voice level -6 dB (event gains set above)
    Mu *= dbg((Lv - 13 + 3) - integrated(Mu))
    S *= dbg((Lv - 10 - 6) - integrated(S))
    duck = 1 - (1 - dbg(-3.0)) * words_env(words)
    Mu *= duck[None, :]
    mix = v + Mu + S
    g = dbg(-15.0 - integrated(mix))
    mix = limiter(mix * g)
    write_wav(os.path.join(HERE, "mix.wav"), mix)
    write_wav(os.path.join(HERE, "stem_music.wav"), Mu * g)
    write_wav(os.path.join(HERE, "stem_sfx.wav"), S * g)
    with open(os.path.join(HERE, "cues.md"), "w") as fh:
        fh.write(f"# Pisa short sound cues\n\nLength {DUR:.3f} s, 48 kHz stereo. Voice {Lv:.1f} LUFS before master gain.\n")
        fh.write(f"Mix integrated {integrated(mix):.2f} LUFS, true peak {true_peak(mix):.2f} dBTP.\n\n| t (s) | frame | event | gain dB |\n|---|---|---|---|\n")
        for t, name, gdb in sorted(cues):
            fh.write(f"| {t:.2f} | {round(t * FPS)} | {name} | {gdb} |\n")
    print("mix", integrated(mix), "LUFS", true_peak(mix), "dBTP", mix.shape[1] / SR, "s")


if __name__ == "__main__":
    main()
