# Zombie short soundtrack: an original spooky-comic score (tuba, pizzicato, glock, snare, pad, vibes), synthesized
# sound effects on the picture's events, and the mix: voice unchanged, music ducked under the voice, standard
# balance (music +3 dB, SFX -6 dB against the house levels), true peak <= -1 dBTP. Times mirror story.ts / cast.ts.
import json
import os
import sys
import numpy as np
from dsp import (SR, ns, tt, rng, lp, hp, bp, peq, colored, fades, place, pan, st, widen, make_ir, convolve_st, integrated,
                 true_peak, read_wav, write_wav, dbg, phase, modal, momentary_max, smooth_noise)
import instruments as I
import sfx_gen as G

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
TOTAL = 2067
DUR = TOTAL / FPS
N = ns(DUR)
F = I.m2f
fr = lambda f: f / FPS

# ---------------------------------------------------------------- score
NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
def m(name, octv):
    return 12 * (octv + 1) + NOTE[name]

CHORDS = {"Dm": ["D", "F", "A"], "A7": ["A", "C#", "E", "G"], "Gm": ["G", "Bb", "D"], "Bb": ["Bb", "D", "F"], "F": ["F", "A", "C"],
          "C": ["C", "E", "G"], "E7": ["E", "G#", "B", "D"]}
Q = 0.5  # quarter at 120 bpm


class Band:
    def __init__(self):
        self.tr = {k: np.zeros((2, N)) for k in ["bass", "pluck", "glock", "drums", "pad", "brass", "vibes"]}
        self.r = rng(2011)

    def add(self, tr, x, t, gain=1.0, p=0.0):
        place(self.tr[tr], pan(x, p) if np.ndim(x) == 1 else x, t, gain)


def oompah(b, t0, t1, chords, vel=0.55, bar=4 * Q):
    """tuba on 1 and 3, pizz chord on 2 and 4; chords = list of names, one per bar, cycled"""
    t, i = t0, 0
    while t < t1 - 0.05:
        c = CHORDS[chords[i % len(chords)]]
        root = m(c[0], 2)
        for k, beat in enumerate([0, 2]):
            tb = t + beat * Q
            if tb < t1: b.add("bass", I.brass(F(root + (7 if k else 0) - (12 if root + 7 > m("D", 3) and k else 0)), Q * 0.8, vel, b.r, "tuba"), tb, 1.0)
        for beat in [1, 3]:
            tb = t + beat * Q
            if tb < t1:
                for j, n in enumerate(c[:3]):
                    b.add("pluck", I.pluck(F(m(n, 4)), vel * 0.5, b.r, 0.35, 0.4), tb + 0.004 * j, 0.6, -0.3 + 0.3 * j)
        t += bar; i += 1


def snare_march(b, t0, t1, vel=0.45):
    t = t0
    pat = [1, 0, 0.5, 0.5, 1, 0, 0.6, 0]  # eighths
    i = 0
    while t < t1 - 0.01:
        v = pat[i % 8]
        if v: b.add("drums", I.snare(vel * v, b.r, 0.25, 1.05), t, 1.0, 0.15)
        t += Q / 2; i += 1


def melody(b, tr, notes, t0, vel=0.6, fn="pluck", p=0.0, oct_=5):
    """notes: list of (beats_from_t0, name|None, octave_offset, beats_len)"""
    for beat, n, oo, ln in notes:
        if n is None: continue
        f = F(m(n, oct_ + oo))
        x = {"pluck": lambda: I.pluck(f, vel, b.r, 0.6, 0.55), "glock": lambda: I.glock(f, vel, b.r, 1.4),
             "vibes": lambda: I.vibes(f, vel, b.r, 1.8), "horn": lambda: I.brass(f, ln * Q * 0.9, vel, b.r, "horn"),
             "stab": lambda: I.brass(f, ln * Q * 0.7, vel, b.r, "stab")}[fn]()
        b.add(tr, x, t0 + beat * Q, 1.0, p)


# creeping minor motif (our own): D F A G# A . F D
CREEP = [(0, "D", 0, 1), (1, "F", 0, 1), (2, "A", 0, 1), (3, "G#", 0, 0.5), (3.5, "A", 0, 0.5), (4.5, "F", 0, 1), (5.5, "D", 0, 1)]
# march tune (our own), 2 bars of 4/4 in D minor
MARCH = [(0, "A", 0, 1), (1, "A", 0, 0.5), (1.5, "Bb", 0, 0.5), (2, "A", 0, 1), (3, "F", 0, 1),
         (4, "G", 0, 1), (5, "E", 0, 0.5), (5.5, "F", 0, 0.5), (6, "D", 0, 2)]
