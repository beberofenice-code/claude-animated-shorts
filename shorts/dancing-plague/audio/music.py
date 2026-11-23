# Original score for "The Dancing Plague": a jig in D dorian (6/8, dotted quarter = 100 bpm, bar = 1.2 s) for pipe
# (fife synth), lute (plucked strings), tabor (small snare drum, slack gut snare) and a drone. The music is part of the
# story: it plays for the hook, falls silent on "No music", creeps back as a tension pulse while the dancing spreads,
# comes back in full as the doctors' "cure" (more dancing / the hired band), slides to a halt when the dancers
# collapse, turns into a lullaby for the yawns, swells for "a whole city", is cut dead by the hammer on "banned",
# and returns as one cheeky bar on the pipe for the red shoes.
import numpy as np
from dsp import SR, ns, rng, pan, st, place, lp, fades, TAU, phase
import instruments as I
import timeline as T

N = ns(T.DUR)
BAR = 1.2
E8 = BAR / 6  # eighth note
m2f = I.m2f

# the tune (own): eighth-note slots per bar, midi or None (= hold previous)
A_PART = [
    [74, 74, 72, 69, 67, 69], [74, 74, 72, 69, 72, 74], [76, 77, 76, 74, 72, 69], [67, 69, 72, 74, None, 74],
    [77, 76, 74, 72, 74, 76], [77, 79, 77, 76, 74, 72], [74, 72, 69, 67, 69, 72], [74, None, None, 74, None, None],
]
CHORDS = [("Dm", "Dm"), ("Dm", "C"), ("C", "Am"), ("G", "Dm"), ("F", "C"), ("F", "C"), ("Dm", "C"), ("Dm", "Dm")]
CH = {"Dm": [50, 57, 62, 65], "C": [48, 55, 60, 64], "Am": [45, 52, 57, 60], "G": [43, 50, 55, 59], "F": [41, 48, 53, 57]}

# sections for the level automation (name, start, end): music level is set per section relative to the voice
SECTIONS = [
    ("hook", 0.0, T.FLASH), ("town", T.FLASH, 15.85), ("silence", 15.85, 17.3), ("creep", 17.3, 25.0), ("spread", 25.0, 28.1),
    ("doctors", 28.1, 34.55), ("cure", 34.55, 43.75), ("fall", 43.75, 44.7), ("lullaby", 44.7, 50.4), ("dread", 50.4, 56.5),
    ("city", 56.5, 59.9), ("cut", 59.9, 60.5), ("road", 60.5, 67.3), ("shoes", 67.3, T.DUR),
]


class Band:
    def __init__(self):
        self.st = {k: np.zeros((2, N)) for k in ("pipe", "lute", "drum", "drone", "perc")}
        self.cues = []
        self.r = rng(1518)

    def add(self, stem, x, t, p=0.0, g=1.0):
        if x.ndim == 1:
            x = pan(x, p)
        place(self.st[stem], x, t, g)

    def cue(self, t, d):
        self.cues.append((t, d))

    def rr(self):
        return rng(int(self.r.integers(1 << 30)))


def jig(b, t0, bars, pipe=True, lute=True, drum=True, drone=True, vel=1.0, stop=None, transpose=0):
    """play `bars` bars of the tune from t0 (cycling the 8-bar A part); everything ending before `stop`"""
    stop = stop if stop is not None else 1e9
    for k in range(bars):
        tb = t0 + k * BAR
        if tb >= stop - 0.02:
            break
        mel, chs = A_PART[k % 8], CHORDS[k % 8]
        if pipe:
            i = 0
            while i < 6:
                n = mel[i]
                j = i + 1
                while j < 6 and mel[j] is None:
                    j += 1
                if n is not None:
                    tn = tb + i * E8 + 0.008 * b.r.standard_normal()
                    dur = min((j - i) * E8 * 0.9, stop - tn - 0.03)
                    if dur > 0.04:
                        acc = 1.0 if i in (0, 3) else 0.82
                        b.add("pipe", I.fife(m2f(n + transpose), dur, 0.55 * vel * acc, b.rr()), tn, 0.15)
                i = j
        if lute:
            for half in (0, 1):
                th = tb + half * 3 * E8
                if th >= stop - 0.05:
                    continue
                notes = CH[chs[half]]
                for q, nn in enumerate(notes):  # quick strum, bass first
                    b.add("lute", I.pluck(m2f(nn + transpose), 0.42 * vel * (1.0 if q == 0 else 0.7), b.rr(), dur=0.9, bright=0.55), th + q * 0.018, -0.25)
                b.add("lute", I.pluck(m2f(notes[2] + 12 + transpose), 0.22 * vel, b.rr(), dur=0.5, bright=0.6), th + 2 * E8, -0.3)
        if drum:
            for i, v in ((0, 1.0), (2, 0.45), (3, 0.8), (5, 0.5)):
                td = tb + i * E8
                if td < stop - 0.02:
                    b.add("drum", I.snare(0.55 * vel * v, b.rr(), dur=0.28, tune=0.62, snappy=0.35), td, 0.05)
        if drone:
            d = min(BAR, stop - tb)
            if d > 0.1:
                b.add("drone", I.pad([m2f(38 + transpose), m2f(45 + transpose)], d, 0.22 * vel, b.rr(), att=0.05 if k else 0.15, rel=0.12, warm=700), tb)


