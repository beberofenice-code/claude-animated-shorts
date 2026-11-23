# Trims long pauses in raw.wav -> voice.wav and writes the raw->trimmed time map (trim_map.json)
import numpy as np, scipy.io.wavfile as w, json
sr,x=w.read('raw.wav'); x=x.astype(np.float32)/32768
win=int(sr*0.01); n=len(x)//win
db=20*np.log10(np.sqrt((x[:n*win].reshape(n,win)**2).mean(1))+1e-9); quiet=db<-40
segs=[];i=0
while i<n:
  if quiet[i]:
    j=i
    while j<n and quiet[j]: j+=1
    if j-i>=20: segs.append((i*win,j*win))
    i=j
  else: i+=1
CAP=int(0.28*sr); pieces=[]; prev=0
for a,b in segs:
  pieces.append((prev,a)); k=min(b-a,CAP); pieces.append((a,a+k//2)); pieces.append((b-(k-k//2),b)); prev=b
pieces.append((prev,len(x)))
st=np.argmax(np.abs(x)>0.003)-int(0.02*sr); lead=int(0.15*sr)
# map: list of (raw_start, raw_end, out_start)
m=[];o=lead;out=[np.zeros(lead,np.float32)]
for a,b in pieces:
  a=max(a,st)
  if b<=a: continue
  m.append((a/sr,b/sr,o/sr)); out.append(x[a:b]); o+=b-a
y=np.concatenate(out)
end=len(y)-np.argmax(np.abs(y[::-1])>0.003)
y=np.concatenate([y[:end+int(0.05*sr)],np.zeros(int(0.6*sr),np.float32)])
w.write('voice.wav',sr,(np.clip(y,-1,1)*32767).astype(np.int16))
json.dump({"map":m,"dur":len(y)/sr},open('trim_map.json','w'))
print(len(y)/sr)