# bright tune for the CDC (F major)
BRIGHT = [(0, "C", 1, 0.5), (0.5, "A", 0, 0.5), (1, "F", 0, 1), (2, "G", 0, 0.5), (2.5, "A", 0, 0.5), (3, "C", 1, 1),
          (4, "D", 1, 0.5), (4.5, "C", 1, 0.5), (5, "A", 0, 1), (6, "G", 0, 2)]


def build_music():
    b = Band(); r = b.r
    # hook 0 - 4.9: spooky pad + creep motif, timpani on "zombie" (1.30)
    b.add("pad", I.pad([F(m("D", 3)), F(m("A", 3)), F(m("F", 4))], 4.6, 0.45, r, att=0.4, rel=0.6), 0.0, 1.0)
    melody(b, "pluck", CREEP, 0.1, 0.55, "pluck", 0.2, 4)
    b.add("drums", I.timpani(F(m("D", 2)), 0.9, r, 2.0), 1.28, 1.0)
    b.add("drums", I.cymbal(0.35, r, 1.6, 0.8), 1.28, 0.5)
    melody(b, "brass", [(0, "D", 0, 1), (1, "F", 0, 1), (2, "A", 0, 2)], 2.4, 0.55, "horn", -0.2, 3)  # "the US military"
    b.add("brass", I.brass(F(m("D", 4)), 0.5, 0.8, r, "stab"), 4.2, 1.0)                           # "plan"
    # base + office 4.9 - 14.8: snare march, oompah Dm/A7, march tune on horn then glock
    oompah(b, 4.95, 14.8, ["Dm", "A7", "Dm", "A7", "Gm", "Dm", "A7", "Dm"], 0.5)
    snare_march(b, 4.95, 14.8, 0.38)
    melody(b, "brass", MARCH, 4.95, 0.45, "horn", -0.15, 4)
    melody(b, "glock", MARCH, 8.95, 0.5, "glock", 0.25, 5)
    melody(b, "brass", MARCH, 12.95 - 4 * Q, 0.0, "horn")  # (rest)
    # line-up 14.8 - 28.7: bouncy oompah + a sting per zombie type
    oompah(b, 14.83, 28.6, ["Dm", "Gm", "A7", "Dm"], 0.55)
    for t, kind in [(15.1, "vibes"), (16.3, "glock"), (17.5, "pluck"), (20.0, "vibes")]:
        notes = {"vibes": [(0, "D", 0, 1), (0.5, "F", 0, 1), (1, "A", 0, 1)], "glock": [(0, "A", 0, 1), (0.25, "C#", 1, 1), (0.5, "E", 1, 1), (0.75, "A", 1, 1)],
                 "pluck": [(0, "F", 0, 1), (0.5, "F", 0, 1), (1, "G", 0, 1)]}[kind]
        melody(b, "vibes" if kind != "glock" else "glock", notes, t, 0.55, kind, 0.2, 5)
    b.add("drums", I.timpani(F(m("A", 1)), 1.0, r, 2.2), 23.5, 1.0)
    b.add("drums", I.cymbal(0.6, r, 2.2, 1.0), 23.52, 0.8)
    b.add("brass", I.brass(F(m("D", 3)), 0.7, 0.9, r, "stab", fall=-5), 24.45, 1.0)  # chicken: a wah-wah fall
    b.add("brass", I.brass(F(m("C#", 3)), 0.8, 0.8, r, "stab", fall=-7), 25.3, 0.8)
    melody(b, "glock", [(0, "D", 1, 1), (1, "A", 0, 1), (2, "D", 0, 2)], 27.0, 0.5, "glock", 0.2, 5)
    # CDC 28.7 - 38.24: bright F major, vibes + pizz, builds with a snare roll into the crash
    oompah(b, 28.7, 38.1, ["F", "C", "Bb", "C"], 0.4)
    melody(b, "vibes", BRIGHT, 28.75, 0.5, "vibes", 0.2, 5)
    melody(b, "glock", BRIGHT, 32.75, 0.45, "glock", -0.2, 5)
    b.add("glock", I.glock(F(m("C", 7)), 0.7, r, 1.0), 31.9, 0.8)  # "posts": ding
    for t, v in I.snare_roll(36.0, 38.2, 0.15, 0.75, r):
        b.add("drums", I.snare(v, r, 0.2, 1.0, buzz=True), t, 0.9, 0.1)
    b.add("drums", I.cymbal(0.9, r, 2.6, 1.1), 38.24, 1.0)
    b.add("brass", I.brass(F(m("Bb", 2)), 1.0, 0.95, r, "stab", fall=-12), 38.24, 1.0)
    # Luckily / Unluckily
    for k, n in enumerate(["F", "A", "C"]):
        b.add("brass", I.brass(F(m(n, 4)), 0.8, 0.8, r, "horn"), 39.0 + 0.02 * k, 0.8, -0.3 + 0.3 * k)
    b.add("drums", I.snare(0.6, r), 39.0, 0.8)
    for k, n in enumerate(["G", "F#", "F", "E"]):  # sad trombone on "Unluckily"
        b.add("brass", I.brass(F(m(n, 3)), 0.45 if k < 3 else 1.1, 0.75, r, "horn", fall=-3 if k == 3 else 0), 41.3 + 0.45 * k, 0.9)
    # explanation 43.9 - 50.8: pad + vibes, Dm Bb F C
    for k, ch in enumerate(["Dm", "Bb", "F", "C"]):
        notes = [F(m(n, 3 if j == 0 else 4)) for j, n in enumerate(CHORDS[ch][:3])]
        b.add("pad", I.pad(notes, 1.9, 0.45, r, att=0.3, rel=0.5), 43.9 + 1.73 * k, 1.0)
        melody(b, "vibes", [(0, CHORDS[ch][2], 0, 1), (1, CHORDS[ch][1], 0, 1), (2, CHORDS[ch][0], 1, 1)], 43.95 + 1.73 * k, 0.4, "vibes", 0.1, 5)
    b.add("drums", I.timpani(F(m("D", 2)), 0.5, r, 1.4), 45.5, 0.8)  # "rise"
    # list 50.8 - 55.2: pizz pulse + a glock ping on each item
    oompah(b, 50.85, 55.1, ["Dm", "Gm"], 0.35)
    for t, n in zip([52.06, 52.6, 53.16, 53.84, 54.46], ["D", "F", "A", "C", "D"]):
        b.add("glock", I.glock(F(m(n, 6 if n != "D" or t < 54 else 7)), 0.6, r, 1.2), t, 1.0, 0.2)
    # camp 55.2 - 59.12: warm, then stops dead at the blackout
    for k, ch in enumerate(["F", "C"]):
        b.add("pad", I.pad([F(m(n, 4)) for n in CHORDS[ch]], 1.4, 0.4, r, att=0.2, rel=0.3), 55.2 + 1.3 * k, 1.0)
    melody(b, "pluck", [(0, "F", 0, 1), (1, "A", 0, 1), (2, "C", 1, 1), (3, "A", 0, 1), (4, "G", 0, 1)], 55.25, 0.5, "pluck", 0.2, 5)
    b.add("drums", I.timpani(F(m("A", 1)), 0.7, r, 1.4), 57.82, 0.9)
    b.add("drums", I.timpani(F(m("F", 1)), 0.7, r, 1.0), 58.6, 0.9)
    # comic 59.7 - 63.5: the march tune comes back light on glock
    oompah(b, 59.75, 63.4, ["Dm", "A7"], 0.38)
    melody(b, "glock", MARCH, 59.75, 0.5, "glock", 0.25, 5)
    b.add("drums", I.cymbal(0.4, r, 1.2, 1.2), 62.82, 0.7)
    # ending 63.5 - 68.9: creep motif + march, button on "chickens"
    b.add("pad", I.pad([F(m("D", 3)), F(m("A", 3)), F(m("F", 4))], 4.6, 0.4, r, att=0.3, rel=0.4), 63.55, 1.0)
    melody(b, "pluck", CREEP, 63.55, 0.55, "pluck", 0.2, 4)
    snare_march(b, 66.0, 68.3, 0.3)
    oompah(b, 66.0, 68.3, ["Dm", "A7"], 0.45)
    for k, n in enumerate(["D", "F", "A"]):
        b.add("brass", I.brass(F(m(n, 4)), 0.35, 0.9, r, "stab"), 68.36 + 0.01 * k, 1.0, -0.3 + 0.3 * k)
    b.add("drums", I.timpani(F(m("D", 2)), 0.8, r, 0.5), 68.36, 1.0)
    # balance inside the band
    g = {"bass": 0.9, "pluck": 0.55, "glock": 0.35, "drums": 0.55, "pad": 0.45, "brass": 0.55, "vibes": 0.4}
    mix = sum(g[k] * v for k, v in b.tr.items())
    ir = make_ir(1.1, 7)
    mix = mix + 0.18 * convolve_st(mix, ir)
    mix[:, ns(59.12):ns(59.75)] *= np.linspace(0, 1, ns(59.75) - ns(59.12)) ** 3  # silence under the blackout
    return mix


