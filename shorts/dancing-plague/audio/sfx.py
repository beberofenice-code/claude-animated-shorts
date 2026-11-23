# Every sound effect and ambience bed of "The Dancing Plague", timed to the picture (timeline.py) and rendered into
# one stereo SFX stem. Standard mix rule: each EVENT has a naive level (LU vs the voice, as the event's max momentary
# loudness) and is placed SFX_DB = -6 dB under it; BEDS (integrated loudness) are not reduced.
import numpy as np
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, peq, pan, st, place, fades, widen, colored, smooth_noise, modal, phase,
                 momentary_max, integrated, make_ir, convolve_st)
import sfx_gen as G
import instruments as I
import timeline as T

N = ns(T.DUR)
SFX_DB = -6.0


class Cue:
    def __init__(self, t, name, desc, gen, naive, kind="event", p=0.0, send=0.1):
        self.t, self.name, self.desc, self.gen, self.naive, self.kind, self.p, self.send = t, name, desc, gen, naive, kind, p, send
        self.applied = naive + (SFX_DB if kind == "event" else 0.0)
        self.measured = None


def env_cut(x, fin=0.3, fout=0.4):
    x = st(x)
    n = x.shape[1]
    e = np.ones(n)
    a, b = ns(fin), ns(fout)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if b:
        e[-b:] *= np.linspace(1, 0, b)
    return x * e[None, :]


# ---------------------------------------------------------------- own generators for this short
def town_air(dur, r, murmur=0.5):
    """daytime town square: breeze, sparrows, distant voices, a far cart"""
    n = ns(dur)
    x = G.breeze(dur, r, 0.8, 0.15, 800)
    x += pan(G.bird_chirps(dur, r, 0.5, "sparrow") * 0.08, 0.5)
    x += pan(G.bird_chirps(dur, r, 0.3, "sparrow") * 0.05, -0.6)
    if murmur:
        mm = np.zeros(n)
        for k in range(6):
            mm += G.babble(dur, rng(int(r.integers(1 << 30))), r.uniform(100, 230), r.uniform(0.95, 1.15), active=0.5)
        x += widen(lp(mm, 2200) * 0.02 * murmur, r)
    return x


def golden_air(dur, r):
    x = G.breeze(dur, r, 0.5, 0.12, 700)
    x += st(G.crickets(dur, r, 3) * 0.05)
    x += pan(G.bird_chirps(dur, r, 0.25, "blackbird") * 0.07, -0.4)
    return x


def feet_bed(dur, r, density=22.0, people=1.0):
    """a crowd dancing on cobbles: shoe taps and scuffs, hops landing, a low thud bed, now and then a groan"""
    n = ns(dur)
    y = np.zeros((2, n))
    k = int(dur * density)
    for _ in range(k):
        s = G.stroll_step(r, scuff=r.uniform(0.2, 0.9)) * r.uniform(0.25, 1.0)
        place(y, pan(s, r.uniform(-0.8, 0.8)), r.uniform(0, dur - 0.3))
    thud = lp(colored(n, r, 1.2), 160, 2) * (0.6 + 0.4 * smooth_noise(n, r, 2.0)) * 0.6
    y += st(thud)
    for _ in range(int(dur * 0.5 * people)):
        v = G.oof(r, str(r.choice(["oof", "ugh", "oh"]))) * 0.25
        place(y, pan(lp(v, 3000), r.uniform(-0.7, 0.7)), r.uniform(0, max(0.01, dur - 0.4)))
    return y


def addm(*parts):
    """sum mono arrays of different lengths: addm((x, gain), (y, gain), ...)"""
    n = max(len(x) for x, _g in parts)
    y = np.zeros(n)
    for x, g in parts:
        y[: len(x)] += g * x
    return y


def tap(r, hard=0.7):
    """one leather shoe on cobbles"""
    return addm((G.stroll_step(r, 0.2), 0.6), (G.boot(r, hard), 0.4))


