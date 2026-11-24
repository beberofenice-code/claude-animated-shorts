# Sound effects for the pelikula short: every event is placed on the picture's frame (shot table mirrored from
# remotion/src/videos/pelikula/story.ts). All synthesized (sfx_gen.py / instruments.py), nothing sampled.
import numpy as np
from dsp import SR, ns, rng, lp, hp, bp, reson, colored, smooth_noise, fades, pan, st, place, widen, make_ir, convolve_st, integrated, dbg
import sfx_gen as G
import instruments as I

FPS = 30
DUR = 70.0
N = ns(DUR)
fr = lambda f: f / FPS
# shot starts (frames) and which ones crossfade (soft whoosh) vs hard cut
SHOT_A = [0, 98, 190, 299, 400, 489, 667, 751, 937, 1022, 1063, 1109, 1193, 1281, 1363, 1421, 1651, 1766, 1819, 1977]
XF = {5, 6, 8, 9, 10, 11, 12, 15, 17, 18, 19, 20}
INNER_CUTS = [128, 436, 546, 829, 985, 1123, 1318, 1464, 1512, 1574, 1601, 1697, 2054]
W = {k: v / 30 for k, v in dict(pelikula=70, ginawa=122, presidente=144, bida=166, gumagalaw=439, singkwenta=517, tatlong=546, hapon=698,
                                  metro=844, noche=955, pamilya=996, pila=1022, nanalong=1109, presidente2=1123, suwerte=1193, magligtas=1234,
                                  malas=1281, doble=1318, malakanyang=1331, handaan=1421, pagtawa=1544, iyak=1574, sigaw=1601, malamig=1705,
                                  mainit=1798, samasama=1914, halalan=1988, sino=2054, bida2=2067).items()}


def addm(*xs):
    """sum mono signals of different lengths"""
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[: len(x)] += x
    return out


def laugh(r, base=180.0, n_syl=6, rate=6.5, scale=1.0):
    """'ha-ha-ha': formant 'a' syllables with breathy onsets, pitch stepping down"""
    d = n_syl / rate + 0.15
    n = ns(d)
    t = np.arange(n) / SR
    amp = np.zeros(n)
    for k in range(n_syl):
        t0 = k / rate
        u = (t - t0) / (0.7 / rate)
        amp += np.clip(u * 6, 0, 1) * np.clip(1 - u, 0, 1) ** 1.5 * (1 - 0.08 * k)
    f0 = base * (1.25 - 0.3 * t / d) * (1 + 0.04 * np.sin(2 * np.pi * rate * t))
    forms = G.vowel_track(n, [(0, "a"), (d, "A")])
    y = G.vox(f0, forms, amp, r, scale, tilt=1.0, breath=0.45)
    return fades(y, 0.002, 0.05)


def crowd_laugh(dur, r, people=10, base=(150, 260), level=1.0):
    out = np.zeros((2, ns(dur)))
    for p in range(people):
        tm = r.uniform(0, 0.4)
        while tm < dur - 0.5:
            y = laugh(r, r.uniform(*base), int(r.integers(4, 8)), r.uniform(5.5, 7.5), r.uniform(0.95, 1.15))
            place(out, pan(y * r.uniform(0.5, 1.0), r.uniform(-0.8, 0.8)), tm)
            tm += len(y) / SR + r.uniform(0.2, 1.2)
    return out * level


def chatter(dur, r, people=8, level=1.0, fmax=3600):
    out = np.zeros((2, ns(dur)))
    for p in range(people):
        base = r.uniform(95, 140) if p % 2 else r.uniform(170, 240)
        out += pan(G.babble(dur, r, base, r.uniform(0.95, 1.15), rate=r.uniform(3.6, 4.8), fmax=fmax), r.uniform(-0.9, 0.9))
    return lp(out, 3000) * level / max(1, np.sqrt(people))


def cheer(dur, r, people=14, level=1.0, kids=0.3):
    out = np.zeros((2, ns(dur)))
    for p in range(people):
        kid = r.uniform() < kids
        base = r.uniform(240, 320) if kid else (r.uniform(110, 160) if p % 2 else r.uniform(190, 260))
        tm = r.uniform(0, 0.5)
        while tm < dur - 0.4:
            y = G.hurrah(r, base, r.uniform(0.95, 1.2) * (1.15 if kid else 1), kid)
            place(out, pan(y * r.uniform(0.4, 1.0), r.uniform(-0.9, 0.9)), tm)
            tm += len(y) / SR + r.uniform(0.3, 1.4)
    return out * level


