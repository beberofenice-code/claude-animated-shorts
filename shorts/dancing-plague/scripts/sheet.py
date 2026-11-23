import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f) for f in files]
w, h = 270, 480
cols = min(5, len(ims)); rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * w, rows * (h + 18)), "white")
d = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * (h + 18)
    S.paste(im.resize((w, h)), (x, y + 18)); d.text((x + 4, y + 2), f.split("/")[-1], fill="black")
S.save(out, quality=88)