def yawn(r, base=None, dur=None, female=False):
    """a big yawn: breath in, an 'aaah-oh' that rises then sinks, breath out"""
    base = base or (r.uniform(170, 220) if female else r.uniform(95, 130))
    d = dur or r.uniform(1.0, 1.25)
    n = ns(d)
    t = np.arange(n) / SR
    f0 = base * np.interp(t, [0, 0.25 * d, 0.45 * d, d], [1.0, 1.35, 1.25, 0.8])
    forms = G.vowel_track(n, [(0, "A"), (0.35 * d, "a"), (0.75 * d, "o"), (d, "U")])
    amp = np.clip(t / 0.18, 0, 1) * np.clip((d - t) / 0.3, 0, 1)
    y = G.vox(f0, forms, amp, r, 1.12 if female else 1.0, tilt=1.25, breath=0.55)
    inh = bp(r.standard_normal(ns(0.35)), 600, 4000, 1) * np.hanning(ns(0.35)) * 0.25
    out = np.concatenate([inh, y, bp(r.standard_normal(ns(0.3)), 400, 3000, 1) * np.hanning(ns(0.3)) * 0.18])
    return fades(out, 0.01, 0.05)


def snore(r, dur=0.9):
    n = ns(dur)
    t = np.arange(n) / SR
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    buzz = np.sin(phase(55 + 10 * e)) * (0.5 + 0.5 * np.sign(np.sin(TAU_ * 28 * t)))
    return fades(lp(buzz + 0.6 * bp(r.standard_normal(n), 200, 1500, 1), 1400) * e * 0.5, 0.01, 0.05)


TAU_ = 2 * np.pi


def rumble(r, dur=0.9):
    """an empty stomach: wobbling low growl with gurgles"""
    n = ns(dur)
    t = np.arange(n) / SR
    f = 70 + 40 * np.sin(TAU_ * 2.3 * t) + 25 * smooth_noise(n, r, 6.0)
    y = np.sin(phase(f)) * (0.6 + 0.4 * np.sin(TAU_ * 7 * t))
    y = addm((y, 1.0), (G.bubbles(dur, r, 9, 150, 600), 0.4))[:n]
    return fades(lp(y, 900) * np.sin(np.pi * t / dur) ** 0.8, 0.01, 0.05)


def thunder(r, dur=2.5):
    n = ns(dur)
    t = np.arange(n) / SR
    y = lp(colored(n, r, 1.6), 220, 2) * np.exp(-t / 0.9) * (1 - np.exp(-t / 0.15))
    return widen(y * (0.7 + 0.3 * smooth_noise(n, r, 3.0)), r)


def thud_fall(r):
    d = 0.6
    t = tt(d)
    body = np.exp(-t / 0.07) * np.sin(phase(70 * (1 + 0.5 * np.exp(-t / 0.02))))
    cloth = bp(r.standard_normal(len(t)), 300, 3000, 1) * np.exp(-t / 0.05) * 0.5
    return fades(body * 1.2 + cloth, 0.0, 0.05)


def bell(r, f=262.0, dur=4.0):
    modes = [(f * 0.5, 0.6, 3.5), (f, 1.0, 2.6), (f * 1.19, 0.6, 1.8), (f * 1.5, 0.45, 1.4), (f * 2.0, 0.5, 1.1), (f * 2.51, 0.3, 0.7), (f * 3.0, 0.2, 0.5)]
    y = modal(dur, modes, r)
    t = tt(dur)
    y += bp(r.standard_normal(len(t)), 1500, 6000, 1) * np.exp(-t / 0.004) * 0.4
    return fades(y, 0.001, 0.3)