def env_in_out(n, a=0.3, b=0.5):
    e = np.ones(n)
    na, nb = ns(a), ns(b)
    e[:na] = np.linspace(0, 1, na)
    e[-nb:] *= np.linspace(1, 0, nb)
    return e


def click(r, f=2500, q=6, dur=0.02):
    n = ns(dur)
    return reson(r.standard_normal(n), f, q) * np.exp(-np.arange(n) / SR / (dur / 4))


def projector(dur, r):
    """film projector: 24 fps shutter clatter + motor hum"""
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k in range(int(dur * 24)):
        place_m = ns(k / 24 + r.uniform(-0.002, 0.002))
        c = click(r, r.uniform(1800, 2600), 5, 0.025) * r.uniform(0.6, 1.0)
        y[place_m:place_m + len(c)] += c[: max(0, n - place_m)]
    y += 0.15 * np.sin(2 * np.pi * 96 * t) * (1 + 0.2 * np.sin(2 * np.pi * 24 * t))
    return y


def paper(r, dur=0.4, lo=1500, hi=7000):
    n = ns(dur)
    nz = bp(r.standard_normal(n), lo, hi, 1)
    e = (0.3 + 0.7 * smooth_noise(n, r, 30) ** 2) * np.exp(-np.arange(n) / SR / (dur / 2.5))
    return fades(nz * e, 0.003, 0.03)


def thud(r, f=90, dur=0.35, vel=1.0):
    t = np.arange(ns(dur)) / SR
    y = np.sin(2 * np.pi * f * (1 + 0.6 * np.exp(-t / 0.03)) * t) * np.exp(-t / (dur / 4))
    y += 0.3 * lp(r.standard_normal(len(t)), 900) * np.exp(-t / 0.02)
    return y * vel


def can_clank(r):
    return addm(G.clink(r, r.uniform(700, 1100), 0.25, 0.8), 0.6 * thud(r, 140, 0.15, 0.6))


def sparkle(r, n_notes=4):
    out = np.zeros(ns(1.2))
    for k in range(n_notes):
        y = I.glock(I.m2f(88 + 3 * k + int(r.integers(0, 2))), 0.35, r, 0.9)
        i = ns(k * 0.06)
        out[i:i + len(y)] += y[: len(out) - i]
    return out


def gulp(r):
    n = ns(0.18)
    t = np.arange(n) / SR
    f = 300 + 500 * t / 0.18
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-((t - 0.07) / 0.05) ** 2) * 0.6


def sniffle(r):
    n = ns(0.3)
    return bp(r.standard_normal(n), 2000, 6000) * np.exp(-((np.arange(n) / SR - 0.12) / 0.06) ** 2) * 0.5


def bloop(r, f=1400):
    t = np.arange(ns(0.09)) / SR
    return np.sin(2 * np.pi * f * (1 + 0.5 * t / 0.09) * t) * np.exp(-t / 0.03) * 0.4