# ---------------------------------------------------------------- sound effects
def moan(r, base=None, dur=None):
    base = base or r.uniform(85, 115)
    d = dur or r.uniform(0.9, 1.4)
    n = ns(d)
    t = np.arange(n) / SR
    f0 = base * G._track(n, [(0, 1.0), (d * 0.5, 0.92), (d, 0.8)], t) * (1 + 0.03 * np.sin(t * 2 * np.pi * 5))
    forms = G.vowel_track(n, [(0, "u"), (d * 0.3, "o"), (d * 0.7, "u"), (d, "U")])
    amp = np.clip(t / 0.15, 0, 1) * np.clip((d - t) / 0.25, 0, 1)
    return fades(G.vox(f0, forms, amp, r, 0.92, tilt=1.25, breath=0.4), 0.01, 0.05)


def cluck(r, n_=3, base=None):
    """a hen's 'bok bok bawk': short pitched bursts"""
    base = base or r.uniform(520, 640)
    out = np.zeros(ns(0.2 * n_ + 0.3))
    for k in range(n_):
        d = 0.09 if k < n_ - 1 else 0.22
        n = ns(d); t = np.arange(n) / SR
        f0 = base * (1.0 + (0.35 if k == n_ - 1 else 0.1) * np.sin(np.pi * t / d))
        forms = G.vowel_track(n, [(0, "a"), (d, "A")])
        amp = np.clip(t / 0.006, 0, 1) * np.clip((d - t) / 0.03, 0, 1)
        y = G.vox(f0, forms, amp, r, 1.35, tilt=0.9, breath=0.3, fmax=7000)
        G._place_mono(out, y, 0.17 * k)
    return out


