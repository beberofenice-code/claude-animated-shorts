# Final mix of the pelikula short: the ElevenLabs voice (gain only) + original score (ducked -3 dB under speech, each
# section held ~10 LU under the voice; standard: music +3 dB, SFX -6 dB, voice unchanged) + synthesized SFX stem.
# Master to -15 LUFS integrated with a 4x-oversampled look-ahead limiter (<= -1.2 dBTP), exactly 70.000 s / 48 kHz / stereo.
import os, json, time
import numpy as np
from scipy import ndimage, signal
from dsp import SR, ns, st, dbg, read_wav, write_wav, integrated, true_peak, lra, fades

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DUR = 70.0
N = ns(DUR)
TARGET_LUFS = -15.0
CEIL_DBTP = -1.2
DUCK_DB = -3.0
MUSIC_UNDER = -13.0 + 3.0     # music sits 10 LU under the voice (the "+3 dB music" standard on a -13 base)
SFX_UNDER = -8.0 - 6.0        # SFX 14 LU under the voice ("SFX -6 dB" on a -8 base)

def log(*a): print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)
def lufs(x):
    v = integrated(x); return v if np.isfinite(v) else -99.0

def limiter(x, ceil_db=CEIL_DBTP, look=0.003, rel=0.08):
    """4x-oversampled peak detection, look-ahead min filter, release one-pole, centred smoothing -> gain curve"""
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    g2 = g1.copy()
    idx = np.flatnonzero(g1 < 1.0)
    if len(idx):
        # one-pole release, run only over clusters of reduced samples (elsewhere the gain is 1)
        kr = 1 - np.exp(-1 / (rel * SR))
        gap = ns(rel * 8)
        brk = np.flatnonzero(np.diff(idx) > gap)
        starts = np.concatenate([[idx[0]], idx[brk + 1]])
        ends = np.concatenate([idx[brk], [idx[-1]]])
        for a, b_ in zip(starts, ends):
            e = min(n, b_ + gap)
            seg = g1[a:e]
            out = np.empty(len(seg))
            g = 1.0
            for k in range(len(seg)):
                g = min(seg[k], g + (1 - g) * kr)
                out[k] = g
            g2[a:e] = out
    g3 = ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest")
    g3 = np.minimum(g3, 1.0)
    return x * g3[None, :], g3



def main():
    words = json.load(open(os.path.join(ROOT, "voice", "words.json")))
    x, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav")); assert sr == SR
    v1 = x[0] if x.shape[0] == 1 else x.mean(0)
    vv = np.zeros(N); vv[: min(N, len(v1))] = v1[:N]
    v = st(vv)
    vL = lufs(v); log(f"voice {vL:.2f} LUFS")
    # speech spans -> duck curve
    spans = []
    for w in words:
        s, e = w["s"], w["e"]
        if spans and s - spans[-1][1] < 0.3: spans[-1][1] = max(spans[-1][1], e)
        else: spans.append([s, e])
    ctrl = 1000; nc = int(DUR * ctrl) + 2; va = np.zeros(nc)
    for s, e in spans: va[max(0, int((s - 0.08) * ctrl)): int((e + 0.12) * ctrl)] = 1
    ka, kr = 1 - np.exp(-1 / (0.07 * ctrl)), 1 - np.exp(-1 / (0.45 * ctrl)); env = np.zeros(nc); g = 0.0
    for i in range(nc): g += (va[i] - g) * (ka if va[i] > g else kr); env[i] = g
    duck = np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, DUCK_DB * env)
    import music
    m = music.render(music.build()) * dbg(duck)[None, :]
    # per-section level: music held MUSIC_UNDER LU under the voice in that section
    curve = np.zeros(N)
    for name, a, b, _ in music.SECTIONS:
        sl = slice(ns(a), ns(b)); Lm, Lv = lufs(m[:, sl]), lufs(v[:, sl])
        gdb = (Lv + MUSIC_UNDER - Lm) if Lm > -90 and Lv > -90 else 0.0
        if name in ("japan", "deadpan", "hot", "vote"): gdb -= 2.0
        curve[sl] = gdb
    curve = ndimage.uniform_filter1d(curve, ns(0.3), mode="nearest")
    m = m * dbg(curve)[None, :]
    m[:, ns(DUR - 0.6):] *= np.linspace(1, 0, N - ns(DUR - 0.6))[None, :]
    import sfx
    s_ = sfx.render()
    s_ = s_ * dbg(vL + SFX_UNDER - lufs(s_))
    log(f"music {lufs(m):.2f} LUFS, sfx {lufs(s_):.2f} LUFS")
    mix0 = v + m + s_
    G = TARGET_LUFS - lufs(mix0)
    for it in range(6):
        y, g3 = limiter(mix0 * dbg(G)); L = lufs(y)
        log(f"master iter {it}: gain {G:+.2f} -> {L:.2f} LUFS, TP {true_peak(y):.2f}")
        if abs(L - TARGET_LUFS) < 0.03: break
        G += TARGET_LUFS - L
    y = fades(y, 0.0, 0.05)
    write_wav(os.path.join(HERE, "mix.wav"), y)
    for nm, xx in (("voice", v), ("music", m), ("sfx", s_)): write_wav(os.path.join(HERE, f"stem_{nm}.wav"), xx * dbg(G))
    log(json.dumps(dict(I=round(lufs(y), 2), TP=round(true_peak(y), 2), LRA=round(lra(y), 2), voice=round(lufs(v * dbg(G)), 2), music=round(lufs(m * dbg(G)), 2), sfx=round(lufs(s_ * dbg(G)), 2))))

if __name__ == "__main__":
    main()
