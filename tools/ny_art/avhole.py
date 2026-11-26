import numpy as np, json
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
KEYS = ['ny-snow', 'ny-tale', 'ny-cabin', 'ny-gifts', 'ny-crystal', 'ny-aurora']
res = {}
cv = Image.new('RGBA', (6 * 330, 330), (14, 10, 34, 255))
for i, k in enumerate(KEYS):
    im = Image.open(f'fr/{k}.png'); a = np.asarray(im)[..., 3] / 255; S = a.shape[0]
    free = a < 0.5
    lab, n = ndimage.label(free)
    c = lab[S // 2, S // 2]
    if c == 0:  # centre sits on something: take the label of the biggest free blob near the centre
        c = np.bincount(lab[S//3:2*S//3, S//3:2*S//3].ravel())[1:].argmax() + 1
    hole = lab == c
    if hole[0].any() or hole[-1].any() or hole[:, 0].any() or hole[:, -1].any():
        print(k, 'LEAKS to the edge')
    hole = ndimage.binary_fill_holes(hole)
    hole = ndimage.binary_dilation(hole, iterations=5)  # tuck the photo under the ring
    ys, xs = np.where(hole)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    res[k] = {'x': round(x0 / S, 4), 'y': round(y0 / S, 4), 'w': round((x1 - x0) / S, 4), 'h': round((y1 - y0) / S, 4)}
    m = Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)).crop((x0, y0, x1, y1))
    mask = Image.new('RGBA', m.size, (255, 255, 255, 0)); mask.putalpha(m)
    mask.save(f'fr/{k}-hole.png')
    # preview with a fake photo
    ph = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(ph)
    d.rectangle((0, 0, S, S), fill=(200, 120, 90, 255)); d.ellipse((S*.38, S*.25, S*.62, S*.5), fill=(240, 200, 170, 255))
    full = Image.new('L', (S, S), 0); full.paste(m, (x0, y0))
    ph.putalpha(full); ph.alpha_composite(im)
    cv.alpha_composite(ph, (i * 330, 5))
cv.save('avhole.png'); print(json.dumps(res))