def click(r, f0=3500, d=0.03):
    t = tt(d)
    return bp(r.standard_normal(len(t)), f0 * 0.6, f0 * 1.6, 2) * np.exp(-t / 0.004)


def typing(dur, r, rate=9.0):
    out = np.zeros(ns(dur))
    t = 0.0
    while t < dur - 0.05:
        G._place_mono(out, click(r, r.uniform(2500, 4500)) * r.uniform(0.5, 1.0), t)
        t += r.exponential(1 / rate) + 0.03
    return out


def paper(r, d=0.35):
    t = tt(d)
    nz = colored(len(t), r, 0.3)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return bp(nz, 1500, 7000, 1) * env * 0.6


def fall_whistle(d, r):
    t = tt(d)
    f = 1900 * (300 / 1900) ** (t / d)
    y = np.sin(phase(f)) * (0.3 + 0.7 * t / d) + 0.25 * bp(r.standard_normal(len(t)), 600, 3000, 1) * (t / d)
    return fades(y, 0.05, 0.02)


def zap(r, d=0.9):
    t = tt(d)
    crack = hp(r.standard_normal(len(t)), 1500) * (r.random(len(t)) < 0.02 + 0.2 * np.exp(-t / 0.08)) * 2.0
    hum = np.sin(phase(120 * (1 - 0.6 * t / d))) * np.exp(-t / 0.3) * 0.8 + np.sin(phase(240 * (1 - 0.6 * t / d))) * np.exp(-t / 0.25) * 0.4
    pd = np.sin(phase(900 * (0.15 / 1) ** (t / d))) * np.exp(-t / 0.35) * 0.4
    return fades(crack * np.exp(-t / 0.3) + hum + pd, 0.0, 0.05)


def sizzle(d, r):
    t = tt(d)
    return hp(r.standard_normal(len(t)), 3000) * (0.2 + 0.1 * smooth_noise(len(t), r, 3.0)) * np.clip(t / 0.2, 0, 1) * np.clip((d - t) / 0.3, 0, 1)


def pop(r):
    t = tt(0.08)
    return np.sin(phase(700 * (1 + 2 * np.exp(-t / 0.01)))) * np.exp(-t / 0.02)


def rain_noise(d, r):
    t = tt(d)
    y = hp(colored(len(t), r, 0.2), 900) * 0.5
    drops = hp(r.standard_normal(len(t)) * (r.random(len(t)) < 0.004), 2000) * 3
    return (y + drops) * np.clip(t / 0.15, 0, 1) * np.clip((d - t) / 0.1, 0, 1)


