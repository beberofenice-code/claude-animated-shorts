# Soundtrack of "The Ship That Refused to Sink": an original score (pizzicato strings, glockenspiel / music box,
# warm pad, timpani; D minor -> F major, 96 bpm) + synthesized SFX (Arctic wind, snow footsteps, ice creaks and
# cracks, steam engine, ski plane, hammer, blizzard, seal, dogs, airport carousel) timed to the picture
# (src/videos/baychimo/story.ts) and the voice words (voice/words.json), and the mix:
#   voice unchanged; music bed +3 dB over the old -13 LU standard (= -10 LU under the voice, ducked -3 dB while
#   speaking); SFX stem -6 dB; master to -15 LUFS integrated, true peak <= -1.2 dBTP; 48 kHz stereo 24-bit, exactly
#   TOTAL / 30 s long. Writes mix.wav, stem_voice/music/sfx.wav and cues.md.
# Uses the shared DSP / instrument / SFX kits (dsp.py, instruments.py, sfx_gen.py) from the bridge short.
import json
import os
import numpy as np
from dsp import SR, ns, tt, rng, lp, hp, bp, colored, smooth_noise, fades, place, pan, st, widen, dbg, modal, phase, \
    make_ir, convolve_st, read_wav, write_wav, integrated, true_peak, short_term
from instruments import m2f, glock, pluck, pad, timpani, triangle, vibes, musicbox, cymbal, brush
from sfx_gen import creak, whoosh, breeze, hammer_hit, wood_crack, timber_tear, oof, whoa, babble, rattle, clink, WOOD, TIMBER, CHAIN

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "out", "baychimo", "audio")
os.makedirs(OUT, exist_ok=True)
FPS, TOTAL = 30, 1982
DUR = TOTAL / FPS
N = ns(DUR)
fr = lambda f: f / FPS
WORDS = json.load(open(os.path.join(ROOT, "voice", "words.json")))
W = lambda i: WORDS[i]["s"]  # word onset (s)
CUES = []


def cue(t, name, note=""):
    CUES.append((t, name, note))


# shots (story.ts) for the beds
SHOTS = {1: (0, 177), 2: (177, 308), 3: (308, 409), 4: (409, 545), 5: (545, 643), 6: (643, 700), 7: (700, 819), 8: (819, 876),
         9: (876, 977), 10: (977, 1029), 11: (1029, 1120), 12: (1120, 1216), 13: (1216, 1348), 14: (1348, 1486), 15: (1486, 1603),
         16: (1603, 1714), 17: (1714, 1760), 18: (1760, 1839), 19: (1839, TOTAL)}
ST = lambda i: (fr(SHOTS[i][0]), fr(SHOTS[i][1]))


def env_seg(n, a, b, fin=0.4, fout=0.4):
    """0..1 gate over sample range with cosine fades"""
    e = np.zeros(n)
    ia, ib = ns(a), ns(b)
    ia, ib = max(0, ia), min(n, ib)
    if ib <= ia:
        return e
    e[ia:ib] = 1
    fi, fo = ns(fin), ns(fout)
    for k in range(min(fi, ib - ia)):
        e[ia + k] = 0.5 - 0.5 * np.cos(np.pi * k / fi)
    for k in range(min(fo, ib - ia)):
        e[ib - 1 - k] = min(e[ib - 1 - k], 0.5 - 0.5 * np.cos(np.pi * k / fo))
    return e


# ================================================================ score
BPM = 96
B = 60 / BPM  # beat (s)
CH = {"Dm": [50, 57, 62, 65], "F": [53, 60, 65, 69], "C": [48, 55, 60, 64], "Bb": [46, 53, 58, 62], "Gm": [43, 55, 58, 62], "A": [45, 57, 61, 64],
      "Am": [45, 57, 60, 64], "D": [50, 57, 62, 66]}