def hooves(dur, r, hz=1.4):
    """horse at a walk: four hoof falls per stride on a dirt road (dull knocks) + harness jingle"""
    n = ns(dur)
    y = np.zeros(n)
    t = 0.05
    k = 0
    while t < dur - 0.2:
        d = 0.18
        tk = tt(d)
        knock = modal(d, [(r.uniform(320, 420), 1.0, 0.02), (r.uniform(800, 1000), 0.5, 0.01)], r) + lp(r.standard_normal(len(tk)), 500) * np.exp(-tk / 0.015)
        i = ns(t)
        y[i: i + len(knock)] += knock[: max(0, n - i)] * (1.0 if k % 2 == 0 else 0.7)
        t += 1 / (hz * 4) * (0.9 if k % 2 else 1.1)
        k += 1
    jing = np.zeros(n)
    for _ in range(int(dur * 5)):
        c = G.clink(r, None, 0.1, 0.8) * 0.12
        i = ns(r.uniform(0, dur - 0.15))
        jing[i: i + len(c)] += c[: max(0, n - i)]
    return y + jing


def cart(dur, r):
    """wooden wheels rolling on a dirt road: rumble, creaks, rattles of the load"""
    n = ns(dur)
    roll = lp(colored(n, r, 1.0), 400, 2) * (0.7 + 0.3 * np.abs(np.sin(TAU_ * 1.2 * np.arange(n) / SR)))
    y = roll * 0.6
    for k in range(int(dur * 1.5)):
        c = G.creak(r.uniform(0.25, 0.5), r, 90, 160) * 0.3
        i = ns(r.uniform(0, dur - 0.5))
        y[i: i + len(c)] += c[: max(0, n - i)]
    y += G.rattle(dur, r, 14.0) * 0.15
    return y


def shimmer(r):
    y = np.zeros(ns(1.6))
    for i, m in enumerate([86, 90, 93, 98]):
        g = I.glock(I.m2f(m), 0.4, r, 1.2)
        a = ns(i * 0.07)
        y[a: a + len(g)] += g[: len(y) - a]
    return y


def coin(r):
    a, b = G.clink(r, r.uniform(2500, 4200), 0.25, 1.2), G.clink(r, r.uniform(3000, 5000), 0.18, 0.8) * 0.5
    y = np.zeros(max(len(a), len(b)) + ns(0.03))
    y[: len(a)] += a
    y[ns(0.03): ns(0.03) + len(b)] += b
    return y