def crackle(d, r):
    t = tt(d)
    return hp(r.standard_normal(len(t)) * (r.random(len(t)) < 0.003), 1500) * 4 + lp(colored(len(t), r, 1.0), 400) * 0.3


def build_sfx():
    r = rng(28)
    S = np.zeros((2, N))
    def ev(x, t, g=1.0, p=0.0):
        place(S, pan(x, p) if np.ndim(x) == 1 else x, t, g)
    # ambiences (beds, low)
    for t0, t1 in [(0, 4.9), (63.5, DUR)]:
        ev(G.bird_chirps(t1 - t0, r, 0.6), t0, 0.35, 0.3)
        ev(G.breeze(t1 - t0, r, 0.6), t0, 0.25)
    ev(G.flag_flutter(2.9, r), 5.0, 0.5, 0.4); ev(G.breeze(3.0, r, 0.8), 4.9, 0.35)
    ev(G.bird_chirps(13.9, r, 0.5), 14.8, 0.3, -0.3)
    ev(G.crickets(3.9, r, 3), 55.2, 0.35, 0.2)
    ev(crackle(3.9, r), 55.2, 0.35, 0.4)
    # zombie moans (street + field + ending)
    for t, p in [(1.35, -0.3), (2.3, 0.4), (3.5, -0.1), (15.2, 0.0), (16.5, 0.1), (20.6, 0.3), (64.7, -0.4), (65.6, 0.3), (66.8, 0.0)]:
        ev(moan(r), t, 0.8, p)
    # whooshes on cuts / place changes, flash shimmer after the hook
    for f in [38, 147, 237, 318, 445, 488, 525, 668, 734, 861, 955, 1078, 1143, 1170, 1239, 1317, 1474, 1525, 1650, 1785, 1905, 1990]:
        ev(widen(G.whoosh(0.45, r, peak=0.12, tail=0.15), r), fr(f) - 0.12, 0.45)
    ev(widen(G.whoosh(0.9, r, peak=0.15, f_lo=900, f_hi=6000, tail=0.4, air=0.4), r), fr(147) - 0.1, 0.6)
    # office: writing / typing, page flips
    ev(typing(3.5, r), 8.0, 0.35, 0.2)
    for t in [10.55, 11.15, 11.75, 12.4, 12.86]:
        ev(paper(r), t, 0.7, 0.1)
    # line-up: radiation hum, magic sparkle, munching, satellite fall + crash, chicken
    t = tt(1.3); ev(np.sin(phase(60 + 0 * t)) * 0.5 + 0.2 * hp(r.standard_normal(len(t)), 4000) * (r.random(len(t)) < 0.03), 15.0, 0.5)
    for k in range(6): ev(I.glock(F(m("A", 6)) * 2 ** (k / 7), 0.4, r, 0.6), 16.35 + 0.07 * k, 0.4, 0.3)
    for k in range(5):  # munch
        ev(G.stroll_step(r, 0.9) * 0.6, 19.0 + 0.17 * k, 0.6, 0.2); ev(click(r, 1200, 0.06), 19.0 + 0.17 * k, 0.6, 0.2)
    ev(fall_whistle(SAT_T - 22.27, r), 22.27, 0.7, 0.2)
    ev(G.wood_crack(r), SAT_T, 1.0)
    ev(G.bolt_snap(r), SAT_T + 0.02, 0.6, 0.2)
    ev(G.oof(r, "oof"), SAT_T + 0.08, 0.7, 0.1)
    for k in range(4): ev(G.clink(r), SAT_T + 0.25 + 0.13 * k, 0.5, 0.3 - 0.2 * k)
    ev(cluck(r, 3), 24.5, 0.8, 0.2)
    ev(cluck(r, 2, 480), 26.9, 0.6, 0.2)
    # CDC: typing, the click on "posts", crowd, phone pings, the crash, sizzle
    ev(typing(3.0, r), 28.9, 0.35, 0.1)
    ev(click(r, 2000, 0.05), 31.9, 0.8)
    crowd = np.zeros((2, ns(2.3)))
    for k in range(10):
        place(crowd, pan(G.babble(2.3, r, r.uniform(100, 220), r.uniform(0.95, 1.25)) * min(1, 0.2 + k * 0.1), r.uniform(-0.7, 0.7)), 0.0, 0.25)
    env = np.clip(np.linspace(0, 1, crowd.shape[1]) * 1.5, 0, 1)
    ev(crowd * env, 35.95, 0.6)
    for k in range(10): ev(I.glock(F(m("E", 7)), 0.35, r, 0.3), 36.05 + 0.2 * k + r.uniform(0, 0.1), 0.35, r.uniform(-0.6, 0.6))
    ev(zap(r), CRASH_T, 1.0)
    ev(G.bolt_snap(r), CRASH_T, 0.5, -0.2)
    for k in range(4): ev(G.whoa(r), CRASH_T + 0.1 + 0.08 * k, 0.45, r.uniform(-0.6, 0.6))
    ev(sizzle(2.6, r), 41.3, 0.5, 0.2)
    # pins pop up on "rise"
    for k in range(9): ev(pop(r), 45.45 + 0.06 * k, 0.4, -0.4 + 0.1 * k)
    # the list drops into the bag
    for t in [52.06, 52.6, 53.16, 53.84, 54.46]:
        ev(G.push_thump(r), t, 0.7, 0.2)
    ev(G.clink(r, 2600), 52.62, 0.5, 0.2)
    # camp: wind gust, rain, blackout clunk
    ev(G.breeze(1.4, r, 3.0, gust=0.6, bright=1800), 57.75, 0.9)
    ev(rain_noise(1.2, r), 58.55, 0.6)
    t = tt(0.4); ev(lp(r.standard_normal(len(t)), 200) * np.exp(-t / 0.06) * 2, 59.12, 1.0); ev(click(r, 1500, 0.04), 59.12, 0.5)
    # comic slap
    t = tt(0.3); ev(bp(r.standard_normal(len(t)), 800, 5000, 1) * np.exp(-t / 0.01) * 1.5 + lp(r.standard_normal(len(t)), 250) * np.exp(-t / 0.05) * 1.5, 62.82, 0.9)
    # ending chicken
    ev(cluck(r, 3, 600), 67.85, 0.8, -0.2)
    ev(cluck(r, 1, 560), 68.5, 0.7, -0.2)
    return S


