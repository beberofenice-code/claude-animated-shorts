# Original score for the pelikula short: one little tune in G major at 104 bpm that changes costume with the story —
# rondalla-style plucked strings for the hook, a music box for 1897, a brassy swing for the 1950s lot, sleigh-bell
# glockenspiel for Christmas, a fanfare for the election, a stop-time deadpan for "Suwerte / Malas", fiesta strums for the
# handaan, a warm pad in the cool dark cinema, a lullaby for the phone, and the fanfare again at the end.
import numpy as np
from dsp import SR, ns, rng, lp, hp, dbg, st, place, pan, widen, make_ir, convolve_st, integrated
import instruments as I

DUR = 70.0
N = ns(DUR)
BPM = 104.0
Q = 60.0 / BPM          # quarter note (s)
BAR = 4 * Q
F = I.m2f
CH = {"G": [55, 59, 62], "Em": [52, 55, 59], "C": [48, 52, 55], "D": [50, 54, 57], "D7": [50, 54, 57, 60], "Am": [45, 48, 52],
      "B7": [47, 51, 54, 57], "Cm": [48, 51, 55], "Bm": [47, 50, 54], "E7": [52, 56, 59, 62]}
PROG = ["G", "Em", "C", "D"]
# the tune (scale degrees as MIDI, quarter-note grid): our own little motif
TUNE = [(71, 1), (74, 1), (76, 1), (74, 1), (71, 1.5), (69, 0.5), (67, 2), (69, 1), (71, 1), (72, 1), (74, 1), (76, 2), (74, 2),
        (72, 1), (71, 1), (69, 1), (67, 1), (69, 1.5), (71, 0.5), (69, 2), (71, 1), (74, 1), (79, 1), (78, 1), (79, 4)]

# sections (name, start s, end s, style)
SECTIONS = [("hook", 0.0, 6.33, "rondalla"), ("1897", 6.33, 16.3, "musicbox"), ("studio", 16.3, 22.23, "swing"),
            ("japan", 22.23, 25.03, "sting"), ("pasko", 25.03, 35.43, "bells"), ("vote", 35.43, 36.97, "tick"),
            ("palace", 36.97, 39.77, "fanfare"), ("deadpan", 39.77, 45.43, "deadpan"), ("handaan", 45.43, 55.03, "fiesta"),
            ("cinema", 55.03, 58.87, "pad"), ("hot", 58.87, 60.63, "sparse"), ("phone", 60.63, 65.9, "lullaby"),
            ("ending", 65.9, 70.0, "fanfare2")]


class Band:
    def __init__(self):
        self.tr = {}
        self.send = {}

    def add(self, name, x, t, gain=1.0, send=0.25):
        if name not in self.tr:
            self.tr[name] = np.zeros((2, N))
            self.send[name] = send
        place(self.tr[name], x, t, gain)


R = rng(2026)


def strum(b, t, chord, vel=0.5, up=False, name="strum", oct_=12, p=0.0):
    notes = [n + oct_ for n in CH[chord]] + [CH[chord][0] + oct_ + 12]
    if up:
        notes = notes[::-1]
    for k, m in enumerate(notes):
        b.add(name, pan(I.pluck(F(m), vel * (0.8 + 0.2 * R.uniform()), R, 1.2, 0.6, 0.12), p + 0.15 * (k - 1.5) / 2), t + k * 0.018)


def bass(b, t, m, vel=0.6, dur=0.5, name="bass"):
    b.add(name, pan(I.pluck(F(m - 12), vel, R, dur + 0.4, 0.25, 0.2), 0.0), t)


def melody(b, t0, notes, fn, vel=0.5, name="mel", tr=0, gate=0.9, p=0.0, t_end=None):
    t = t0
    for m, d in notes:
        if t_end is not None and t >= t_end:
            break
        dur = d * Q
        if fn == "glock":
            x = I.glock(F(m + tr), vel, R, 1.4)
        elif fn == "musicbox":
            x = I.musicbox(F(m + tr), vel, R, 1.4)
        elif fn == "vibes":
            x = I.vibes(F(m + tr), vel, R, 1.8)
        elif fn == "horn":
            x = I.brass(F(m + tr), dur * gate, vel, R, "horn")
        elif fn == "pluck":
            x = I.pluck(F(m + tr), vel, R, 1.0, 0.7, 0.15)
        b.add(name, pan(x, p), t)
        t += dur