# ---------------------------------------------------------------- the cue list
def cues():
    C = []
    R = rng(1518)
    rr = lambda: rng(int(R.integers(1 << 30)))
    add = C.append
    # beds
    add(Cue(0.0, "amb_town_1", "town square air: breeze, sparrows, distant voices (shots 1-20)", env_cut(town_air(44.8, rr()), 0.2, 0.5), -31, "bed"))
    add(Cue(44.6, "amb_golden_1", "golden evening: soft breeze, crickets, blackbird (yawns, shots 21-22)", env_cut(golden_air(6.0, rr()), 0.4, 0.4), -31, "bed"))
    add(Cue(50.3, "amb_town_2", "town square air again (fear, St Vitus, the city, the ban)", env_cut(town_air(10.4, rr(), 0.8), 0.3, 0.3), -31, "bed"))
    add(Cue(60.45, "amb_golden_2", "golden hills: breeze, crickets, blackbird (road, shrine, shoes)", env_cut(golden_air(T.DUR - 60.45, rr()), 0.4, 0.05), -31, "bed"))
    add(Cue(0.0, "feet_hook", "hundreds of dancers on cobbles: taps, scuffs, hop landings, groans (hook)", env_cut(feet_bed(T.FLASH + 0.05, rr(), 30), 0.0, 0.05), -23, "bed"))
    add(Cue(T.W(672) - 0.05, "feet_thirty", "thirty dancers join in the lane", env_cut(feet_bed(T.W(728) - T.W(672) + 0.05, rr(), 14, 0.6), 0.25, 0.05), -25, "bed"))
    add(Cue(T.W(728), "feet_august", "hundreds dancing in the square (crane up, hopping and spinning)", env_cut(feet_bed(T.W(843) - T.W(728), rr(), 34), 0.05, 0.3), -22, "bed"))
    add(Cue(T.W(843), "feet_doctors", "the crowd dancing behind the doctors (quieter)", env_cut(feet_bed(T.W(1035) - T.W(843), rr(), 16, 0.4), 0.3, 0.2), -29, "bed"))
    add(Cue(T.W(1035), "feet_cure", "more dancing: the crowd dances harder (stage, band, strong men)", env_cut(feet_bed(43.7 - T.W(1035), rr(), 30), 0.15, 0.3), -24, "bed"))
    add(Cue(44.0, "feet_after", "the rest still shuffling after the falls", env_cut(feet_bed(0.8, rr(), 10, 0.0), 0.05, 0.4), -30, "bed"))
    add(Cue(T.W(1680), "feet_city", "a whole city dancing (crane out) until the ban", env_cut(feet_bed(T.HITS[1] + 0.4 - T.W(1680), rr(), 36), 0.6, 0.4), -23, "bed"))
    add(Cue(60.5, "cart_road", "the cart: wooden wheels on the dirt road, creaks, load rattle", env_cut(cart(2.35, rr()), 0.2, 0.15), -22, "bed"))
    add(Cue(60.5, "horse", "the horse at a walk: hoof falls + harness jingle", env_cut(hooves(2.35, rr()), 0.1, 0.15), -21, "bed"))
    # events
    add(Cue(T.FLASH - 0.32, "flash_whoosh", "whoosh into the white flash after the hook", G.whoosh(0.5, rr(), 0.32, 500, 3200, 0.9, 0.15, 0.25), -10))
    for tc, nm in ((T.W(70) - 0.3, "glide down into the crowd"), (T.W(681) - 0.3, "pull back up the lane"), (T.W(759) - 0.35, "crane up over the square"),
                   (T.W(1700) - 0.4, "crane out over the whole city")):
        add(Cue(tc, "glide_whoosh", nm, G.whoosh(0.8, rr(), 0.35, 300, 1800, 0.9, 0.3, 0.1), -17))
    for k, dt in enumerate((0.0, 0.11, 0.25, 0.4, 0.52)):
        add(Cue(T.W(281) + dt, "coin", "coins tumbling: the price of one loaf", coin(rr()), -12, p=0.2))
    add(Cue(T.W(281) - 0.05, "gasp", "the customer gasps at the price", G.whoa(rr(), 230, 0.35), -13, p=0.15))
    add(Cue(T.STEP_OUT - 0.35, "door_creak", "her front door creaks open", G.creak(0.55, rr(), 70, 130), -13, p=-0.1))
    for k, ts in enumerate([T.STEP_OUT + 0.12 + 0.3 * i for i in range(3)]):
        add(Cue(ts, "step", "Troffea steps out into the lane", tap(rr(), 0.4), -15))
    lane_end = T.W(728)
    for ts in T.troffea_steps(T.DANCE0, lane_end):
        sh = [i for i, (a, b, *_r) in T.SHOTS.items() if T.W(a) <= ts < T.W(b)][0]
        far = sh in (6,) and ts < T.W(503)
        add(Cue(ts, "dance_tap", "Troffea's shoes on the cobbles, every kick" + (" (wide)" if far else ""), tap(rr(), 0.7), -15 if far else -10))
    for ts in (20.85, 21.25):
        add(Cue(ts, "xfade_swish", "day-night-day swish", G.whoosh(0.35, rr(), 0.2, 800, 2800, 0.8, 0.12, 0.2), -20))
    add(Cue(T.W(622) + 0.05, "snore", "the husband asleep on the step", snore(rr()), -14, p=0.25))
    add(Cue(T.W(880) - 0.05, "flask", "glass flask held up to the light", G.clink(rr(), 2400, 0.4, 0.6), -16, p=-0.2))
    add(Cue(T.W(1065) + 0.1, "hall_doors", "guildhall doors swing open", G.creak(0.7, rr(), 60, 110), -13, p=0.2))
    add(Cue(T.W(1083) + 0.05, "hall_bang", "the doors bang against the wall on 'clears'", G.wood_crack(rr())[: ns(0.6)] * 0.5, -12, p=0.25))
    for h in T.STAGE_HITS:
        add(Cue(h, "carpenter_hit", "carpenter nailing the stage boards", G.hammer_hit(rr(), 0.7), -11, p=0.1))
    add(Cue(T.W(1245), "strong_ugh", "the strong men heave the dancer up", G.oof(rr(), "ugh", 105), -12, p=0.1))
    for k, tc in enumerate(T.COLLAPSE):
        add(Cue(tc, "fall_thud", "a dancer hits the cobbles", thud_fall(rr()), -6, p=[-0.1, 0.25, -0.3][k]))
        add(Cue(tc - 0.06, "fall_oof", "groan as they drop", G.oof(rr(), ["oof", "ugh", "oh"][k]), -10, p=[-0.1, 0.25, -0.3][k]))
    add(Cue(44.05, "stars", "dizzy stars twinkle", shimmer(rr()) * 0.6, -18, p=0.1))
    y0 = T.W(1406)
    for k, d in enumerate([1.2, 0.6, 0.0, 0.75, 1.35]):
        add(Cue(y0 + d - 0.3, "yawn_row", "the yawn travels along the bench", yawn(rr(), female=k % 2 == 1), -12 if k == 2 else -15, p=(k - 2) * 0.25))
    add(Cue(T.W(1453) - 0.3, "yawn_a", "she yawns", yawn(rr(), female=True), -9, p=-0.15))
    add(Cue(T.W(1488) - 0.3, "yawn_b", "...and he has to yawn too", yawn(rr(), 115, 1.35), -9, p=0.15))
    add(Cue(50.5, "thunder", "distant thunder under the dark cloud ('Fear')", thunder(rr()), -16))
    add(Cue(T.W(1538) + 0.05, "stomach", "an empty stomach growls ('hunger')", rumble(rr()), -11, p=0.2))
    for h in T.HITS:
        add(Cue(h, "ban_hammer", "the councillor nails up the no-music notice", G.hammer_hit(rr(), 1.0), -5, p=0.1))
    add(Cue(T.W(1884) + 0.1, "bell", "the shrine's bell", bell(rr(), 330), -12, p=0.1))
    add(Cue(T.W(1884) + 1.5, "bell", "the shrine's bell (second stroke)", bell(rr(), 330), -15, p=0.1))
    add(Cue(T.W(2017) - 0.05, "shoes_shimmer", "the red shoes appear", shimmer(rr()), -14))
    for ts in (68.0 + 0.5 / 1.6, 68.0 + 1.0 / 1.6 - 0.02):
        add(Cue(ts, "shoe_tap", "a single tap of the red shoes", tap(rr(), 0.9), -8))
    return C


def level(x):
    x = st(x)
    pad_n = max(0, ns(0.45) - x.shape[1])
    xx = np.pad(x, ((0, 0), (0, pad_n)))
    return momentary_max(xx)


def render(v_ref):
    C = cues()
    out = np.zeros((2, N))
    ir = make_ir(1.1, 7, pre=0.01)
    for c in C:
        x = st(c.gen) if c.gen.ndim == 1 or c.gen.shape[0] != 2 else c.gen
        if c.gen.ndim == 1:
            x = pan(c.gen, c.p)
        L = integrated(x) if c.kind == "bed" else level(x)
        if not np.isfinite(L):
            continue
        g = dbg(v_ref + c.applied - L)
        y = x * g
        if c.send > 0 and c.kind == "event":
            y = y + c.send * convolve_st(y, ir)[:, : y.shape[1] + ns(1.0)][:, : y.shape[1]]
        place(out, y, c.t)
        c.measured = c.applied
    return out, C
