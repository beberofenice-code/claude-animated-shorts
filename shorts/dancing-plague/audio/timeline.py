# Picture timeline of "The Dancing Plague", mirrored read-only from src/videos/dancing/story.ts + cast.ts.
import json
FPS = 30
TOTAL = 2075
DUR = TOTAL / FPS                 # 69.1667 s
W = lambda f: f / FPS             # word / picture frame -> seconds
FLASH = W(158)
STEP_OUT, DANCE0 = 13.9, 14.83
HITS = [59.4, 59.9, 60.45]
COLLAPSE = [43.88, 44.25, 44.6]
STAGE_HITS = [h - 0.1 for h in (37.3, 37.75, 38.2, 38.65)]   # carpenter blows while shot 17 is on screen
wagonX = lambda t: 150 + 3.0 * (t - 60.5)
# id: (a, b, light, scene)
SHOTS = {1: (0, 158, "day", "square"), 2: (158, 258, "day", "aerial"), 3: (258, 321, "day", "bread"), 4: (321, 350, "day", "tired"),
         5: (350, 476, "day", "door"), 6: (476, 531, "day", "lane"), 7: (531, 586, "day", "husband"), 8: (586, 604, "day", "days"),
         9: (604, 622, "golden", "days"), 10: (622, 642, "day", "days"), 11: (642, 728, "day", "lane30"), 12: (728, 776, "day", "square"),
         13: (776, 843, "day", "hop"), 14: (843, 1000, "day", "doctors"), 15: (1000, 1065, "day", "doctors"), 16: (1065, 1118, "day", "hall"),
         17: (1118, 1157, "day", "stage"), 18: (1157, 1210, "day", "band"), 19: (1210, 1290, "day", "strong"), 20: (1290, 1343, "day", "collapse"),
         21: (1343, 1425, "golden", "yawnrow"), 22: (1425, 1513, "golden", "yawncu"), 23: (1513, 1585, "day", "fear"), 24: (1585, 1658, "day", "vitus"),
         25: (1658, 1724, "day", "spread"), 26: (1724, 1815, "day", "ban"), 27: (1815, 1884, "golden", "wagon"), 28: (1884, 1934, "golden", "shrine"),
         29: (1934, TOTAL, "golden", "shoes")}


def shot_t(i):
    a, b = SHOTS[i][:2]
    return W(a), W(b)


def troffea_steps(t0, t1, hz=1.15, start=DANCE0):
    """her dance: the planted foot changes at every half cycle (phase 0.25 at DANCE0)"""
    out, k = [], 1
    while True:
        t = start + (k * 0.5 - 0.25) / hz
        if t >= t1:
            return out
        if t >= t0:
            out.append(t)
        k += 1


def words(path):
    return json.load(open(path, encoding="utf-8"))