def bars(a, b_):
    """bar start times in [a, b_) on the global grid"""
    k0 = int(np.ceil(a / BAR - 1e-6))
    out = []
    k = k0
    while k * BAR < b_ - 1e-6:
        out.append(k * BAR)
        k += 1
    return out


def build():
    b = Band()
    for name, a, e, style in SECTIONS:
        if style in ("rondalla", "fiesta"):
            for i, t in enumerate(bars(a, e)):
                ch = PROG[i % 4]
                bass(b, t, CH[ch][0], 0.55); bass(b, t + 2 * Q, CH[ch][2], 0.45)
                for k, beat in enumerate([0, 1, 1.5, 2, 3, 3.5]):
                    if t + beat * Q < e:
                        strum(b, t + beat * Q, ch, 0.42 if beat in (0, 2) else 0.3, up=beat % 1 > 0, p=-0.3)
                for beat in (1, 3):
                    if t + beat * Q < e:
                        b.add("perc", st(I.brush(0.35, R, 0.25)), t + beat * Q)
            tune_t = bars(a, e)[0] if bars(a, e) else a
            melody(b, tune_t, TUNE, "glock" if style == "rondalla" else "pluck", 0.45, "mel", 12 if style == "rondalla" else 0, p=0.25, t_end=e - 0.1)
            if style == "fiesta":
                melody(b, tune_t + 4 * BAR, TUNE[:8], "horn", 0.45, "horn", -12, p=0.2, t_end=52.4)
        elif style == "musicbox":
            for i, t in enumerate(bars(a, e)):
                ch = PROG[i % 4]
                b.add("pad", I.pad([F(m) for m in CH[ch]], BAR * 0.95, 0.25, R, 0.4, 0.6, 700), t)
            melody(b, bars(a, e)[0], TUNE, "musicbox", 0.5, "mel", 12, p=0.1, t_end=e - 0.1)
        elif style == "swing":
            for i, t in enumerate(bars(a, e)):
                ch = ["G", "E7", "Am", "D7"][i % 4]
                for beat in range(4):
                    bass(b, t + beat * Q, CH[ch][beat % len(CH[ch])], 0.5, 0.35)
                    b.add("perc", st(I.brush(0.3, R, 0.3, swish=beat % 2 == 1)), t + beat * Q)
                for beat in (1, 3):
                    for m in CH[ch][1:]:
                        b.add("horn", pan(I.brass(F(m + 12), Q * 0.4, 0.4, R, "stab"), 0.25), t + (beat + 0.66) * Q)
            melody(b, bars(a, e)[0], [(67, 0.66), (71, 0.34), (74, 1), (76, 0.66), (74, 0.34), (71, 2)] * 3, "horn", 0.5, "horn2", 0, p=-0.2, t_end=e)
        elif style == "sting":
            # the bigger stack: a sad trombone-ish fall
            for k, m in enumerate([62, 61, 60, 59]):
                b.add("horn", pan(I.brass(F(m - 12), Q * (0.6 if k < 3 else 1.6), 0.55, R, "tuba", fall=-0.0 if k < 3 else -200), 0.0), a + 1.2 + k * 0.42)
            b.add("pad", I.pad([F(m) for m in CH["Cm"]], 2.0, 0.18, R, 0.3, 0.8, 600), a + 1.2)
        elif style == "bells":
            for i, t in enumerate(bars(a, e)):
                ch = PROG[i % 4]
                b.add("pad", I.pad([F(m) for m in CH[ch]], BAR * 0.95, 0.3, R, 0.3, 0.6, 1000), t)
                bass(b, t, CH[ch][0], 0.45); bass(b, t + 2 * Q, CH[ch][0], 0.35)
                for k in range(8):
                    b.add("perc", pan(I.triangle(0.12, R, 0.4, 3600 + 200 * (k % 2)), 0.4), t + k * Q / 2)
            melody(b, bars(a, e)[0], TUNE + TUNE, "glock", 0.5, "mel", 12, p=0.15, t_end=e - 0.1)
        elif style == "tick":
            for k in range(int((e - a) / (Q / 2))):
                b.add("perc", st(I.brush(0.2, R, 0.1)), a + k * Q / 2)
        elif style in ("fanfare", "fanfare2"):
            seq = [(67, 0.5), (71, 0.5), (74, 0.5), (79, 2.5)] if style == "fanfare" else [(74, 0.5), (79, 0.5), (83, 0.5), (86, 1.5), (83, 0.5), (86, 3)]
            for voice, tr in ((0, 0), (1, -5), (2, -12)):
                melody(b, a + 0.05, seq, "horn", 0.6 - 0.1 * voice, f"fan{voice}", tr, p=(voice - 1) * 0.3)
            b.add("perc", st(I.cymbal(0.6, R, 2.2)), a + 0.05 + 1.5 * Q)
            b.add("perc", st(I.timpani(F(43), 0.8, R, 1.8)), a + 0.05)
            for i, t in enumerate(bars(a + 0.05 + 4 * Q, e)):
                strum(b, t, "G" if i % 2 == 0 else "D", 0.4)
            if style == "fanfare2":
                b.add("pad", I.pad([F(m) for m in CH["G"] + [74]], 2.6, 0.35, R, 0.1, 1.2, 1400), 68.9)
                for m in (55, 62, 67, 71, 74, 79):
                    b.add("fan0", pan(I.brass(F(m), 1.0, 0.45, R, "horn"), 0.0), 68.9)
        elif style == "deadpan":
            # stop-time: one plucked note on "Suwerte", a little tuba "wah-wah" on "Malas", a tick-tock under the desk
            b.add("mel", pan(I.pluck(F(79), 0.5, R, 1.2, 0.8), 0.2), 39.77)
            b.add("mel", st(I.glock(F(91), 0.35, R, 1.5)), 41.12)
            for k, m in enumerate([55, 54]):
                b.add("horn", pan(I.brass(F(m - 12), 0.45 if k == 0 else 0.9, 0.6, R, "tuba", fall=0 if k == 0 else -120), 0.0), 42.7 + k * 0.5)
            for k in range(int((45.3 - 43.9) / (Q / 2))):
                b.add("perc", st(I.brush(0.18, R, 0.08)), 43.9 + k * Q / 2)
        elif style == "pad":
            for i, t in enumerate(bars(a, e)):
                ch = ["Em", "C", "G", "D"][i % 4]
                b.add("pad", I.pad([F(m) for m in CH[ch]], BAR * 0.98, 0.4, R, 0.5, 0.9, 800), t)
            melody(b, bars(a, e)[0], TUNE[:10], "vibes", 0.4, "mel", 0, p=0.2, t_end=e - 0.1)
        elif style == "sparse":
            for k in range(3):
                b.add("mel", pan(I.pluck(F(67 + 7 * k), 0.35, R, 1.0, 0.4), 0.0), a + k * 0.55)
        elif style == "lullaby":
            for i, t in enumerate(bars(a, e)):
                ch = PROG[i % 4]
                for k in range(8):
                    m = CH[ch][[0, 1, 2, 1][k % 4]] + 12
                    b.add("arp", pan(I.pluck(F(m), 0.3, R, 0.9, 0.4), 0.3 * np.sin(k)), t + k * Q / 2)
            melody(b, bars(a, e)[0], TUNE, "vibes", 0.42, "mel", 0, p=-0.1, t_end=e - 0.1)
    return b


TARGET = {"strum": -8, "bass": -10, "perc": -16, "mel": -7, "horn": -9, "horn2": -8, "pad": -12, "arp": -11,
          "fan0": -7, "fan1": -10, "fan2": -10}


def render(b, ref=-20.0):
    hall = make_ir(1.4, 7, pre=0.018, hf=1.4)
    dry = np.zeros((2, N))
    wet = np.zeros(N)
    for k, x in b.tr.items():
        if not np.any(x):
            continue
        L = integrated(x)
        g = dbg(ref + TARGET.get(k, -10) - L) if np.isfinite(L) else 1.0
        x = x * g
        dry += x
        wet += b.send[k] * x.mean(0)
    out = dry + 0.6 * convolve_st(wet, hall)[:, :N]
    return hp(out, 30, 2)