def lute_arps(b, t0, t1, chords, per_bar=6, vel=0.32, bar=BAR, bright=0.4, octave=0):
    """gentle broken chords (one note per slot)"""
    k = 0
    tb = t0
    while tb < t1 - 0.05:
        notes = CH[chords[k % len(chords)]]
        seq = [notes[0], notes[2], notes[3], notes[1] + 12, notes[3], notes[2]]
        for i in range(per_bar):
            tn = tb + i * bar / per_bar
            if tn < t1 - 0.05:
                b.add("lute", I.pluck(m2f(seq[i % 6] + octave), vel * (1.0 if i == 0 else 0.75), b.rr(), dur=1.4, bright=bright), tn, -0.2 + 0.08 * (i % 3))
        tb += bar
        k += 1


def pad_hold(b, t0, dur, notes, vel=0.25, att=0.8, rel=1.2, warm=600):
    b.add("drone", I.pad([m2f(n) for n in notes], dur, vel, b.rr(), att=att, rel=rel, warm=warm), t0)


def slide_down(f0, dur, vel, r):
    """the pipe's last note sagging a fifth as the dancers drop"""
    n = ns(dur)
    t = np.arange(n) / SR
    f = f0 * 2 ** (-(7 / 12) * (t / dur) ** 1.6)
    ph = phase(f)
    env = np.minimum(1, t / 0.02) * (1 - t / dur) ** 0.6
    return (np.sin(ph) + 0.2 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)) * env * vel