def music():
    r = rng(5)
    out = np.zeros((2, N))
    ir = make_ir(1.6, 3, hf=0.6)

    def pz(t, m, vel=0.6, p=0.0, dur=0.7, bright=0.45):
        place(out, pan(pluck(m2f(m), vel, r, dur, bright), p), t)

    def gl(t, m, vel=0.5, p=0.25):
        place(out, pan(glock(m2f(m), vel, r, 1.6), p) * 0.55, t)

    def mb(t, m, vel=0.5, p=-0.2):
        place(out, pan(musicbox(m2f(m), vel, r, 1.4), p) * 0.6, t)

    def pd(t, chord, dur, vel=0.32, att=0.5, rel=0.9):
        place(out, pad([m2f(x) for x in CH[chord][1:]], dur, vel, r, att, rel, warm=1100), t)

    def tim(t, m=38, vel=0.7):
        place(out, st(timpani(m2f(m), vel, r, 2.2)) * 0.8, t)

    def ostinato(t0, t1, prog, vel=0.55, bars_per=1, beat=B):
        """pizzicato bass on 1 and 3, chord stabs on 2 and 4 (one bar of 4 beats per chord)"""
        t, k = t0, 0
        while t < t1 - 0.05:
            c = CH[prog[(k // (4 * bars_per)) % len(prog)]]
            b = k % 4
            if b in (0, 2):
                pz(t, c[0] - 12 + (7 if b == 2 else 0), vel, -0.1, 0.8, 0.35)
            else:
                for j, m in enumerate(c[1:]):
                    pz(t + 0.006 * j, m, vel * 0.42, 0.15 + 0.15 * j, 0.45, 0.55)
            t += beat
            k += 1

    def melody(t0, notes, inst=gl, step=B / 2, vel=0.5):
        t = t0
        for m in notes:
            if m:
                inst(t, m, vel)
            t += step

    # --- hook (0 - 5.9): music box motif over a cold Dm pad; timpani under "refusing to sink"
    pd(0.0, "Dm", 5.4, 0.28, 1.2)
    melody(0.35, [74, 77, 81, 79, 77, 76, 74, 0, 72, 74, 76, 77, 76, 74, 0, 0], mb, B / 2, 0.55)
    tim(W(17) - 0.02, 38, 0.55); tim(W(19) - 0.02, 33, 0.75)
    cue(W(17), "music: timpani", "refusing to sink")
    # --- journey, open sea (5.9 - 10.3): bright pizz ostinato in F, glock tune
    ostinato(5.9, 10.25, ["F", "C", "Dm", "Bb"], 0.55)
    melody(5.95, [72, 0, 77, 79, 81, 0, 79, 77, 76, 0, 74, 76, 77, 0, 0, 0], gl, B / 2, 0.5)
    # --- freeze (10.3 - 13.25): the tune slows down and sinks, tremolo pad
    t = 10.3
    k = 0
    for m in [77, 76, 74, 72, 70, 69, 67, 65]:
        gl(t, m, 0.45); pz(t, m - 24, 0.45, 0, 0.9, 0.3)
        t += B * (0.55 + 0.11 * k); k += 1
    pd(10.3, "Dm", 2.9, 0.26, 0.8, 0.2)
    ts = fr(397)
    tim(ts - 0.01, 33, 0.95); pz(ts, 38, 0.9, 0, 1.2, 0.2); pz(ts, 50, 0.7, 0, 1.0, 0.3)
    cue(ts, "music: STUCK hit", "timpani + pizz unison")
    # --- flown home / the hut (13.7 - 18.2): light vibes + pizz
    ostinato(13.65, 18.15, ["F", "Dm", "Bb", "C"], 0.45)
    melody(13.7, [81, 79, 77, 0, 77, 76, 74, 0, 74, 76, 77, 79, 77, 0, 0, 0], lambda t, m, v: place(out, pan(vibes(m2f(m), v, r, 1.4), 0.2) * 0.5, t), B / 2, 0.45)
    # --- blizzard (18.2 - 21.4): minor swell, then silence on "gone"
    pd(18.2, "Gm", 2.2, 0.36, 0.4, 0.6)
    pd(19.3, "A", 1.9, 0.30, 0.6, 0.3)
    tim(W(83) - 0.01, 33, 0.55)
    cue(W(83), "music: 'gone' low hit")
    # --- the captain (21.5 - 23.3): mournful pad + one bell
    pd(21.45, "Dm", 1.8, 0.24, 0.6, 0.4)
    mb(21.55, 69, 0.45); mb(22.2, 65, 0.4); mb(22.87, 62, 0.45)
    # --- luckily (23.4 - 27.2): bounce returns
    ostinato(W(91) - 0.02, 27.25, ["F", "C", "F", "C"], 0.5)
    melody(W(91), [72, 77, 81, 84, 0, 81, 79, 77, 0, 76, 79, 0, 77, 0, 0, 0], gl, B / 2, 0.5)
    # --- unluckily (27.34): the band stops dead; one deflating low pizz
    pz(W(104) - 0.01, 41, 0.75, 0, 1.2, 0.2); pz(W(104) + 0.32, 40, 0.65, 0, 1.2, 0.2)
    cue(W(104), "music: dead stop", "deadpan beat")
    # --- sled out / leave her (29.2 - 34.3)
    ostinato(29.2, 32.55, ["Dm", "Bb", "Gm", "A"], 0.45)
    pd(32.55, "Dm", 1.8, 0.3, 0.6, 0.6)
    melody(32.6, [69, 0, 74, 0, 72, 0, 69, 0], mb, B / 2, 0.5)
    # --- the sightings (34.3 - 44.9): the theme, a sting per year
    ostinato(34.3, 44.9, ["F", "C", "Dm", "Bb"], 0.45)
    for t0 in (W(130), W(143), W(156)):
        place(out, pan(triangle(0.45, r), 0.4) * 0.5, t0 - 0.01)
        gl(t0, 84, 0.5)
    melody(34.35, [72, 0, 77, 79, 81, 0, 79, 77, 76, 0, 74, 76, 77, 0, 0, 0, 77, 0, 81, 84, 86, 0, 84, 81, 79, 0, 77, 79, 81, 0, 0, 0], gl, B / 2, 0.42)
    tim(fr(1320) - 0.01, 33, 0.9)
    cue(fr(1320), "music: shove hit")
    # --- explanation + airport (45 - 53.4): music-box waltz going round and round
    t = 44.97
    waltz = [62, 65, 69, 74, 69, 65]
    k = 0
    while t < 53.4:
        mb(t, waltz[k % 6] + (12 if (k // 6) % 2 else 12), 0.42)
        if k % 3 == 0:
            pz(t, [50, 46, 41, 45][(k // 6) % 4] - 12, 0.4, 0, 0.9, 0.3)
        t += B / 2
        k += 1
    pd(44.97, "Dm", 4.5, 0.22, 0.8, 0.6); pd(49.55, "Bb", 3.85, 0.22, 0.6, 0.6)
    # --- frozen onto the carousel / spotted again and again (53.5 - 61.3): the theme, fuller; montage pings
    ostinato(53.45, 61.3, ["F", "C", "Dm", "Bb"], 0.5)
    melody(53.5, [72, 0, 77, 79, 81, 0, 79, 77, 76, 0, 74, 76, 77, 0, 0, 0], gl, B / 2, 0.45)
    for i, w in enumerate((222, 223, 225)):
        gl(W(w) - 0.01, 81 + 3 * i, 0.55)
    pd(W(230) - 0.1, "F", 2.0, 0.32, 0.3, 0.6)
    place(out, st(cymbal(0.25, r, 2.4, 0.6)) * 0.5, W(230) - 0.4)
    # --- ending (61.3 - 66): bell motif, dip on "sunk", final F chord
    pd(61.3, "Dm", 3.0, 0.24, 0.6, 0.5)
    melody(61.35, [74, 77, 81, 79, 77, 76, 74, 0], mb, B / 2, 0.5)
    pd(64.3, "Bb", 0.8, 0.26, 0.3, 0.3)
    tim(W(252) - 0.01, 33, 0.8)
    pz(W(252) + 0.5, 41, 0.65, 0, 1.0, 0.3)
    pd(W(252) + 0.4, "F", DUR - W(252) - 0.6, 0.34, 0.2, 0.25)
    gl(W(252) + 0.45, 84, 0.55); gl(W(252) + 0.6, 89, 0.45)
    cue(W(252), "music: final dip + F chord", "she still hasn't sunk")
    wet = convolve_st(out, ir)[:, :N]
    return out * 0.85 + wet * 0.3


# ================================================================ SFX
def snow_step(r, hard=1.0):
    d = 0.16
    t = tt(d)
    nz = colored(len(t), r, 0.3)
    crunch = bp(nz, 900, 6000, 1) * (np.clip(t / 0.01, 0, 1) * np.exp(-t / 0.05)) * (0.6 + 0.4 * r.uniform())
    gr = bp(r.standard_normal(len(t)), 2500, 9000, 1) * (r.uniform(size=len(t)) < 0.05) * np.exp(-t / 0.06)
    thud = lp(r.standard_normal(len(t)), 200) * np.exp(-t / 0.02) * 0.6
    return (crunch + gr * 0.8 + thud) * hard


def ice_creak(r, dur=1.2, lo=60, hi=110, scale=1.0):
    return creak(dur, r, lo, hi, TIMBER, [(0, 0), (0.3, 1), (0.7, 0.8), (1, 0)], rough=0.2, noise=0.08, scale=scale)


def ice_crack(r, big=1.0):
    d = 1.4
    t = tt(d)
    snap = hp(r.standard_normal(len(t)), 1500) * np.exp(-t / 0.004) * 1.5
    body = modal(d, [(70, 1.0, 0.25), (140, 0.6, 0.18), (330, 0.4, 0.1), (760, 0.25, 0.05)], r, glide=0.08)
    rumble = lp(colored(len(t), r, 1.0), 180) * np.exp(-t / 0.4) * 1.2
    zing = np.sin(phase(2400 * np.exp(-t / 0.15) + 300)) * np.exp(-t / 0.12) * 0.15
    return fades((snap + body + rumble + zing) * big, 0, 0.1)


def steam_chug(dur, r, rate=2.6):
    n = ns(dur)
    t = np.arange(n) / SR
    ph = (t * rate) % 1
    puff = np.exp(-ph / 0.08) * (0.6 + 0.4 * smooth_noise(n, r, 1.0))
    return lp(colored(n, r, 0.7), 500) * puff * 0.8 + lp(colored(n, r, 1.2), 90) * 0.5


def plane_pass(r, dur=2.6, t_close=1.0):
    n = ns(dur)
    t = np.arange(n) / SR
    dop = 1 + 0.07 * np.tanh((t_close - t) * 2.5)
    f0 = 95 * dop
    ph = phase(f0)
    y = np.zeros(n)
    for k in range(1, 16):
        y += np.sin(k * ph) / k ** 0.9
    y *= 0.6 + 0.4 * np.sin(phase(f0 * 2))
    y = lp(y, 2500) + 0.3 * bp(colored(n, r, 0.6), 400, 2500, 1)
    g = 1 / (1 + ((t - t_close) / 0.7) ** 2)
    return y * g


def seal_bloop(r):
    d = 0.5
    t = tt(d)
    f = 180 + 520 * (1 - np.exp(-t / 0.05))
    y = np.sin(phase(f)) * np.exp(-t / 0.09) * np.clip(t / 0.005, 0, 1)
    return y + lp(r.standard_normal(len(t)), 900) * np.exp(-t / 0.03) * 0.4


def dog_pant(dur, r, rate=3.2):
    n = ns(dur)
    t = np.arange(n) / SR
    g = np.maximum(0, np.sin(np.pi * ((t * rate) % 1))) ** 2
    return bp(colored(n, r, 0.4), 700, 3500, 1) * g * 0.5


def soft_thump(r, f=70, d=0.35):
    t = tt(d)
    return np.sin(phase(f * (1 + 0.4 * np.exp(-t / 0.02)))) * np.exp(-t / 0.07) + lp(r.standard_normal(len(t)), 300) * np.exp(-t / 0.03) * 0.5


def hull_knock(r):
    return modal(1.2, [(118, 1.0, 0.35), (233, 0.7, 0.25), (412, 0.45, 0.15), (680, 0.3, 0.08)], r) * 0.8


def belt_rattle(dur, r, rate=4.6):
    n = ns(dur)
    y = np.zeros(n)
    k = 0
    while k / rate < dur - 0.1:
        c = clink(r, r.uniform(1200, 2200), 0.08, 0.6) * 0.25
        i = ns(k / rate + r.uniform(-0.01, 0.01))
        y[i:i + len(c)] += c[: max(0, n - i)]
        k += 1
    return y + lp(colored(n, r, 1.0), 250) * 0.25


def sfx():
    r = rng(17)
    out = np.zeros((2, N))
    # --- wind beds (Arctic shots; the airport is indoors)
    wind = breeze(DUR, r, 1.0, 0.15, 800) * 0.32
    g = np.ones(N)
    a15, b15 = ST(15)
    g *= 1 - env_seg(N, a15, b15, 0.25, 0.25)
    storm = 0.9 * env_seg(N, 18.3, 20.6, 0.4, 0.9) + 0.6 * env_seg(N, *ST(12), 0.3, 0.3)
    out += wind * g[None, :] * (1 + 2.4 * storm[None, :])
    gust = breeze(DUR, rng(18), 1.0, 0.5, 2600) * 0.3
    out += gust * storm[None, :]
    cue(18.3, "blizzard roar", "wind x3.4, bright gusts")
    # --- footsteps in snow: crews walking
    def steps(t0, t1, people, rate=1.7, gain=0.5, p=0.0):
        for i in range(people):
            ph = r.uniform(0, 1 / rate)
            t = t0 + ph
            while t < t1:
                place(out, pan(snow_step(r, r.uniform(0.6, 1.0)), p + r.uniform(-0.4, 0.4)), t, gain / np.sqrt(people))
                t += 1 / rate * r.uniform(0.95, 1.05)
    steps(0.0, 5.9, 8, 1.6, 0.7)
    steps(29.3, 30.15, 5, 1.8, 0.6)
    steps(30.2, 31.75, 3, 1.4, 0.5, 0.3)
    steps(31.8, 34.3, 5, 1.6, 0.5)
    cue(0.0, "snow footsteps", "crew walking away")
    # --- hook: one distant ice groan under the bow shot
    place(out, widen(ice_creak(r, 1.6, 50, 80, 0.9), r) * 0.35, 3.3)
    # flash whoosh into the open sea
    place(out, widen(whoosh(0.8, r, 0.45), r) * 0.6, fr(177) - 0.45)
    # --- open sea: engine + bow wash
    a2, b2 = ST(2)[0], ST(3)[1]
    eng = steam_chug(b2 - a2, r)
    e = np.ones(len(eng))
    e[ns(fr(397) - a2):] *= np.exp(-np.arange(len(e) - ns(fr(397) - a2)) / SR / 0.15)
    place(out, st(eng * e) * 0.35, a2)
    wash = lp(colored(ns(b2 - a2), r, 0.8), 1600) * 0.25
    place(out, widen(wash * e, r), a2)
    place(out, pan(soft_thump(r, 90, 0.3), 0.2) * 0.5, W(29) + 0.05)  # fur bale dropped in the hatch insert
    cue(a2, "steam engine + bow wash", "stops on 'stuck'")
    # --- freeze: ice crackle closing in, then the jam
    for k in range(14):
        t = 10.4 + k * 0.2 + r.uniform(0, 0.12)
        place(out, pan(clink(r, r.uniform(1800, 4200), 0.1, 1.2), r.uniform(-0.7, 0.7)) * (0.12 + 0.03 * k), t)
    place(out, widen(ice_creak(r, 2.0, 55, 120), r) * 0.45, 11.2)
    place(out, st(ice_crack(r, 1.2)) * 0.8, fr(397) - 0.01)
    place(out, widen(creak(1.4, r, 40, 70, CHAIN, [(0, 1), (0.4, 0.8), (1, 0)], rough=0.2, noise=0.05), r) * 0.35, fr(397) + 0.05)
    cue(fr(397), "ice crack + hull groan", "STUCK")
    # --- the plane goes over
    place(out, pan(plane_pass(r, 2.8, 1.0), -0.2) * 0.55, 13.6)
    cue(13.6, "ski plane passes overhead")
    # --- hammer on the hut (cast.ts: hits when (t*1.9) % 1 crosses 0.66)
    n0 = int(np.ceil(fr(454) * 1.9 - 0.66))
    while (n0 + 0.66) / 1.9 < fr(545):
        place(out, pan(hammer_hit(r, 0.7), 0.3) * 0.5, (n0 + 0.66) / 1.9)
        n0 += 1
    cue(fr(454), "hammer on the hut", "every 0.53 s")
    # --- blizzard reveal: whoosh as the snow clears; 'gone' leaves only wind
    place(out, widen(whoosh(1.4, r, 0.9, 300, 1500, 1.0, 0.5), r) * 0.4, 19.6)
    # --- seal pops up
    place(out, pan(seal_bloop(r), 0.1) * 0.55, fr(748))
    place(out, pan(whoosh(0.5, r, 0.2, 600, 2600), 0.3) * 0.3, fr(771) - 0.15)
    cue(fr(748), "seal bloop")
    # --- 'forty-five miles away' long-lens zoom whoosh
    place(out, widen(whoosh(0.9, r, 0.6, 250, 1200), r) * 0.35, fr(784) - 0.6)
    # --- fur bales thumped down by the ladder
    for t in (30.45, 30.9, 31.3):
        place(out, pan(soft_thump(r, 80, 0.3), 0.3) * 0.4, t)
    # --- dogs panting, a sled creak
    a11, b11 = ST(11)
    place(out, pan(dog_pant(b11 - a11, r), 0.35) * 0.35, a11)
    place(out, pan(ice_creak(r, 2.4, 45, 70, 0.8), -0.3) * 0.35, 35.6)
    place(out, pan(dog_pant(fr(1734) - fr(1714), r), 0.2) * 0.3, fr(1714))
    # --- storm ladder creaks (1933)
    for t in (37.6, 38.2, 38.8):
        place(out, pan(creak(0.4, r, 300, 420, WOOD, [(0, 0), (0.4, 1), (1, 0)], rough=0.1, noise=0.02), 0.3) * 0.25, t)
    # porthole lights warm on: a soft lamp 'tink'
    place(out, pan(clink(r, 2600, 0.15, 0.5), 0.2) * 0.2, fr(1166))
    # --- 1939: flag planted, the ice heaves, he flies off
    place(out, pan(soft_thump(r, 140, 0.25), 0.2) * 0.4, W(163))
    place(out, st(ice_crack(r, 1.4)) * 0.85, fr(1320) - 0.01)
    place(out, st(timber_tear(r, 0.6)) * 0.35, fr(1320) + 0.05)
    place(out, pan(whoa(r, 120), 0.25) * 0.4, fr(1321) + 0.02)
    place(out, pan(soft_thump(r, 60, 0.4), 0.3) * 0.7, fr(1338))
    place(out, pan(oof(r, "oof", 115), 0.3) * 0.45, fr(1338) + 0.02)
    place(out, widen(bp(colored(ns(0.6), r, 0.5), 400, 5000, 1) * np.exp(-tt(0.6) / 0.15) * 0.6, r), fr(1338))
    cue(fr(1320), "ice heave crack, 'whoa', snow thump + oof")
    # --- aerial: slow grinding of the pack
    place(out, widen(ice_creak(r, 3.5, 35, 60, 1.0), r) * 0.35, 45.6)
    place(out, widen(ice_creak(r, 3.0, 40, 70, 1.1), r) * 0.3, 48.0)
    # --- airport: hall murmur + the belt
    a15, b15 = ST(15)
    hall = np.zeros((2, ns(b15 - a15) + 1))
    for v in range(7):
        bb = babble(b15 - a15, r, r.uniform(100, 220), r.uniform(0.9, 1.15), 4.0, 0.6)
        place(hall, pan(lp(bb, 2500), r.uniform(-0.8, 0.8)), 0, 0.12)
    hall = convolve_st(hall, make_ir(1.8, 9, hf=0.5))[:, : hall.shape[1]]
    eh = env_seg(hall.shape[1], 0, b15 - a15, 0.35, 0.35)
    place(out, hall * eh[None, :] * 0.8, a15)
    belt = belt_rattle(b15 - a15, r) * env_seg(ns(b15 - a15), 0, b15 - a15, 0.3, 0.3)
    place(out, pan(belt, 0.15) * 0.5, a15)
    cue(a15, "airport hall murmur + belt rattle")
    # --- the hull at the ice line: a solid knock ('sealed tight')
    place(out, pan(hull_knock(r), -0.2) * 0.55, fr(1699))
    # --- montage: whooshes on the cuts, the plane over
    for f in (1734, 1746):
        place(out, widen(whoosh(0.5, r, 0.3, 500, 2600), r) * 0.35, fr(f) - 0.3)
    place(out, pan(plane_pass(r, 1.6, 0.6), 0.3) * 0.4, fr(1745))
    # --- ending: ice groan, the dip and bob, crane-out whoosh
    place(out, widen(ice_creak(r, 2.0, 40, 65, 1.0), r) * 0.45, fr(1924))
    place(out, st(soft_thump(r, 50, 0.6)) * 0.6, fr(1950))
    place(out, widen(lp(colored(ns(1.2), r, 0.8), 1200) * np.exp(-tt(1.2) / 0.35) * 0.5, r), fr(1950))
    place(out, pan(clink(r, 900, 0.3, 0.4), 0) * 0.25, fr(1976))
    place(out, widen(whoosh(1.2, r, 0.6), r) * 0.35, fr(1956))
    cue(fr(1950), "dip + bob: thump + slosh")
    # gentle room reverb on the SFX
    wet = convolve_st(out, make_ir(0.9, 21, hf=0.5))[:, :N]
    return out + wet * 0.15


# ================================================================ mix
def limiter(x, ceil_db=-1.2):
    c = dbg(ceil_db)
    up = np.stack([np.interp(np.arange(len(ch) * 4) / 4, np.arange(len(ch)), ch) for ch in x])
    pk = np.max(np.abs(up), axis=0).reshape(-1, 4).max(axis=1)
    g = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    la = ns(0.003)
    g = np.minimum.accumulate(np.concatenate([g[la:], np.ones(la)])[::-1])[::-1] * 0 + g  # (no-op guard)
    # smooth gain: instant attack (min over look-ahead window), 80 ms release
    from scipy.ndimage import minimum_filter1d
    gm = minimum_filter1d(g, la * 2 + 1)
    out = np.empty_like(gm)
    rel = np.exp(-1 / (0.08 * SR))
    v = 1.0
    for i in range(len(gm)):
        v = gm[i] if gm[i] < v else gm[i] + (v - gm[i]) * rel
        out[i] = v
    return x * out[None, :]


def main():
    v, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
    assert sr == SR
    v = st(v)[:, :N]
    v = np.pad(v, ((0, 0), (0, N - v.shape[1])))
    m = music()
    s = sfx()
    # duck the music under speech (key = words.json), 3 dB, 80 ms attack / 250 ms release
    key = np.zeros(N)
    for w in WORDS:
        key[ns(w["s"]):ns(w["e"] + 0.05)] = 1
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    key = uniform_filter1d(maximum_filter1d(key, ns(0.18)), ns(0.12))
    m *= dbg(-3.0 * key)[None, :]
    Lv = integrated(v)
    Lm, Ls = integrated(m), integrated(s)
    gm = dbg((Lv - 10.0) - Lm)          # music bed -10 LU under the voice (+3 dB over the old -13 standard)
    gs = dbg((Lv - 8.0) - Ls - 6.0)     # SFX -6 dB from a -8 LU reference
    m *= gm
    s *= gs
    mix = v + m + s
    Lmix = integrated(mix)
    master = dbg(-15.0 - Lmix)
    mix *= master
    mix = limiter(mix, -1.2)
    mix = fades(mix, 0.0, 0.25) if mix.ndim == 1 else np.stack([fades(c, 0.0, 0.25) for c in mix])
    write_wav(os.path.join(OUT, "mix.wav"), mix, 24)
    write_wav(os.path.join(OUT, "stem_voice.wav"), v * master, 24)
    write_wav(os.path.join(OUT, "stem_music.wav"), m * master, 24)
    write_wav(os.path.join(OUT, "stem_sfx.wav"), s * master, 24)
    rep = [f"# Baychimo soundtrack cues ({DUR:.3f} s, {SR} Hz)", "",
           f"Loudness: voice {Lv:.1f} LUFS raw; music {integrated(m):.1f}; sfx {integrated(s):.1f}; mix {integrated(mix):.2f} LUFS integrated, "
           f"true peak {true_peak(mix):.2f} dBTP, master gain {20 * np.log10(master):+.1f} dB", "",
           "| t (s) | frame | event | note |", "|---|---|---|---|"]
    for t, n, note in sorted(CUES):
        rep.append(f"| {t:.2f} | {round(t * FPS)} | {n} | {note} |")
    open(os.path.join(OUT, "cues.md"), "w").write("\n".join(rep) + "\n")
    print("\n".join(rep[:3]))


if __name__ == "__main__":
    main()