def cicadas(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for v in range(3):
        f = r.uniform(5200, 6800)
        am = 0.6 + 0.4 * np.sin(2 * np.pi * r.uniform(60, 90) * t)
        y += np.sin(2 * np.pi * f * t + 3 * np.sin(2 * np.pi * 120 * t)) * am * (0.6 + 0.4 * smooth_noise(n, r, 0.4))
    return y * 0.3


def render():
    r = rng(1897)
    out = np.zeros((2, N))
    add = lambda x, t, g=1.0: place(out, x, t, g)
    # ---- whooshes on cuts and crossfades, the white flash after the hook ----
    for i, a in enumerate(SHOT_A[1:], start=2):
        soft = i in XF
        w = G.whoosh(0.55 if soft else 0.4, r, peak=0.22 if soft else 0.18, f_lo=300, f_hi=1800 if soft else 2600)
        add(widen(w, r, 9, 0.8), fr(a) - (0.22 if soft else 0.18), 0.22 if soft else 0.32)
    for a in INNER_CUTS:
        add(widen(G.whoosh(0.3, r, peak=0.14, f_lo=500, f_hi=3000), r, 9, 0.8), fr(a) - 0.14, 0.18)
    add(widen(sparkle(r, 6), r, 12, 1.0), fr(190) - 0.05, 0.5)
    # ---- 1 hook: plaza crowd ----
    add(chatter(4.2, r, 10, 0.5) * env_in_out(ns(4.2), 0.2, 0.6)[None, :], 0.0)
    add(cheer(2.4, r, 10, 0.55, 0.4), 1.6)
    # ---- 2 hero steps out of the poster ----
    add(st(paper(r, 0.45, 1200, 6000)), fr(128) - 0.05, 0.9)
    add(st(thud(r, 120, 0.3, 0.7)), fr(132))
    add(cheer(2.2, r, 18, 0.8, 0.3), fr(130))
    add(G.applause(2.4, r, 30) * 0.12, fr(132))
    for k in range(10):
        add(pan(click(r, r.uniform(2500, 5000), 8, 0.01) * 0.3, r.uniform(-0.8, 0.8)), 4.4 + k * 0.17)
    add(st(addm(I.timpani(73.4, 0.9, r, 1.6), thud(r, 70, 0.5, 0.8))), W["bida"])
    # ---- 3-4 1897 street: breeze, birds, hooves, queue chatter ----
    add(G.breeze(6.0, r, 0.06) * env_in_out(ns(6.0))[None, :], fr(190))
    add(st(G.bird_chirps(6.0, r, 0.6) * 0.25), fr(190))
    for k in range(14):  # a calesa trotting past, far
        add(pan(G.clink(r, r.uniform(500, 700), 0.08, 0.3) * 0.25, -0.4 + k * 0.05), 6.6 + k * 0.27 + (0.07 if k % 2 else 0))
    add(chatter(3.4, r, 6, 0.35) * env_in_out(ns(3.4))[None, :], fr(299))
    add(laugh(r, 150, 5, 6) * 0.25, 12.3)
    # ---- 5 projector, gasps ----
    add(widen(projector(3.1, r), r, 6, 0.4) * 0.22, fr(396))
    for k in range(7):
        add(pan(G.whoa(r) * 0.4, r.uniform(-0.7, 0.7)), W["gumagalaw"] - 0.03 + r.uniform(0, 0.15))
    # ---- 6-7 studio: megaphone, clapper, cans ----
    mega = bp(G.babble(1.6, r, 130, 1.05, rate=5.0), 500, 2600, 2)
    add(st(np.tanh(mega * 3) * 0.3), 16.4)
    add(st(addm(G.clink(r, 1900, 0.06, 1.2), thud(r, 400, 0.05, 0.5))), 17.3, 0.8)  # clapper
    prev = 0
    for f in range(546, 667):  # one clank per can that lands (cansAt in story.ts)
        t = f / FPS
        n = int(np.floor(max(0, min(34, (t - W["tatlong"] + 0.2) ** 1.6 * 4.2))))
        if n > prev:
            for k in range(n - prev):
                add(pan(can_clank(r) * 0.4, r.uniform(-0.3, 0.3)), t + k * 0.02)
            prev = n
    add(st(G.whoosh(1.2, r, peak=0.9, f_lo=200, f_hi=900, tail=0.3) * 0.25), W["hapon"] - 0.9)
    add(G.breeze(2.8, r, 0.05), fr(667))
    # ---- 8 christmas plaza ----
    add(chatter(6.2, r, 10, 0.35) * env_in_out(ns(6.2))[None, :], fr(751))
    add(st(G.crickets(6.2, r, 3) * 0.04), fr(751))
    for k in range(10):
        add(pan(I.triangle(0.18, r, 1.0, r.uniform(2400, 3200)), r.uniform(-0.6, 0.6)), 25.2 + k * 0.55)
    # ---- 9 noche buena: cutlery, laughter, chairs scrape on "buong pamilya" ----
    for k in range(9):
        add(pan(G.clink(r, r.uniform(2500, 4200), 0.08, 1.0) * 0.18, r.uniform(-0.5, 0.5)), 31.3 + k * 0.23 + r.uniform(0, 0.1))
    add(crowd_laugh(1.6, r, 4, (160, 260), 0.25), 31.6)
    for k in range(5):
        sc = bp(r.standard_normal(ns(0.25)), 300, 1800) * np.hanning(ns(0.25)) * 0.35
        add(pan(sc, r.uniform(-0.6, 0.6)), W["pamilya"] - 0.05 + k * 0.05)
    add(cheer(1.4, r, 6, 0.4, 0.4), W["pamilya"] + 0.1)
    # ---- 10 queue at night ----
    add(chatter(1.5, r, 10, 0.4), fr(1022))
    # ---- 11 vote: ballot drop ----
    add(st(paper(r, 0.25, 2000, 7000) * 0.5), 35.7)
    add(st(thud(r, 160, 0.2, 0.4)), 35.95)
    add(chatter(1.5, r, 4, 0.25), fr(1063))
    # ---- 12 balcony: roar, applause, timpani ----
    add(cheer(2.8, r, 24, 0.9, 0.25), W["nanalong"] - 0.05)
    add(G.applause(2.8, r, 40) * 0.16 * env_in_out(ns(2.8), 0.1, 0.5)[None, :], W["nanalong"])
    add(st(I.timpani(98.0, 0.9, r, 1.4)), W["presidente2"])
    # ---- 13 heroic: sparkles ----
    for t0 in (39.9, 40.9, 41.7):
        add(widen(sparkle(r, 4), r, 12, 1.0), t0, 0.35)
    # ---- 14 desk: paper rustle, gulp, a sheet slides off ----
    add(st(paper(r, 0.6, 1500, 6000) * 0.25), 42.8)
    add(st(gulp(r)), W["doble"] + 0.25, 0.8)
    add(st(paper(r, 0.8, 1000, 5000) * 0.4), W["malakanyang"])
    # ---- 15-16 handaan: birds, cutlery, laughter, crying, shouting at the villain ----
    add(st(G.bird_chirps(9.5, r, 0.5) * 0.2), fr(1363))
    for k in range(14):
        add(pan(G.clink(r, r.uniform(2500, 4200), 0.08, 1.0) * 0.15, r.uniform(-0.5, 0.5)), 46.2 + k * 0.33 + r.uniform(0, 0.1))
    add(chatter(3.8, r, 6, 0.3) * env_in_out(ns(3.8))[None, :], 47.4)
    add(crowd_laugh(1.0, r, 7, (150, 280), 0.6), W["pagtawa"] - 0.05)
    for k in range(5):
        add(pan(sniffle(r), r.uniform(-0.5, 0.5)), W["iyak"] + 0.1 + k * 0.17)
    for k in range(6):
        y = G.hurrah(r, r.uniform(140, 260), 1.05)
        add(pan(np.tanh(y * 2) * 0.45, r.uniform(-0.6, 0.6)), W["sigaw"] + k * 0.13)
    # ---- 17 cinema: audience laughter, popcorn ----
    add(crowd_laugh(3.8, r, 12, (140, 280), 0.45) * env_in_out(ns(3.8), 0.2, 0.6)[None, :], fr(1651))
    for k in range(14):
        add(pan(bp(r.standard_normal(ns(0.05)), 1500, 5000) * np.hanning(ns(0.05)) * 0.12, r.uniform(-0.6, 0.6)), 55.1 + k * 0.26 + r.uniform(0, 0.1))
    # ---- 18 hot: cicadas, fan flaps ----
    add(st(cicadas(1.8, r)) * env_in_out(ns(1.8), 0.2, 0.3)[None, :], fr(1766))
    for k in range(6):
        add(pan(bp(r.standard_normal(ns(0.12)), 200, 1200) * np.hanning(ns(0.12)) * 0.3, r.uniform(-0.4, 0.4)), 59.0 + k * 0.28)
    # ---- 19 phone at night: crickets, bloops, laughter on "sama-sama" ----
    add(st(G.crickets(5.4, r, 4) * 0.05), fr(1819))
    for k in range(4):
        add(st(bloop(r, 1200 + 200 * k)), 61.2 + k * 0.9, 0.5)
    add(crowd_laugh(1.8, r, 5, (160, 290), 0.45), W["samasama"] + 0.1)
    # ---- 20 election rally ----
    add(cheer(2.3, r, 16, 0.55, 0.3), fr(1977))
    add(G.applause(2.2, r, 30) * 0.1, fr(1977) + 0.1)
    add(st(addm(I.cymbal(0.4, r, 1.6) * 0.3, thud(r, 80, 0.5, 0.6))), W["sino"])
    add(widen(sparkle(r, 5), r, 12, 1.0), W["sino"] + 0.2, 0.4)
    add(cheer(1.4, r, 22, 0.8, 0.3), W["bida2"] + 0.1)
    # gentle room for every scene: a short ambience reverb on the whole stem
    ir = make_ir(0.5, 3, pre=0.006, hf=1.5)
    out = out + 0.18 * convolve_st(out.mean(0), ir)[:, :N]
    out = hp(out, 35, 2)
    return out
