# compress pauses > 0.40 s down to 0.40 s (cut from the middle of the gap), remap word timings; 0.30 s lead-in, 0.8 s tail
import json, subprocess, numpy as np, soundfile as sf
subprocess.run(["ffmpeg","-y","-v","error","-i","raw.mp3","-ac","1","-ar","48000","raw.wav"],check=True)
x, sr = sf.read("raw.wav")
W = [w for w in json.load(open("words_raw.json"))["words"] if w.get("type","word")=="word"]
MAX=0.40
segs=[]  # (src_start, src_end)
cur=0.0
for a,b in zip(W,W[1:]):
    g=b["start"]-a["end"]
    if g>MAX:
        mid=(a["end"]+b["start"])/2
        segs.append((cur, a["end"]+MAX/2)); cur=b["start"]-MAX/2
segs.append((cur, W[-1]["end"]+0.25))
segs[0]=(max(0,W[0]["start"]-0.05), segs[0][1])
lead=0.30
fade=int(0.01*sr)
out=[np.zeros(int(lead*sr))]; maps=[]; t=lead
for s,e in segs:
    c=x[int(s*sr):int(e*sr)].copy(); c[:fade]*=np.linspace(0,1,fade); c[-fade:]*=np.linspace(1,0,fade)
    maps.append((s,e,t)); out.append(c); t+=len(c)/sr
out.append(np.zeros(int(0.8*sr)))
y=np.concatenate(out); sf.write("voice.wav",y,sr,subtype="PCM_16")
def m(v):
    for s,e,t0 in maps:
        if s-1e-6<=v<=e+1e-6: return round(t0+v-s,3)
    raise ValueError(v)
words=[{"w":w["text"],"s":m(w["start"]),"e":m(w["end"])} for w in W]
json.dump(words,open("words.json","w"),indent=0)
print("dur",len(y)/sr,"words",len(words))