def build():
    b = Band()
    # hook: the jig, cut hard on the white flash
    jig(b, 0.0, 5, stop=T.FLASH, vel=1.0)
    b.cue(0.0, "jig (pipe, lute, tabor, drone) - the plague in full swing")
    # setting + Troffea steps out: calm lute, warm pad
    lute_arps(b, T.FLASH + 0.15, 15.85, ["Dm", "C", "Dm", "Am"], per_bar=3, vel=0.3, bar=1.6)
    pad_hold(b, T.FLASH + 0.1, 10.4, [50, 57, 62], vel=0.18)
    b.cue(T.FLASH, "town: slow lute broken chords + soft pad")
    # "No music": silence (the dance goes on to the sound of her shoes only)
    b.cue(15.85, "music stops dead on 'No music'")
    # the creep: a low pulse that grows while the dancing spreads
    t = 17.3
    while t < 25.0:
        k = (t - 17.3) / 7.7
        b.add("lute", I.pluck(m2f(38), 0.32 + 0.2 * k, b.rr(), dur=0.6, bright=0.2), t, 0)
        b.add("lute", I.pluck(m2f(45), 0.2 + 0.15 * k, b.rr(), dur=0.5, bright=0.2), t + 3 * E8, 0)
        if t > 22.3:
            for i in (1, 2, 4, 5):
                b.add("lute", I.pluck(m2f(57 if i < 3 else 60), 0.16 + 0.1 * k, b.rr(), dur=0.3, bright=0.35), t + i * E8, 0.3)
        t += BAR
    pad_hold(b, 17.3, 7.7, [38, 45], vel=0.2, att=2.0, rel=0.4)
    b.cue(17.3, "tension pulse (low lute D-A), ostinato joins with the thirty dancers")
    # by August, hundreds: tabor + drone + pipe fragments
    jig(b, 25.0, 3, pipe=False, vel=0.75, stop=28.1)
    for k, n in enumerate([69, 72, 74, 76, 77]):
        b.add("pipe", I.fife(m2f(n), 0.18, 0.35, b.rr()), 26.2 + k * 0.4, 0.2)
    b.cue(25.0, "hundreds: tabor + drone + rising pipe fragments")
    # doctors: comic pizzicato walk, timpani on "hot blood", bright chord on "Luckily", triangle on "cure"
    walk = [50, 57, 53, 57, 50, 57, 48, 55, 50, 57, 53, 57, 50, 52, 53, 55]
    for k in range(16):
        tk = 28.15 + k * 0.4
        if tk < 34.4:
            b.add("lute", I.pluck(m2f(walk[k]), 0.36, b.rr(), dur=0.35, bright=0.3), tk, -0.1)
    b.add("perc", I.timpani(m2f(38), 0.8, b.rr()), T.W(916) - 0.02)
    for n in (62, 66, 69, 74):
        b.add("perc", I.glock(m2f(n + 12), 0.3, b.rr()), T.W(944) + 0.02 * (n - 62) / 4)
    b.add("perc", I.triangle(0.5, b.rr()), T.W(982))
    b.cue(28.1, "doctors: pizzicato walk, timpani 'hot blood', glock 'Luckily', triangle 'cure'")
    # "more dancing": the jig is back, bigger when the band is hired, then it sags as the dancers collapse
    jig(b, T.W(1038) - 0.02, 8, vel=0.9, stop=43.7)
    b.cue(T.W(1038), "'more dancing': the jig returns")
    b.add("pipe", slide_down(m2f(74), 0.75, 0.5, b.rr()), 43.65, 0.15)
    b.add("drum", I.snare(0.5, b.rr(), dur=0.3, tune=0.55, snappy=0.3), 43.88, 0.05)
    b.cue(43.65, "pipe note sags a fifth as the dancers drop")
    # yawns: lullaby (lute arpeggios + warm pad)
    lute_arps(b, 44.85, 50.4, ["Dm", "Am", "F", "C"], per_bar=6, vel=0.26, bar=1.8, bright=0.3)
    pad_hold(b, 44.8, 5.5, [50, 57, 62, 65], vel=0.17, att=1.0)
    b.cue(44.8, "lullaby for the yawns")
    # fear, hunger, St Vitus: dark drone, timpani on "Saint Vitus", a growing roll into "a whole city"
    pad_hold(b, 50.4, 6.1, [38, 45, 50, 53], vel=0.24, att=0.6, rel=0.3, warm=450)
    b.add("perc", I.timpani(m2f(38), 0.9, b.rr()), T.W(1593) - 0.02)
    roll = 53.9
    while roll < 56.55:
        v = 0.15 + 0.5 * ((roll - 53.9) / 2.65) ** 2
        b.add("drum", I.snare(v, b.rr(), dur=0.2, tune=0.6, snappy=0.3), roll, 0.0)
        roll += 0.07 if roll > 55.5 else 0.12
    b.cue(50.4, "dread drone, timpani on 'Saint Vitus', drum roll into 'whole city'")
    # a whole city: the jig at full tilt ... cut dead by the hammer on "banned"
    jig(b, 56.55, 3, vel=1.05, stop=T.HITS[1])
    b.cue(56.55, "whole city: jig full; cut on the second hammer blow ('banned')")
    # the road to the shrine: a slow, warm lute in golden light
    lute_arps(b, 60.6, 67.2, ["Dm", "C", "F", "Am", "Dm"], per_bar=6, vel=0.24, bar=1.5, bright=0.35)
    pad_hold(b, 60.5, 6.7, [50, 57, 62], vel=0.16, att=1.2, rel=0.8)
    b.cue(60.5, "road to the shrine: slow lute + pad")
    # red shoes: one bar of the jig on the pipe, solo, a drum tap to button it
    t0 = 67.75
    for i, n in enumerate(A_PART[0]):
        b.add("pipe", I.fife(m2f(n), E8 * 0.85, 0.5, b.rr()), t0 + i * E8 * 0.9, 0.1)
    b.add("drum", I.snare(0.55, b.rr(), dur=0.3, tune=0.62, snappy=0.35), t0 + 6 * E8 * 0.9 + 0.02, 0.0)
    b.cue(t0, "red shoes: one cheeky bar of the jig on the pipe")
    return b


def render(b, ref=-20.0):
    out = sum(b.st.values())
    out = lp(out, 12000, 2)
    return fades(out, 0.0, 0.05), None