SAT_T, CRASH_T = 23.52, 38.24


def speech_spans(words, merge=0.3):
    spans = []
    for w in words:
        if spans and w["s"] - spans[-1][1] < merge: spans[-1][1] = w["e"]
        else: spans.append([w["s"], w["e"]])
    return spans


def limiter(x, ceil_db=-1.2, att=0.002, rel=0.08):
    ceil = dbg(ceil_db)
    pk = np.max(np.abs(x), axis=0)
    g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    # smooth gain: instant attack via min filter over a short window, then release
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(g, size=ns(att) * 2 + 1)
    out = np.empty_like(g); cur = 1.0; k = np.exp(-1 / (rel * SR))
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else cur * k + (1 - k) * g[i]
        out[i] = cur
    return x * out


def main():
    vdir = sys.argv[1]
    out = sys.argv[2]
    v, sr = read_wav(os.path.join(vdir, "voice.wav"))
    assert sr == SR
    voice = np.zeros((2, N)); place(voice, v, 0.0)
    words = json.load(open(os.path.join(vdir, "words.json")))
    VL = integrated(voice)
    music = build_music()
    sfx = build_sfx()
    # house balance: music bed at voice -13 LU, SFX events at voice -4 LU momentary; then the standard +3 / -6 dB
    music = music * dbg(VL - 13 - integrated(music)) * dbg(3.0)
    sfx = sfx * dbg(VL - 4 - momentary_max(sfx)) * dbg(-6.0)
    # duck the music while the voice speaks (keyed from words.json), 3 dB, 60 ms ramps
    duck = np.ones(N)
    for a, b2 in speech_spans(words):
        duck[ns(a):ns(b2)] = dbg(-3.0)
    from scipy.ndimage import uniform_filter1d
    duck = uniform_filter1d(duck, ns(0.06))
    music = music * duck
    mix = voice + music + sfx
    mix = mix * dbg(-15.0 - integrated(mix))  # master gain (all stems together: the balance is kept)
    mix = limiter(mix, -1.3)
    os.makedirs(out, exist_ok=True)
    write_wav(os.path.join(out, "mix.wav"), mix)
    write_wav(os.path.join(out, "music.wav"), music); write_wav(os.path.join(out, "sfx.wav"), sfx)
    print(f"voice {VL:.1f} LUFS | mix {integrated(mix):.1f} LUFS | music {integrated(music):.1f} | TP {true_peak(mix):.2f} dBTP | {mix.shape[1] / SR:.3f} s")


if __name__ == "__main__":
    main()
